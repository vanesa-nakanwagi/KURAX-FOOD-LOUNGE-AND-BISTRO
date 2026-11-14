import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEffectiveMenuPrice,
  parsePromotionSettings,
  snapshotMenuPromotions,
} from '../helpers/menuPromotions.js';

test('menu without an enabled promotion preserves its original price', () => {
  const menu = { id: 1, price: 25000, promotion_enabled: false };
  assert.deepEqual(getEffectiveMenuPrice(menu), {
    listPrice: 25000,
    effectivePrice: 25000,
    discountAmount: 0,
    promotionActive: false,
    promotionDiscountPercent: 0,
    promotionDiscountType: null,
    promotionDiscountValue: 0,
  });
});

test('percentage and fixed promotions calculate promotional prices', () => {
  const at = new Date('2026-11-06T12:00:00.000Z');
  const dates = {
    promotion_enabled: true,
    promotion_starts_at: '2026-11-01T00:00:00.000Z',
    promotion_ends_at: '2026-11-30T23:59:59.000Z',
  };
  assert.equal(getEffectiveMenuPrice({
    price: 25000,
    ...dates,
    promotion_discount_type: 'percentage',
    promotion_discount_value: 10,
  }, { at }).effectivePrice, 22500);
  assert.equal(getEffectiveMenuPrice({
    price: 25000,
    ...dates,
    promotion_discount_type: 'fixed',
    promotion_discount_value: 2500,
  }, { at }).effectivePrice, 22500);
});

test('promotion activation, expiry, explicit disable and discount validation are enforced', () => {
  const promotion = {
    price: 10000,
    promotion_enabled: true,
    promotion_discount_type: 'fixed',
    promotion_discount_value: 2500,
    promotion_starts_at: '2026-11-06T09:00:00.000Z',
    promotion_ends_at: '2026-11-06T15:00:00.000Z',
  };
  assert.equal(getEffectiveMenuPrice(promotion, { at: new Date('2026-11-06T08:59:59.000Z') }).effectivePrice, 10000);
  assert.equal(getEffectiveMenuPrice(promotion, { at: new Date('2026-11-06T12:00:00.000Z') }).effectivePrice, 7500);
  assert.equal(getEffectiveMenuPrice(promotion, { at: new Date('2026-11-06T15:00:01.000Z') }).effectivePrice, 10000);
  assert.equal(getEffectiveMenuPrice({ ...promotion, promotion_enabled: false }, { at: new Date('2026-11-06T12:00:00.000Z') }).effectivePrice, 10000);
  assert.match(parsePromotionSettings({
    promotion_enabled: true,
    promotion_discount_type: 'fixed',
    promotion_discount_value: 10001,
    promotion_starts_at: '2026-11-06T09:00:00.000Z',
    promotion_ends_at: '2026-11-06T15:00:00.000Z',
    price: 10000,
  }).error, /cannot exceed/);
  assert.match(parsePromotionSettings({
    promotion_enabled: true,
    promotion_discount_type: 'percentage',
    promotion_discount_value: 101,
    promotion_starts_at: '2026-11-06T09:00:00.000Z',
    promotion_ends_at: '2026-11-06T15:00:00.000Z',
  }).error, /100 percent/);
});

test('order snapshots preserve original price and never mutate historical items', () => {
  const oldItem = { id: 5, name: 'Meal', price: 18000, quantity: 1 };
  const [newItem] = snapshotMenuPromotions(
    [{ ...oldItem, price: 25000, quantity: 2 }],
    [{
      id: 5,
      name: 'Meal',
      price: 25000,
      promotion_enabled: true,
      promotion_discount_type: 'percentage',
      promotion_discount_value: 10,
      promotion_starts_at: '2026-11-01T00:00:00.000Z',
      promotion_ends_at: '2026-11-30T23:59:59.000Z',
    }],
    new Date('2026-11-06T12:00:00.000Z')
  );
  assert.equal(newItem.price, 22500);
  assert.equal(newItem.originalUnitPrice, 25000);
  assert.equal(newItem.originalLineAmount, 50000);
  assert.equal(newItem.payableAmount, 45000);
  assert.equal(newItem.menuDiscountAmount, 5000);
  assert.equal(oldItem.price, 18000);
});
