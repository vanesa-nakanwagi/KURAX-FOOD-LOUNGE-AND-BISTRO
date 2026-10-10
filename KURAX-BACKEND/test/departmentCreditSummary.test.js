import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeDepartmentCredits, updateCreditOrderItems } from '../helpers/departmentCreditSummary.js';

test('department credit summary separates partial, settled, and outstanding balances', () => {
  const summary = summarizeDepartmentCredits([
    { amount: 100, amount_paid: 0 },
    { amount: 100, amount_paid: 40 },
    { amount: 50, amount_paid: 50 },
  ]);

  assert.deepEqual(summary, {
    partially_paid_credit_count: 1,
    partially_paid_credit_amount: 40,
    partially_paid_credit_balance: 60,
    settled_credit_count: 1,
    settled_credit_amount: 50,
    outstanding_credit_count: 2,
    outstanding_credit_balance: 160,
  });
});

test('department credit summary clamps overpayment and ignores non-positive credits', () => {
  const summary = summarizeDepartmentCredits([
    { amount: 20, amount_paid: 25 },
    { amount: 0, amount_paid: 0 },
    { amount: -10, amount_paid: 5 },
  ]);

  assert.equal(summary.settled_credit_count, 1);
  assert.equal(summary.settled_credit_amount, 20);
  assert.equal(summary.outstanding_credit_count, 0);
  assert.equal(summary.outstanding_credit_balance, 0);
});

test('partial credit settlement does not mark the item fully paid', () => {
  const [item] = updateCreditOrderItems([
    { name: 'Burger', price: 100, quantity: 2, creditRequested: true },
  ], { label: 'Burger', amountPaid: 75, fullySettled: false });

  assert.equal(item._rowPaid, false);
  assert.equal(item.is_partially_paid, true);
  assert.equal(item.partial_amount_paid, 75);
  assert.equal(item.remaining_balance, 125);
  assert.equal(item.creditRequested, true);
});

test('fully settled credit marks only the matching item paid', () => {
  const [settled, untouched] = updateCreditOrderItems([
    { name: 'Burger', price: 100, quantity: 1, creditRequested: true },
    { name: 'Juice', price: 20, quantity: 1, creditRequested: true },
  ], { label: 'Burger', amountPaid: 100, fullySettled: true });

  assert.equal(settled._rowPaid, true);
  assert.equal(settled.is_partially_paid, false);
  assert.equal(settled.remaining_balance, 0);
  assert.equal(settled.creditRequested, false);
  assert.equal(untouched._rowPaid, undefined);
});