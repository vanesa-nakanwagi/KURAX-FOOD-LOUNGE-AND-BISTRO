import pg from 'pg';

const { Client } = pg;
const client = new Client({ connectionString: 'postgresql://postgres:mysql@localhost:5432/kurax_db' });

try {
  await client.connect();

  const result = await client.query(`
    SELECT 'orders' AS table_name, COUNT(*) AS row_count FROM public.orders
    UNION ALL
    SELECT 'credits', COUNT(*) FROM public.credits
    UNION ALL
    SELECT 'staff_shifts', COUNT(*) FROM public.staff_shifts
    UNION ALL
    SELECT 'cashier_queue', COUNT(*) FROM public.cashier_queue
    UNION ALL
    SELECT 'menus', COUNT(*) FROM public.menus
    UNION ALL
    SELECT 'events', COUNT(*) FROM public.events
    UNION ALL
    SELECT 'monthly_targets', COUNT(*) FROM public.monthly_targets
    UNION ALL
    SELECT 'staff', COUNT(*) FROM public.staff;
  `);

  console.log(JSON.stringify(result.rows, null, 2));
} finally {
  await client.end();
}
