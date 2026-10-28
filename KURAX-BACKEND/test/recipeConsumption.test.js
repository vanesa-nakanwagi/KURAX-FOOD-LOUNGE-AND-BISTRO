import test from 'node:test';
import assert from 'node:assert/strict';

import { convertRecipeQuantity, isSoldOrderItem } from '../helpers/recipeConsumption.js';

test('recipe quantities convert within compatible mass and volume units', () => {
  assert.equal(convertRecipeQuantity(150, 'g', 'kg'), 0.15);
  assert.equal(convertRecipeQuantity(0.6, 'kg', 'g'), 600);
  assert.equal(convertRecipeQuantity(1.5, 'litre', 'ml'), 1500);
  assert.throws(() => convertRecipeQuantity(1, 'kg', 'ml'), /Incompatible recipe and inventory units/);
});

test('recipes can use item-configured packaging units without cross-dimension conversions', () => {
  const coffee = { unit: 'kg', purchase_unit: 'bag', purchase_conversion_factor: '25' };
  assert.equal(convertRecipeQuantity(18, 'g', 'kg', coffee), 0.018);
  assert.equal(convertRecipeQuantity(1, 'bag', 'kg', coffee), 25);
  assert.throws(() => convertRecipeQuantity(1, 'L', 'kg', coffee), /Incompatible recipe and inventory units/);
});

test('only paid or approved-credit non-voided items are consumable', () => {
  assert.equal(isSoldOrderItem({ _rowPaid: true, payment_method: 'Cash' }), true);
  assert.equal(isSoldOrderItem({ creditRequested: true, payment_method: 'Credit' }), false);
  assert.equal(isSoldOrderItem({ _approvedCreditSale: true, payment_method: 'Credit' }), true);
  assert.equal(isSoldOrderItem({ _rowPaid: true, status: 'VOIDED' }), false);
  assert.equal(isSoldOrderItem({ _rowPaid: false, payment_method: 'Cash' }), false);
});

test('served complimentary items consume recipes, while unserved or voided items do not', () => {
  assert.equal(isSoldOrderItem({ complimentary: true, served: true }), true);
  assert.equal(isSoldOrderItem({ complimentary: true, served: false }), false);
  assert.equal(isSoldOrderItem({ complimentary: true, served: true, status: 'VOIDED' }), false);
});