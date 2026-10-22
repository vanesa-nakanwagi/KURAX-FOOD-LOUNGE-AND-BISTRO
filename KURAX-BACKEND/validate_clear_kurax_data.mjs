import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(backendDirectory, '..', '.env') });
dotenv.config({ path: path.join(backendDirectory, '.env') });
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not configured.');
}

const preservedTables = ['staff', 'menus', 'events', 'combos', 'monthly_targets'];
const isLocalDb =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1') ||
  connectionString.includes('@database:');
const client = new Client({
  connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();

  const target = await client.query('SELECT current_database() AS database');
  if (target.rows[0].database !== 'kurax_db') {
    throw new Error(`Unexpected database: ${target.rows[0].database}`);
  }

  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const counts = [];
  for (const { table_name: tableName } of tables.rows) {
    const quotedTableName = `"${tableName.replaceAll('"', '""')}"`;
    const result = await client.query(
      `SELECT COUNT(*)::bigint AS row_count FROM public.${quotedTableName};`,
    );
    counts.push({ table_name: tableName, row_count: result.rows[0].row_count });
  }

  const missingPreservedTables = preservedTables.filter(
    (tableName) => !counts.some((table) => table.table_name === tableName),
  );
  if (missingPreservedTables.length > 0) {
    throw new Error(`Required preserved tables are missing: ${missingPreservedTables.join(', ')}`);
  }

  const unclearedTables = counts.filter(
    ({ table_name: tableName, row_count: rowCount }) =>
      !preservedTables.includes(tableName) && rowCount !== '0',
  );
  if (unclearedTables.length > 0) {
    throw new Error(`Rows remain in tables that should be empty: ${JSON.stringify(unclearedTables)}`);
  }

  console.log(`Verified database: ${target.rows[0].database}`);
  console.log(JSON.stringify(counts, null, 2));
} finally {
  await client.end();
}
