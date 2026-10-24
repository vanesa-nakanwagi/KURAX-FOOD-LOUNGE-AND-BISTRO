const STATIONS = {
  kitchen: {
    table: 'kitchen_tickets',
    matches: (station) => !['bar', 'barman', 'barista', 'shisha'].includes(station),
    sqlMatch: "LOWER(COALESCE(NULLIF(BTRIM(expanded.item->>'station'), ''), 'kitchen')) NOT IN ('bar', 'barman', 'barista', 'shisha')",
  },
  bar: {
    table: 'barman_tickets',
    matches: (station) => ['bar', 'barman'].includes(station),
    sqlMatch: "LOWER(BTRIM(expanded.item->>'station')) IN ('bar', 'barman')",
  },
  barista: {
    table: 'barista_tickets',
    matches: (station) => station === 'barista',
    sqlMatch: "LOWER(BTRIM(expanded.item->>'station')) = 'barista'",
  },
};

function parseItems(items) {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getRoutableItemsForStation(items, stationKey) {
  const station = STATIONS[stationKey];
  if (!station) throw new Error(`Unknown station: ${stationKey}`);

  return parseItems(items)
    .map((item, index) => ({ ...item, _orderItemIndex: index }))
    .filter((item) => item.payment_confirmed === true || item.station_routing_requested === true)
    .filter((item) => station.matches(String(item.station || (stationKey === 'kitchen' ? 'kitchen' : '')).trim().toLowerCase()));
}

export async function syncRoutableStationTickets(queryable, stationKey) {
  const station = STATIONS[stationKey];
  if (!station) throw new Error(`Unknown station: ${stationKey}`);

  await queryable.query(
    `INSERT INTO public.${station.table} AS ticket
       (order_id, table_name, staff_name, staff_role, items, total, status, ticket_date)
     SELECT o.id, o.table_name, COALESCE(o.staff_name, 'Staff'),
       COALESCE(o.staff_role, 'WAITER'),
       jsonb_agg(expanded.item || jsonb_build_object('_orderItemIndex', expanded.ordinality - 1)
         ORDER BY expanded.ordinality),
       SUM(
         COALESCE(NULLIF(expanded.item->>'price', '')::numeric,
           NULLIF(expanded.item->>'unit_price', '')::numeric, 0)
         * COALESCE(NULLIF(expanded.item->>'quantity', '')::numeric, 1)
       ),
       'Pending', (NOW() AT TIME ZONE 'Africa/Kampala')::date
     FROM public.orders o
     CROSS JOIN LATERAL jsonb_array_elements(
       CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END
     ) WITH ORDINALITY AS expanded(item, ordinality)
     WHERE LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'voided', 'closed', 'served')
       AND COALESCE(o.day_cleared, false) = false
       AND COALESCE(o.shift_cleared, false) = false
       AND (
         expanded.item->'payment_confirmed' = 'true'::jsonb
         OR (
           o.public_order_ref IS NULL
           AND expanded.item->'station_routing_requested' = 'true'::jsonb
         )
       )
       AND ${station.sqlMatch}
     GROUP BY o.id, o.table_name, o.staff_name, o.staff_role
     ON CONFLICT (order_id) DO UPDATE SET
       table_name = EXCLUDED.table_name,
       staff_name = EXCLUDED.staff_name,
       staff_role = EXCLUDED.staff_role,
       items = EXCLUDED.items,
       total = EXCLUDED.total,
       updated_at = NOW()
     WHERE ticket.table_name IS DISTINCT FROM EXCLUDED.table_name
        OR ticket.staff_name IS DISTINCT FROM EXCLUDED.staff_name
        OR ticket.staff_role IS DISTINCT FROM EXCLUDED.staff_role
        OR ticket.items IS DISTINCT FROM EXCLUDED.items
        OR ticket.total IS DISTINCT FROM EXCLUDED.total`
  );
}
