export function isItemFullyPaid(item) {
  if (!item) return false;

  if (item.creditRequested === true) {
    return item._rowPaid === true && item.is_partially_paid !== true;
  }

  return item._rowPaid === true || item.status === "Paid" || Boolean(item.paid_at);
}