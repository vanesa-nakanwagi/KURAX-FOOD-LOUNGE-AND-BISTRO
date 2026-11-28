import { getOrderItemOriginalAmount, getOrderItemUnitCount } from "./orderItemAmounts.js";

export function isManagerCreatedOrder(order) {
  const role = String(order?.staff_role || order?.staff_role_name || order?.role || "")
    .trim()
    .toUpperCase();
  return role === "MANAGER";
}

export function isItemFullyPaid(item) {
  if (!item) return false;

  if (item.creditRequested === true) {
    return item._rowPaid === true && item.is_partially_paid !== true;
  }

  if (Array.isArray(item.unitStates)) {
    const activeStates = item.unitStates.filter(state => state?.voidProcessed !== true);
    return activeStates.length > 0 && activeStates.every(state => state?.paid === true);
  }
  return item._rowPaid === true || item.status === "Paid" || Boolean(item.paid_at);
}

export function getActiveOrderItems(items = []) {
  return (Array.isArray(items) ? items : []).filter(item => {
    if (!item || item.status === "VOIDED" || item.voidProcessed === true) return false;
    if (isItemFullyPaid(item)) return false;
    return item.creditRequested !== true || item.creditRejected === true;
  });
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
      if (Array.isArray(item.unitStates)) {
        const unitCount = getOrderItemUnitCount(item);
        const originalUnitAmount = getOrderItemOriginalAmount(item) / unitCount;
        item.unitStates.forEach((state, unitIndex) => {
          if (state?.paid !== true || state?.voidProcessed === true) return;
          const paidAmount = Number(state.paidAmount);
          paidItems.push({
            order,
            item: {
              ...item,
              quantity: 1,
              price: originalUnitAmount,
              originalUnitPrice: originalUnitAmount,
              originalLineAmount: originalUnitAmount,
              payableAmount: Number.isFinite(paidAmount) ? paidAmount : originalUnitAmount,
              paidAmount: Number.isFinite(paidAmount) ? paidAmount : originalUnitAmount,
              unitStates: undefined,
              _rowPaid: true,
              _unitIndex: unitIndex,
              _unitCount: unitCount,
            },
            itemIndex,
            unitIndex,
          });
        });
      } else if (isItemFullyPaid(item)) paidItems.push({ order, item, itemIndex });
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
    items.some(item => Array.isArray(item?.unitStates)
      ? item.unitStates.some(state =>
        state?.creditRequested === true && state?.paid !== true && state?.voidProcessed !== true
      )
      : item?.creditRequested === true && !isItemFullyPaid(item));
}