import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOpenShiftOrderClause,
  buildOpenShiftCashierQueueClause,
} from '../helpers/shiftVisibility.js';

test('active shift order visibility does not rely on the raw calendar date', () => {
  const orderClause = buildOpenShiftOrderClause({ staffId: 12, staffName: 'Alice' });
  assert.match(orderClause.sql, /COALESCE\(shift_cleared, false\) = false/);
  assert.match(orderClause.sql, /COALESCE\(day_cleared, false\) = false/);
  assert.doesNotMatch(orderClause.sql, /date\s*=|DATE\(/i);
  assert.deepEqual(orderClause.params, [12, 'Alice']);
});

test('cashier queue visibility stays open across midnight until the shift is explicitly cleared', () => {
  const queueClause = buildOpenShiftCashierQueueClause({ staffId: 12, staffName: 'Alice' });
  assert.match(queueClause.sql, /COALESCE\(shift_cleared, false\) = false/);
  assert.match(queueClause.sql, /status = 'Confirmed'/);
  assert.doesNotMatch(queueClause.sql, /created_at.*date|DATE\(created_at/i);
  assert.deepEqual(queueClause.params, [12, 'Alice']);
});
