import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVolumeMl,
  getMenuInventoryMatchFields,
  matchMenuInventory,
  normalizeInventoryProductName,
} from '../helpers/menuInventoryMatch.js';

const inventoryItem = (id, item_name, current_quantity = 1) => ({
  id,
  item_name,
  current_quantity,
  is_active: true,
});

test('volume parsing and product normalization support litre and millilitre labels', () => {
  assert.equal(extractVolumeMl('Four Cousins White 1 Litre'), 1000);
  assert.equal(extractVolumeMl('Four Cousins White 750ml'), 750);
  assert.equal(extractVolumeMl('Four Cousins White 500 ml'), 500);
  assert.equal(
    normalizeInventoryProductName('Four Cousins Sweet White (1.5L)'),
    normalizeInventoryProductName('four cousins sweet white')
  );
});

test('menu volume disambiguates inventory records for the same product', () => {
  const match = matchMenuInventory(
    { name: 'Four Cousins Sweet White 750ml' },
    [
      inventoryItem(1, 'Four Cousins Sweet White 1 Litre'),
      inventoryItem(2, 'Four Cousins Sweet White 750 ml'),
    ]
  );

  assert.equal(match.status, 'MATCHED');
  assert.equal(match.inventoryItem.id, 2);
  assert.equal(match.inventoryVolumeMl, 750);
});

test('a menu without volume matches a unique product and inherits inventory volume', () => {
  const fields = getMenuInventoryMatchFields(
    { name: 'Four Cousins Sweet White' },
    [inventoryItem(1, 'Four Cousins Sweet White 1.5L', 2)]
  );

  assert.equal(fields.inventory_match_status, 'MATCHED');
  assert.equal(fields.linked_inventory_item_id, 1);
  assert.equal(fields.linked_inventory_bottle_volume_ml, 1500);
  assert.equal(fields.stock_available, true);
});

test('a menu without volume flags multiple sizes for review instead of choosing one', () => {
  const match = matchMenuInventory(
    { name: 'Four Cousins Sweet White' },
    [
      inventoryItem(1, 'Four Cousins Sweet White 1 Litre'),
      inventoryItem(2, 'Four Cousins Sweet White 750ml'),
    ]
  );

  assert.equal(match.status, 'AMBIGUOUS');
  assert.equal(match.matchCount, 2);
  assert.equal(match.inventoryItem, null);
});

test('similar product names do not match and conflicting sizes are flagged', () => {
  const similarName = matchMenuInventory(
    { name: 'Four Cousins Sweet Red 750ml' },
    [inventoryItem(1, 'Four Cousins Sweet White 750ml')]
  );
  const wrongVolume = matchMenuInventory(
    { name: 'Four Cousins Sweet White 750ml' },
    [inventoryItem(2, 'Four Cousins Sweet White 1 Litre')]
  );

  assert.equal(similarName.status, 'MISSING');
  assert.equal(wrongVolume.status, 'VOLUME_MISMATCH');
});
