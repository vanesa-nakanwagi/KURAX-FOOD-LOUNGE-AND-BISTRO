import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
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

const sql = fs.readFileSync(path.resolve(backendDirectory, '..', 'clear_data.sql'), 'utf8');
const preservedTables = ['staff', 'menus', 'events', 'combos', 'monthly_targets'];
const isLocalDb =
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1') ||
  connectionString.includes('@database:');
const client = new Client({
  connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});
let transactionStarted = false;

async function getPublicTableCounts() {
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const counts = new Map();
  for (const { table_name: tableName } of tables.rows) {
    const quotedTableName = `"${tableName.replaceAll('"', '""')}"`;
    const result = await client.query(
      `SELECT COUNT(*)::bigint AS row_count FROM public.${quotedTableName};`,
    );
    counts.set(tableName, result.rows[0].row_count);
  }
  return counts;
}

try {
  await client.connect();

  const target = await client.query('SELECT current_database() AS database');
  if (target.rows[0].database !== 'kurax_db') {
    throw new Error(`Refusing to clear unexpected database: ${target.rows[0].database}`);
  }

  await client.query('BEGIN');
  transactionStarted = true;
  const countsBefore = await getPublicTableCounts();
  await client.query(sql);
  const countsAfter = await getPublicTableCounts();

  for (const tableName of preservedTables) {
    if (!countsBefore.has(tableName) || !countsAfter.has(tableName)) {
      throw new Error(`Required preserved table is missing: ${tableName}`);
    }
    if (countsBefore.get(tableName) !== countsAfter.get(tableName)) {
      throw new Error(`Row count changed in preserved table: ${tableName}`);
    }
  }

  const unclearedTables = [...countsAfter].filter(
    ([tableName, rowCount]) => !preservedTables.includes(tableName) && rowCount !== '0',
  );
  if (unclearedTables.length > 0) {
    throw new Error(`Rows remain in tables that should be empty: ${JSON.stringify(unclearedTables)}`);
  }

  await client.query('COMMIT');
  transactionStarted = false;
  const countsAfterCommit = await getPublicTableCounts();
  const repopulatedTables = [...countsAfterCommit].filter(
    ([tableName, rowCount]) => !preservedTables.includes(tableName) && rowCount !== '0',
  );
  if (repopulatedTables.length > 0) {
    throw new Error(
      `Rows reappeared after cleanup committed: ${JSON.stringify(repopulatedTables)}`,
    );
  }

  console.log('Cleanup completed for database:', target.rows[0].database);
  console.log(
    'Preserved table row counts:',
    Object.fromEntries(
      preservedTables.map((tableName) => [tableName, countsAfterCommit.get(tableName)]),
    ),
  );
  console.log('All other public tables are empty.');
} catch (error) {
  if (transactionStarted) {
    await client.query('ROLLBACK');
  }
  throw error;
} finally {
  await client.end();
}
