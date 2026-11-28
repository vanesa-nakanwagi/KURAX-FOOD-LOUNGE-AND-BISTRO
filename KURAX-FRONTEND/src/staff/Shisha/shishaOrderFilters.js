export function isFullyPaidShishaOrder(order) {
  return String(order?.payment_status || '').toUpperCase() === 'FULLY_PAID';
}

export function partitionShishaOrders(orders = []) {
  return orders.reduce((groups, order) => {
    groups[isFullyPaidShishaOrder(order) ? 'fullyPaid' : 'incoming'].push(order);
    return groups;
  }, { incoming: [], fullyPaid: [] });
}
