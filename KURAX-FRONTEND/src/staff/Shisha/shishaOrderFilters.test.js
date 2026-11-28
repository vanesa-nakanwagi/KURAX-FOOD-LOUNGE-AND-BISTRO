import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionShishaOrders } from './shishaOrderFilters.js';

test('fully paid Shisha orders are separated from incoming orders', () => {
  const paid = { id: 1, payment_status: 'FULLY_PAID' };
  const partiallyPaid = { id: 2, payment_status: 'PARTIALLY_PAID' };
  const unpaid = { id: 3, payment_status: 'UNPAID' };

  assert.deepEqual(partitionShishaOrders([paid, partiallyPaid, unpaid]), {
    incoming: [partiallyPaid, unpaid],
    fullyPaid: [paid],
  });
});
