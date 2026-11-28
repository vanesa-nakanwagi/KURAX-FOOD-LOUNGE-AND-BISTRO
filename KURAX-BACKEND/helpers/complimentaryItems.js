export function getOrderItemUnitPrice(item = {}) {
  const rawUnitPrice = item.drink_serving
    ? item.drink_serving.unit_selling_price ?? item.price ?? item.unit_price
    : item.originalUnitPrice ?? item.original_unit_price ?? item.price ?? item.unit_price;
  return Number(rawUnitPrice ?? 0);
}

export function getOrderItemOriginalAmount(item = {}) {
  if (item.drink_serving) {
    const unitPrice = getOrderItemUnitPrice(item);
    const quantity = Number(item.quantity || 1);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Order item price and quantity must be valid non-negative values.');
    }
    return roundMoney(unitPrice * quantity);
  }

  const storedOriginal = Number(item.originalLineAmount);
  if (Number.isFinite(storedOriginal) && storedOriginal >= 0) return roundMoney(storedOriginal);
  const unitPrice = getOrderItemUnitPrice(item);
  const quantity = Number(item.quantity || 1);
  if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Order item price and quantity must be valid non-negative values.');
  }
  return roundMoney(unitPrice * quantity);
}

export function getOrderItemWaivedAmount(item = {}) {
  const originalAmount = getOrderItemOriginalAmount(item);
  const storedWaiver = Number(item.complimentaryWaivedAmount ?? 0);
  if (!Number.isFinite(storedWaiver) || storedWaiver < 0 || storedWaiver > originalAmount) {
    throw new Error('The complimentary amount must be between zero and the original item total.');
  }
  return roundMoney(storedWaiver);
}

export function getOrderItemPayableAmount(item = {}) {
  const originalAmount = getOrderItemOriginalAmount(item);
  const storedPayable = Number(item.payableAmount);
  if (Number.isFinite(storedPayable) && storedPayable >= 0 && storedPayable <= originalAmount) {
    return roundMoney(storedPayable);
  }
  if (item.complimentary !== true) return originalAmount;
  return roundMoney(originalAmount - getOrderItemWaivedAmount(item));
}

export function getOrderItemPaidAmount(item = {}) {
  if (Array.isArray(item.unitStates)) {
    return roundMoney(item.unitStates.reduce((total, state) =>
      total + Number(state?.paidAmount || 0), 0));
  }
  const storedPaid = Number(item.paidAmount ?? item.partial_amount_paid ?? item.amount_paid);
  if (Number.isFinite(storedPaid) && storedPaid >= 0) return roundMoney(storedPaid);
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
  const perUnit = roundMoney(total / count);
  return unitIndex === count - 1
    ? roundMoney(total - perUnit * (count - 1))
    : perUnit;
}

export function applyComplimentaryTerms(item, {
  complimentary,
  waivedAmount,
  actorId,
  actorName,
  reason = '',
  markedAt = new Date().toISOString(),
}) {
  const originalAmount = getOrderItemOriginalAmount(item);
  const normalizedWaiver = complimentary ? Number(waivedAmount) : 0;
  if (!Number.isFinite(normalizedWaiver) || normalizedWaiver < 0 || normalizedWaiver > originalAmount) {
    throw new Error('The complimentary amount must be between zero and the original item total.');
  }

  const unitPrice = getOrderItemUnitPrice(item);
  const nextWaiver = roundMoney(normalizedWaiver);
  return {
    ...item,
    originalUnitPrice: roundMoney(unitPrice),
    originalLineAmount: originalAmount,
    complimentary: complimentary === true && nextWaiver > 0,
    complimentaryWaivedAmount: nextWaiver,
    payableAmount: roundMoney(originalAmount - nextWaiver),
    complimentaryBy: nextWaiver > 0 ? Number(actorId) : null,
    complimentaryByName: nextWaiver > 0 ? String(actorName || '').trim() : null,
    complimentaryAt: nextWaiver > 0 ? markedAt : null,
    complimentaryReason: nextWaiver > 0 ? String(reason || '').trim().slice(0, 500) : '',
  };
}

export function getOrderPayableTotal(items = []) {
  return roundMoney(items.reduce((total, item) => {
    if (item?.voidProcessed === true || String(item?.status || '').toUpperCase() === 'VOIDED') return total;
    if (Array.isArray(item?.unitStates)) {
      return total + getOrderItemUnitStates(item).reduce((unitTotal, state, index) =>
        state?.voidProcessed === true
          ? unitTotal
          : unitTotal + getOrderItemUnitPayableAmount(item, index), 0);
    }
    return total + getOrderItemPayableAmount(item);
  }, 0));
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
