import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBottleVolumeMl, snapshotDrinkServing } from '../helpers/drinkServing.js';

test('bottle volume is parsed from existing menu labels', () => {
  assert.equal(parseBottleVolumeMl({ name: 'Four Cousins Sweet Red 1.5L' }), 1500);
  assert.equal(parseBottleVolumeMl({ name: 'Red Wine 750ml' }), 750);
  assert.equal(parseBottleVolumeMl({ name: 'Four Cousins Sweet Red - Glass (150ml)' }), 150);
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
    bottle_volume_ml: 750,
  });
  assert.equal(item.serving_volume_ml, 50);
  assert.equal(item.price, 5000);
  assert.equal(item.total_selling_amount, 10000);
  assert.equal(item.total_inventory_consumption_ml, 100);
  assert.equal(item.originalLineAmount, 10000);
  assert.equal(item.originalUnitPrice, 5000);
  assert.equal(item.payableAmount, 10000);
});

test('150ml drink serving is accepted and priced proportionally to the bottle', () => {
  const item = snapshotDrinkServing({
    id: 79,
    name: 'Four Cousins Sweet Red 750ml',
    price: 150000,
    category: 'Drinks & Cocktails',
    drink_serving: { name: 'Glass', volume_ml: 150 },
  }, {
    id: 79,
    name: 'Four Cousins Sweet Red 750ml',
    price: 150000,
    category: 'Drinks & Cocktails',
    bottle_volume_ml: 750,
  });

  assert.equal(item.serving_volume_ml, 150);
  assert.equal(item.price, 30000);
  assert.equal(item.drink_serving.unit_selling_price, 30000);
});

test('cocktail servings use a 150ml basis and the exact-name linked inventory item', () => {
  const item = snapshotDrinkServing({
    id: 56,
    name: 'Aperol Spritz',
    price: 30000,
    category: 'Drinks & Cocktails',
    station: 'Barman',
    drink_serving: { name: 'Single Glass', volume_ml: 50 },
  }, {
    id: 56,
    name: 'Aperol Spritz',
    price: 30000,
    category: 'Drinks & Cocktails',
    station: 'Barman',
    linked_inventory_item_id: 25,
    stock_available: true,
  });

  assert.equal(item.price, 10000);
  assert.equal(item.bottle_volume_ml, 150);
  assert.equal(item.inventory_item_id, 25);
  assert.equal(item.drink_serving.inventory_item_id, 25);
});

test('drink serving uses the menu-linked inventory ID when there is no name-match ID', () => {
  const item = snapshotDrinkServing({
    id: 79,
    name: 'Four Cousins Sweet White 1.5l',
    price: 150000,
    category: 'Drinks & Cocktails',
    drink_serving: { name: 'Double Glass', volume_ml: 100 },
  }, {
    id: 79,
    name: 'Four Cousins Sweet White 1.5l',
    price: 150000,
    category: 'Drinks & Cocktails',
    bottle_volume_ml: 1500,
    inventory_item_id: 25,
    stock_available: true,
  });

  assert.equal(item.inventory_item_id, 25);
  assert.equal(item.price, 10000);
  assert.equal(item.serving_volume_ml, 100);
});

test('drink serving inherits bottle volume from a unique inventory item when menu name omits it', () => {
  const item = snapshotDrinkServing({
    id: 80,
    name: 'Four Cousins Sweet White',
    price: 150000,
    category: 'Drinks & Cocktails',
    drink_serving: { name: 'Double Glass', volume_ml: 100 },
  }, {
    id: 80,
    name: 'Four Cousins Sweet White',
    price: 150000,
    category: 'Drinks & Cocktails',
    linked_inventory_item_id: 25,
    linked_inventory_item_name: 'Four Cousins Sweet White 1.5L',
    linked_inventory_bottle_volume_ml: 1500,
    stock_available: true,
  });

  assert.equal(item.bottle_volume_ml, 1500);
  assert.equal(item.price, 10000);
  assert.equal(item.inventory_item_id, 25);
});

test('proportional drink servings preserve effective promotional pricing', () => {
  const item = snapshotDrinkServing({
    id: 56,
    name: 'Aperol Spritz',
    price: 27000,
    originalUnitPrice: 30000,
    menuPromotionApplied: true,
    category: 'Drinks & Cocktails',
    station: 'Barman',
    quantity: 2,
    drink_serving: { name: 'Single Glass', volume_ml: 50 },
  }, {
    id: 56,
    name: 'Aperol Spritz',
    price: 30000,
    category: 'Drinks & Cocktails',
    station: 'Barman',
    linked_inventory_item_id: 25,
    stock_available: true,
  });

  assert.equal(item.price, 9000);
  assert.equal(item.originalUnitPrice, 10000);
  assert.equal(item.originalLineAmount, 20000);
  assert.equal(item.payableAmount, 18000);
  assert.equal(item.menuDiscountAmount, 2000);
  assert.equal(item.menuPromotionApplied, true);
});

test('drink serving is rejected when exact-name linked inventory is out of stock', () => {
  const item = snapshotDrinkServing({
    id: 56,
    name: 'Aperol Spritz',
    category: 'Drinks & Cocktails',
    drink_serving: { name: 'Single Glass', volume_ml: 50 },
  }, {
    id: 56,
    name: 'Aperol Spritz',
    category: 'Drinks & Cocktails',
    stock_available: false,
  });

  assert.equal(item._invalidDrinkServing, 'This drink is out of stock.');
});
