export function getOrderItemOriginalAmount(item = {}) {
  const original = Number(item.originalLineAmount);
  if (Number.isFinite(original) && original >= 0) return original;
  return Number(item.originalUnitPrice ?? item.price ?? item.unit_price ?? 0)
    * Number(item.quantity || 1);
}

export function getOrderItemPayableAmount(item = {}) {
  const original = getOrderItemOriginalAmount(item);
  const payable = Number(item.payableAmount);
  if (item.complimentary === true && Number.isFinite(payable) && payable >= 0) return payable;
  if (item.complimentary === true) {
    return Math.max(0, original - Number(item.complimentaryWaivedAmount || 0));
  }
  return original;
}

export function getOrderItemPaidAmount(item = {}) {
  const paid = Number(item.paidAmount ?? item.partial_amount_paid ?? item.amount_paid);
  if (Number.isFinite(paid) && paid >= 0) return paid;
  return item._rowPaid === true ? getOrderItemPayableAmount(item) : 0;
}
