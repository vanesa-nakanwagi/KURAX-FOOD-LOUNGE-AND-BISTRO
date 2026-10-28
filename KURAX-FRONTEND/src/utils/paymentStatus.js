export function isItemFullyPaid(item) {
  if (!item) return false;

  if (item.creditRequested === true) {
    return item._rowPaid === true && item.is_partially_paid !== true;
  }

  return item._rowPaid === true || item.status === "Paid" || Boolean(item.paid_at);
}

export function hasOutstandingCreditItems(order) {
  let items = order?.items;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return false;
    }
  }
  return Array.isArray(items) &&
    items.some(item => item?.creditRequested === true && !isItemFullyPaid(item));
}