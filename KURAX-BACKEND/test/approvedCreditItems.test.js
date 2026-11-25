import test from 'node:test';
import assert from 'node:assert/strict';
import { applyApprovedCreditToItems } from '../helpers/approvedCreditItems.js';

test('approved item credit clears cashier-pending state on the exact order line', () => {
  const result = applyApprovedCreditToItems([
    { name: 'Tea', paymentRequested: true, _rowPaid: false },
    { name: 'Tea', paymentRequested: true, _rowPaid: false },
  ], { targetItem: { name: 'Tea', _orderItemIndex: 1 } });

  assert.equal(result.changed, true);
  assert.equal(result.items[0].creditApproved, undefined);
  assert.equal(result.items[1].paymentRequested, false);
  assert.equal(result.items[1].creditRequested, true);
  assert.equal(result.items[1].creditApproved, true);
});

test('whole-order credit approval marks only unpaid, non-voided lines', () => {
  const result = applyApprovedCreditToItems([
    { name: 'Unpaid', paymentRequested: true },
    { name: 'Paid', _rowPaid: true },
    { name: 'Voided', status: 'VOIDED' },
  ], { markAllUnpaid: true });

  assert.deepEqual(result.items.map(item => item.creditApproved === true), [true, false, false]);
  assert.equal(result.items[0].paymentRequested, false);
});
