import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCashbookJournalLines,
  getCashbookActorCapabilities,
  normalizeCashbookDate,
  normalizeCashbookTransaction,
  validateCashbookCounterpart,
} from '../helpers/cashbook.js';

const receipt = {
  request_id: 'cashbook-test-request-001',
  transaction_date: '2026-11-15',
  transaction_type: 'Receipt',
  category: 'Customer Payment',
  description: 'Customer account settlement',
  cash_account_code: '1006',
  counterpart_account_code: '1101',
  payment_method: 'MTN Mobile Money',
  amount: '15000.25',
  external_reference: 'PAY-001',
};

test('cashbook normalizes a valid mobile-money receipt and preserves unique request identity', () => {
  assert.deepEqual(normalizeCashbookTransaction(receipt), {
    ...receipt,
    amount: 15000.25,
    external_reference: 'PAY-001',
  });
});

test('cashbook normalizes database Date values before journal posting', () => {
  assert.equal(normalizeCashbookDate(new Date('2026-11-15T00:00:00.000Z')), '2026-11-15');
  assert.equal(normalizeCashbookDate('2026-11-15'), '2026-11-15');
});

test('cashbook requires the payment method to match its ledger cash account', () => {
  assert.throws(
    () => normalizeCashbookTransaction({ ...receipt, cash_account_code: '1007' }),
    { statusCode: 400, message: 'The payment method must match the selected cashbook account.' }
  );
});

test('cashbook receipts and payments produce balanced, correctly sided journals', () => {
  const cash = { code: '1001', name: 'Counter Cash' };
  const receivable = { code: '1101', name: 'Accounts Receivable' };
  const receiptLines = buildCashbookJournalLines({ ...receipt, amount: 1000 }, cash, receivable);
  const paymentLines = buildCashbookJournalLines({
    transaction_type: 'Payment',
    amount: 700,
  }, cash, { code: '5003', name: 'Utilities' });

  assert.deepEqual(
    receiptLines.map(({ accountCode, debit, credit }) => [accountCode, debit, credit]),
    [['1001', 1000, 0], ['1101', 0, 1000]]
  );
  assert.deepEqual(
    paymentLines.map(({ accountCode, debit, credit }) => [accountCode, debit, credit]),
    [['5003', 700, 0], ['1001', 0, 700]]
  );
  for (const lines of [receiptLines, paymentLines]) {
    assert.equal(lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0);
  }
});

test('cashbook category validation rejects cash accounts as counterpart ledgers', () => {
  assert.throws(
    () => validateCashbookCounterpart('Expense', 'Payment', {
      code: '1001',
      name: 'Counter Cash',
      category: 'Asset',
      account_type: 'Cash',
      is_active: true,
    }),
    /non-cash Chart of Accounts entry/
  );
  assert.throws(
    () => validateCashbookCounterpart('Utilities', 'Payment', {
      code: '5002',
      name: 'Salaries / Wages',
      category: 'Expense',
      account_type: 'Operating Expense',
      is_active: true,
    }),
    /does not match/
  );
});

test('accountants can post cashbook entries while reversals remain restricted to managers and directors', () => {
  const accountant = getCashbookActorCapabilities({ id: 4, role: 'ACCOUNTANT' }, 4);
  const manager = getCashbookActorCapabilities({ id: 5, role: 'MANAGER' }, 4);
  const director = getCashbookActorCapabilities({ id: 4, role: 'DIRECTOR' }, 4);

  assert.equal(accountant.can_create, true);
  assert.equal(accountant.can_reverse, false);
  assert.equal(accountant.can_edit, true);
  assert.equal(manager.can_reverse, true);
  assert.equal(manager.can_edit, true);
  assert.equal(director.can_reverse, true);
  assert.equal(director.can_edit, true);
  assert.equal(getCashbookActorCapabilities({ id: 6, role: 'CASHIER' }).can_create, false);
});
