import test from 'node:test';
import assert from 'node:assert/strict';
import { getStaffPerformanceOrderSummary } from '../helpers/staffSalesPerformance.js';

test('staff sales exclude voided units from a partially voided item line', () => {
  const summary = getStaffPerformanceOrderSummary({
    status: 'served',
    items: [{
      name: 'Shisha',
      price: 25000,
      line_total: 50000,
      quantity: 2,
      unitStates: [{}, { voidProcessed: true }],
    }],
  });

  assert.deepEqual(summary, {
    orders_count: 1,
    items_count: 1,
    total_sales: 25000,
    payment_breakdown: { Pending: 1 },
  });
});

test('unit payment filters and breakdowns use each unit state', () => {
  const order = {
    status: 'mixed',
    items: [{
      name: 'Meal',
      price: 20000,
      line_total: 40000,
      quantity: 2,
      unitStates: [{ paid: true }, { creditRequested: true }],
    }],
  };

  assert.deepEqual(getStaffPerformanceOrderSummary(order), {
    orders_count: 1,
    items_count: 1,
    total_sales: 40000,
    payment_breakdown: { paid: 1, credit: 1 },
  });
  assert.deepEqual(getStaffPerformanceOrderSummary(order, 'paid'), {
    orders_count: 1,
    items_count: 1,
    total_sales: 20000,
    payment_breakdown: { paid: 1 },
  });
  assert.deepEqual(getStaffPerformanceOrderSummary(order, 'credit'), {
    orders_count: 1,
    items_count: 1,
    total_sales: 20000,
    payment_breakdown: { credit: 1 },
  });
});

test('ordinary item amounts and payment breakdown counts remain line-based', () => {
  const summary = getStaffPerformanceOrderSummary({
    status: 'paid',
    payment_method: 'Cash',
    items: [{ price: 10000, quantity: 2, line_total: 20000 }],
  });

  assert.deepEqual(summary, {
    orders_count: 1,
    items_count: 1,
    total_sales: 20000,
    payment_breakdown: { cash: 1 },
  });
});

test('orders with no matched sales still contribute to the order count', () => {
  const summary = getStaffPerformanceOrderSummary({
    status: 'pending',
    items: [{ price: 25000, quantity: 1 }],
  });

  assert.deepEqual(summary, {
    orders_count: 1,
    items_count: 0,
    total_sales: 0,
    payment_breakdown: {},
  });
  assert.equal(getStaffPerformanceOrderSummary({
    status: 'pending',
    items: [{ price: 25000, quantity: 1 }],
  }, 'paid').orders_count, 0);
});

test('staff sales reconcile discounted line amounts to the stored order total', () => {
  const summary = getStaffPerformanceOrderSummary({
    status: 'paid',
    total: 85000,
    items: [
      { price: 15000, quantity: 1, line_total: 15000 },
      { price: 80000, quantity: 1, line_total: 80000 },
    ],
  });

  assert.deepEqual(summary, {
    orders_count: 1,
    items_count: 2,
    total_sales: 85000,
    payment_breakdown: { paid: 2 },
  });
});
