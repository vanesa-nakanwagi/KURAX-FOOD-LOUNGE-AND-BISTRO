import test from 'node:test';
import assert from 'node:assert/strict';

import { convertRecipeQuantity, isSoldOrderItem } from '../helpers/recipeConsumption.js';

test('recipe quantities convert within compatible mass and volume units', () => {
  assert.equal(convertRecipeQuantity(150, 'g', 'kg'), 0.15);
  assert.equal(convertRecipeQuantity(0.6, 'kg', 'g'), 600);
  assert.equal(convertRecipeQuantity(1.5, 'litre', 'ml'), 1500);
  assert.throws(() => convertRecipeQuantity(1, 'kg', 'ml'), /Incompatible recipe and inventory units/);
});

test('only paid or approved-credit non-voided items are consumable', () => {
  assert.equal(isSoldOrderItem({ _rowPaid: true, payment_method: 'Cash' }), true);
  assert.equal(isSoldOrderItem({ creditRequested: true, payment_method: 'Credit' }), false);
  assert.equal(isSoldOrderItem({ _approvedCreditSale: true, payment_method: 'Credit' }), true);
  assert.equal(isSoldOrderItem({ _rowPaid: true, status: 'VOIDED' }), false);
  assert.equal(isSoldOrderItem({ _rowPaid: false, payment_method: 'Cash' }), false);
});