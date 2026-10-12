import test from 'node:test';
import assert from 'node:assert/strict';
import { isShishaInventoryItem, shishaInventoryFilterSql } from '../helpers/inventoryFilters.js';

test('shisha inventory rows are filtered out of management views', () => {
  assert.equal(isShishaInventoryItem({ station: 'SHISHA', category: 'General' }), true);
  assert.equal(isShishaInventoryItem({ station: 'KITCHEN', category: 'Shisha' }), true);
  assert.equal(isShishaInventoryItem({ station: 'KITCHEN', category: 'General' }), false);
  assert.match(shishaInventoryFilterSql('ii'), /LOWER\(COALESCE\(ii\.station, ''\)\) <> 'shisha'/);
  assert.match(shishaInventoryFilterSql('ii'), /LOWER\(COALESCE\(ii\.category, ''\)\) <> 'shisha'/);
});
