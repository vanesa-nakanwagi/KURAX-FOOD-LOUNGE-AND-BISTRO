import crypto from 'node:crypto';
import pool from '../db.js';
import { toSearchPattern } from './pagination.js';

export const DEFAULT_ACCOUNTS = [
  { code: '1001', name: 'Counter Cash', category: 'Asset', account_type: 'Cash', normal_balance: 'Debit', description: 'Cash on hand' },
  { code: '1002', name: 'Bank', category: 'Asset', account_type: 'Bank', normal_balance: 'Debit', description: 'Operating bank account' },
  { code: '1003', name: 'Mobile Money', category: 'Asset', account_type: 'Mobile Money', normal_balance: 'Debit', description: 'Mobile money float' },
  { code: '1004', name: 'Card Settlement Clearing', category: 'Asset', account_type: 'Clearing', normal_balance: 'Debit', description: 'Card receipts awaiting settlement into the operating bank' },
  { code: '1005', name: 'Kurax Savings', category: 'Asset', account_type: 'Savings', normal_balance: 'Debit', description: 'Longer-term cash reserve account for Kurax savings and transfers' },
  { code: '1101', name: 'Accounts Receivable', category: 'Asset', account_type: 'Receivable', normal_balance: 'Debit', description: 'Customer credit balances' },
  { code: '1201', name: 'Inventory', category: 'Asset', account_type: 'Inventory', normal_balance: 'Debit', description: 'Stock on hand' },
  { code: '1501', name: 'Equipment', category: 'Asset', account_type: 'Fixed Asset', normal_balance: 'Debit', description: 'Equipment and machinery' },
  { code: '1601', name: 'Furniture', category: 'Asset', account_type: 'Fixed Asset', normal_balance: 'Debit', description: 'Furniture and fittings' },
  { code: '2001', name: 'Accounts Payable', category: 'Liability', account_type: 'Payable', normal_balance: 'Credit', description: 'Suppliers and expenses owed' },
  { code: '2101', name: 'Other Liabilities', category: 'Liability', account_type: 'Current Liability', normal_balance: 'Credit', description: 'Other obligations' },
  { code: '3001', name: "Owner's Capital", category: 'Equity', account_type: 'Capital', normal_balance: 'Credit', description: 'Owner capital introduced' },
  { code: '3002', name: 'Retained Earnings', category: 'Equity', account_type: 'Retained Earnings', normal_balance: 'Credit', description: 'Accumulated retained earnings' },
  { code: '3003', name: 'Current Period Profit/Loss', category: 'Equity', account_type: 'Current Period', normal_balance: 'Credit', description: 'Net profit/loss for the current period' },
  { code: '4001', name: 'Food Sales', category: 'Revenue', account_type: 'Sales', normal_balance: 'Credit', description: 'Food revenue' },
  { code: '4002', name: 'Bar Sales', category: 'Revenue', account_type: 'Sales', normal_balance: 'Credit', description: 'Bar revenue' },
  { code: '4003', name: 'Barista Sales', category: 'Revenue', account_type: 'Sales', normal_balance: 'Credit', description: 'Barista revenue' },
  { code: '4004', name: 'Shisha Sales', category: 'Revenue', account_type: 'Sales', normal_balance: 'Credit', description: 'Shisha revenue' },
  { code: '4005', name: 'Other Sales', category: 'Revenue', account_type: 'Sales', normal_balance: 'Credit', description: 'Other revenue streams' },
  { code: '5001', name: 'Rent', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Property rent' },
  { code: '5002', name: 'Salaries / Wages', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Payroll and wages' },
  { code: '5003', name: 'Utilities', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Electricity, water, internet' },
  { code: '5004', name: 'Transport', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Travel and transport' },
  { code: '5005', name: 'Cleaning', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Cleaning and sanitation' },
  { code: '5006', name: 'Repairs and Maintenance', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Maintenance and repair' },
  { code: '5007', name: 'Marketing', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Advertising and promotions' },
  { code: '5008', name: 'Petty Expenses', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Small operational expenses' },
  { code: '5009', name: 'Other Operating Expenses', category: 'Expense', account_type: 'Operating Expense', normal_balance: 'Debit', description: 'Other operating expenses' },
  { code: '5010', name: 'Cost of Goods Sold', category: 'Expense', account_type: 'Cost of Goods Sold', normal_balance: 'Debit', description: 'Ingredient costs recognized when menu items are sold' },
];

const CARD_PAYMENT_METHODS = new Set(['card', 'bankcard', 'creditcard', 'debitcard', 'visa', 'mastercard', 'pos']);

export function resolveRevenueAccountCode(department = '') {
  const normalized = String(department || '').trim().toLowerCase();
  const accountByDepartment = {
    kitchen: '4001',
    food: '4001',
    bar: '4002',
    barman: '4002',
    barista: '4003',
    other: '4005',
  };
  const accountCode = accountByDepartment[normalized];
  if (!accountCode) throw new Error(`Unsupported sales department: ${department || '(missing)'}`);
  return accountCode;
}

export function resolveIncomeStatementRevenueCode(station = '', category = '') {
  const normalizedStation = String(station || '').trim().toLowerCase();
  const normalizedCategory = String(category || '').trim().toLowerCase();

  if (normalizedStation === 'barista' || /barista|coffee|tea/.test(normalizedCategory)) return '4003';
  if (['bar', 'barman'].includes(normalizedStation) || /barman|bar|cocktail|drink|beer/.test(normalizedCategory)) return '4002';
  return '4001';
}

export function buildSalesRevenueBreakdown(items = [], amount) {
  const total = safeMoney(amount);
  const totals = new Map();
  for (const item of items) {
    if (!item || item.voidProcessed === true || item.status === 'VOIDED') continue;
    const station = String(item.station || 'kitchen').trim().toLowerCase();
    const department = ['kitchen', 'food', 'bar', 'barman', 'barista', 'other'].includes(station)
      ? station
      : 'other';
    const accountCode = resolveRevenueAccountCode(department);
    const itemAmount = (safeMoney(item.price || item.unit_price)) * (safeMoney(item.quantity) || 1);
    if (itemAmount > 0) totals.set(accountCode, (totals.get(accountCode) || 0) + itemAmount);
  }

  const sourceTotal = [...totals.values()].reduce((sum, value) => sum + value, 0);
  if (sourceTotal <= 0 || total <= 0) return [{ accountCode: '4001', amount: total }];
  const entries = [...totals.entries()];
  let allocated = 0;
  return entries.map(([accountCode, value], index) => {
    const allocatedAmount = index === entries.length - 1
      ? Math.round((total - allocated) * 100) / 100
      : Math.round((total * value / sourceTotal) * 100) / 100;
    allocated += allocatedAmount;
    return { accountCode, amount: allocatedAmount };
  }).filter((line) => line.amount > 0);
}

export function aggregateIncomeStatementRevenue(rows = []) {
  return rows.reduce((totals, row) => {
    const code = resolveIncomeStatementRevenueCode(row.station, row.category);
    totals[code] = (totals[code] || 0) + safeMoney(row.amount);
    return totals;
  }, {});
}

export function resolvePaymentDebitAccountCode(paymentMethod = 'Cash', settlementStatus = 'Pending') {
  const method = String(paymentMethod || 'Cash').trim().toLowerCase().replace(/[\s_-]+/g, '');

  if (CARD_PAYMENT_METHODS.has(method)) return '1002';

  const accountByMethod = {
    cash: '1001',
    mtn: '1003',
    momo: '1003',
    mobile: '1003',
    mobilemoney: '1003',
    airtel: '1003',
    momomtn: '1003',
    momoairtel: '1003',
    credit: '1101',
    receivable: '1101',
  };
  const accountCode = accountByMethod[method];
  if (!accountCode) throw new Error(`Unsupported payment method: ${paymentMethod}`);
  return accountCode;
}

export function safeMoney(value) {
  const asNumber = Number(value || 0);
  return Number.isFinite(asNumber) ? asNumber : 0;
}

function normalizeTransactionAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value > 9999999999.99) {
    throw new Error('Enter a valid transaction amount.');
  }
  return Math.round(value * 100) / 100;
}

export async function ensureAccountingDataModel() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
      account_type TEXT NOT NULL,
      normal_balance TEXT NOT NULL CHECK (normal_balance IN ('Debit', 'Credit')),
      is_active BOOLEAN DEFAULT true,
      parent_code TEXT,
      description TEXT,
      created_by TEXT DEFAULT 'System',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.accounting_periods (
      id SERIAL PRIMARY KEY,
      period_name TEXT NOT NULL UNIQUE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
      created_by TEXT DEFAULT 'System',
      closed_by TEXT,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.journal_entries (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      entry_date DATE NOT NULL,
      description TEXT NOT NULL,
      source_transaction TEXT,
      posted_by TEXT NOT NULL DEFAULT 'System',
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      reversal_of INTEGER REFERENCES public.journal_entries(id),
      reversal_reason TEXT,
      system_type TEXT NOT NULL DEFAULT 'MAIN' CHECK (system_type IN ('MAIN', 'SHISHA')),
      business_time TIME,
      posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'Posted' CHECK (status IN ('Draft', 'Posted', 'Reversed', 'Voided')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.general_ledger (
      id SERIAL PRIMARY KEY,
      journal_entry_id INTEGER NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
      account_code TEXT NOT NULL,
      account_name TEXT NOT NULL,
      debit NUMERIC(12,2) DEFAULT 0,
      credit NUMERIC(12,2) DEFAULT 0,
      entry_date DATE NOT NULL,
      business_time TIME,
      description TEXT,
      source_transaction TEXT,
      posted_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.accounting_audit_log (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      actor TEXT,
      details JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.accounts_receivable (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL,
      customer_name TEXT,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
      outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Outstanding' CHECK (status IN ('Outstanding', 'Partially Paid', 'Fully Settled')),
      payment_method TEXT,
      settlement_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.accounts_payable (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL,
      supplier_name TEXT,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
      outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Fully Paid')),
      due_date DATE,
      payment_method TEXT,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }

  await pool.query(`ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reversal_of INTEGER REFERENCES public.journal_entries(id)`);
  await pool.query(`ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS reversal_reason TEXT`);
  await pool.query(`ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS system_type TEXT NOT NULL DEFAULT 'MAIN'`);
  await pool.query(`ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS business_time TIME`);
  await pool.query(
    `UPDATE public.journal_entries je
     SET system_type = 'SHISHA'
     WHERE je.system_type <> 'SHISHA'
       AND (
         je.source_transaction ILIKE 'shisha%'
         OR EXISTS (
           SELECT 1 FROM public.general_ledger gl
           WHERE gl.journal_entry_id = je.id AND gl.account_code = '4004'
         )
       )`
  );
  await pool.query(`ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS journal_entries_system_type_check`);
  await pool.query(`ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_system_type_check CHECK (system_type IN ('MAIN', 'SHISHA'))`);
  await pool.query(`ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ`);
  await pool.query(`UPDATE public.journal_entries SET posted_at = created_at WHERE posted_at IS NULL`);
  await pool.query(`ALTER TABLE public.journal_entries ALTER COLUMN posted_at SET DEFAULT NOW()`);
  await pool.query(`ALTER TABLE public.journal_entries ALTER COLUMN posted_at SET NOT NULL`);
  await pool.query(`ALTER TABLE public.general_ledger ADD COLUMN IF NOT EXISTS business_time TIME`);
  await pool.query(
    `UPDATE public.journal_entries
     SET business_time = (posted_at AT TIME ZONE 'Africa/Kampala')::time
     WHERE business_time IS NULL AND posted_at IS NOT NULL`
  );
  await pool.query(
    `UPDATE public.general_ledger gl
     SET business_time = je.business_time
     FROM public.journal_entries je
     WHERE gl.journal_entry_id = je.id
       AND gl.business_time IS NULL
       AND je.business_time IS NOT NULL`
  );
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_reversal_of_unique ON public.journal_entries (reversal_of) WHERE reversal_of IS NOT NULL`);

  for (const account of DEFAULT_ACCOUNTS) {
    await pool.query(
      `INSERT INTO public.chart_of_accounts (
         code, name, category, account_type, normal_balance, is_active, description, created_by
       ) VALUES ($1, $2, $3, $4, $5, true, $6, 'System')
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         account_type = EXCLUDED.account_type,
         normal_balance = EXCLUDED.normal_balance,
         description = EXCLUDED.description,
         updated_at = NOW()`,
      [account.code, account.name, account.category, account.account_type, account.normal_balance, account.description]
    );
  }

  await pool.query(`UPDATE public.chart_of_accounts SET is_active = false, updated_at = NOW() WHERE code = '4004'`);

  const currentMonth = new Date();
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const periodName = monthStart.toISOString().slice(0, 7);
  await pool.query(
    `INSERT INTO public.accounting_periods (period_name, start_date, end_date, status, created_by)
     VALUES ($1, $2, $3, 'Open', 'System')
     ON CONFLICT (period_name) DO NOTHING`,
    [periodName, monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10)]
  );
}

export function isEligibleInternalTransferAccount(account = null) {
  if (!account) return false;
  const category = String(account.category || '').trim();
  const accountType = String(account.account_type || '').trim().toLowerCase();
  const eligibleTypes = new Set(['cash', 'bank', 'bank account', 'mobile money', 'clearing', 'savings']);
  return category === 'Asset'
    && account.is_active !== false
    && account.is_postable !== false
    && eligibleTypes.has(accountType);
}

export function resolveSavingsAccount(accounts = DEFAULT_ACCOUNTS, explicitCode = process.env.KURAX_SAVINGS_ACCOUNT_CODE || null) {
  const candidates = Array.isArray(accounts) && accounts.length ? accounts : DEFAULT_ACCOUNTS;
  const configuredCode = String(explicitCode || process.env.KURAX_SAVINGS_ACCOUNT_CODE || '').trim();

  if (configuredCode) {
    const match = candidates.find((account) => String(account.code || '').trim() === configuredCode && account.is_active !== false);
    if (match) return match;
  }

  const directMatches = [
    '1005',
    'Kurax Savings',
    'Savings',
    'Savings Account',
    'Operating Savings'
  ];

  for (const candidate of directMatches) {
    const match = candidates.find((account) => {
      if (account.is_active === false) return false;
      const codeMatches = String(account.code || '').trim() === String(candidate).trim();
      const label = String(account.name || account.account_name || '').trim().toLowerCase();
      return codeMatches || label.includes(String(candidate).trim().toLowerCase());
    });
    if (match) return match;
  }

  return candidates.find((account) => {
    const label = String(account.name || account.account_name || '').trim().toLowerCase();
    return account.category === 'Asset' && /kurax.*savings|savings/.test(label) && account.is_active !== false;
  }) || null;
}

export function resolveAccountTransferTargets({ sourceName, destinationName, sourceAccountCode, destinationAccountCode, accounts = DEFAULT_ACCOUNTS }) {
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const candidates = Array.isArray(accounts) && accounts.length ? accounts : DEFAULT_ACCOUNTS;
  const matchAccount = (needle, exactCode = null) => {
    if (!needle && !exactCode) return null;
    const normalizedNeedle = normalize(needle || exactCode);
    return candidates.find((account) => {
      const matchesCode = exactCode && String(account.code || '').trim() === String(exactCode).trim();
      const accountName = normalize(account.name || account.account_name || '');
      const normalizedAlias = accountName.replace(/\baccount\b/g, '').trim();
      const normalizedSearchAlias = normalizedNeedle.replace(/\baccount\b/g, '').trim();
      const matchesName = normalizedNeedle && (
        accountName.includes(normalizedNeedle)
        || normalizedNeedle.includes(accountName)
        || normalizedAlias === normalizedSearchAlias
        || accountName.includes(normalizedSearchAlias)
        || normalizedSearchAlias.includes(accountName)
      );
      return matchesCode || matchesName;
    }) || null;
  };

  let sourceAccount = matchAccount(sourceName, sourceAccountCode);
  let destinationAccount = matchAccount(destinationName, destinationAccountCode);

  if (!sourceAccount && sourceAccountCode) {
    sourceAccount = candidates.find((account) => String(account.code || '').trim() === String(sourceAccountCode).trim()) || null;
  }
  if (!destinationAccount && destinationAccountCode) {
    destinationAccount = candidates.find((account) => String(account.code || '').trim() === String(destinationAccountCode).trim()) || null;
  }

  if (!sourceAccount && sourceName) {
    throw new Error(`Source account ${sourceName} was not found in the chart of accounts.`);
  }
  if (!destinationAccount && destinationName) {
    throw new Error(`Destination account ${destinationName} was not found in the chart of accounts.`);
  }

  if (!sourceAccount || !destinationAccount) {
    throw new Error('Both source and destination accounts are required for an internal transfer.');
  }
  if (String(sourceAccount.code) === String(destinationAccount.code)) {
    throw new Error('Source and destination accounts must be different.');
  }
  if (!isEligibleInternalTransferAccount(sourceAccount)) {
    throw new Error(`Source account ${sourceAccount.name} is not eligible for internal transfers.`);
  }
  if (!isEligibleInternalTransferAccount(destinationAccount)) {
    throw new Error(`Destination account ${destinationAccount.name} is not eligible for internal transfers.`);
  }

  return { source: sourceAccount, destination: destinationAccount };
}

export function buildAccountTransferJournalLines({ amount, sourceAccount, destinationAccount, description = 'Cash deposit' }) {
  const sanitizedAmount = Number(amount);
  if (!Number.isFinite(sanitizedAmount) || sanitizedAmount <= 0 || sanitizedAmount > 9999999999.99) {
    throw new Error('Enter a valid transfer amount.');
  }
  if (!sourceAccount || !destinationAccount) {
    throw new Error('Both source and destination accounts are required for an internal transfer.');
  }
  if (String(sourceAccount.code || sourceAccount.account_code) === String(destinationAccount.code || destinationAccount.account_code)) {
    throw new Error('Source and destination accounts must be different.');
  }

  const normalizedAmount = Math.round(sanitizedAmount * 100) / 100;
  const finalDescription = String(description || '').trim() || 'Cash deposit';

  return [
    { accountCode: String(destinationAccount.code || destinationAccount.account_code), accountName: destinationAccount.name || destinationAccount.account_name || 'Destination Account', debit: normalizedAmount, description: finalDescription },
    { accountCode: String(sourceAccount.code || sourceAccount.account_code), accountName: sourceAccount.name || sourceAccount.account_name || 'Source Account', credit: normalizedAmount, description: finalDescription },
  ];
}

export function getAccountTransactionOptions(accounts = []) {
  const postableAccounts = (Array.isArray(accounts) ? accounts : []).filter((account) =>
    account.is_active !== false && account.is_postable !== false);
  const moneyAccounts = postableAccounts.filter(isEligibleInternalTransferAccount);
  const deposit = [];
  const withdrawal = [];

  for (const account of postableAccounts) {
    const code = String(account.code || account.account_code || '');
    const type = String(account.account_type || '').toLowerCase();
    if (account.category === 'Equity' && /capital/.test(type)) {
      deposit.push({ value: `OWNER_CAPITAL:${code}`, label: account.name, counterpartAccountCode: code });
    }
    if (account.category === 'Liability' && /loan/.test(type)) {
      deposit.push({ value: `LOAN_PROCEEDS:${code}`, label: account.name, counterpartAccountCode: code });
    }
    if (account.category === 'Revenue' && /other income/.test(type)) {
      deposit.push({ value: `OTHER_INCOME:${code}`, label: account.name, counterpartAccountCode: code });
    }
    if (account.category === 'Asset' && /receivable/.test(type)) {
      deposit.push({ value: `RECEIVABLE_COLLECTION:${code}`, label: account.name, counterpartAccountCode: code, requiresReference: true });
    }
    if (account.category === 'Liability' && /payable/.test(type)) {
      withdrawal.push({ value: `SUPPLIER_SETTLEMENT:${code}`, label: account.name, counterpartAccountCode: code, requiresReference: true });
    }
    if (account.category === 'Expense') {
      withdrawal.push({ value: `EXPENSE_PAYMENT:${code}`, label: account.name, counterpartAccountCode: code });
    }
  }

  return { moneyAccounts, deposit, withdrawal };
}

export function buildAccountTransactionJournalLines({
  transactionType,
  amount,
  account,
  counterpartAccount,
  classification,
  sourceAccount,
  destinationAccount,
  description,
}) {
  const type = String(transactionType || '').trim().toLowerCase();
  const normalizedAmount = normalizeTransactionAmount(amount);
  const finalDescription = String(description || '').trim() || 'Account transaction';

  if (type === 'transfer') {
    return buildAccountTransferJournalLines({ amount: normalizedAmount, sourceAccount, destinationAccount, description: finalDescription });
  }
  if (!['deposit', 'withdrawal'].includes(type)) {
    throw new Error('Transaction type must be Deposit, Withdrawal, or Transfer.');
  }
  if (!isEligibleInternalTransferAccount(account)) {
    throw new Error('The selected account must be an active cash, bank, mobile money, clearing, or savings account.');
  }
  if (!classification) throw new Error('Select a transaction classification.');
  if (!counterpartAccount || String(classification).split(':')[1] !== String(counterpartAccount.code || counterpartAccount.account_code)) {
    throw new Error('The classification does not match the selected counterpart account.');
  }

  const classificationType = String(classification).split(':')[0];
  const allowed = type === 'deposit'
    ? new Set(['OWNER_CAPITAL', 'LOAN_PROCEEDS', 'OTHER_INCOME', 'RECEIVABLE_COLLECTION'])
    : new Set(['EXPENSE_PAYMENT', 'SUPPLIER_SETTLEMENT']);
  if (!allowed.has(classificationType)) throw new Error('Select a valid transaction classification.');

  const cashLine = {
    accountCode: String(account.code || account.account_code),
    accountName: account.name || account.account_name || 'Cash Account',
    debit: type === 'deposit' ? normalizedAmount : 0,
    credit: type === 'withdrawal' ? normalizedAmount : 0,
    description: finalDescription,
  };
  const counterpartLine = {
    accountCode: String(counterpartAccount.code || counterpartAccount.account_code),
    accountName: counterpartAccount.name || counterpartAccount.account_name || 'Counterpart Account',
    debit: type === 'withdrawal' ? normalizedAmount : 0,
    credit: type === 'deposit' ? normalizedAmount : 0,
    description: finalDescription,
  };

  return type === 'deposit' ? [cashLine, counterpartLine] : [counterpartLine, cashLine];
}

export function buildSavingsDepositJournalLines({ amount, sourceAccount, destinationAccount = resolveSavingsAccount(), description = 'Deposit into savings' }) {
  const savingsAccount = destinationAccount || resolveSavingsAccount();
  if (!savingsAccount) {
    throw new Error('A valid Kurax Savings account is required for this deposit.');
  }
  if (!sourceAccount) {
    throw new Error('A valid source or classification account is required for a savings deposit.');
  }
  if (String(sourceAccount.code || sourceAccount.account_code) === String(savingsAccount.code || savingsAccount.account_code)) {
    throw new Error('The source and destination accounts must be different for a savings deposit.');
  }

  const normalized = Number(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('Enter a valid savings deposit amount.');
  }

  return [
    { accountCode: String(savingsAccount.code || savingsAccount.account_code), accountName: savingsAccount.name || savingsAccount.account_name || 'Kurax Savings', debit: Math.round(normalized * 100) / 100, description: String(description || '').trim() || 'Deposit into savings' },
    { accountCode: String(sourceAccount.code || sourceAccount.account_code), accountName: sourceAccount.name || sourceAccount.account_name || 'Source Account', credit: Math.round(normalized * 100) / 100, description: String(description || '').trim() || 'Deposit into savings' },
  ];
}

export function buildSavingsWithdrawalJournalLines({ amount, sourceAccount = resolveSavingsAccount(), destinationAccount, description = 'Withdrawal from savings' }) {
  const savingsAccount = sourceAccount || resolveSavingsAccount();
  if (!savingsAccount) {
    throw new Error('A valid Kurax Savings account is required for this withdrawal.');
  }
  if (!destinationAccount) {
    throw new Error('A valid destination account is required for a savings withdrawal.');
  }
  if (String(sourceAccount?.code || sourceAccount?.account_code || savingsAccount.code) === String(destinationAccount.code || destinationAccount.account_code)) {
    throw new Error('The source and destination accounts must be different for a savings withdrawal.');
  }

  const normalized = Number(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('Enter a valid savings withdrawal amount.');
  }

  return [
    { accountCode: String(destinationAccount.code || destinationAccount.account_code), accountName: destinationAccount.name || destinationAccount.account_name || 'Destination Account', debit: Math.round(normalized * 100) / 100, description: String(description || '').trim() || 'Withdrawal from savings' },
    { accountCode: String(savingsAccount.code || savingsAccount.account_code), accountName: savingsAccount.name || savingsAccount.account_name || 'Kurax Savings', credit: Math.round(normalized * 100) / 100, description: String(description || '').trim() || 'Withdrawal from savings' },
  ];
}

export async function getAccountByCode(code) {
  const result = await pool.query(
    `SELECT * FROM public.chart_of_accounts WHERE code = $1 AND is_active = true LIMIT 1`,
    [String(code)]
  );
  return result.rows[0] || null;
}

export async function listAccounts() {
  const result = await pool.query(
    `SELECT * FROM public.chart_of_accounts WHERE is_active = true ORDER BY code ASC`
  );
  return result.rows;
}

export async function listPostableAccounts(queryable = pool) {
  const result = await queryable.query(
    `SELECT * FROM public.chart_of_accounts WHERE is_active = true ORDER BY code ASC`
  );
  return result.rows.filter((account) => account.is_postable !== false);
}

export async function createJournalEntry({
  entryDate,
  businessTime,
  description,
  sourceTransaction,
  postedBy = 'System',
  lines,
  reference,
  systemType = 'MAIN',
  queryable = pool,
}) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('A journal entry requires at least one accounting line.');
  }

  const normalized = lines.map((line) => ({
    accountCode: String(line.accountCode || line.account_code || '').trim(),
    accountName: line.accountName || line.account_name || 'Account',
    debit: safeMoney(line.debit),
    credit: safeMoney(line.credit),
  }));

  const totalDebit = normalized.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = normalized.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry is imbalanced: debit ${totalDebit} vs credit ${totalCredit}`);
  }

  const finalReference = reference || `JE-${Date.now()}`;
  const finalDate = entryDate || new Date().toISOString().slice(0, 10);
  const finalBusinessTime = businessTime || new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Kampala',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

  const result = await queryable.query(
    `INSERT INTO public.journal_entries (reference, entry_date, business_time, description, source_transaction, posted_by, status, system_type)
     VALUES ($1, $2, $3, $4, $5, $6, 'Posted', $7)
     RETURNING *`,
    [finalReference, finalDate, finalBusinessTime, description || 'Accounting entry', sourceTransaction || 'Manual Entry', postedBy || 'System', systemType === 'SHISHA' ? 'SHISHA' : 'MAIN']
  );

  const journal = result.rows[0];

  for (const line of normalized) {
    if (!line.accountCode) {
      throw new Error('Every ledger line needs an account code.');
    }

    const account = await getAccountByCode(line.accountCode);
    if (!account) {
      throw new Error(`Account code ${line.accountCode} does not exist in the chart of accounts.`);
    }

    await queryable.query(
      `INSERT INTO public.general_ledger (
         journal_entry_id,
         account_code,
         account_name,
         debit,
         credit,
         entry_date,
         business_time,
         description,
         source_transaction,
         posted_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        journal.id,
        account.code,
        account.name,
        line.debit,
        line.credit,
        finalDate,
        finalBusinessTime,
        description || 'Accounting entry',
        sourceTransaction || 'Manual Entry',
        postedBy || 'System',
      ]
    );
  }

  await queryable.query(
    `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
     VALUES ('journal_entry', $1, 'posted', $2, $3)`,
    [journal.id, postedBy || 'System', JSON.stringify({ reference: finalReference, description: description || 'Accounting entry', totalDebit, totalCredit })]
  );

  return journal;
}

export async function postBackdatedExpense({
  amount,
  category,
  description,
  paymentAccountCode = '1001',
  transactionDate,
  businessTime = null,
  reason,
  actor = 'Accountant',
}) {
  const numericAmount = Math.round(Number(amount) * 100) / 100;
  const normalizedReason = String(reason || '').trim();
  const normalizedCategory = String(category || '').trim();
  const normalizedDescription = String(description || '').trim();
  const normalizedActor = String(actor || 'Accountant').trim().slice(0, 120) || 'Accountant';
  const date = String(transactionDate || '').trim();
  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 9999999999.99) {
    throw Object.assign(new Error('Enter a valid expense amount.'), { statusCode: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date) {
    throw Object.assign(new Error('Enter a valid transaction date.'), { statusCode: 400 });
  }
  const now = new Date();
  const kampalaParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const today = `${kampalaParts.find((part) => part.type === 'year').value}-${kampalaParts.find((part) => part.type === 'month').value}-${kampalaParts.find((part) => part.type === 'day').value}`;
  if (date > today) {
    throw Object.assign(new Error('A transaction cannot be posted to a future business date.'), { statusCode: 400 });
  }
  if (!normalizedCategory || !normalizedDescription || !normalizedReason) {
    throw Object.assign(new Error('Category, description, and posting reason are required.'), { statusCode: 400 });
  }
  if (normalizedReason.length > 1000) {
    throw Object.assign(new Error('The posting reason must be 1000 characters or fewer.'), { statusCode: 400 });
  }
  if (businessTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(businessTime)) {
    throw Object.assign(new Error('Enter a valid business time.'), { statusCode: 400 });
  }

  const expenseCode = resolveExpenseAccountCode(normalizedCategory);
  const paymentCode = String(paymentAccountCode || '1001').trim();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const periodResult = await client.query(
      `SELECT period_name, status FROM public.accounting_periods
       WHERE $1::date BETWEEN start_date AND end_date
       ORDER BY start_date DESC LIMIT 1 FOR SHARE`,
      [date]
    );
    if (!periodResult.rows.length) {
      throw Object.assign(new Error('No accounting period is configured for this transaction date. Create or open the appropriate period before posting.'), { statusCode: 409 });
    }
    if (periodResult.rows[0].status !== 'Open') {
      throw Object.assign(new Error(`${periodResult.rows[0].period_name} is a closed accounting period. Authorization or controlled reopening is required to post this transaction.`), { statusCode: 409 });
    }

    const accountResult = await client.query(
      `SELECT code, name FROM public.chart_of_accounts
       WHERE code = ANY($1::text[]) AND is_active = true`,
      [[expenseCode, paymentCode]]
    );
    const accounts = new Map(accountResult.rows.map((account) => [account.code, account]));
    const expenseAccount = accounts.get(expenseCode);
    const paymentAccount = accounts.get(paymentCode);
    if (!expenseAccount || !paymentAccount) {
      throw Object.assign(new Error('Select active expense and payment accounts from the chart of accounts.'), { statusCode: 400 });
    }

    const reference = `BEXP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const sourceTransaction = `backdated_expense:${reference}`;
    const journalDescription = `${normalizedCategory}: ${normalizedDescription}`;
    const journalResult = await client.query(
      `INSERT INTO public.journal_entries (
         reference, entry_date, business_time, description, source_transaction, posted_by, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'Posted') RETURNING *`,
      [reference, date, businessTime || null, journalDescription, sourceTransaction, normalizedActor]
    );
    const journal = journalResult.rows[0];

    for (const [account, debit, credit] of [
      [expenseAccount, numericAmount, 0],
      [paymentAccount, 0, numericAmount],
    ]) {
      await client.query(
        `INSERT INTO public.general_ledger (
           journal_entry_id, account_code, account_name, debit, credit,
           entry_date, business_time, description, source_transaction, posted_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [journal.id, account.code, account.name, debit, credit, date, businessTime || null,
          journalDescription, sourceTransaction, normalizedActor]
      );
    }

    const action = date < today ? 'backdated_expense_posted' : 'expense_posted';
    const auditDetails = JSON.stringify({
      reference,
      transaction_date: date,
      business_time: businessTime || null,
      posted_at: journal.posted_at,
      posted_by: normalizedActor,
      transaction_type: date < today ? 'Backdated Expense' : 'Expense',
      amount: numericAmount,
      category: normalizedCategory,
      payment_account: paymentCode,
      description: normalizedDescription,
      reason: normalizedReason,
      status: 'Posted',
    });
    await client.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('journal_entry', $1, $2, $3, $4)`,
      [journal.id, action, normalizedActor, auditDetails]
    );

    await client.query('COMMIT');
    return { journal, amount: numericAmount, category: normalizedCategory, account_code: expenseCode };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function reverseJournalEntry({ journalEntryId, reversalDate, reason, actor }) {
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) {
    throw Object.assign(new Error('A reason is required to reverse a journal entry.'), { statusCode: 400 });
  }
  if (normalizedReason.length > 1000) {
    throw Object.assign(new Error('The reversal reason must be 1000 characters or fewer.'), { statusCode: 400 });
  }

  const requestedDate = String(reversalDate || new Date().toISOString().slice(0, 10)).trim();
  const parsedDate = new Date(`${requestedDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    || !Number.isFinite(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== requestedDate) {
    throw Object.assign(new Error('A valid reversal date is required.'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const originalResult = await client.query(
      `SELECT * FROM public.journal_entries WHERE id = $1 FOR UPDATE`,
      [journalEntryId]
    );
    const original = originalResult.rows[0];
    if (!original) {
      throw Object.assign(new Error('Journal entry not found.'), { statusCode: 404 });
    }
    if (original.status !== 'Posted' || original.reversal_of) {
      throw Object.assign(new Error('Only unreversed posted journal entries can be reversed.'), { statusCode: 409 });
    }

    const existingReversal = await client.query(
      `SELECT id FROM public.journal_entries WHERE reversal_of = $1 LIMIT 1`,
      [original.id]
    );
    if (existingReversal.rows.length) {
      throw Object.assign(new Error('This journal entry has already been reversed.'), { statusCode: 409 });
    }

    const linesResult = await client.query(
      `SELECT account_code, account_name, debit, credit
       FROM public.general_ledger WHERE journal_entry_id = $1 ORDER BY id FOR SHARE`,
      [original.id]
    );
    if (!linesResult.rows.length) {
      throw Object.assign(new Error('The original journal has no ledger lines and cannot be reversed.'), { statusCode: 409 });
    }

    let periodResult = await client.query(
      `SELECT start_date::text AS start_date
       FROM public.accounting_periods
       WHERE status = 'Open' AND $1::date BETWEEN start_date AND end_date
       ORDER BY start_date DESC LIMIT 1 FOR SHARE`,
      [requestedDate]
    );
    let effectiveDate = requestedDate;
    if (!periodResult.rows.length) {
      periodResult = await client.query(
        `SELECT start_date::text AS start_date
         FROM public.accounting_periods
         WHERE status = 'Open' AND start_date > $1::date
         ORDER BY start_date ASC LIMIT 1 FOR SHARE`,
        [requestedDate]
      );
      if (!periodResult.rows.length) {
        throw Object.assign(new Error('No open accounting period is available on or after the requested reversal date.'), { statusCode: 409 });
      }
      effectiveDate = periodResult.rows[0].start_date;
    }

    const finalActor = String(actor || 'Accountant').trim().slice(0, 120) || 'Accountant';
    const reference = `REV-${original.id}-${Date.now()}`;
    const description = `Reversal of ${original.reference}: ${normalizedReason}`;
    const reversalResult = await client.query(
      `INSERT INTO public.journal_entries (
         reference, entry_date, description, source_transaction, posted_by,
         reversal_of, reversal_reason, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Posted') RETURNING *`,
      [reference, effectiveDate, description, `Reversal of ${original.reference}`, finalActor, original.id, normalizedReason]
    );
    const reversal = reversalResult.rows[0];

    for (const line of linesResult.rows) {
      await client.query(
        `INSERT INTO public.general_ledger (
           journal_entry_id, account_code, account_name, debit, credit,
           entry_date, description, source_transaction, posted_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [reversal.id, line.account_code, line.account_name, line.credit, line.debit,
          effectiveDate, description, `Reversal of ${original.reference}`, finalActor]
      );
    }

    const updatedOriginalResult = await client.query(
      `UPDATE public.journal_entries SET status = 'Reversed' WHERE id = $1 AND status = 'Posted' RETURNING *`,
      [original.id]
    );
    if (!updatedOriginalResult.rows.length) {
      throw Object.assign(new Error('The original journal entry is no longer posted.'), { statusCode: 409 });
    }
    const auditDetails = JSON.stringify({
      reversal_id: reversal.id,
      reversal_reference: reference,
      reversal_date: effectiveDate,
      reason: normalizedReason,
    });
    await client.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('journal_entry', $1, 'reversed', $2, $3)`,
      [original.id, finalActor, auditDetails]
    );
    await client.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('journal_entry', $1, 'posted_reversal', $2, $3)`,
      [reversal.id, finalActor, JSON.stringify({ original_id: original.id, original_reference: original.reference, reversal_date: effectiveDate, reason: normalizedReason })]
    );

    await client.query('COMMIT');
    return { original: updatedOriginalResult.rows[0], reversal, effectiveDate };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function resolveExpenseAccountCode(category = '') {
  const normalized = String(category || '').trim().toLowerCase();

  if (normalized.includes('furniture') || normalized.includes('fitting')) return '1601';
  if (normalized.includes('rent')) return '5001';
  if (normalized.includes('salary') || normalized.includes('wage') || normalized.includes('staff')) return '5002';
  if (normalized.includes('utility')) return '5003';
  if (normalized.includes('transport')) return '5004';
  if (normalized.includes('clean')) return '5005';
  if (normalized.includes('repair') || normalized.includes('maint')) return '5006';
  if (normalized.includes('market')) return '5007';
  if (normalized.includes('petty') || normalized.includes('general')) return '5008';
  if (normalized.includes('stock') || normalized.includes('supply') || normalized.includes('inventory')) return '5009';
  if (normalized.includes('other')) return '5009';

  return '5008';
}

export async function createAccountTransactionJournalEntry({
  amount,
  sourceAccountCode,
  destinationAccountCode,
  transactionDate,
  businessTime = null,
  description = 'Cash deposit',
  referenceNumber = null,
  postedBy = 'Accountant',
  transactionType = 'Transfer',
  sourceAccountName = null,
  destinationAccountName = null,
}) {
  const normalizedType = String(transactionType || 'Transfer').trim() || 'Transfer';
  const supportedTypes = new Set(['transfer', 'deposit', 'withdrawal']);
  if (!supportedTypes.has(normalizedType.toLowerCase())) {
    throw Object.assign(new Error('This accounting module supports Transfer, Deposit, and Withdrawal transactions only.'), { statusCode: 400 });
  }

  const date = String(transactionDate || '').trim();
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(parsedDate.getTime())
    || parsedDate.toISOString().slice(0, 10) !== date) {
    throw Object.assign(new Error('Enter a valid transaction date.'), { statusCode: 400 });
  }

  const now = new Date();
  const kampalaParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const today = `${kampalaParts.find((part) => part.type === 'year').value}-${kampalaParts.find((part) => part.type === 'month').value}-${kampalaParts.find((part) => part.type === 'day').value}`;
  if (date > today) {
    throw Object.assign(new Error('A transaction cannot be posted to a future business date.'), { statusCode: 400 });
  }

  const accounts = await listAccounts();
  const targetAccounts = resolveAccountTransferTargets({
    sourceName: sourceAccountName || sourceAccountCode,
    destinationName: destinationAccountName || destinationAccountCode,
    sourceAccountCode,
    destinationAccountCode,
    accounts,
  });
  const journalLines = buildAccountTransferJournalLines({
    amount,
    sourceAccount: targetAccounts.source,
    destinationAccount: targetAccounts.destination,
    description,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const periodResult = await client.query(
      `SELECT period_name, status FROM public.accounting_periods
       WHERE $1::date BETWEEN start_date AND end_date
       ORDER BY start_date DESC LIMIT 1 FOR SHARE`,
      [date]
    );
    if (!periodResult.rows.length) {
      throw Object.assign(new Error('No accounting period is configured for this transaction date. Create or open the appropriate period before posting.'), { statusCode: 409 });
    }
    if (periodResult.rows[0].status !== 'Open') {
      throw Object.assign(new Error(`${periodResult.rows[0].period_name} is a closed accounting period. Authorization or controlled reopening is required to post this transaction.`), { statusCode: 409 });
    }

    const dedupKey = `account_transaction:${crypto.createHash('sha256').update(JSON.stringify({
      amount: Number(amount),
      sourceAccountCode: targetAccounts.source.code,
      destinationAccountCode: targetAccounts.destination.code,
      transactionDate: date,
    })).digest('hex').slice(0, 24)}`;

    const existingResult = await client.query(
      `SELECT * FROM public.journal_entries WHERE source_transaction = $1 LIMIT 1 FOR UPDATE`,
      [dedupKey]
    );
    if (existingResult.rows.length) {
      await client.query('COMMIT');
      return { journal: existingResult.rows[0], duplicate: true, preview: journalLines, source_transaction: dedupKey };
    }

    const reference = `${normalizedType.toUpperCase().slice(0, 3)}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const finalDescription = String(description || '').trim() || 'Cash deposit';
    const finalReferenceNumber = referenceNumber && String(referenceNumber).trim() ? String(referenceNumber).trim() : null;
    const journalResult = await client.query(
      `INSERT INTO public.journal_entries (
         reference, entry_date, business_time, description, source_transaction, posted_by, status, system_type
       ) VALUES ($1, $2, $3, $4, $5, $6, 'Posted', 'MAIN') RETURNING *`,
      [reference, date, businessTime || null, finalDescription, dedupKey, String(postedBy || 'Accountant').slice(0, 120) || 'Accountant']
    );
    const journal = journalResult.rows[0];

    for (const line of journalLines) {
      const account = await getAccountByCode(line.accountCode);
      if (!account) {
        throw Object.assign(new Error(`Account code ${line.accountCode} is not active in the chart of accounts.`), { statusCode: 400 });
      }
      await client.query(
        `INSERT INTO public.general_ledger (
           journal_entry_id, account_code, account_name, debit, credit,
           entry_date, business_time, description, source_transaction, posted_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [journal.id, account.code, account.name, line.debit || 0, line.credit || 0, date, businessTime || null, finalDescription, dedupKey, String(postedBy || 'Accountant').slice(0, 120) || 'Accountant']
      );
    }

    await client.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('journal_entry', $1, 'account_transaction_posted', $2, $3)`,
      [journal.id, String(postedBy || 'Accountant').slice(0, 120) || 'Accountant', JSON.stringify({
        transaction_type: normalizedType,
        source_account: targetAccounts.source.code,
        destination_account: targetAccounts.destination.code,
        transaction_date: date,
        amount: Number(amount),
        reference_number: finalReferenceNumber,
        description: finalDescription,
        source_transaction: dedupKey,
      })]
    );

    await client.query('COMMIT');
    return { journal, duplicate: false, preview: journalLines, source_transaction: dedupKey };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createInternalTransferJournalEntry({
  amount,
  sourceAccountCode,
  destinationAccountCode,
  transactionDate,
  businessTime = null,
  description = 'Cash deposit',
  referenceNumber = null,
  postedBy = 'Accountant',
  transactionType = 'Transfer',
  sourceAccountName = null,
  destinationAccountName = null,
}) {
  return createAccountTransactionJournalEntry({
    amount,
    sourceAccountCode,
    destinationAccountCode,
    transactionDate,
    businessTime,
    description,
    referenceNumber,
    postedBy,
    transactionType,
    sourceAccountName,
    destinationAccountName,
  });
}

export async function createExpenseJournalEntry({
  amount,
  category,
  description,
  paymentAccountCode = '1001',
  sourceTransaction,
  postedBy = 'Accountant',
  entryDate,
}) {
  const numericAmount = safeMoney(amount);
  const expenseCode = resolveExpenseAccountCode(category);
  const cashAccount = await getAccountByCode(paymentAccountCode);
  const expenseAccount = await getAccountByCode(expenseCode);

  if (!cashAccount) {
    throw new Error(`Payment account ${paymentAccountCode} is not defined in the chart of accounts.`);
  }

  if (!expenseAccount) {
    throw new Error(`Expense account ${expenseCode} is not defined in the chart of accounts.`);
  }

  const journal = await createJournalEntry({
    entryDate,
    description: description || `Expense - ${category || 'General'}`,
    sourceTransaction: sourceTransaction || `expense:${category || 'general'}`,
    postedBy,
    lines: [
      { accountCode: expenseCode, accountName: expenseAccount.name, debit: numericAmount },
      { accountCode: paymentAccountCode, accountName: cashAccount.name, credit: numericAmount },
    ],
  });

  return journal;
}

export async function createSalesJournalEntry({
  amount,
  paymentMethod = 'Cash',
  settlementStatus = 'Pending',
  businessTime,
  revenueAccountCode = '4001',
  revenueBreakdown,
  description,
  sourceTransaction,
  postedBy = 'System',
  entryDate,
  queryable,
}) {
  const numericAmount = safeMoney(amount);
  if (numericAmount <= 0) throw new Error('Sales amount must be greater than zero.');
  const debitAccountCode = resolvePaymentDebitAccountCode(paymentMethod, settlementStatus);
  const normalizedBreakdown = Array.isArray(revenueBreakdown) && revenueBreakdown.length
    ? revenueBreakdown.map((line) => ({
        accountCode: String(line.accountCode || '').trim(),
        amount: safeMoney(line.amount),
      }))
    : [{ accountCode: revenueAccountCode, amount: numericAmount }];
  const breakdownTotal = normalizedBreakdown.reduce((sum, line) => sum + line.amount, 0);
  if (normalizedBreakdown.some((line) => !line.accountCode || line.amount <= 0)
    || Math.abs(breakdownTotal - numericAmount) > 0.01) {
    throw new Error('Sales revenue breakdown must contain positive amounts equal to the sale total.');
  }

  const createEntry = async (client) => {
    const source = sourceTransaction || `sale:${(paymentMethod || 'Cash').toLowerCase()}:${crypto.randomUUID()}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`accounting-sale:${source}`]);
    const existing = await client.query(
      `SELECT * FROM public.journal_entries
       WHERE source_transaction = $1 AND system_type = 'MAIN' AND status <> 'Voided'
       ORDER BY id LIMIT 1`,
      [source]
    );
    if (existing.rows[0]) return existing.rows[0];

    const debitAccount = await getAccountByCode(debitAccountCode);
    if (!debitAccount) {
      throw new Error(`Sales debit account ${debitAccountCode} is not defined in the chart of accounts.`);
    }
    const lines = [{ accountCode: debitAccountCode, accountName: debitAccount.name, debit: numericAmount }];
    for (const revenueLine of normalizedBreakdown) {
      const revenueAccount = await getAccountByCode(revenueLine.accountCode);
      if (!revenueAccount) {
        throw new Error(`Revenue account ${revenueLine.accountCode} is not defined in the chart of accounts.`);
      }
      lines.push({
        accountCode: revenueAccount.code,
        accountName: revenueAccount.name,
        credit: revenueLine.amount,
      });
    }
    return createJournalEntry({
      entryDate: entryDate || new Intl.DateTimeFormat('en-CA', {
        timeZone: process.env.KURAX_BUSINESS_TIME_ZONE || 'Africa/Kampala',
      }).format(new Date()),
      businessTime,
      description: description || `Sales - ${paymentMethod || 'Cash'}`,
      sourceTransaction: source,
      postedBy,
      lines,
      queryable: client,
    });
  };

  if (queryable) return createEntry(queryable);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const journal = await createEntry(client);
    await client.query('COMMIT');
    return journal;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function createReceivableSettlementJournalEntry({
  amount,
  paymentMethod = 'Cash',
  settlementStatus = 'Pending',
  sourceTransaction,
  postedBy = 'System',
  entryDate,
  queryable = pool,
}) {
  const numericAmount = safeMoney(amount);
  if (numericAmount <= 0) throw new Error('Credit settlement amount must be greater than zero.');
  const accountCode = resolvePaymentDebitAccountCode(paymentMethod, settlementStatus);
  const debitAccount = await getAccountByCode(accountCode);
  const receivableAccount = await getAccountByCode('1101');

  if (!debitAccount || !receivableAccount) {
    throw new Error('Counter cash and accounts receivable accounts must exist to post a settlement.');
  }

  return createJournalEntry({
    entryDate: entryDate || new Intl.DateTimeFormat('en-CA', {
      timeZone: process.env.KURAX_BUSINESS_TIME_ZONE || 'Africa/Kampala',
    }).format(new Date()),
    description: `Credit settlement via ${paymentMethod}`,
    sourceTransaction: sourceTransaction || `credit_settlement:${paymentMethod.toLowerCase()}:${crypto.randomUUID()}`,
    postedBy,
    lines: [
      { accountCode: accountCode, accountName: debitAccount.name, debit: numericAmount },
      { accountCode: '1101', accountName: receivableAccount.name, credit: numericAmount },
    ],
    queryable,
  });
}

export async function syncConfirmedCashierSales({ startDate, endDate, limit = 500 } = {}) {
  const params = [];
  let dateFilter = '';
  if (startDate && endDate) {
    params.push(startDate, endDate);
    dateFilter = `AND (cq.confirmed_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date`;
  }
  params.push(Math.max(1, Math.min(Number(limit) || 500, 2000)));
  const result = await pool.query(
    `SELECT cq.id, cq.amount, cq.method, cq.table_name, cq.order_ids, cq.item, cq.is_item,
            cq.confirmed_by, cq.confirmed_at
     FROM public.cashier_queue cq
     WHERE cq.status = 'Confirmed'
       AND cq.amount > 0
       AND LOWER(COALESCE(cq.method, '')) <> 'credit'
       AND cq.public_order_ref IS NULL
       ${dateFilter}
       AND NOT EXISTS (
         SELECT 1 FROM public.journal_entries je
         WHERE je.source_transaction = 'cashier_queue:' || cq.id::text
           AND je.system_type = 'MAIN' AND je.status <> 'Voided'
       )
     ORDER BY cq.confirmed_at, cq.id
     LIMIT $${params.length}`,
    params
  );

  let posted = 0;
  for (const sale of result.rows) {
    let saleItems = [];
    if (sale.is_item && sale.item) {
      saleItems = [sale.item];
    } else if (Array.isArray(sale.order_ids) && sale.order_ids.length) {
      const orders = await pool.query(
        'SELECT items FROM public.orders WHERE id = ANY($1::int[])',
        [sale.order_ids]
      );
      saleItems = orders.rows.flatMap((order) => {
        if (Array.isArray(order.items)) return order.items;
        if (typeof order.items === 'string') {
          try {
            const parsed = JSON.parse(order.items);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return [];
      });
    }
    await createSalesJournalEntry({
      amount: sale.amount,
      paymentMethod: sale.method,
      revenueBreakdown: buildSalesRevenueBreakdown(saleItems, sale.amount),
      description: `Cashier sale · ${sale.table_name || 'WALK-IN'}`,
      sourceTransaction: `cashier_queue:${sale.id}`,
      postedBy: sale.confirmed_by || 'System',
      entryDate: sale.confirmed_at
        ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date(sale.confirmed_at))
        : undefined,
    });
    posted += 1;
  }
  return posted;
}

export async function getTrialBalance(startDate, endDate, startTime = null, endTime = null) {
  const result = await pool.query(
    `SELECT
       gl.account_code,
       gl.account_name,
       COALESCE(SUM(gl.debit), 0) AS total_debit,
       COALESCE(SUM(gl.credit), 0) AS total_credit
     FROM public.general_ledger gl
       JOIN public.journal_entries je ON je.id = gl.journal_entry_id AND je.system_type = 'MAIN'
     WHERE gl.entry_date BETWEEN $1 AND $2
         AND gl.account_code <> '4004'
       AND ($3::time IS NULL OR gl.business_time >= $3::time)
       AND ($4::time IS NULL OR gl.business_time <= $4::time)
     GROUP BY gl.account_code, gl.account_name
     ORDER BY gl.account_code ASC`,
    [startDate, endDate, startTime, endTime]
  );

  return result.rows.map((row) => ({
    account_code: row.account_code,
    account_name: row.account_name,
    total_debit: Number(row.total_debit || 0),
    total_credit: Number(row.total_credit || 0),
    balance: Number(row.total_debit || 0) - Number(row.total_credit || 0),
  }));
}

export async function getIncomeStatement(startDate, endDate, startTime = null, endTime = null) {
  const [result, salesResult, refundsResult] = await Promise.all([pool.query(
    `SELECT
       coa.code,
       coa.name,
       coa.category,
       COALESCE(SUM(gl.credit), 0) AS credit_total,
       COALESCE(SUM(gl.debit), 0) AS debit_total
     FROM public.chart_of_accounts coa
     LEFT JOIN public.general_ledger gl
       ON gl.account_code = coa.code AND gl.entry_date BETWEEN $1 AND $2
         AND gl.account_code <> '4004'
         AND EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = gl.journal_entry_id AND je.system_type = 'MAIN')
         AND ($3::time IS NULL OR gl.business_time >= $3::time)
         AND ($4::time IS NULL OR gl.business_time <= $4::time)
     WHERE coa.category IN ('Revenue', 'Expense') AND coa.is_active = true AND coa.code <> '4004'
     GROUP BY coa.code, coa.name, coa.category
     ORDER BY coa.code ASC`,
    [startDate, endDate, startTime, endTime]
  ), pool.query(
    `SELECT
       item->>'station' AS station,
       item->>'category' AS category,
       COALESCE(
         NULLIF(item->>'line_total', '')::numeric,
         NULLIF(item->>'lineTotal', '')::numeric,
         COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
           * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)
       ) AS amount,
       COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
         * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1) AS gross_amount
     FROM public.orders o
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
     LEFT JOIN LATERAL (
       SELECT c.id, c.approved_at, c.created_at
       FROM public.credits c
       LEFT JOIN public.cashier_queue cq ON cq.id = c.cashier_queue_id
       WHERE c.order_id = o.id
         AND c.status IN ('Approved', 'PartiallySettled', 'FullySettled')
         AND (
           LOWER(BTRIM(COALESCE(cq.item->>'name', ''))) = LOWER(BTRIM(COALESCE(item->>'name', '')))
           OR LOWER(BTRIM(COALESCE(c.label, ''))) = LOWER(BTRIM(COALESCE(item->>'name', '')))
         )
       ORDER BY c.approved_at DESC NULLS LAST, c.created_at DESC
       LIMIT 1
     ) approved_credit ON true
     WHERE UPPER(COALESCE(item->>'station', '')) NOT LIKE '%SHISHA%'
       AND UPPER(COALESCE(item->>'category', '')) NOT LIKE '%SHISHA%'
       AND (
         (
           approved_credit.id IS NOT NULL
           AND COALESCE(approved_credit.approved_at, approved_credit.created_at) IS NOT NULL
           AND (COALESCE(approved_credit.approved_at, approved_credit.created_at) AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
           AND ($3::time IS NULL OR (COALESCE(approved_credit.approved_at, approved_credit.created_at) AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (COALESCE(approved_credit.approved_at, approved_credit.created_at) AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         )
         OR (
           approved_credit.id IS NULL
           AND (
             COALESCE(item->>'_rowPaid', 'false') = 'true'
             OR (o.public_order_ref IS NOT NULL AND o.payment_confirmed = true)
           )
           AND UPPER(COALESCE(item->>'payment_method', '')) NOT LIKE '%CREDIT%'
           AND COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at) IS NOT NULL
           AND (COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at) AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
           AND ($3::time IS NULL OR (COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at) AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at) AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         )
       )
     ORDER BY o.id`,
    [startDate, endDate, startTime, endTime]
  ), pool.query(
    `SELECT item->>'station' AS station, item->>'category' AS category,
            COALESCE(
              NULLIF(item->>'line_total', '')::numeric,
              NULLIF(item->>'lineTotal', '')::numeric,
              COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)
            ) AS amount
     FROM public.void_requests vr
     JOIN public.orders o ON o.id = vr.order_id
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
     LEFT JOIN LATERAL (
       SELECT c.id
       FROM public.credits c
       LEFT JOIN public.cashier_queue cq ON cq.id = c.cashier_queue_id
       WHERE c.order_id = o.id
         AND c.status IN ('Approved', 'PartiallySettled', 'FullySettled')
         AND (LOWER(BTRIM(COALESCE(cq.item->>'name', ''))) = LOWER(BTRIM(COALESCE(item->>'name', '')))
           OR LOWER(BTRIM(COALESCE(c.label, ''))) = LOWER(BTRIM(COALESCE(item->>'name', ''))))
       ORDER BY c.approved_at DESC NULLS LAST, c.created_at DESC LIMIT 1
     ) approved_credit ON true
     WHERE vr.status = 'Approved'
       AND LOWER(BTRIM(COALESCE(item->>'name', ''))) = LOWER(BTRIM(vr.item_name))
       AND (COALESCE(item->>'voidProcessed', 'false') = 'true' OR UPPER(COALESCE(item->>'status', '')) = 'VOIDED')
       AND (approved_credit.id IS NOT NULL OR (COALESCE(item->>'_rowPaid', 'false') = 'true' AND UPPER(COALESCE(item->>'payment_method', '')) NOT LIKE '%CREDIT%'))
       AND UPPER(COALESCE(item->>'station', '')) NOT LIKE '%SHISHA%'
       AND UPPER(COALESCE(item->>'category', '')) NOT LIKE '%SHISHA%'
       AND (vr.resolved_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
       AND ($3::time IS NULL OR (vr.resolved_at AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
       AND ($4::time IS NULL OR (vr.resolved_at AT TIME ZONE 'Africa/Kampala')::time <= $4::time)`,
    [startDate, endDate, startTime, endTime]
  )]);

  const revenueTotals = aggregateIncomeStatementRevenue(salesResult.rows);
  const refundTotals = aggregateIncomeStatementRevenue(refundsResult.rows);
  const grossSales = salesResult.rows.reduce((sum, row) => sum + Number(row.gross_amount ?? row.amount ?? 0), 0);
  const totalDiscounts = salesResult.rows.reduce((sum, row) => sum + Math.max(0, Number(row.gross_amount ?? row.amount ?? 0) - Number(row.amount || 0)), 0);
  const totalRefunds = refundsResult.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  for (const [code, amount] of Object.entries(refundTotals)) revenueTotals[code] = (revenueTotals[code] || 0) - amount;
  const revenue = result.rows.filter((row) => row.category === 'Revenue');
  const expenses = result.rows.filter((row) => row.category === 'Expense');
  const cogsAccount = expenses.find((row) => row.code === '5010');
  const operatingExpenses = expenses.filter((row) => row.code !== '5010');
  const totalRevenue = revenue.reduce((sum, row) => sum + (revenueTotals[row.code] || 0), 0);
  const costOfGoodsSold = Number(cogsAccount?.debit_total || 0) - Number(cogsAccount?.credit_total || 0);
  const totalOperatingExpenses = operatingExpenses.reduce((sum, row) => sum + (Number(row.debit_total || 0) - Number(row.credit_total || 0)), 0);
  const totalExpenses = costOfGoodsSold + totalOperatingExpenses;
  const grossProfit = totalRevenue - costOfGoodsSold;

  return {
    startDate,
    endDate,
    grossSales,
    totalDiscounts,
    totalRefunds,
    netSales: totalRevenue,
    revenue: revenue.map((row) => ({
      account_code: row.code,
      account_name: row.name,
      amount: revenueTotals[row.code] || 0,
    })),
    expenses: operatingExpenses.map((row) => ({
      account_code: row.code,
      account_name: row.name,
      amount: Number(row.debit_total || 0) - Number(row.credit_total || 0),
    })),
    totalRevenue,
    costOfGoodsSold,
    grossProfit,
    grossProfitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    totalOperatingExpenses,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
  };
}

export async function getBalanceSheet(asOfDate, startTime = null, endTime = null) {
  const [year, month, day] = String(asOfDate).split('-').map(Number);
  const priorYear = year - 1;
  const priorMonthLastDay = new Date(Date.UTC(priorYear, month, 0)).getUTCDate();
  const priorAsOfDate = `${priorYear}-${String(month).padStart(2, '0')}-${String(Math.min(day, priorMonthLastDay)).padStart(2, '0')}`;
  const result = await pool.query(
    `SELECT
       coa.code,
       coa.name,
       coa.category,
       coa.account_type,
      COALESCE(SUM(CASE WHEN (gl.entry_date < $1 OR (gl.entry_date = $1 AND ($3::time IS NULL OR gl.business_time >= $3::time) AND ($4::time IS NULL OR gl.business_time <= $4::time))) AND gl.debit > 0 THEN gl.debit ELSE 0 END), 0) AS current_debit,
      COALESCE(SUM(CASE WHEN (gl.entry_date < $1 OR (gl.entry_date = $1 AND ($3::time IS NULL OR gl.business_time >= $3::time) AND ($4::time IS NULL OR gl.business_time <= $4::time))) AND gl.credit > 0 THEN gl.credit ELSE 0 END), 0) AS current_credit,
      COALESCE(SUM(CASE WHEN (gl.entry_date < $2 OR (gl.entry_date = $2 AND ($3::time IS NULL OR gl.business_time >= $3::time) AND ($4::time IS NULL OR gl.business_time <= $4::time))) AND gl.debit > 0 THEN gl.debit ELSE 0 END), 0) AS prior_debit,
      COALESCE(SUM(CASE WHEN (gl.entry_date < $2 OR (gl.entry_date = $2 AND ($3::time IS NULL OR gl.business_time >= $3::time) AND ($4::time IS NULL OR gl.business_time <= $4::time))) AND gl.credit > 0 THEN gl.credit ELSE 0 END), 0) AS prior_credit
     FROM public.chart_of_accounts coa
     LEFT JOIN public.general_ledger gl
       ON gl.account_code = coa.code AND gl.entry_date <= $1 AND gl.account_code <> '4004'
         AND EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = gl.journal_entry_id AND je.system_type = 'MAIN')
     WHERE coa.category IN ('Asset', 'Liability', 'Equity')
     GROUP BY coa.code, coa.name, coa.category, coa.account_type
     ORDER BY coa.code`,
    [asOfDate, priorAsOfDate, startTime, endTime]
  );

  const accountRows = result.rows.map((row) => {
    const currentDebit = Number(row.current_debit || 0);
    const currentCredit = Number(row.current_credit || 0);
    const priorDebit = Number(row.prior_debit || 0);
    const priorCredit = Number(row.prior_credit || 0);
    const isAsset = row.category === 'Asset';
    const normalizedType = String(row.account_type || '').toLowerCase();
    const isNonCurrent = normalizedType.includes('fixed') || normalizedType.includes('non-current') || normalizedType.includes('noncurrent') || normalizedType.includes('long-term') || normalizedType.includes('long term');
    return {
      account_code: row.code,
      account_name: row.name,
      group: isNonCurrent ? 'non_current' : 'current',
      balance: isAsset ? currentDebit - currentCredit : currentCredit - currentDebit,
      prior_balance: isAsset ? priorDebit - priorCredit : priorCredit - priorDebit,
    };
  });
  const accounts = Object.fromEntries(
    ['Asset', 'Liability', 'Equity'].map((category) => [
      category,
      accountRows.filter((account, index) => result.rows[index].category === category && (Math.abs(account.balance) > 0.005 || Math.abs(account.prior_balance) > 0.005)),
    ])
  );
  const sumBalance = (rows, property) => rows.reduce((sum, account) => sum + account[property], 0);
  const currentAssets = accounts.Asset.filter((account) => account.group === 'current');
  const nonCurrentAssets = accounts.Asset.filter((account) => account.group === 'non_current');
  const currentLiabilities = accounts.Liability.filter((account) => account.group === 'current');
  const nonCurrentLiabilities = accounts.Liability.filter((account) => account.group === 'non_current');
  const assets = sumBalance(accounts.Asset, 'balance');
  const priorAssets = sumBalance(accounts.Asset, 'prior_balance');
  const liabilities = sumBalance(accounts.Liability, 'balance');
  const priorLiabilities = sumBalance(accounts.Liability, 'prior_balance');
  const equity = sumBalance(accounts.Equity, 'balance');
  const priorEquity = sumBalance(accounts.Equity, 'prior_balance');

  return {
    asOfDate,
    priorAsOfDate,
    assets: {
      current_accounts: currentAssets,
      non_current_accounts: nonCurrentAssets,
      total_current_assets: sumBalance(currentAssets, 'balance'),
      prior_year_total_current_assets: sumBalance(currentAssets, 'prior_balance'),
      total_non_current_assets: sumBalance(nonCurrentAssets, 'balance'),
      prior_year_total_non_current_assets: sumBalance(nonCurrentAssets, 'prior_balance'),
      total_assets: assets,
      prior_year_total_assets: priorAssets,
    },
    liabilities: {
      current_accounts: currentLiabilities,
      non_current_accounts: nonCurrentLiabilities,
      total_current_liabilities: sumBalance(currentLiabilities, 'balance'),
      prior_year_total_current_liabilities: sumBalance(currentLiabilities, 'prior_balance'),
      total_non_current_liabilities: sumBalance(nonCurrentLiabilities, 'balance'),
      prior_year_total_non_current_liabilities: sumBalance(nonCurrentLiabilities, 'prior_balance'),
      total_liabilities: liabilities,
      prior_year_total_liabilities: priorLiabilities,
    },
    equity: {
      accounts: accounts.Equity,
      total_equity: equity,
      prior_year_total_equity: priorEquity,
    },
    total_liabilities_and_equity: liabilities + equity,
    prior_year_total_liabilities_and_equity: priorLiabilities + priorEquity,
    difference: assets - (liabilities + equity),
    prior_year_difference: priorAssets - (priorLiabilities + priorEquity),
  };
}

export async function getCashFlowStatement(startDate, endDate, startTime = null, endTime = null) {
  const result = await pool.query(
    `SELECT
       SUM(CASE WHEN gl.account_code = '1001' AND gl.credit > 0 THEN gl.credit ELSE 0 END) AS cash_in,
       SUM(CASE WHEN gl.account_code = '1001' AND gl.debit > 0 THEN gl.debit ELSE 0 END) AS cash_out
     FROM public.general_ledger gl
     JOIN public.journal_entries je ON je.id = gl.journal_entry_id AND je.system_type = 'MAIN'
     WHERE gl.entry_date BETWEEN $1 AND $2
       AND gl.account_code <> '4004'
       AND ($3::time IS NULL OR gl.business_time >= $3::time)
       AND ($4::time IS NULL OR gl.business_time <= $4::time)`,
    [startDate, endDate, startTime, endTime]
  );

  const cashIn = Number(result.rows[0]?.cash_in || 0);
  const cashOut = Number(result.rows[0]?.cash_out || 0);
  const openingCash = Number((await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN gl.account_code = '1001' AND gl.credit > 0 THEN gl.credit ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN gl.account_code = '1001' AND gl.debit > 0 THEN gl.debit ELSE 0 END), 0) AS opening_cash
     FROM public.general_ledger gl
     JOIN public.journal_entries je ON je.id = gl.journal_entry_id AND je.system_type = 'MAIN'
     WHERE (gl.entry_date < $1 AND gl.account_code <> '4004')
        OR (gl.entry_date = $1 AND gl.account_code <> '4004' AND $2::time IS NOT NULL AND (gl.business_time < $2::time OR gl.business_time IS NULL))`,
    [startDate, startTime]
  )).rows[0]?.opening_cash || 0);

  const netChangeInCash = cashIn - cashOut;
  const closingCash = openingCash + netChangeInCash;

  return {
    startDate,
    endDate,
    operating_activities: {
      cash_received_from_customers: cashIn,
      cash_paid_for_expenses: cashOut,
    },
    investing_activities: { purchase_of_equipment: 0, other_investments: 0 },
    financing_activities: { owner_capital: 0, owner_withdrawals: 0, loans: 0 },
    net_change_in_cash: netChangeInCash,
    opening_cash: openingCash,
    closing_cash: closingCash,
  };
}

export async function getJournalEntries({ startDate, endDate, startTime, endTime, limit, offset = 0, search, sortBy = 'entry_date', sortOrder = 'desc' } = {}) {
  let query = `SELECT je.*,
                      original.reference AS reversal_of_reference,
                      (SELECT reversal.reference FROM public.journal_entries reversal WHERE reversal.reversal_of = je.id LIMIT 1) AS reversed_by_reference,
                      COALESCE(json_agg(gl ORDER BY gl.id) FILTER (WHERE gl.id IS NOT NULL), '[]'::json) AS lines
               FROM public.journal_entries je
               LEFT JOIN public.journal_entries original ON original.id = je.reversal_of
               LEFT JOIN public.general_ledger gl ON gl.journal_entry_id = je.id`;
  const params = [];
  query += ` WHERE je.system_type = 'MAIN'`;

  if (startDate && endDate) {
    query += ` AND je.entry_date BETWEEN $1 AND $2
                 AND ($3::time IS NULL OR je.business_time >= $3::time)
                 AND ($4::time IS NULL OR je.business_time <= $4::time)`;
    params.push(startDate, endDate, startTime || null, endTime || null);
  }

  if (search) {
    params.push(toSearchPattern(search));
    query += ` AND (je.reference ILIKE $${params.length} ESCAPE '!' OR je.description ILIKE $${params.length} ESCAPE '!' OR je.source_transaction ILIKE $${params.length} ESCAPE '!')`;
  }

  query += ` GROUP BY je.id, original.reference`;

  const sortColumns = { entry_date: 'je.entry_date', posted_at: 'je.posted_at', reference: 'je.reference' };
  const orderColumn = sortColumns[sortBy] || 'je.entry_date';
  const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

  if (limit) {
    query += ` ORDER BY ${orderColumn} ${direction}, je.id ${direction} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
  } else {
    query += ` ORDER BY ${orderColumn} ${direction}, je.id ${direction}`;
  }

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getGeneralLedger(startDate, endDate, startTime = null, endTime = null, options = {}) {
  let query = `SELECT gl.* FROM public.general_ledger gl
               JOIN public.journal_entries je ON je.id = gl.journal_entry_id
               WHERE je.system_type = 'MAIN' AND gl.account_code <> '4004'`;
  const params = [];

  if (startDate && endDate) {
    query += ` AND gl.entry_date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR gl.business_time >= $3::time)
           AND ($4::time IS NULL OR gl.business_time <= $4::time)`;
    params.push(startDate, endDate, startTime, endTime);
  }

  if (options.search) {
    params.push(toSearchPattern(options.search));
    query += ` AND (gl.account_name ILIKE $${params.length} ESCAPE '!' OR gl.account_code ILIKE $${params.length} ESCAPE '!' OR gl.description ILIKE $${params.length} ESCAPE '!' OR gl.source_transaction ILIKE $${params.length} ESCAPE '!')`;
  }

  const sortColumns = { entry_date: 'gl.entry_date', created_at: 'gl.created_at', account_code: 'gl.account_code', debit: 'gl.debit', credit: 'gl.credit' };
  const orderColumn = sortColumns[options.sortBy] || 'gl.entry_date';
  const direction = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${orderColumn} ${direction}, gl.id ${direction}`;
  if (options.limit) {
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(options.limit, options.offset || 0);
  }

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getAuditTrail({ limit, offset = 0, search, startDate, endDate } = {}) {
  const auditEntries = `WITH audit_entries AS (
       SELECT entity_type, entity_id, action, actor, details, created_at
       FROM public.accounting_audit_log
       UNION ALL
       SELECT 'inventory_adjustment' AS entity_type,
              ia.id AS entity_id,
              LOWER(ia.adjustment_type) AS action,
              ia.created_by AS actor,
              jsonb_build_object(
                'item_id', ia.item_id,
                'item_name', ii.item_name,
                'adjustment_type', ia.adjustment_type,
                'quantity', ia.quantity,
                'reason', ia.reason,
                'business_date', ia.business_date,
                'location_id', ia.location_id
              ) AS details,
              ia.created_at
       FROM public.inventory_adjustments ia
       LEFT JOIN public.inventory_items ii ON ii.id = ia.item_id
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.accounting_audit_log audit
         WHERE audit.entity_type = 'inventory_adjustment'
           AND audit.entity_id = ia.id
       )
     )`;
  const conditions = [];
  const searchParams = [];
  if (search) {
    searchParams.push(toSearchPattern(search));
    conditions.push(`(entity_type ILIKE $${searchParams.length} ESCAPE '!' OR entity_id::text ILIKE $${searchParams.length} ESCAPE '!' OR action ILIKE $${searchParams.length} ESCAPE '!' OR actor ILIKE $${searchParams.length} ESCAPE '!' OR details::text ILIKE $${searchParams.length} ESCAPE '!')`);
  }
  if (startDate && endDate) {
    searchParams.push(startDate, endDate);
    conditions.push(`created_at::date BETWEEN $${searchParams.length - 1} AND $${searchParams.length}`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pageParams = [...searchParams];
  const queryLimit = limit || 100;
  pageParams.push(queryLimit, offset);
  const pageClause = `LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`;

  const result = await pool.query(
    `${auditEntries}
     SELECT entity_type, entity_id, action, actor, details, created_at
     FROM audit_entries ${whereClause}
     ORDER BY created_at DESC, entity_type ASC, entity_id DESC ${pageClause}`,
    pageParams
  );
  if (!limit) return result.rows;

  const countResult = await pool.query(
    `${auditEntries} SELECT COUNT(*) AS total_records FROM audit_entries ${whereClause}`,
    searchParams
  );
  return { entries: result.rows, totalRecords: Number(countResult.rows[0]?.total_records || 0) };
}
