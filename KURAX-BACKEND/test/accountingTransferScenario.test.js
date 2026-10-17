import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountTransferJournalLines,
  createAccountTransactionJournalEntry,
  ensureAccountingDataModel,
  resolveAccountTransferTargets,
  resolveSavingsAccount,
} from '../helpers/accounting.js';

const databaseUrl = process.env.DATABASE_URL || '';
const isLocalDatabase = databaseUrl.includes('localhost')
  || databaseUrl.includes('127.0.0.1')
  || databaseUrl.includes('@database:');
const databaseTestOptions = {
  skip: process.env.RUN_ACCOUNTING_DB_TESTS !== 'true' || !isLocalDatabase,
};

test('sample cash deposit uses the Counter Cash to Bank internal transfer journal pattern', () => {
  const source = resolveAccountTransferTargets({
    sourceName: 'Counter Cash',
    destinationName: 'Bank Account',
  });

  assert.equal(source.source.code, '1001');
  assert.equal(source.destination.code, '1002');

  const lines = buildAccountTransferJournalLines({
    amount: 500000,
    sourceAccount: source.source,
    destinationAccount: source.destination,
    description: 'Cash deposit',
  });

  assert.equal(lines.length, 2);
  assert.deepEqual(
    lines.map((line) => ({ accountCode: line.accountCode, debit: line.debit || 0, credit: line.credit || 0 })),
    [
      { accountCode: '1002', debit: 500000, credit: 0 },
      { accountCode: '1001', debit: 0, credit: 500000 },
    ]
  );
  assert.equal(lines.reduce((sum, line) => sum + (line.debit || 0) - (line.credit || 0), 0), 0);
});

test('internal transfers reject operating and fixed asset accounts', () => {
  assert.throws(() => resolveAccountTransferTargets({
    sourceName: 'Inventory',
    destinationName: 'Equipment',
  }), /eligible for internal transfers/i);
});

test('deposit and withdrawal post through the central journal flow using one selected account', databaseTestOptions, async () => {
  await ensureAccountingDataModel();
  const baseAmount = 250000 + (Date.now() % 2000);
  for (const [transactionType, amount, accountCode, counterpartAccountCode, classification] of [
    ['Deposit', baseAmount, '1005', '3001', 'OWNER_CAPITAL:3001'],
    ['Withdrawal', baseAmount + 25000, '1002', '5003', 'EXPENSE_PAYMENT:5003'],
  ]) {
    const result = await createAccountTransactionJournalEntry({
      amount,
      accountCode,
      counterpartAccountCode,
      classification,
      transactionDate: '2026-10-14',
      description: transactionType === 'Deposit' ? 'Cash deposit' : 'Cash withdrawal',
      postedBy: 'Accountant',
      transactionType,
      requestId: `account-test-${Date.now()}-${transactionType.toLowerCase()}-${amount}`,
    });

    assert.equal(result.duplicate, false);
    assert.deepEqual(
      [result.journal.entry_date.getFullYear(), result.journal.entry_date.getMonth() + 1, result.journal.entry_date.getDate()],
      [2026, 10, 14],
    );
    assert.equal(result.preview.length, 2);
    assert.equal(result.preview.reduce((sum, line) => sum + (line.debit || 0) - (line.credit || 0), 0), 0);
    assert.match(result.journal.source_transaction, /^account_transaction:/);
  }
});

test('Kurax Savings resolves as an eligible asset account and supports savings transfers', () => {
  const savings = resolveSavingsAccount();
  const transfer = resolveAccountTransferTargets({
    sourceName: 'Counter Cash',
    destinationName: 'Kurax Savings',
  });

  assert.ok(savings);
  assert.equal(savings.code, '1005');
  assert.equal(savings.category, 'Asset');
  assert.equal(transfer.source.code, '1001');
  assert.equal(transfer.destination.code, '1005');

  const lines = buildAccountTransferJournalLines({
    amount: 500000,
    sourceAccount: transfer.source,
    destinationAccount: transfer.destination,
    description: 'Savings deposit',
  });

  assert.deepEqual(
    lines.map((line) => ({ accountCode: line.accountCode, debit: line.debit || 0, credit: line.credit || 0 })),
    [
      { accountCode: '1005', debit: 500000, credit: 0 },
      { accountCode: '1001', debit: 0, credit: 500000 },
    ]
  );
});

test('an identical transaction retry is a duplicate and a changed payload conflicts', databaseTestOptions, async () => {
  await ensureAccountingDataModel();
  const uniqueAmount = 250000 + (Date.now() % 1000);
  const requestId = `account-test-retry-${Date.now()}`;
  const transaction = {
    amount: uniqueAmount,
    sourceAccountCode: '1001',
    destinationAccountCode: '1002',
    transactionDate: '2026-10-15',
    description: 'Cash deposit',
    postedBy: 'Accountant',
    transactionType: 'Transfer',
    requestId,
  };
  const first = await createAccountTransactionJournalEntry(transaction);
  const second = await createAccountTransactionJournalEntry(transaction);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.journal.id, first.journal.id);
  await assert.rejects(
    createAccountTransactionJournalEntry({ ...transaction, description: 'Changed transaction payload' }),
    { statusCode: 409 },
  );
});
