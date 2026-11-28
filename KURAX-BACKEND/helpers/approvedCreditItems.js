import {
  getOrderItemPaidAmount,
  getOrderItemUnitPayableAmount,
  getOrderItemUnitStates,
} from './complimentaryItems.js';

function isUnpaidOrderItem(item) {
  return item?._rowPaid !== true
    && !item?.paid_at
    && String(item?.status || '').toUpperCase() !== 'VOIDED'
    && item?.voidProcessed !== true
    && String(item?.voidProcessed || '').toLowerCase() !== 'true';
}

function matchesTarget(item, index, targetItem) {
  if (targetItem?._orderItemIndex !== undefined && targetItem?._orderItemIndex !== null) {
    return Number(targetItem._orderItemIndex) === index;
  }
  return Boolean(targetItem?.name)
    && String(item?.name || '').trim().toLowerCase() === String(targetItem.name).trim().toLowerCase();
}

export function applyApprovedCreditToItems(items, { targetItem = null, markAllUnpaid = false } = {}) {
  let changed = false;
  const updatedItems = items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || (targetItem && !matchesTarget(item, index, targetItem))) {
      return item;
    }

    const hasUnitTarget = targetItem?._unitIndex !== undefined && targetItem?._unitIndex !== null;
    if (hasUnitTarget) {
      if (!isUnpaidOrderItem(item)) return item;
      const unitIndex = Number(targetItem._unitIndex);
      if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= Number(item.quantity || 1)) return item;
      const unitStates = getOrderItemUnitStates(item);
      const state = unitStates[unitIndex];
      if (!state || state.paid === true || state.voidRequested === true
        || state.voidProcessed === true || state.paymentRequested === true) return item;

      unitStates[unitIndex] = {
        ...state,
        paymentRequested: false,
        creditRequested: true,
        creditApproved: true,
        creditRejected: false,
        creditStatus: 'Approved',
      };
      changed = true;
      return { ...item, unitStates };
    }

    if (!isUnpaidOrderItem(item)) return item;
    const matchesCredit = targetItem
      ? true
      : item.creditRequested === true || markAllUnpaid;
    if (!matchesCredit) return item;

    changed = true;
    return {
      ...item,
      paymentRequested: false,
      creditRequested: true,
      creditApproved: true,
      creditRejected: false,
      payment_method: 'Credit',
      _rowPaid: false,
      payment_confirmed: false,
    };
  });

  return { items: updatedItems, changed };
}

export function applyUnitCreditSettlement(item, unitIndex, {
  amountPaid,
  balance,
  status,
  method,
  settledAt = new Date().toISOString(),
} = {}) {
  const unitStates = getOrderItemUnitStates(item);
  const state = unitStates[unitIndex];
  if (!state || state.creditRequested !== true || state.creditRejected === true) {
    return { item, changed: false };
  }

  if (status === 'FullySettled') {
    unitStates[unitIndex] = {
      ...state,
      paid: true,
      paidAmount: getOrderItemUnitPayableAmount(item, unitIndex),
      paidAt: settledAt,
      paymentMethod: method || 'Cash',
      creditRequested: false,
      creditApproved: false,
      creditStatus: 'FullySettled',
      creditAmountPaid: amountPaid,
      creditBalance: 0,
      is_partially_paid: false,
    };
  } else {
    unitStates[unitIndex] = {
      ...state,
      paidAmount: amountPaid,
      creditRequested: true,
      creditApproved: true,
      creditStatus: 'PartiallySettled',
      creditAmountPaid: amountPaid,
      creditBalance: balance,
      partial_payment_method: method || 'Cash',
      partial_paid_at: settledAt,
      is_partially_paid: true,
    };
  }

  const activeUnits = unitStates.filter(unit => unit?.voidProcessed !== true);
  const updatedItem = { ...item, unitStates };
  updatedItem._rowPaid = activeUnits.length > 0 && activeUnits.every(unit => unit?.paid === true);
  updatedItem.paidAmount = getOrderItemPaidAmount(updatedItem);
  if (updatedItem._rowPaid) updatedItem.paid_at = settledAt;

  return { item: updatedItem, changed: true };
}
