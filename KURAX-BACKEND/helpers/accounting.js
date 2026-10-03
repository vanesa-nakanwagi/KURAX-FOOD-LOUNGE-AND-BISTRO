import pool from '../db.js';

export const DEFAULT_ACCOUNTS = [
  { code: '1001', name: 'Counter Cash', category: 'Asset', account_type: 'Cash', normal_balance: 'Debit', description: 'Cash on hand' },
  { code: '1002', name: 'Bank', category: 'Asset', account_type: 'Bank', normal_balance: 'Debit', description: 'Operating bank account' },
  { code: '1003', name: 'Mobile Money', category: 'Asset', account_type: 'Mobile Money', normal_balance: 'Debit', description: 'Mobile money float' },
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
];

export function safeMoney(value) {
  const asNumber = Number(value || 0);
  return Number.isFinite(asNumber) ? asNumber : 0;
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
  await pool.query(`ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS business_time TIME`);
  await pool.query(`ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ`);
  await pool.query(`UPDATE public.journal_entries SET posted_at = created_at WHERE posted_at IS NULL`);
  await pool.query(`ALTER TABLE public.journal_entries ALTER COLUMN posted_at SET DEFAULT NOW()`);
  await pool.query(`ALTER TABLE public.journal_entries ALTER COLUMN posted_at SET NOT NULL`);
  await pool.query(`ALTER TABLE public.general_ledger ADD COLUMN IF NOT EXISTS business_time TIME`);
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

export async function createJournalEntry({
  entryDate,
  description,
  sourceTransaction,
  postedBy = 'System',
  lines,
  reference,
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

  const result = await pool.query(
    `INSERT INTO public.journal_entries (reference, entry_date, description, source_transaction, posted_by, status)
     VALUES ($1, $2, $3, $4, $5, 'Posted')
     RETURNING *`,
    [finalReference, finalDate, description || 'Accounting entry', sourceTransaction || 'Manual Entry', postedBy || 'System']
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

    await pool.query(
      `INSERT INTO public.general_ledger (
         journal_entry_id,
         account_code,
         account_name,
         debit,
         credit,
         entry_date,
         description,
         source_transaction,
         posted_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        journal.id,
        account.code,
        account.name,
        line.debit,
        line.credit,
        finalDate,
        description || 'Accounting entry',
        sourceTransaction || 'Manual Entry',
        postedBy || 'System',
      ]
    );
  }

  await pool.query(
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
  revenueAccountCode = '4001',
  description,
  sourceTransaction,
  postedBy = 'System',
  entryDate,
}) {
  const numericAmount = safeMoney(amount);
  const normalizedMethod = String(paymentMethod || 'Cash').trim().toLowerCase();

  const debitAccountMap = {
    cash: '1001',
    card: '1002',
    mtn: '1003',
    momo: '1003',
    mobile: '1003',
    airtel: '1003',
    'momo-mtn': '1003',
    'momo-airtel': '1003',
    'momo_mtn': '1003',
    'momo_airtel': '1003',
    credit: '1101',
    receivable: '1101',
  };

  const debitAccountCode = debitAccountMap[normalizedMethod] || '1001';
  const debitAccount = await getAccountByCode(debitAccountCode);
  const revenueAccount = await getAccountByCode(revenueAccountCode);

  if (!debitAccount) {
    throw new Error(`Sales debit account ${debitAccountCode} is not defined in the chart of accounts.`);
  }

  if (!revenueAccount) {
    throw new Error(`Revenue account ${revenueAccountCode} is not defined in the chart of accounts.`);
  }

  return createJournalEntry({
    entryDate,
    description: description || `Sales - ${paymentMethod || 'Cash'}`,
    sourceTransaction: sourceTransaction || `sale:${(paymentMethod || 'Cash').toLowerCase()}`,
    postedBy,
    lines: [
      { accountCode: debitAccountCode, accountName: debitAccount.name, debit: numericAmount },
      { accountCode: revenueAccountCode, accountName: revenueAccount.name, credit: numericAmount },
    ],
  });
}

export async function createReceivableSettlementJournalEntry({
  amount,
  paymentMethod = 'Cash',
  sourceTransaction,
  postedBy = 'System',
  entryDate,
}) {
  const numericAmount = safeMoney(amount);
  const normalizedMethod = String(paymentMethod || 'Cash').trim().toLowerCase();
  const depositAccountMap = {
    cash: '1001',
    card: '1002',
    mtn: '1003',
    momo: '1003',
    mobile: '1003',
    airtel: '1003',
    'momo-mtn': '1003',
    'momo-airtel': '1003',
    'momo_mtn': '1003',
    'momo_airtel': '1003',
  };
  const accountCode = depositAccountMap[normalizedMethod] || '1001';
  const debitAccount = await getAccountByCode(accountCode);
  const receivableAccount = await getAccountByCode('1101');

  if (!debitAccount || !receivableAccount) {
    throw new Error('Counter cash and accounts receivable accounts must exist to post a settlement.');
  }

  return createJournalEntry({
    entryDate,
    description: `Credit settlement via ${paymentMethod}`,
    sourceTransaction: sourceTransaction || `credit_settlement:${paymentMethod.toLowerCase()}`,
    postedBy,
    lines: [
      { accountCode: accountCode, accountName: debitAccount.name, debit: numericAmount },
      { accountCode: '1101', accountName: receivableAccount.name, credit: numericAmount },
    ],
  });
}

export async function getTrialBalance(startDate, endDate, startTime = null, endTime = null) {
  const result = await pool.query(
    `SELECT
       gl.account_code,
       gl.account_name,
       COALESCE(SUM(gl.debit), 0) AS total_debit,
       COALESCE(SUM(gl.credit), 0) AS total_credit
     FROM public.general_ledger gl
     WHERE gl.entry_date BETWEEN $1 AND $2
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
  const result = await pool.query(
    `SELECT
       coa.code,
       coa.name,
       coa.category,
       COALESCE(SUM(gl.credit), 0) AS credit_total,
       COALESCE(SUM(gl.debit), 0) AS debit_total
     FROM public.chart_of_accounts coa
     LEFT JOIN public.general_ledger gl
       ON gl.account_code = coa.code AND gl.entry_date BETWEEN $1 AND $2
         AND ($3::time IS NULL OR gl.business_time >= $3::time)
         AND ($4::time IS NULL OR gl.business_time <= $4::time)
     WHERE coa.category IN ('Revenue', 'Expense')
     GROUP BY coa.code, coa.name, coa.category
     ORDER BY coa.code ASC`,
    [startDate, endDate, startTime, endTime]
  );

  const revenue = result.rows.filter((row) => row.category === 'Revenue');
  const expenses = result.rows.filter((row) => row.category === 'Expense');
  const totalRevenue = revenue.reduce((sum, row) => sum + (Number(row.credit_total || 0) - Number(row.debit_total || 0)), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + (Number(row.debit_total || 0) - Number(row.credit_total || 0)), 0);

  return {
    startDate,
    endDate,
    revenue: revenue.map((row) => ({
      account_code: row.code,
      account_name: row.name,
      amount: Number(row.credit_total || 0) - Number(row.debit_total || 0),
    })),
    expenses: expenses.map((row) => ({
      account_code: row.code,
      account_name: row.name,
      amount: Number(row.debit_total || 0) - Number(row.credit_total || 0),
    })),
    totalRevenue,
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
       ON gl.account_code = coa.code AND gl.entry_date <= $1
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
       SUM(CASE WHEN account_code = '1001' AND credit > 0 THEN credit ELSE 0 END) AS cash_in,
       SUM(CASE WHEN account_code = '1001' AND debit > 0 THEN debit ELSE 0 END) AS cash_out
     FROM public.general_ledger
     WHERE entry_date BETWEEN $1 AND $2
       AND ($3::time IS NULL OR business_time >= $3::time)
       AND ($4::time IS NULL OR business_time <= $4::time)`,
    [startDate, endDate, startTime, endTime]
  );

  const cashIn = Number(result.rows[0]?.cash_in || 0);
  const cashOut = Number(result.rows[0]?.cash_out || 0);
  const openingCash = Number((await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN account_code = '1001' AND credit > 0 THEN credit ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN account_code = '1001' AND debit > 0 THEN debit ELSE 0 END), 0) AS opening_cash
     FROM public.general_ledger
      WHERE entry_date < $1
        OR (entry_date = $1 AND $2::time IS NOT NULL AND (business_time < $2::time OR business_time IS NULL))`,
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

export async function getJournalEntries({ startDate, endDate, startTime, endTime, limit } = {}) {
  let query = `SELECT je.*,
                      original.reference AS reversal_of_reference,
                      (SELECT reversal.reference FROM public.journal_entries reversal WHERE reversal.reversal_of = je.id LIMIT 1) AS reversed_by_reference,
                      COALESCE(json_agg(gl ORDER BY gl.id) FILTER (WHERE gl.id IS NOT NULL), '[]'::json) AS lines
               FROM public.journal_entries je
               LEFT JOIN public.journal_entries original ON original.id = je.reversal_of
               LEFT JOIN public.general_ledger gl ON gl.journal_entry_id = je.id`;
  const params = [];

  if (startDate && endDate) {
    query += ` WHERE je.entry_date BETWEEN $1 AND $2
                 AND ($3::time IS NULL OR je.business_time >= $3::time)
                 AND ($4::time IS NULL OR je.business_time <= $4::time)`;
    params.push(startDate, endDate, startTime || null, endTime || null);
  }

  query += ` GROUP BY je.id, original.reference`;

  if (limit) {
    query += ` ORDER BY je.entry_date DESC, je.id DESC LIMIT $${params.length + 1}`;
    params.push(limit);
  } else {
    query += ` ORDER BY je.entry_date DESC, je.id DESC`;
  }

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getGeneralLedger(startDate, endDate, startTime = null, endTime = null) {
  let query = `SELECT * FROM public.general_ledger`;
  const params = [];

  if (startDate && endDate) {
    query += ` WHERE entry_date BETWEEN $1 AND $2
                 AND ($3::time IS NULL OR business_time >= $3::time)
                 AND ($4::time IS NULL OR business_time <= $4::time)`;
    params.push(startDate, endDate, startTime, endTime);
  }

  query += ` ORDER BY entry_date DESC, id DESC`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getAuditTrail() {
  const result = await pool.query(
    `SELECT * FROM public.accounting_audit_log ORDER BY created_at DESC LIMIT 100`
  );
  return result.rows;
}
