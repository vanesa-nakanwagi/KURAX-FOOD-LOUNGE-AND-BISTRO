export function isItemFullyPaid(item) {
  if (!item) return false;

  if (item.creditRequested === true) {
    return item._rowPaid === true && item.is_partially_paid !== true;
  }

  return item._rowPaid === true || item.status === "Paid" || Boolean(item.paid_at);
}

export function isItemReadyForService(item) {
  return item?.readyForService === true
    && item.served !== true
    && !isItemFullyPaid(item)
    && String(item.status || "").toUpperCase() !== "VOIDED"
    && item.voidProcessed !== true
    && String(item.voidProcessed || "").toLowerCase() !== "true";
}

export function hasReadyForServiceItems(order) {
  let items = order?.items;
  if (typeof items === "string") {
    try { items = JSON.parse(items); } catch { return false; }
  }
  return Array.isArray(items) && items.some(isItemReadyForService);
}

export function getPaidOrderItems(orders = []) {
  const paymentSourceOrderIds = new Set();
  orders.forEach(order => {
    let sourceIds = order?.original_order_ids;
    if (typeof sourceIds === "string") {
      try { sourceIds = JSON.parse(sourceIds); } catch { sourceIds = []; }
    }
    if (Array.isArray(sourceIds)) {
      sourceIds.forEach(sourceId => {
        if (sourceId != null) paymentSourceOrderIds.add(String(sourceId));
      });
    }
  });

  const paidItems = [];
  orders.forEach(order => {
    if (paymentSourceOrderIds.has(String(order?.id))) return;
    let orderItems = order?.items || [];
    if (typeof orderItems === "string") {
      try { orderItems = JSON.parse(orderItems); } catch { orderItems = []; }
    }
    if (!Array.isArray(orderItems)) return;
    orderItems.forEach((item, itemIndex) => {
      if (isItemFullyPaid(item)) paidItems.push({ order, item, itemIndex });
    });
  });
  return paidItems;
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