import test from 'node:test';
import assert from 'node:assert/strict';

import {
  configuredPurchaseConversionFactor,
  convertInventoryQuantity,
  inventoryUnitsForStation,
  normalizeInventoryUnit,
} from '../helpers/inventoryUnits.js';

test('station unit lists use shared canonical unit abbreviations', () => {
  assert.deepEqual(inventoryUnitsForStation('KITCHEN'), [
    'kg', 'g', 'L', 'ml', 'pc', 'pack', 'btl', 'can', 'tin', 'bag', 'sachet', 'bunch', 'doz', 'portion', 'slice',
  ]);
  assert.deepEqual(inventoryUnitsForStation('BAR'), [
    'pc', 'btl', 'can', 'L', 'ml', 'kg', 'g', 'shot', 'glass', 'pour', 'pack', 'crate', 'carton',
  ]);
  assert.deepEqual(inventoryUnitsForStation('BARISTA'), [
    'kg', 'g', 'L', 'ml', 'pc', 'sachet', 'shot', 'cup', 'portion', 'btl', 'pack', 'box', 'tab',
  ]);
  assert.equal(normalizeInventoryUnit('litre'), 'L');
  assert.equal(normalizeInventoryUnit('piece'), 'pc');
  assert.equal(normalizeInventoryUnit('packet'), 'pack');
  assert.equal(normalizeInventoryUnit('bottles'), 'btl');
});

test('mass and volume conversions are exact and cannot cross dimensions', () => {
  assert.equal(convertInventoryQuantity(1, 'kg', 'g'), 1000);
  assert.equal(convertInventoryQuantity(18, 'g', 'kg'), 0.018);
  assert.equal(convertInventoryQuantity(1, 'L', 'ml'), 1000);
  assert.throws(() => convertInventoryQuantity(1, 'kg', 'L'), /Incompatible recipe and inventory units/);
});

test('packaging conversions are configurable per inventory item', () => {
  const rice = { unit: 'kg', purchase_unit: 'bag', purchase_conversion_factor: '25' };
  const crate = { unit: 'btl', purchase_unit: 'crate', purchase_conversion_factor: '24' };
  assert.equal(configuredPurchaseConversionFactor('kg', 'bag', '25'), 25);
  assert.equal(convertInventoryQuantity(1, 'bag', 'kg', rice), 25);
  assert.equal(convertInventoryQuantity(500, 'g', 'kg', rice), 0.5);
  assert.equal(convertInventoryQuantity(1, 'crate', 'btl', crate), 24);
  assert.throws(() => convertInventoryQuantity(1, 'crate', 'btl', rice), /Incompatible recipe and inventory units/);
});

test('invalid or dimensionally inconsistent purchase conversions are rejected', () => {
  assert.throws(() => configuredPurchaseConversionFactor('kg', 'bag', '0'), /positive/);
  assert.throws(() => configuredPurchaseConversionFactor('g', 'kg', '1'), /must be 1000/);
  assert.throws(() => configuredPurchaseConversionFactor('kg', 'L', '1'), /Incompatible/);
  assert.throws(() => configuredPurchaseConversionFactor('kg', 'bag', '1.1234567'), /six decimal places/);
});
