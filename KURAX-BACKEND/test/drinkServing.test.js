import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBottleVolumeMl, snapshotDrinkServing } from '../helpers/drinkServing.js';

test('bottle volume is parsed from existing menu labels', () => {
  assert.equal(parseBottleVolumeMl({ name: 'Four Cousins Sweet Red 1.5L' }), 1500);
  assert.equal(parseBottleVolumeMl({ name: 'Red Wine 750ml' }), 750);
  assert.equal(parseBottleVolumeMl({ name: 'Four Cousins Sweet Red - Glass (150ml)' }), 0);
});

test('drink serving prices and quantities are calculated proportionally', () => {
  const item = snapshotDrinkServing({
    id: 79,
    name: 'Four Cousins Sweet Red 1.5L',
    price: 150000,
    category: 'Drinks & Cocktails',
    quantity: 2,
    drink_serving: { name: 'Single Glass', volume_ml: 50 },
  }, {
    id: 79,
    name: 'Four Cousins Sweet Red 1.5L',
    price: 150000,
    category: 'Drinks & Cocktails',
  });
  assert.equal(item.serving_volume_ml, 50);
  assert.equal(item.price, 5000);
  assert.equal(item.total_selling_amount, 10000);
  assert.equal(item.total_inventory_consumption_ml, 100);
  assert.equal(item.originalLineAmount, 10000);
  assert.equal(item.originalUnitPrice, 5000);
  assert.equal(item.payableAmount, 10000);
});
