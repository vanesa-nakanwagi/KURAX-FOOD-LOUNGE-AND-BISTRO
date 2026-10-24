import test from 'node:test';
import assert from 'node:assert/strict';

import {
  configuredPurchaseConversionFactor,
  convertInventoryQuantity,
  isInventoryPurchaseUnitForStock,
  inventoryUnitsForStation,
  normalizeInventoryUnit,
} from '../helpers/inventoryUnits.js';

test('station unit lists use one canonical abbreviation per unit', () => {
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
  assert.equal(isInventoryPurchaseUnitForStock('kg', 'bag', 'KITCHEN'), true);
  assert.equal(isInventoryPurchaseUnitForStock('pc', 'crate', 'BAR'), true);
  assert.equal(isInventoryPurchaseUnitForStock('kg', 'portion', 'KITCHEN'), false);
});

test('mass and volume convert only within their physical families', () => {
  assert.equal(convertInventoryQuantity(1, 'kg', 'g'), 1000);
  assert.ok(Math.abs(convertInventoryQuantity(18, 'g', 'kg') - 0.018) < Number.EPSILON);
  assert.equal(convertInventoryQuantity(1, 'L', 'ml'), 1000);
  assert.throws(() => convertInventoryQuantity(1, 'kg', 'L'), /Incompatible recipe and inventory units/);
});

test('packaging conversions are item-specific and work for recipes in either direction', () => {
  const rice = { unit: 'kg', purchase_unit: 'bag', purchase_conversion_factor: '25' };
  assert.equal(configuredPurchaseConversionFactor('kg', 'bag', '25'), 25);
  assert.equal(convertInventoryQuantity(1, 'bag', 'kg', rice), 25);
  assert.equal(convertInventoryQuantity(500, 'g', 'kg', rice), 0.5);
  assert.throws(
    () => convertInventoryQuantity(1, 'crate', 'btl', rice),
    /Incompatible recipe and inventory units/
  );
});

test('invalid or physically inconsistent purchase factors are rejected', () => {
  assert.throws(() => configuredPurchaseConversionFactor('kg', 'bag', '0'), /positive/);
  assert.throws(() => configuredPurchaseConversionFactor('g', 'kg', '1'), /must be 1000/);
});
