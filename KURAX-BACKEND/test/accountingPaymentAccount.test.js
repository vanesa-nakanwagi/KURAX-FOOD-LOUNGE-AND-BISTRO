import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateIncomeStatementRevenue,
  buildAccountTransactionJournalLines,
  buildAccountTransferJournalLines,
  buildSalesRevenueBreakdown,
  getAccountTransactionOptions,
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

test('sales revenue is proportionally assigned to item departments and excludes voided items', () => {
  const breakdown = buildSalesRevenueBreakdown([
    { station: 'Kitchen', price: 10000, quantity: 2 },
    { station: 'Bar', price: 5000, quantity: 1 },
    { station: 'Barista', price: 5000, quantity: 1, status: 'VOIDED' },
  ], 25000);

  assert.deepEqual(breakdown, [
    { accountCode: '4001', amount: 20000 },
    { accountCode: '4002', amount: 5000 },
  ]);
  assert.equal(breakdown.reduce((sum, line) => sum + line.amount, 0), 25000);
});

test('all card receipts post directly to the bank account', () => {
  assert.equal(resolvePaymentDebitAccountCode('Card'), '1002');
  assert.equal(resolvePaymentDebitAccountCode('Visa', 'Pending'), '1002');
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

test('classified deposits debit the selected cash account and credit the capital source', () => {
  const lines = buildAccountTransactionJournalLines({
    transactionType: 'Deposit',
    amount: 1000000,
    account: { code: '1005', name: 'Kurax Savings', category: 'Asset', account_type: 'Savings', is_active: true },
    counterpartAccount: { code: '3001', name: "Owner's Capital", category: 'Equity', account_type: 'Capital', is_active: true },
    classification: 'OWNER_CAPITAL:3001',
  });

  assert.deepEqual(lines.map(({ accountCode, debit, credit }) => ({ accountCode, debit, credit })), [
    { accountCode: '1005', debit: 1000000, credit: 0 },
    { accountCode: '3001', debit: 0, credit: 1000000 },
  ]);
});

test('classified withdrawals debit an expense and credit the selected paying account', () => {
  const lines = buildAccountTransactionJournalLines({
    transactionType: 'Withdrawal',
    amount: 80000,
    account: { code: '1002', name: 'Bank', category: 'Asset', account_type: 'Bank', is_active: true },
    counterpartAccount: { code: '5003', name: 'Utilities', category: 'Expense', account_type: 'Operating Expense', is_active: true },
    classification: 'EXPENSE_PAYMENT:5003',
  });

  assert.deepEqual(lines.map(({ accountCode, debit, credit }) => ({ accountCode, debit, credit })), [
    { accountCode: '5003', debit: 80000, credit: 0 },
    { accountCode: '1002', debit: 0, credit: 80000 },
  ]);
});

test('classified transactions reject unknown purposes and mismatched counterpart accounts', () => {
  const input = {
    transactionType: 'Deposit',
    amount: 1000,
    account: { code: '1001', name: 'Counter Cash', category: 'Asset', account_type: 'Cash', is_active: true },
    counterpartAccount: { code: '4001', name: 'Food Sales', category: 'Revenue', account_type: 'Sales', is_active: true },
  };
  assert.throws(() => buildAccountTransactionJournalLines({ ...input, classification: '' }), /classification/i);
  assert.throws(() => buildAccountTransactionJournalLines({ ...input, classification: 'OWNER_CAPITAL:3001' }), /does not match/i);
});

test('transaction options only offer active postable mappings from the Chart of Accounts', () => {
  const options = getAccountTransactionOptions([
    { code: '1001', name: 'Counter Cash', category: 'Asset', account_type: 'Cash', is_active: true, is_postable: true },
    { code: '1002', name: 'Bank', category: 'Asset', account_type: 'Bank Account', is_active: true, is_postable: true },
    { code: '2001', name: 'Accounts Payable', category: 'Liability', account_type: 'Payable', is_active: true, is_postable: true },
    { code: '2101', name: 'Loan Payable', category: 'Liability', account_type: 'Loan', is_active: true, is_postable: true },
    { code: '3001', name: "Owner's Capital", category: 'Equity', account_type: 'Capital', is_active: true, is_postable: true },
    { code: '4006', name: 'Other Income', category: 'Revenue', account_type: 'Other Income', is_active: true, is_postable: true },
    { code: '5003', name: 'Utilities', category: 'Expense', account_type: 'Operating Expense', is_active: true, is_postable: true },
    { code: '5004', name: 'Inactive expense', category: 'Expense', account_type: 'Expense', is_active: false, is_postable: true },
    { code: '5005', name: 'Parent expense', category: 'Expense', account_type: 'Expense', is_active: true, is_postable: false },
  ]);

  assert.deepEqual(options.moneyAccounts.map((account) => account.code), ['1001', '1002']);
  assert.ok(options.deposit.some((option) => option.value === 'OWNER_CAPITAL:3001'));
  assert.ok(options.deposit.some((option) => option.value === 'LOAN_PROCEEDS:2101'));
  assert.ok(options.deposit.some((option) => option.value === 'OTHER_INCOME:4006'));
  assert.ok(options.withdrawal.some((option) => option.value === 'SUPPLIER_SETTLEMENT:2001' && option.requiresReference));
  assert.ok(options.withdrawal.some((option) => option.value === 'EXPENSE_PAYMENT:5003'));
  assert.ok(!options.withdrawal.some((option) => ['5004', '5005'].includes(option.counterpartAccountCode)));
});

test('deposit and withdrawal require a cash-like selected account and positive amount', () => {
  const input = {
    transactionType: 'Deposit',
    amount: 1000,
    counterpartAccount: { code: '3001', name: "Owner's Capital", category: 'Equity', account_type: 'Capital', is_active: true },
    classification: 'OWNER_CAPITAL:3001',
  };
  assert.throws(() => buildAccountTransactionJournalLines({ ...input, account: { code: '1201', category: 'Asset', account_type: 'Inventory', is_active: true } }), /cash, bank/i);
  assert.throws(() => buildAccountTransactionJournalLines({ ...input, amount: -1, account: { code: '1001', name: 'Counter Cash', category: 'Asset', account_type: 'Cash', is_active: true } }), /valid transaction amount/i);
});