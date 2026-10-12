import test from 'node:test';
import assert from 'node:assert/strict';
import { itemAssignedToStation } from '../helpers/inventoryStations.js';

test('inventory ingredients are available only to explicitly assigned stations', () => {
  assert.equal(itemAssignedToStation('KITCHEN', 'KITCHEN'), true);
  assert.equal(itemAssignedToStation('BARMAN', 'BAR'), true);
  assert.equal(itemAssignedToStation('BARISTA', 'BARISTA'), true);
  assert.equal(itemAssignedToStation('KITCHEN, BAR', 'BAR'), true);
  assert.equal(itemAssignedToStation('KITCHEN|BARISTA', 'BARISTA'), true);
  assert.equal(itemAssignedToStation('KITCHEN', 'BAR'), false);
  assert.equal(itemAssignedToStation('', 'BAR'), false);
  assert.equal(itemAssignedToStation('ALL', 'BAR'), false);
  assert.equal(itemAssignedToStation('KITCHEN', 'UNKNOWN'), false);
});
