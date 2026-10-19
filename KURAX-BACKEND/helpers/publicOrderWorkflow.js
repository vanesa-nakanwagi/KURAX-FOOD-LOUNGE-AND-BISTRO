const PUBLIC_ORDER_STATIONS = [
  'public.kitchen_tickets',
  'public.barman_tickets',
  'public.barista_tickets',
];

export function arePublicOrderStationsReady(ticketStatuses) {
  const handedOffStatuses = new Set(['Ready', 'Served', 'Paid', 'Closed']);
  return ticketStatuses.length > 0 && ticketStatuses.every((status) => handedOffStatuses.has(status));
}

export async function refreshPublicOrderPreparationStatus(orderId, queryable) {
  const stationTicketQueries = PUBLIC_ORDER_STATIONS.map(
    (table) => `SELECT status FROM ${table} WHERE order_id = $1`
  );
  const ticketResult = await queryable.query(
    stationTicketQueries.join(' UNION ALL '),
    [orderId]
  );
  if (!ticketResult.rows.length) return null;
  const preparationStatus = arePublicOrderStationsReady(ticketResult.rows.map((row) => row.status))
    ? 'Ready'
    : 'Preparing';
  const result = await queryable.query(
    `UPDATE public.public_payment_requests
     SET preparation_status = $1, updated_at = NOW()
     WHERE order_id = $2
       AND status IN ('Pending', 'Confirmed')
       AND preparation_status IN ('Preparing', 'Ready')
     RETURNING preparation_status`,
    [preparationStatus, orderId]
  );
  return result.rows[0]?.preparation_status || null;
}
