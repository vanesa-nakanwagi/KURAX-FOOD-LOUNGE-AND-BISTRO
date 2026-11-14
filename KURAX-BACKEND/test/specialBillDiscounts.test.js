import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySpecialBillDiscount,
  getDiscountableBillBalance,
  getSpecialDiscountLimit,
  splitDiscountAmount,
  normalizeSpecialDiscountSettings,
} from '../helpers/specialBillDiscounts.js';

test('discount eligibility excludes settled, voided and credit lines while retaining partial balances', () => {
  const items = [
    { name: 'Part-paid', price: 10000, quantity: 1, originalLineAmount: 10000, payableAmount: 9000, pricingSnapshot: true, paidAmount: 4000 },
    { name: 'Settled', price: 5000, quantity: 1, originalLineAmount: 5000, payableAmount: 5000, pricingSnapshot: true, _rowPaid: true, paidAmount: 5000 },
    { name: 'Voided', price: 2000, quantity: 1, originalLineAmount: 2000, payableAmount: 2000, pricingSnapshot: true, status: 'VOIDED' },
    { name: 'Credit', price: 6000, quantity: 1, originalLineAmount: 6000, payableAmount: 6000, pricingSnapshot: true, creditRequested: true },
  ];
  assert.equal(getDiscountableBillBalance(items), 5000);
  assert.equal(getSpecialDiscountLimit(items, 10), 500);
  assert.equal(getSpecialDiscountLimit(items, { max_discount_type: 'fixed', max_discount_value: 250 }), 250);
});

test('special discounts reduce only the unpaid portion and preserve menu discount history', () => {
  const item = {
    name: 'Meal',
    price: 8000,
    quantity: 1,
    originalLineAmount: 10000,
    payableAmount: 8000,
    menuDiscountAmount: 2000,
    paidAmount: 3000,
    pricingSnapshot: true,
  };
  const result = applySpecialBillDiscount([item], 1000, {
    discount_type: 'fixed',
    discount_value: 1000,
  });
  assert.equal(result.balanceBefore, 5000);
  assert.equal(result.balanceAfter, 4000);
  assert.equal(result.items[0].payableAmount, 7000);
  assert.equal(result.items[0].paidAmount, 3000);
  assert.equal(result.items[0].menuDiscountAmount, 2000);
  assert.equal(result.items[0].specialBillDiscountAmount, 1000);
  assert.equal(result.items[0].price, 7000);
});

test('discount allocation is rounded and settings reject invalid limits', () => {
  assert.deepEqual(splitDiscountAmount(10, [30, 70]), [3, 7]);
  assert.throws(() => splitDiscountAmount(101, [30, 70]), /unpaid bill balance/);
  assert.deepEqual(normalizeSpecialDiscountSettings({
    max_discount_type: 'percentage',
    max_discount_value: 12.5,
  }), { max_discount_type: 'percentage', max_discount_value: 12.5 });
  assert.deepEqual(normalizeSpecialDiscountSettings({
    max_discount_type: 'percentage',
    max_discount_value: 100,
  }), { max_discount_type: 'percentage', max_discount_value: 100 });
  assert.throws(() => normalizeSpecialDiscountSettings({
    max_discount_type: 'percentage',
    max_discount_value: 100.01,
  }), /100/);
});
