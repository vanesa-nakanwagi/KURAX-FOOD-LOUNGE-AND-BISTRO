export function getOrderItemUnitPrice(item = {}) {
  const servingUnitPrice = Number(item.drink_serving?.unit_selling_price);
  if (Number.isFinite(servingUnitPrice) && servingUnitPrice >= 0) return servingUnitPrice;
  return Number(item.price ?? item.unit_price ?? 0);
}

export function getOrderItemOriginalAmount(item = {}) {
  if (item.drink_serving) {
    const servingUnitPrice = getOrderItemUnitPrice(item);
    if (Number.isFinite(servingUnitPrice) && servingUnitPrice >= 0) {
      return servingUnitPrice * Number(item.quantity || 1);
    }
  }

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

export function getOrderItemUnitCount(item = {}) {
  const quantity = Number(item.quantity || 1);
  return Number.isFinite(quantity) && quantity > 0 ? Math.max(1, Math.floor(quantity)) : 1;
}

export function getOrderItemUnitStates(item = {}) {
  const count = getOrderItemUnitCount(item);
  return Array.from({ length: count }, (_, index) => item.unitStates?.[index] || {});
}

export function getOrderItemUnitPayableAmount(item = {}, unitIndex = 0) {
  const count = getOrderItemUnitCount(item);
  if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= count) return 0;
  const total = getOrderItemPayableAmount(item);
  const perUnit = Math.round((total / count + Number.EPSILON) * 100) / 100;
  return unitIndex === count - 1
    ? Math.round((total - perUnit * (count - 1) + Number.EPSILON) * 100) / 100
    : perUnit;
}

export function expandOrderItemUnits(item = {}, metadata = {}) {
  const count = getOrderItemUnitCount(item);
  const states = getOrderItemUnitStates(item);
  const originalPerUnit = getOrderItemOriginalAmount(item) / count;
  const inheritedPaid = item._rowPaid === true || Boolean(item.paid_at);
  const inheritedCreditRequested = item.creditRequested === true;
  const inheritedCreditApproved = item.creditApproved === true;
  const inheritedCreditRejected = item.creditRejected === true;
  return states.map((state, index) => {
    const voided = state.voidProcessed === true || item.voidProcessed === true
      || String(item.status || '').toUpperCase() === 'VOIDED';
    const paid = state.paid === true || (!Array.isArray(item.unitStates) && inheritedPaid);
    const payable = getOrderItemUnitPayableAmount(item, index);
    return {
      ...item,
      ...metadata,
      quantity: 1,
      price: originalPerUnit,
      originalUnitPrice: originalPerUnit,
      originalLineAmount: originalPerUnit,
      payableAmount: payable,
      complimentaryWaivedAmount: Number(item.complimentaryWaivedAmount || 0) / count,
      paidAmount: Number(state.paidAmount ?? (paid ? payable : 0)),
      unitStates: undefined,
      _unitCount: count,
      _unitIndex: count > 1 ? index : undefined,
      _unitPaid: paid,
      _unitVoided: voided,
      _rowPaid: paid,
      paymentRequested: state.paymentRequested === true || item.paymentRequested === true,
      creditRequested: state.creditRequested === true || inheritedCreditRequested,
      creditApproved: state.creditApproved === true || inheritedCreditApproved,
      creditRejected: state.creditRejected === true || inheritedCreditRejected,
      is_partially_paid: state.is_partially_paid === true || item.is_partially_paid === true,
      voidRequested: state.voidRequested === true || item.voidRequested === true,
      voidProcessed: voided,
    };
  });
}
