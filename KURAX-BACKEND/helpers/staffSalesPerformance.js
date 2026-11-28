import {
  getOrderItemUnitCount,
  getOrderItemUnitStates,
} from './complimentaryItems.js';

const COMPLETED_ORDER_STATUSES = new Set([
  'served',
  'paid',
  'closed',
  'confirmed',
  'credit',
  'mixed',
  'partially_paid',
  'partially paid',
  'partiallypaid',
]);

export function getStaffPerformanceOrderSummary(order, paymentStatus = 'all') {
  let items = order.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  if (!Array.isArray(items) || !items.length) {
    items = [{ _reportAmount: Number(order.total) || 0 }];
  }

  const orderStatus = String(order.status || '').toLowerCase();
  const isCompletedOrder = COMPLETED_ORDER_STATUSES.has(orderStatus);
  const matches = [];
  let activeAmount = 0;
  let items_count = 0;

  items.forEach(item => {
    if (String(item.status || '').toUpperCase() === 'VOIDED' || item.voidProcessed === true) return;
    const amount = item._reportAmount !== undefined
      ? Number(item._reportAmount) || 0
      : Number(item.line_total ?? item.lineTotal) ||
        (Number(item.price || item.unit_price) || 0) * (Number(item.quantity) || 1);
    if (!Number.isFinite(amount) || amount < 0) return;

    const method = String(item.payment_method || order.payment_method || '').toLowerCase();
    const hasUnitStates = Array.isArray(item.unitStates);
    const unitStates = hasUnitStates ? getOrderItemUnitStates(item) : [{}];
    const unitCount = hasUnitStates ? getOrderItemUnitCount(item) : 1;
    const amountPerUnit = Math.round((amount / unitCount + Number.EPSILON) * 100) / 100;
    const itemMatches = new Map();
    let matchedUnits = 0;

    unitStates.forEach((state, index) => {
      if (state.voidProcessed === true) return;
      const unitAmount = index === unitCount - 1
        ? Math.round((amount - amountPerUnit * (unitCount - 1) + Number.EPSILON) * 100) / 100
        : amountPerUnit;
      activeAmount += unitAmount;
      const isCredit = hasUnitStates
        ? state.creditRequested === true
        : item.creditRequested === true || method.includes('credit') || orderStatus === 'credit';
      const isPaid = (hasUnitStates && state.paid === true)
        || state.payment_confirmed === true
        || item._rowPaid === true
        || item.payment_confirmed === true
        || String(item.status || '').toLowerCase() === 'paid'
        || order.payment_confirmed === true
        || ['paid', 'closed', 'confirmed'].includes(orderStatus);
      const isServed = item.served === true || isCompletedOrder;
      const included = paymentStatus === 'paid'
        ? isPaid
        : paymentStatus === 'credit'
          ? isCredit && !isPaid
          : paymentStatus === 'pending'
            ? isServed && !isPaid && !isCredit
            : isPaid || isServed || isCredit;
      if (!included) return;

      matchedUnits += 1;
      const payment = isPaid ? (method || 'paid') : isCredit ? 'credit' : 'Pending';
      const current = itemMatches.get(payment) || { amount: 0, payment };
      current.amount += unitAmount;
      itemMatches.set(payment, current);
    });

    if (matchedUnits > 0) {
      items_count += 1;
      matches.push(...itemMatches.values());
    }
  });

  const payment_breakdown = {};
  let total_sales = 0;
  matches.forEach(match => {
    total_sales += match.amount;
    payment_breakdown[match.payment] = (payment_breakdown[match.payment] || 0) + 1;
  });
  const storedOrderTotal = Number(order.total);
  const hasStoredOrderTotal = order.total !== null
    && order.total !== undefined
    && Number.isFinite(storedOrderTotal)
    && storedOrderTotal >= 0;
  if (hasStoredOrderTotal && activeAmount > 0) {
    total_sales *= storedOrderTotal / activeAmount;
  }

  return {
    orders_count: paymentStatus === 'all' || matches.length > 0 ? 1 : 0,
    items_count,
    total_sales: Math.round((total_sales + Number.EPSILON) * 100) / 100,
    payment_breakdown,
  };
}
