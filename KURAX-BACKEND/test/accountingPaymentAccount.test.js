import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateIncomeStatementRevenue,
  buildAccountTransferJournalLines,
  resolveAccountTransferTargets,
  resolveIncomeStatementRevenueCode,
  resolvePaymentDebitAccountCode,
  resolveRevenueAccountCode,
} from '../helpers/accounting.js';

test('sales are posted to the revenue account for their department', () => {
  assert.equal(resolveRevenueAccountCode('Kitchen'), '4001');
  assert.equal(resolveRevenueAccountCode('Bar'), '4002');
  assert.equal(resolveRevenueAccountCode('Barman'), '4002');
  assert.equal(resolveRevenueAccountCode('Barista'), '4003');
});

test('unknown or missing sales departments are rejected', () => {
  assert.throws(() => resolveRevenueAccountCode(), /Unsupported sales department/);
  assert.throws(() => resolveRevenueAccountCode('Shisha'), /Unsupported sales department/);
});

test('income statement keeps paid sales and approved credit sales in their departments', () => {
  const revenue = aggregateIncomeStatementRevenue([
    { station: 'Kitchen', amount: '50000' },
    { station: 'Barman', amount: '25000' },
    { station: 'Barista', amount: '25000' },
  ]);

  assert.deepEqual(revenue, { '4001': 50000, '4002': 25000, '4003': 25000 });
  assert.equal(resolveIncomeStatementRevenueCode('', 'Coffee'), '4003');
});

test('card receipts stay in clearing until explicitly settled', () => {
  assert.equal(resolvePaymentDebitAccountCode('Card'), '1004');
  assert.equal(resolvePaymentDebitAccountCode('Visa', 'Pending'), '1004');
  assert.equal(resolvePaymentDebitAccountCode('Card', 'Settled'), '1002');
  assert.equal(resolvePaymentDebitAccountCode('Credit Card', 'fully settled'), '1002');
});

test('non-card receipts use their payment method account', () => {
  assert.equal(resolvePaymentDebitAccountCode('Cash', 'Settled'), '1001');
  assert.equal(resolvePaymentDebitAccountCode('Momo-MTN'), '1003');
  assert.equal(resolvePaymentDebitAccountCode('Airtel'), '1003');
  assert.equal(resolvePaymentDebitAccountCode('Credit'), '1101');
});

test('unknown payment methods are rejected rather than posted to cash', () => {
  assert.throws(() => resolvePaymentDebitAccountCode('Unknown tender'), /Unsupported payment method/);
});

test('internal cash-to-bank transfers resolve the correct chart-of-accounts entries and balanced journal lines', () => {
  const source = resolveAccountTransferTargets({ sourceName: 'Counter Cash', destinationName: 'Bank Account' });
  const lines = buildAccountTransferJournalLines({
    amount: 500000,
    sourceAccount: source.source,
    destinationAccount: source.destination,
    description: 'Cash deposit',
  });

  assert.equal(source.source.code, '1001');
  assert.equal(source.destination.code, '1002');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].accountCode, '1002');
  assert.equal(lines[0].debit, 500000);
  assert.equal(lines[1].accountCode, '1001');
  assert.equal(lines[1].credit, 500000);
  assert.equal(lines.reduce((sum, line) => sum + (line.debit || 0) - (line.credit || 0), 0), 0);
});

test('transfer validation rejects same accounts, unsupported account types, and malformed amounts', () => {
  assert.throws(() => resolveAccountTransferTargets({ sourceName: 'Counter Cash', destinationName: 'Counter Cash' }), /different/i);
  assert.throws(() => resolveAccountTransferTargets({ sourceName: 'Food Sales', destinationName: 'Bank' }), /eligible/i);
  assert.throws(() => buildAccountTransferJournalLines({ amount: 0, sourceAccount: { code: '1001' }, destinationAccount: { code: '1002' } }), /valid.*amount/i);
});