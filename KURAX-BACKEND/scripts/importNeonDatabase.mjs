import 'dotenv/config';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';

const { Pool } = pg;
const sourceConnectionString = process.env.SOURCE_DATABASE_URL || process.env.NEON_DATABASE_URL;
const targetConnectionString = process.env.DATABASE_URL;

if (!sourceConnectionString) {
  throw new Error('SOURCE_DATABASE_URL (or NEON_DATABASE_URL) is required for the one-time database import.');
}

if (!targetConnectionString) {
  throw new Error('DATABASE_URL must point to the local PostgreSQL database.');
}

function parseConnectionString(connectionString, label) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`${label} must be a valid PostgreSQL connection URL.`);
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${label} must use the PostgreSQL protocol.`);
  }

  const password = decodeURIComponent(url.password);
  url.password = '';
  return { url, password };
}

const source = parseConnectionString(sourceConnectionString, 'SOURCE_DATABASE_URL');
const target = parseConnectionString(targetConnectionString, 'DATABASE_URL');
const localHosts = new Set(['database', 'localhost', '127.0.0.1', '::1']);

if (!localHosts.has(target.url.hostname.toLowerCase())) {
  throw new Error('DATABASE_URL must point to the local PostgreSQL database or Compose database service.');
}

if (/(^|-)pooler(?=\.|$)/i.test(source.url.hostname)) {
  throw new Error('Use Neon’s direct (non-pooled) connection URL in NEON_DATABASE_URL for a complete database dump.');
}

const databaseIdentity = (url) =>
  `${url.hostname.toLowerCase()}:${url.port || '5432'}${decodeURIComponent(url.pathname)}`;

if (databaseIdentity(source.url) === databaseIdentity(target.url)) {
  throw new Error('Source and target database URLs must point to different databases.');
}

const targetPool = new Pool({ connectionString: targetConnectionString });
const sourcePool = new Pool({ connectionString: sourceConnectionString });
const quoteIdentifier = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;
const qualifiedName = (schema, name) => `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;

function environmentFor(password) {
  return { ...process.env, PGPASSWORD: password };
}

function waitForSuccessfulExit(child, name) {
  return once(child, 'close').then(([code, signal]) => {
    if (code !== 0) {
      throw new Error(`${name} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`);
    }
  });
}

async function dumpAndRestore() {
  const dump = spawn(
    process.env.PG_DUMP_PATH || 'pg_dump',
    [
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--snapshot',
      source.snapshot,
      '--dbname',
      source.url.toString(),
    ],
    { env: environmentFor(source.password), stdio: ['ignore', 'pipe', 'inherit'] }
  );
  const restore = spawn(
    process.env.PG_RESTORE_PATH || 'pg_restore',
    [
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '--no-acl',
      '--dbname',
      target.url.toString(),
    ],
    { env: environmentFor(target.password), stdio: ['pipe', 'ignore', 'inherit'] }
  );
  const dumpExit = waitForSuccessfulExit(dump, 'pg_dump');
  const restoreExit = waitForSuccessfulExit(restore, 'pg_restore');

  try {
    await pipeline(dump.stdout, restore.stdin);
    await Promise.all([dumpExit, restoreExit]);
  } catch (error) {
    dump.kill();
    restore.kill();
    await Promise.allSettled([dumpExit, restoreExit]);
    throw error;
  }
}

async function getTables(pool) {
  const result = await pool.query(`
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_%'
      AND c.relkind IN ('r', 'p')
    ORDER BY n.nspname, c.relname
  `);
  return result.rows;
}

async function getTableRowCount(pool, schema, table) {
  const result = await pool.query(
    `SELECT count(*)::text AS row_count FROM ${qualifiedName(schema, table)}`
  );
  return result.rows[0].row_count;
}

async function importDatabase() {
  const existingObjects = await targetPool.query(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_%'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      UNION ALL
      SELECT 1
      FROM pg_namespace n
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'public')
        AND n.nspname NOT LIKE 'pg_%'
      UNION ALL
      SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_%'
        AND t.typtype IN ('d', 'e', 'r')
      UNION ALL
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_%'
      UNION ALL
      SELECT 1 FROM pg_extension WHERE extname <> 'plpgsql'
    ) AS has_objects
  `);

  if (existingObjects.rows[0].has_objects) {
    throw new Error('The local database is not empty. Refusing to overwrite existing database objects.');
  }

  const sourceClient = await sourcePool.connect();
  let transactionOpen = false;
  try {
    await sourceClient.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    transactionOpen = true;

    const sourceTables = await getTables(sourceClient);
    if (sourceTables.length === 0) {
      throw new Error('The source database has no user tables; refusing to import an empty source.');
    }

    const sourceRowCounts = new Map();
    for (const { schema_name: schema, table_name: table } of sourceTables) {
      sourceRowCounts.set(
        JSON.stringify([schema, table]),
        await getTableRowCount(sourceClient, schema, table)
      );
    }

    const snapshotResult = await sourceClient.query('SELECT pg_export_snapshot() AS snapshot');
    source.snapshot = snapshotResult.rows[0].snapshot;
    await dumpAndRestore();

    const targetTables = await getTables(targetPool);
    if (JSON.stringify(sourceTables) !== JSON.stringify(targetTables)) {
      throw new Error('Schema verification failed: source and local table lists differ.');
    }

    let totalRows = 0n;
    for (const { schema_name: schema, table_name: table } of sourceTables) {
      const sourceRows = sourceRowCounts.get(JSON.stringify([schema, table]));
      const targetRows = await getTableRowCount(targetPool, schema, table);
      if (sourceRows !== targetRows) {
        throw new Error(`Row count verification failed for ${schema}.${table}.`);
      }
      totalRows += BigInt(sourceRows);
    }

    await sourceClient.query('COMMIT');
    transactionOpen = false;
    console.log(
      `Imported ${sourceTables.length} tables and ${totalRows.toString()} rows; schema and row counts verified.`
    );
  } finally {
    try {
      if (transactionOpen) {
        await sourceClient.query('ROLLBACK');
      }
    } finally {
      sourceClient.release();
    }
  }
}

try {
  await importDatabase();
} finally {
  await Promise.all([sourcePool.end(), targetPool.end()]);
}
