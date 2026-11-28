import test from 'node:test';
import assert from 'node:assert/strict';
import { hasValidRetrospectiveCounts } from '../helpers/dayClosureValidation.js';

test('historical closure accepts non-negative retrospective counts with a note', () => {
  assert.equal(hasValidRetrospectiveCounts({
    final_cash: 0,
    final_card: '1200.50',
    final_mtn: 300,
    final_airtel: 0,
    notes: 'Reconciled against cashier records.',
  }), true);
});

test('historical closure requires every count and a non-empty note', () => {
  const valid = {
    final_cash: 1,
    final_card: 2,
    final_mtn: 3,
    final_airtel: 4,
    notes: 'Checked against records.',
  };

  assert.equal(hasValidRetrospectiveCounts({ ...valid, final_mtn: '' }), false);
  assert.equal(hasValidRetrospectiveCounts({ ...valid, final_airtel: -1 }), false);
  assert.equal(hasValidRetrospectiveCounts({ ...valid, final_card: 'not a number' }), false);
  assert.equal(hasValidRetrospectiveCounts({ ...valid, notes: '   ' }), false);
});
