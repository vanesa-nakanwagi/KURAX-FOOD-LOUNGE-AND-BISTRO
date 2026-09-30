import fs from 'fs';
import pg from 'pg';

const { Client } = pg;
const connectionString = 'postgresql://postgres:mysql@localhost:5432/kurax_db';
const sql = fs.readFileSync('../clear_data.sql', 'utf8');

const client = new Client({ connectionString });

try {
  await client.connect();

  const preservedBefore = await client.query(`
    SELECT 'menus' AS table_name, COUNT(*) AS row_count FROM public.menus
    UNION ALL
    SELECT 'events', COUNT(*) FROM public.events
    UNION ALL
    SELECT 'monthly_targets', COUNT(*) FROM public.monthly_targets
    UNION ALL
    SELECT 'staff', COUNT(*) FROM public.staff;
  `);

  console.log('Before cleanup:', preservedBefore.rows);

  await client.query(sql);

  const preservedAfter = await client.query(`
    SELECT 'menus' AS table_name, COUNT(*) AS row_count FROM public.menus
    UNION ALL
    SELECT 'events', COUNT(*) FROM public.events
    UNION ALL
    SELECT 'monthly_targets', COUNT(*) FROM public.monthly_targets
    UNION ALL
    SELECT 'staff', COUNT(*) FROM public.staff;
  `);

  console.log('After cleanup:', preservedAfter.rows);

  const remainingTables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log('Remaining public tables:', remainingTables.rows.map((row) => row.table_name));
} finally {
  await client.end();
}
