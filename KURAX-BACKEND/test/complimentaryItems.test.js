import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyComplimentaryTerms,
  getOrderItemOriginalAmount,
  getOrderItemPaidAmount,
  getOrderItemPayableAmount,
  getOrderItemWaivedAmount,
  getOrderPayableTotal,
} from '../helpers/complimentaryItems.js';

test('fully complimentary line preserves its selling price and derives zero payable', () => {
  const item = applyComplimentaryTerms(
    { name: 'Tea', price: 2500, quantity: 2 },
    { complimentary: true, waivedAmount: 5000, actorId: 7, actorName: 'Manager', reason: 'Guest courtesy' }
  );

  assert.equal(item.price, 2500);
  assert.equal(item.originalLineAmount, 5000);
  assert.equal(item.complimentaryWaivedAmount, 5000);
  assert.equal(getOrderItemPayableAmount(item), 0);
  assert.equal(getOrderItemPaidAmount(item), 0);
  assert.equal(item.complimentaryByName, 'Manager');
});

test('partial waiver records payable and preserves actual paid amount', () => {
  const item = applyComplimentaryTerms(
    { name: 'Meal', price: 10000, quantity: 1, paidAmount: 3000 },
    { complimentary: true, waivedAmount: 2500, actorId: 4, actorName: 'Waiter' }
  );

  assert.equal(getOrderItemOriginalAmount(item), 10000);
  assert.equal(getOrderItemWaivedAmount(item), 2500);
  assert.equal(getOrderItemPayableAmount(item), 7500);
  assert.equal(getOrderItemPaidAmount(item), 3000);
});

test('a UGX 50000 waiver on a UGX 150000 item preserves gross and leaves UGX 100000 payable', () => {
  const item = applyComplimentaryTerms(
    { name: 'Dinner', price: 150000, quantity: 1 },
    { complimentary: true, waivedAmount: 50000, actorId: 4, actorName: 'Cashier' }
  );

  assert.equal(getOrderItemOriginalAmount(item), 150000);
  assert.equal(getOrderItemPayableAmount(item), 100000);
});

test('stored payable amount is honored for promotional and special bill discounts', () => {
  const promoItem = {
    name: 'Meal',
    price: 9000,
    quantity: 1,
    originalLineAmount: 10000,
    payableAmount: 9000,
    menuDiscountAmount: 1000,
    pricingSnapshot: true,
  };
  const discountedItem = {
    ...promoItem,
    price: 8000,
    payableAmount: 8000,
    line_total: 8000,
    specialBillDiscountAmount: 1000,
  };

  assert.equal(getOrderItemPayableAmount(promoItem), 9000);
  assert.equal(getOrderItemPayableAmount(discountedItem), 8000);
  assert.equal(getOrderPayableTotal([promoItem, discountedItem]), 17000);
});

test('order total excludes waived and voided lines without affecting ordinary lines', () => {
  const complimentary = applyComplimentaryTerms(
    { name: 'Juice', price: 6000, quantity: 1 },
    { complimentary: true, waivedAmount: 4000, actorId: 2, actorName: 'Supervisor' }
  );

  assert.equal(getOrderPayableTotal([
    complimentary,
    { name: 'Lunch', price: 12000, quantity: 1 },
    { name: 'Voided', price: 9000, quantity: 1, status: 'VOIDED' },
  ]), 14000);
});

test('complimentary amounts outside the original line value are rejected', () => {
  assert.throws(() => applyComplimentaryTerms(
    { name: 'Tea', price: 2500, quantity: 1 },
    { complimentary: true, waivedAmount: 2501, actorId: 1, actorName: 'Staff' }
  ), /between zero and the original item total/);
});
