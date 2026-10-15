import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAccountTransferJournalLines,
  createInternalTransferJournalEntry,
  resolveAccountTransferTargets,
  resolveSavingsAccount,
} from '../helpers/accounting.js';

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

test('internal transfers are valid across active asset accounts, not only cash and bank', () => {
  const target = resolveAccountTransferTargets({
    sourceName: 'Inventory',
    destinationName: 'Equipment',
  });

  assert.equal(target.source.code, '1201');
  assert.equal(target.destination.code, '1501');
  assert.equal(target.source.category, 'Asset');
  assert.equal(target.destination.category, 'Asset');
});

test('deposit and withdrawal use the same balanced account transaction posting flow', async () => {
  const baseAmount = 250000 + (Date.now() % 2000);
  for (const [transactionType, amount] of [['Deposit', baseAmount], ['Withdrawal', baseAmount + 25000]]) {
    const result = await createInternalTransferJournalEntry({
      amount,
      sourceAccountCode: '1001',
      destinationAccountCode: '1002',
      sourceAccountName: 'Counter Cash',
      destinationAccountName: 'Bank',
      transactionDate: '2026-10-14',
      description: transactionType === 'Deposit' ? 'Cash deposit' : 'Cash withdrawal',
      postedBy: 'Accountant',
      transactionType,
    });

    assert.equal(result.duplicate, false);
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

test('reposting the same account movement under different labels is treated as a duplicate', async () => {
  const uniqueAmount = 250000 + (Date.now() % 1000);
  const first = await createInternalTransferJournalEntry({
    amount: uniqueAmount,
    sourceAccountCode: '1001',
    destinationAccountCode: '1002',
    sourceAccountName: 'Counter Cash',
    destinationAccountName: 'Bank',
    transactionDate: '2026-10-15',
    description: 'Cash deposit',
    postedBy: 'Accountant',
    transactionType: 'Transfer',
  });

  const second = await createInternalTransferJournalEntry({
    amount: uniqueAmount,
    sourceAccountCode: '1001',
    destinationAccountCode: '1002',
    sourceAccountName: 'Counter Cash',
    destinationAccountName: 'Bank',
    transactionDate: '2026-10-15',
    description: 'Cash withdrawal',
    postedBy: 'Accountant',
    transactionType: 'Withdrawal',
  });

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.journal.id, first.journal.id);
});
