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
    if (!item || typeof item !== 'object' || Array.isArray(item) || !isUnpaidOrderItem(item)) {
      return item;
    }

    const matchesCredit = targetItem
      ? matchesTarget(item, index, targetItem)
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
