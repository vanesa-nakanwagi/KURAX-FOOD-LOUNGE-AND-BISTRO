const PUBLIC_ORDER_STATIONS = [
  'public.kitchen_tickets',
  'public.barman_tickets',
  'public.barista_tickets',
];

export function arePublicOrderStationsReady(ticketStatuses) {
  const handedOffStatuses = new Set(['Ready', 'Served', 'Paid', 'Closed']);
  return ticketStatuses.length > 0 && ticketStatuses.every((status) => handedOffStatuses.has(status));
}

export function buildPublicOrderReadyNotification(orderId) {
  return {
    type: 'PUBLIC_ORDER_READY',
    title: 'Website order ready',
    body: `Website order #${orderId} is ready at all stations.`,
    referenceId: orderId,
    referenceType: 'order',
    link: '/cashier',
  };
}

export async function notifyCashierOfReadyPublicOrder(notificationService, orderId) {
  try {
    const delivery = await notificationService.sendToRoles(
      ['CASHIER'],
      buildPublicOrderReadyNotification(orderId)
    );
    if (delivery.error || delivery.failed || delivery.noRecipients) {
      console.warn(`Public order ready notification was not fully delivered for order #${orderId}:`, delivery);
    }
  } catch (error) {
    console.error(`Public order ready notification failed for order #${orderId}:`, error.message);
  }
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
       AND preparation_status IS DISTINCT FROM $1
     RETURNING preparation_status`,
    [preparationStatus, orderId]
  );
  return result.rows[0]?.preparation_status || null;
}
