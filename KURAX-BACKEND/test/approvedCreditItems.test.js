import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyApprovedCreditToItems,
  applyUnitCreditSettlement,
} from '../helpers/approvedCreditItems.js';

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

test('approved unit credit changes only the selected quantity unit', () => {
  const result = applyApprovedCreditToItems([
    {
      name: 'Tea',
      quantity: 2,
      unitStates: [
        { paid: true, paidAmount: 10 },
        { creditRequested: true, cashierQueueId: 44 },
      ],
      _rowPaid: false,
    },
    { name: 'Tea', quantity: 2, unitStates: [{}, {}] },
  ], {
    targetItem: { name: 'Tea', _orderItemIndex: 0, _unitIndex: 1 },
  });

  assert.equal(result.changed, true);
  assert.equal(result.items[0].unitStates[0].creditApproved, undefined);
  assert.equal(result.items[0].unitStates[1].creditApproved, true);
  assert.equal(result.items[0]._rowPaid, false);
  assert.deepEqual(result.items[1].unitStates, [{}, {}]);
});

test('partial credit settlement updates only the unit balance', () => {
  const result = applyUnitCreditSettlement({
    quantity: 2,
    price: 10,
    unitStates: [
      { paid: true, paidAmount: 10 },
      { creditRequested: true, creditApproved: true },
    ],
  }, 1, {
    amountPaid: 4,
    balance: 6,
    status: 'PartiallySettled',
    method: 'Cash',
    settledAt: '2026-11-28T00:00:00.000Z',
  });

  assert.equal(result.changed, true);
  assert.equal(result.item.unitStates[0].paidAmount, 10);
  assert.equal(result.item.unitStates[1].creditRequested, true);
  assert.equal(result.item.unitStates[1].creditBalance, 6);
  assert.equal(result.item.unitStates[1].is_partially_paid, true);
  assert.equal(result.item.paidAmount, 14);
  assert.equal(result.item._rowPaid, false);
});

test('fully settled unit credit marks only the selected unit paid', () => {
  const result = applyUnitCreditSettlement({
    quantity: 2,
    price: 10,
    unitStates: [
      { paid: true, paidAmount: 10 },
      { creditRequested: true, creditApproved: true },
    ],
  }, 1, {
    amountPaid: 10,
    balance: 0,
    status: 'FullySettled',
    method: 'Cash',
    settledAt: '2026-11-28T00:00:00.000Z',
  });

  assert.equal(result.item.unitStates[1].creditRequested, false);
  assert.equal(result.item.unitStates[1].paid, true);
  assert.equal(result.item._rowPaid, true);
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
