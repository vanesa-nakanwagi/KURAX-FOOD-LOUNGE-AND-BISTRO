import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const sourceConn = 'postgresql://postgres:mysql@localhost:5432/kurax_db';
const targetConn = process.env.DATABASE_URL;

if (!targetConn) {
  throw new Error('DATABASE_URL is not configured.');
}

const source = new Client({ connectionString: sourceConn });
const target = new Client({ connectionString: targetConn });

function sqlTypeFromColumn(col) {
  const type = col.data_type;
  const udtName = col.udt_name || '';

  if (type === 'integer' || udtName === 'int4') return 'integer';
  if (type === 'bigint' || udtName === 'int8') return 'bigint';
  if (type === 'smallint' || udtName === 'int2') return 'smallint';
  if (type === 'boolean' || udtName === 'bool') return 'boolean';
  if (type === 'numeric' || udtName === 'numeric') {
    return col.numeric_precision == null
      ? 'numeric'
      : `numeric(${col.numeric_precision}, ${col.numeric_scale ?? 0})`;
  }
  if (type === 'real' || udtName === 'float4') return 'real';
  if (type === 'double precision' || udtName === 'float8') return 'double precision';
  if (type === 'character varying' || type === 'varchar' || udtName === 'varchar') {
    return col.character_maximum_length == null
      ? 'character varying'
      : `character varying(${col.character_maximum_length})`;
  }
  if (type === 'character' || udtName === 'bpchar') {
    return `character(${col.character_maximum_length ?? 1})`;
  }
  if (type === 'text' || udtName === 'text') return 'text';
  if (type === 'date') return 'date';
  if (type === 'time without time zone') return 'time without time zone';
  if (type === 'time with time zone') return 'time with time zone';
  if (type === 'timestamp without time zone') return 'timestamp without time zone';
  if (type === 'timestamp with time zone') return 'timestamp with time zone';
  if (type === 'json') return 'json';
  if (type === 'jsonb' || udtName === 'jsonb') return 'jsonb';
  if (type === 'ARRAY') {
    const base = udtName.replace(/^_/, '');
    return `${base}[]`;
  }

  return udtName || type || 'text';
}

async function getTables(client) {
  const result = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;"
  );
  return result.rows.map((row) => row.table_name);
}

async function getColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name = $1
     ORDER BY ordinal_position;`,
    [tableName]
  );
  return result.rows;
}

async function getPrimaryKeys(client, tableName) {
  const result = await client.query(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.table_name = $1
       AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position;`,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function generateCreateTableSql(client, tableName) {
  const columns = await getColumns(client, tableName);
  if (!columns.length) return null;

  const primaryKeys = await getPrimaryKeys(client, tableName);
  const columnDefs = columns.map((col) => {
    let out = `"${col.column_name}" ${sqlTypeFromColumn(col)}`;
    if (col.is_nullable === 'NO') out += ' NOT NULL';
    if (col.column_default && col.column_default !== 'NULL') {
      out += ` DEFAULT ${col.column_default}`;
    }
    return out;
  });

  if (primaryKeys.length) {
    columnDefs.push(`PRIMARY KEY (${primaryKeys.map((key) => `"${key}"`).join(', ')})`);
  }

  return `CREATE TABLE IF NOT EXISTS public."${tableName}" (\n${columnDefs.join(',\n')}\n);`;
}

async function migrate() {
  console.log('Connecting to source local DB...');
  await source.connect();

  console.log('Connecting to Neon target DB...');
  await target.connect();

  const existingTables = await target.query(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
  );
  if (Number(existingTables.rows[0].count) > 0) {
    throw new Error('Target public schema is not empty; refusing to replace it.');
  }

  console.log('Resetting target schema...');
  await target.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await target.query('CREATE SCHEMA public;');

  const extensions = await source.query(`
    SELECT extname
    FROM pg_extension
    WHERE extname <> 'plpgsql'
    ORDER BY extname;
  `);

  for (const row of extensions.rows) {
    console.log(`Creating extension: ${row.extname}`);
    await target.query(`CREATE EXTENSION IF NOT EXISTS ${quoteIdentifier(row.extname)};`);
  }

  const tables = await getTables(source);
  console.log(`Found ${tables.length} source tables.`);

  const sequenceRows = await source.query(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default LIKE 'nextval(%'
    ORDER BY table_name, ordinal_position;
  `);

  for (const row of sequenceRows.rows) {
    const match = row.column_default.match(/nextval\('([^']+)'/);
    if (!match) continue;
    const seqName = match[1];
    console.log(`Creating sequence: ${seqName}`);
    await target.query(`CREATE SEQUENCE IF NOT EXISTS public."${seqName.split('"').join('')}";`);
  }

  for (const table of tables) {
    const ddl = await generateCreateTableSql(source, table);
    if (!ddl) continue;
    console.log(`Creating target table: ${table}`);
    await target.query(ddl);
  }

  for (const row of sequenceRows.rows) {
    const match = row.column_default.match(/nextval\('([^']+)'/);
    if (!match) continue;
    const seqName = match[1].split('.').at(-1);
    await target.query(
      `ALTER SEQUENCE public.${quoteIdentifier(seqName)} OWNED BY public.${quoteIdentifier(row.table_name)}.${quoteIdentifier(row.column_name)};`
    );
  }

  for (const table of tables) {
    const columns = await getColumns(source, table);
    if (!columns.length) continue;

    const rows = await source.query(`SELECT * FROM public."${table}";`);
    if (!rows.rows.length) {
      console.log(`Skipping empty table: ${table}`);
      continue;
    }

    console.log(`Migrating ${table} (${rows.rows.length} rows)`);
    const insertSql = `INSERT INTO public."${table}" (${columns.map((col) => `"${col.column_name}"`).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')});`;

    for (const row of rows.rows) {
      const values = columns.map((col) => row[col.column_name]);
      await target.query(insertSql, values);
    }
  }

  const sequenceStates = await source.query(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_default LIKE 'nextval(%'
    ORDER BY c.table_name, c.ordinal_position;
  `);

  for (const row of sequenceStates.rows) {
    const match = row.column_default.match(/nextval\('([^']+)'/);
    if (!match) continue;
    const sequenceName = match[1].split('.').at(-1);
    const maxResult = await source.query(
      `SELECT MAX(${quoteIdentifier(row.column_name)}) AS max_id FROM public.${quoteIdentifier(row.table_name)};`
    );
    const sourceSequence = await source.query(
      'SELECT last_value FROM pg_sequences WHERE schemaname = $1 AND sequencename = $2;',
      ['public', sequenceName]
    );
    const maxId = maxResult.rows[0].max_id == null ? 0 : Number(maxResult.rows[0].max_id);
    const sequenceValue = sourceSequence.rows[0]?.last_value == null
      ? 0
      : Number(sourceSequence.rows[0].last_value);
    const lastValue = Math.max(maxId, sequenceValue);
    await target.query(
      'SELECT setval($1::regclass, $2, $3);',
      [`public.${sequenceName}`, lastValue || 1, lastValue > 0]
    );
  }

  const constraints = await source.query(`
    SELECT c.relname AS table_name, con.conname AS constraint_name,
           pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND con.contype IN ('f', 'u', 'c', 'x')
    ORDER BY c.relname, con.conname;
  `);

  for (const row of constraints.rows) {
    await target.query(
      `ALTER TABLE public.${quoteIdentifier(row.table_name)} ADD CONSTRAINT ${quoteIdentifier(row.constraint_name)} ${row.definition};`
    );
  }

  const indexes = await source.query(`
    SELECT i.indexdef
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint con
        JOIN pg_class idx ON idx.oid = con.conindid
        JOIN pg_namespace n ON n.oid = idx.relnamespace
        WHERE n.nspname = i.schemaname
          AND idx.relname = i.indexname
      )
    ORDER BY i.tablename, i.indexname;
  `);

  for (const row of indexes.rows) {
    await target.query(row.indexdef);
  }

  const functions = await source.query(`
    SELECT pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND l.lanname IN ('sql', 'plpgsql')
    ORDER BY p.proname;
  `);

  for (const row of functions.rows) {
    await target.query(row.definition);
  }

  const views = await source.query(`
    SELECT viewname, definition
    FROM pg_views
    WHERE schemaname = 'public'
    ORDER BY viewname;
  `);

  for (const row of views.rows) {
    await target.query(
      `CREATE VIEW public.${quoteIdentifier(row.viewname)} AS ${row.definition}`
    );
  }

  const triggers = await source.query(`
    SELECT c.relname AS table_name, pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname;
  `);

  for (const row of triggers.rows) {
    await target.query(row.definition);
  }

  const targetTables = await getTables(target);
  console.log('Target tables:', targetTables.join(', '));

  const preservedCounts = await target.query(`
    SELECT 'menus' AS table_name, COUNT(*) AS row_count FROM public.menus
    UNION ALL
    SELECT 'events', COUNT(*) FROM public.events
    UNION ALL
    SELECT 'monthly_targets', COUNT(*) FROM public.monthly_targets
    UNION ALL
    SELECT 'staff', COUNT(*) FROM public.staff;
  `);

  console.log('Preserved table counts:', preservedCounts.rows);

  await source.end();
  await target.end();
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
