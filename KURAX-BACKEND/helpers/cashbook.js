import { randomBytes } from 'node:crypto';
import pool from '../db.js';
import {
  createJournalEntry,
  getAccountByCode,
  isEligibleInternalTransferAccount,
  listAccounts,
  resolvePaymentDebitAccountCode,
  reverseJournalEntry,
} from './accounting.js';

export const CASHBOOK_CATEGORIES = {
  Receipt: ['Customer Payment', 'Deposit Received', 'Other Income', 'Other Receipt'],
  Payment: ['Expense', 'Supplier Payment', 'Salaries', 'Utilities', 'Other Payment'],
};

const CASHBOOK_ACCOUNT_TYPES = new Set(['cash', 'bank', 'bank account', 'mobile money', 'clearing']);
const MONEY_LIMIT = 9999999999.99;

export function isCashbookCashAccount(account) {
  return Boolean(account)
    && account.category === 'Asset'
    && account.is_active !== false
    && account.is_postable !== false
    && CASHBOOK_ACCOUNT_TYPES.has(String(account.account_type || '').trim().toLowerCase());
}

function assertValidDate(value, label) {
  const date = String(value || '').trim();
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== date) {
    throw Object.assign(new Error(`Enter a valid ${label}.`), { statusCode: 400 });
  }
  return date;
}

export function normalizeCashbookDate(value) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw Object.assign(new Error('The cashbook transaction date is invalid.'), { statusCode: 400 });
    }
    return value.toISOString().slice(0, 10);
  }
  return assertValidDate(String(value || '').trim().slice(0, 10), 'transaction date');
}

export function validateCashbookCounterpart(category, transactionType, account) {
  const categoryName = String(category || '').toLowerCase();
  const accountCategory = String(account?.category || '');
  const accountType = String(account?.account_type || '').toLowerCase();
  const accountName = String(account?.name || '').toLowerCase();
  const cashLike = isEligibleInternalTransferAccount(account);

  if (!account || account.is_active === false || account.is_postable === false || cashLike) {
    throw Object.assign(new Error('Choose an active, postable non-cash Chart of Accounts entry.'), { statusCode: 400 });
  }

  if (transactionType === 'Receipt') {
    const valid = categoryName === 'customer payment'
      ? accountCategory === 'Asset' && /receivable/.test(accountType)
      : categoryName === 'deposit received'
        ? accountCategory === 'Liability'
        : categoryName === 'other income'
          ? accountCategory === 'Revenue'
          : ['Asset', 'Liability', 'Equity', 'Revenue'].includes(accountCategory);
    if (!valid) {
      throw Object.assign(new Error('The selected account does not match this receipt category.'), { statusCode: 400 });
    }
    return;
  }

  const valid = categoryName === 'expense'
    ? accountCategory === 'Expense'
    : categoryName === 'supplier payment'
      ? (accountCategory === 'Liability' && /payable/.test(accountType)) || accountCategory === 'Expense'
      : categoryName === 'salaries'
        ? accountCategory === 'Expense' && /salary|wage|staff/.test(`${accountType} ${accountName}`)
        : categoryName === 'utilities'
          ? accountCategory === 'Expense' && /utilit/.test(`${accountType} ${accountName}`)
          : ['Asset', 'Liability', 'Equity', 'Expense'].includes(accountCategory);
  if (!valid) {
    throw Object.assign(new Error('The selected account does not match this payment category.'), { statusCode: 400 });
  }
}

export function normalizeCashbookTransaction(input = {}) {
  const transactionType = String(input.transaction_type || '').trim();
  const category = String(input.category || '').trim();
  const amount = Number(input.amount);
  const accountCode = String(input.cash_account_code || '').trim();
  const counterpartAccountCode = String(input.counterpart_account_code || '').trim();
  const paymentMethod = String(input.payment_method || '').trim();
  const description = String(input.description || '').trim();
  const requestId = String(input.request_id || '').trim();
  const transactionDate = assertValidDate(input.transaction_date, 'transaction date');
  const externalReference = String(input.external_reference || '').trim();

  if (!CASHBOOK_CATEGORIES[transactionType]?.includes(category)) {
    throw Object.assign(new Error('Choose a valid cashbook transaction category.'), { statusCode: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > MONEY_LIMIT) {
    throw Object.assign(new Error('Enter a positive transaction amount within the supported limit.'), { statusCode: 400 });
  }
  if (!/^[\w-]{8,100}$/.test(requestId)) {
    throw Object.assign(new Error('A valid transaction request ID is required.'), { statusCode: 400 });
  }
  if (!accountCode || !counterpartAccountCode || accountCode === counterpartAccountCode) {
    throw Object.assign(new Error('Select different cash and counterpart accounts.'), { statusCode: 400 });
  }
  if (!paymentMethod || paymentMethod.length > 40) {
    throw Object.assign(new Error('Choose a valid payment method.'), { statusCode: 400 });
  }
  if (!description || description.length > 500) {
    throw Object.assign(new Error('Enter a description of 1 to 500 characters.'), { statusCode: 400 });
  }
  if (externalReference.length > 100) {
    throw Object.assign(new Error('The external reference must be 100 characters or fewer.'), { statusCode: 400 });
  }

  let methodAccountCode;
  try {
    methodAccountCode = resolvePaymentDebitAccountCode(paymentMethod);
  } catch {
    throw Object.assign(new Error('Choose a supported payment method.'), { statusCode: 400 });
  }
  if (methodAccountCode !== accountCode) {
    throw Object.assign(new Error('The payment method must match the selected cashbook account.'), { statusCode: 400 });
  }

  return {
    request_id: requestId,
    transaction_date: transactionDate,
    transaction_type: transactionType,
    category,
    description,
    cash_account_code: accountCode,
    counterpart_account_code: counterpartAccountCode,
    payment_method: paymentMethod,
    amount: Math.round(amount * 100) / 100,
    external_reference: externalReference || null,
  };
}

export function buildCashbookJournalLines(transaction, cashAccount, counterpartAccount) {
  const amount = Number(transaction.amount);
  if (transaction.transaction_type === 'Receipt') {
    return [
      { accountCode: cashAccount.code, accountName: cashAccount.name, debit: amount, credit: 0 },
      { accountCode: counterpartAccount.code, accountName: counterpartAccount.name, debit: 0, credit: amount },
    ];
  }
  return [
    { accountCode: counterpartAccount.code, accountName: counterpartAccount.name, debit: amount, credit: 0 },
    { accountCode: cashAccount.code, accountName: cashAccount.name, debit: 0, credit: amount },
  ];
}

function todayInKampala() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.KURAX_BUSINESS_TIME_ZONE || 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function validateAccounts(transaction) {
  const [cashAccount, counterpartAccount] = await Promise.all([
    getAccountByCode(transaction.cash_account_code),
    getAccountByCode(transaction.counterpart_account_code),
  ]);
  if (!isCashbookCashAccount(cashAccount)) {
    throw Object.assign(new Error('Choose an active cash, bank, mobile money, or clearing account.'), { statusCode: 400 });
  }
  validateCashbookCounterpart(transaction.category, transaction.transaction_type, counterpartAccount);
  return { cashAccount, counterpartAccount };
}

async function postCashbookTransaction(queryable, transaction, cashAccount, counterpartAccount, actor) {
  const journal = await createJournalEntry({
    reference: transaction.reference_number,
    entryDate: normalizeCashbookDate(transaction.transaction_date),
    description: `${transaction.category}: ${transaction.description}`,
    sourceTransaction: `cashbook:${transaction.id}`,
    postedBy: actor.name,
    lines: buildCashbookJournalLines(transaction, cashAccount, counterpartAccount),
    queryable,
  });
  const result = await queryable.query(
    `UPDATE public.cashbook_transactions
     SET status = 'Posted', journal_entry_id = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [transaction.id, journal.id]
  );
  return { transaction: result.rows[0], journal };
}

async function writeAudit(queryable, entityType, entityId, action, actor, details) {
  await queryable.query(
    `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [entityType, entityId, action, actor.name, JSON.stringify(details)]
  );
}

function accountTypeFilter(alias = 'coa') {
  return `LOWER(COALESCE(${alias}.account_type, '')) IN ('cash', 'bank', 'bank account', 'mobile money', 'clearing')`;
}

export async function getCashbookData({ startDate, endDate, accountCode = '', search = '', page = 1, limit = 50 }) {
  const accounts = await listAccounts();
  const cashAccounts = accounts.filter(isCashbookCashAccount);
  if (accountCode && !cashAccounts.some((account) => account.code === accountCode)) {
    throw Object.assign(new Error('The selected account is not an active cashbook account.'), { statusCode: 400 });
  }
  const normalizedSearch = String(search || '').trim().slice(0, 120);
  const searchPattern = normalizedSearch
    ? `%${normalizedSearch.replace(/[!%_]/g, (character) => `!${character}`)}%`
    : null;
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;
  const accountFilter = accountCode || null;

  const summaryQuery = `SELECT
      COALESCE(SUM(CASE WHEN gl.entry_date < $1::date THEN gl.debit - gl.credit ELSE 0 END), 0) AS opening_balance,
      COALESCE(SUM(CASE WHEN gl.entry_date BETWEEN $1::date AND $2::date THEN gl.debit ELSE 0 END), 0) AS total_received,
      COALESCE(SUM(CASE WHEN gl.entry_date BETWEEN $1::date AND $2::date THEN gl.credit ELSE 0 END), 0) AS total_paid
    FROM public.general_ledger gl
    JOIN public.journal_entries je ON je.id = gl.journal_entry_id
    JOIN public.chart_of_accounts coa ON coa.code = gl.account_code
    WHERE je.system_type = 'MAIN'
      AND je.status IN ('Posted', 'Reversed')
      AND coa.is_active = true
      AND ${accountTypeFilter()}
      AND ($3::text IS NULL OR gl.account_code = $3)`;
  const summaryResult = await pool.query(summaryQuery, [startDate, endDate, accountFilter]);
  const summary = summaryResult.rows[0];
  const openingBalance = Number(summary.opening_balance || 0);
  const totalReceived = Number(summary.total_received || 0);
  const totalPaid = Number(summary.total_paid || 0);

  const rowCtes = `WITH cash_accounts AS (
      SELECT code, name, account_type FROM public.chart_of_accounts coa
      WHERE coa.is_active = true AND ${accountTypeFilter()}
        AND ($3::text IS NULL OR coa.code = $3)
    ),
    opening_balances AS (
      SELECT gl.account_code, SUM(gl.debit - gl.credit) AS balance
      FROM public.general_ledger gl
      JOIN public.journal_entries je ON je.id = gl.journal_entry_id
      JOIN cash_accounts ca ON ca.code = gl.account_code
      WHERE je.system_type = 'MAIN' AND je.status IN ('Posted', 'Reversed')
        AND gl.entry_date < $1::date
      GROUP BY gl.account_code
    ),
    posted_rows AS (
      SELECT
        'ledger-' || gl.id::text AS row_id,
        gl.id AS sort_id,
        je.id AS journal_entry_id,
        je.reference,
        gl.entry_date::text AS transaction_date,
        gl.business_time::text AS business_time,
        je.posted_at,
        COALESCE(cb.transaction_type, CASE WHEN gl.debit > 0 THEN 'Receipt' ELSE 'Payment' END) AS transaction_type,
        COALESCE(cb.category,
          CASE
            WHEN je.source_transaction ILIKE 'cashier_queue:%' OR je.source_transaction ILIKE 'sale:%' THEN 'POS Sales'
            WHEN je.source_transaction ILIKE 'credit_settlement:%' THEN 'Customer Payment'
            WHEN je.source_transaction ILIKE 'cashier_expense:%' OR je.source_transaction ILIKE 'backdated_expense:%' THEN 'Expense'
            WHEN je.source_transaction ILIKE 'cashbook:%' THEN 'Cashbook Transaction'
            ELSE 'Journal Entry'
          END
        ) AS category,
        gl.description,
        gl.account_code,
        gl.account_name,
        cb.counterpart_account_code,
        COALESCE(cb.payment_method, cq.method,
          CASE gl.account_code
            WHEN '1001' THEN 'Cash'
            WHEN '1002' THEN 'Bank / Card'
            WHEN '1006' THEN 'MTN Mobile Money'
            WHEN '1007' THEN 'Airtel Money'
            WHEN '1003' THEN 'Mobile Money'
            ELSE 'Other'
          END
        ) AS payment_method,
        COALESCE(cb.external_reference, '') AS external_reference,
        gl.debit::numeric AS debit,
        gl.credit::numeric AS credit,
        COALESCE(cb.status, je.status) AS status,
        cb.id AS cashbook_id,
        cb.request_id,
        cb.created_by_staff_id,
        cb.created_by,
        true AS is_posted
      FROM public.general_ledger gl
      JOIN public.journal_entries je ON je.id = gl.journal_entry_id
      JOIN cash_accounts ca ON ca.code = gl.account_code
      LEFT JOIN public.cashbook_transactions cb ON cb.journal_entry_id = je.id
        OR (cb.journal_entry_id IS NULL AND je.source_transaction = 'cashbook:' || cb.id::text)
      LEFT JOIN public.cashier_queue cq
        ON cq.id = CASE
          WHEN je.source_transaction ~ '^cashier_queue:[0-9]+$'
            THEN split_part(je.source_transaction, ':', 2)::integer
          ELSE NULL
        END
      WHERE je.system_type = 'MAIN'
        AND je.status IN ('Posted', 'Reversed')
        AND gl.entry_date BETWEEN $1::date AND $2::date
    ),
    pending_rows AS (
      SELECT
        'cashbook-' || cb.id::text AS row_id,
        cb.id AS sort_id,
        NULL::integer AS journal_entry_id,
        cb.reference_number AS reference,
        cb.transaction_date::text AS transaction_date,
        NULL::text AS business_time,
        cb.created_at AS posted_at,
        cb.transaction_type,
        cb.category,
        cb.description,
        cb.cash_account_code AS account_code,
        coa.name AS account_name,
        cb.counterpart_account_code,
        cb.payment_method,
        COALESCE(cb.external_reference, '') AS external_reference,
        CASE WHEN cb.transaction_type = 'Receipt' THEN cb.amount ELSE 0 END::numeric AS debit,
        CASE WHEN cb.transaction_type = 'Payment' THEN cb.amount ELSE 0 END::numeric AS credit,
        cb.status,
        cb.id AS cashbook_id,
        cb.request_id,
        cb.created_by_staff_id,
        cb.created_by,
        false AS is_posted
      FROM public.cashbook_transactions cb
      JOIN cash_accounts coa ON coa.code = cb.cash_account_code
      WHERE cb.journal_entry_id IS NULL
        AND cb.status IN ('Pending Approval', 'Rejected')
        AND cb.transaction_date BETWEEN $1::date AND $2::date
    ),
    all_rows AS (
      SELECT * FROM posted_rows
      UNION ALL
      SELECT * FROM pending_rows
    ),
    balanced_rows AS (
      SELECT rows.*,
        COALESCE(opening.balance, 0) + SUM(
          CASE WHEN rows.is_posted THEN rows.debit - rows.credit ELSE 0 END
        ) OVER (
          PARTITION BY rows.account_code
          ORDER BY rows.transaction_date, rows.business_time NULLS LAST, rows.posted_at NULLS FIRST, rows.sort_id
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_balance
      FROM all_rows rows
      LEFT JOIN opening_balances opening ON opening.account_code = rows.account_code
    ),
    filtered_rows AS (
      SELECT * FROM balanced_rows
      WHERE $4::text IS NULL
        OR reference ILIKE $4 ESCAPE '!'
        OR description ILIKE $4 ESCAPE '!'
        OR category ILIKE $4 ESCAPE '!'
        OR account_name ILIKE $4 ESCAPE '!'
        OR payment_method ILIKE $4 ESCAPE '!'
        OR external_reference ILIKE $4 ESCAPE '!'
    )`;
  const countResult = await pool.query(
    `${rowCtes} SELECT COUNT(*) AS total_records FROM filtered_rows`,
    [startDate, endDate, accountFilter, searchPattern]
  );
  const entriesResult = await pool.query(
    `${rowCtes}
     SELECT * FROM filtered_rows
     ORDER BY transaction_date DESC, business_time DESC NULLS LAST, posted_at DESC, sort_id DESC
     LIMIT $5 OFFSET $6`,
    [startDate, endDate, accountFilter, searchPattern, safeLimit, offset]
  );

  return {
    accounts: cashAccounts,
    counterpart_accounts: accounts.filter((account) => !isEligibleInternalTransferAccount(account)),
    categories: CASHBOOK_CATEGORIES,
    entries: entriesResult.rows,
    summary: {
      opening_balance: openingBalance,
      total_received: totalReceived,
      total_paid: totalPaid,
      closing_balance: openingBalance + totalReceived - totalPaid,
    },
    pagination: {
      totalRecords: Number(countResult.rows[0]?.total_records || 0),
      currentPage: safePage,
      totalPages: Math.ceil(Number(countResult.rows[0]?.total_records || 0) / safeLimit),
      pageSize: safeLimit,
    },
  };
}

export async function createCashbookTransaction(input, actor) {
  const transaction = normalizeCashbookTransaction(input);
  if (transaction.transaction_date > todayInKampala()) {
    throw Object.assign(new Error('A transaction cannot be dated in the future.'), { statusCode: 400 });
  }
  const { cashAccount, counterpartAccount } = await validateAccounts(transaction);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cashbook-request:${transaction.request_id}`]);
    const existing = await client.query(
      'SELECT * FROM public.cashbook_transactions WHERE request_id = $1 FOR UPDATE',
      [transaction.request_id]
    );
    if (existing.rows.length) {
      const current = existing.rows[0];
      const samePayload = normalizeCashbookDate(current.transaction_date) === transaction.transaction_date
        && current.transaction_type === transaction.transaction_type
        && current.category === transaction.category
        && current.description === transaction.description
        && current.cash_account_code === transaction.cash_account_code
        && current.counterpart_account_code === transaction.counterpart_account_code
        && current.payment_method === transaction.payment_method
        && Number(current.amount) === transaction.amount
        && (current.external_reference || null) === transaction.external_reference;
      if (!samePayload) {
        throw Object.assign(new Error('This request ID was already used for a different transaction.'), { statusCode: 409 });
      }
      await client.query('COMMIT');
      return { transaction: current, duplicate: true };
    }

    const period = await client.query(
      `SELECT period_name, status FROM public.accounting_periods
       WHERE $1::date BETWEEN start_date AND end_date
       ORDER BY start_date DESC LIMIT 1 FOR SHARE`,
      [transaction.transaction_date]
    );
    if (!period.rows.length || period.rows[0].status !== 'Open') {
      throw Object.assign(new Error('The transaction date must be in an open accounting period before it can be posted.'), { statusCode: 409 });
    }

    const reference = `CB-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const result = await client.query(
      `INSERT INTO public.cashbook_transactions (
         request_id, reference_number, external_reference, transaction_date, transaction_type,
         category, description, cash_account_code, counterpart_account_code, payment_method,
         amount, status, created_by_staff_id, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Posted', $12, $13)
       RETURNING *`,
      [
        transaction.request_id, reference, transaction.external_reference, transaction.transaction_date,
        transaction.transaction_type, transaction.category, transaction.description,
        transaction.cash_account_code, transaction.counterpart_account_code, transaction.payment_method,
        transaction.amount, actor.id, actor.name,
      ]
    );
    const created = result.rows[0];
    const posted = await postCashbookTransaction(client, created, cashAccount, counterpartAccount, actor);
    await writeAudit(client, 'cashbook_transaction', created.id, 'created', actor, {
      reference,
      transaction_type: created.transaction_type,
      transaction_date: transaction.transaction_date,
      category: created.category,
      amount: transaction.amount,
      cash_account_code: created.cash_account_code,
      counterpart_account_code: created.counterpart_account_code,
      status: 'Posted',
      journal_reference: posted.journal.reference,
      journal_entry_id: posted.journal.id,
    });
    await client.query('COMMIT');
    return { ...posted, duplicate: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCashbookTransaction(transactionId, input, actor) {
  const transaction = normalizeCashbookTransaction(input);
  if (transaction.transaction_date > todayInKampala()) {
    throw Object.assign(new Error('A transaction cannot be dated in the future.'), { statusCode: 400 });
  }
  const { cashAccount, counterpartAccount } = await validateAccounts(transaction);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      'SELECT * FROM public.cashbook_transactions WHERE id = $1 FOR UPDATE',
      [transactionId]
    );
    const current = currentResult.rows[0];
    if (!current) throw Object.assign(new Error('Cashbook transaction not found.'), { statusCode: 404 });
    if (current.status !== 'Pending Approval') {
      throw Object.assign(new Error('Only unposted legacy transactions can be edited.'), { statusCode: 409 });
    }
    if (Number(current.created_by_staff_id) !== Number(actor.id) && !['MANAGER', 'DIRECTOR'].includes(actor.role)) {
      throw Object.assign(new Error('Only the creator or an accounting manager can edit this transaction.'), { statusCode: 403 });
    }
    const period = await client.query(
      `SELECT period_name, status FROM public.accounting_periods
       WHERE $1::date BETWEEN start_date AND end_date
       ORDER BY start_date DESC LIMIT 1 FOR SHARE`,
      [transaction.transaction_date]
    );
    if (!period.rows.length || period.rows[0].status !== 'Open') {
      throw Object.assign(new Error('The transaction date must be in an open accounting period before it can be posted.'), { statusCode: 409 });
    }
    const updatedResult = await client.query(
      `UPDATE public.cashbook_transactions
       SET external_reference = $2, transaction_date = $3, transaction_type = $4, category = $5,
           description = $6, cash_account_code = $7, counterpart_account_code = $8,
           payment_method = $9, amount = $10, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        transactionId, transaction.external_reference, transaction.transaction_date,
        transaction.transaction_type, transaction.category, transaction.description,
        transaction.cash_account_code, transaction.counterpart_account_code,
        transaction.payment_method, transaction.amount,
      ]
    );
    const updated = updatedResult.rows[0];
    const posted = await postCashbookTransaction(client, updated, cashAccount, counterpartAccount, actor);
    await writeAudit(client, 'cashbook_transaction', transactionId, 'edited_and_posted', actor, {
      reference: current.reference_number,
      before: {
        transaction_date: current.transaction_date,
        transaction_type: current.transaction_type,
        category: current.category,
        description: current.description,
        cash_account_code: current.cash_account_code,
        counterpart_account_code: current.counterpart_account_code,
        payment_method: current.payment_method,
        amount: Number(current.amount),
      },
      after: transaction,
      journal_reference: posted.journal.reference,
      journal_entry_id: posted.journal.id,
    });
    await client.query('COMMIT');
    return posted.transaction;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function reverseCashbookTransaction(transactionId, reversalDate, reason, actor) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT * FROM public.cashbook_transactions WHERE id = $1 FOR UPDATE',
      [transactionId]
    );
    const transaction = result.rows[0];
    if (!transaction) throw Object.assign(new Error('Cashbook transaction not found.'), { statusCode: 404 });
    if (!['Posted', 'Approved'].includes(transaction.status) || !transaction.journal_entry_id) {
      throw Object.assign(new Error('Only posted cashbook transactions can be reversed.'), { statusCode: 409 });
    }
    const reversal = await reverseJournalEntry({
      journalEntryId: transaction.journal_entry_id,
      reversalDate,
      reason,
      actor: actor.name,
      queryable: client,
    });
    const updatedResult = await client.query(
      `UPDATE public.cashbook_transactions
       SET status = 'Reversed', reversed_by_staff_id = $2, reversed_by = $3,
           reversed_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [transaction.id, actor.id, actor.name]
    );
    await writeAudit(client, 'cashbook_transaction', transaction.id, 'reversed', actor, {
      reference: transaction.reference_number,
      reversal_reference: reversal.reversal.reference,
      reversal_date: reversal.effectiveDate,
      reason: String(reason || '').trim(),
    });
    await client.query('COMMIT');
    return { transaction: updatedResult.rows[0], ...reversal };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getCashbookReconciliations(reconciliationDate) {
  const accounts = (await listAccounts()).filter(isCashbookCashAccount);
  const result = await pool.query(
    `SELECT coa.code, coa.name, coa.account_type,
       COALESCE(balance.expected_balance, 0) AS expected_balance,
       reconciliation.counted_balance,
       reconciliation.discrepancy,
       reconciliation.note,
       reconciliation.reconciled_by,
       reconciliation.updated_at
     FROM public.chart_of_accounts coa
     LEFT JOIN LATERAL (
       SELECT SUM(gl.debit - gl.credit) AS expected_balance
       FROM public.general_ledger gl
       JOIN public.journal_entries je ON je.id = gl.journal_entry_id
       WHERE gl.account_code = coa.code
         AND gl.entry_date <= $1::date
         AND je.system_type = 'MAIN'
         AND je.status IN ('Posted', 'Reversed')
     ) balance ON true
     LEFT JOIN public.cashbook_reconciliations reconciliation
       ON reconciliation.account_code = coa.code AND reconciliation.reconciliation_date = $1::date
     WHERE coa.is_active = true AND ${accountTypeFilter()}
     ORDER BY coa.code`,
    [reconciliationDate]
  );
  return { accounts, reconciliations: result.rows };
}

export async function saveCashbookReconciliation(input, actor) {
  const date = assertValidDate(input.reconciliation_date, 'reconciliation date');
  if (date > todayInKampala()) {
    throw Object.assign(new Error('A reconciliation date cannot be in the future.'), { statusCode: 400 });
  }
  const accountCode = String(input.account_code || '').trim();
  const countedBalance = Number(input.counted_balance);
  const note = String(input.note || '').trim().slice(0, 1000);
  if (!Number.isFinite(countedBalance) || countedBalance < 0 || countedBalance > MONEY_LIMIT) {
    throw Object.assign(new Error('Enter a valid counted balance.'), { statusCode: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const accountResult = await client.query(
      `SELECT * FROM public.chart_of_accounts
       WHERE code = $1 AND is_active = true FOR SHARE`,
      [accountCode]
    );
    const account = accountResult.rows[0];
    if (!isCashbookCashAccount(account)) {
      throw Object.assign(new Error('Choose an active cashbook account to reconcile.'), { statusCode: 400 });
    }
    const expectedResult = await client.query(
      `SELECT COALESCE(SUM(gl.debit - gl.credit), 0) AS expected_balance
       FROM public.general_ledger gl
       JOIN public.journal_entries je ON je.id = gl.journal_entry_id
       WHERE gl.account_code = $1 AND gl.entry_date <= $2::date
         AND je.system_type = 'MAIN' AND je.status IN ('Posted', 'Reversed')`,
      [accountCode, date]
    );
    const expectedBalance = Number(expectedResult.rows[0].expected_balance || 0);
    const discrepancy = Math.round((countedBalance - expectedBalance) * 100) / 100;
    const existing = await client.query(
      `SELECT id FROM public.cashbook_reconciliations
       WHERE reconciliation_date = $1::date AND account_code = $2 FOR UPDATE`,
      [date, accountCode]
    );
    let reconciliation;
    let action;
    if (existing.rows.length) {
      const updated = await client.query(
        `UPDATE public.cashbook_reconciliations
         SET expected_balance = $3, counted_balance = $4, discrepancy = $5,
             note = $6, reconciled_by_staff_id = $7, reconciled_by = $8, updated_at = NOW()
         WHERE id = $1 AND account_code = $2 RETURNING *`,
        [existing.rows[0].id, accountCode, expectedBalance, countedBalance, discrepancy, note || null, actor.id, actor.name]
      );
      reconciliation = updated.rows[0];
      action = 'updated';
    } else {
      const inserted = await client.query(
        `INSERT INTO public.cashbook_reconciliations (
           reconciliation_date, account_code, expected_balance, counted_balance, discrepancy,
           note, reconciled_by_staff_id, reconciled_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [date, accountCode, expectedBalance, countedBalance, discrepancy, note || null, actor.id, actor.name]
      );
      reconciliation = inserted.rows[0];
      action = 'reconciled';
    }
    await writeAudit(client, 'cashbook_reconciliation', reconciliation.id, action, actor, {
      reconciliation_date: date,
      account_code: accountCode,
      expected_balance: expectedBalance,
      counted_balance: countedBalance,
      discrepancy,
      note: note || null,
    });
    await client.query('COMMIT');
    return reconciliation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getCashbookAuditTrail({ page = 1, limit = 50, search = '' } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const offset = (safePage - 1) * safeLimit;
  const normalizedSearch = String(search || '').trim().slice(0, 120);
  const pattern = normalizedSearch
    ? `%${normalizedSearch.replace(/[!%_]/g, (character) => `!${character}`)}%`
    : null;
  const conditions = `entity_type IN ('cashbook_transaction', 'cashbook_reconciliation')
    AND ($1::text IS NULL OR actor ILIKE $1 ESCAPE '!' OR action ILIKE $1 ESCAPE '!' OR details::text ILIKE $1 ESCAPE '!')`;
  const [count, rows] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total_records FROM public.accounting_audit_log WHERE ${conditions}`, [pattern]),
    pool.query(
      `SELECT id, entity_type, entity_id, action, actor, details, created_at
       FROM public.accounting_audit_log WHERE ${conditions}
       ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [pattern, safeLimit, offset]
    ),
  ]);
  const totalRecords = Number(count.rows[0]?.total_records || 0);
  return {
    entries: rows.rows,
    pagination: {
      totalRecords,
      currentPage: safePage,
      totalPages: Math.ceil(totalRecords / safeLimit),
      pageSize: safeLimit,
    },
  };
}

export function getCashbookActorCapabilities(actor, creatorId = null) {
  const role = String(actor?.role || '').toUpperCase();
  const canReverse = ['MANAGER', 'DIRECTOR'].includes(role);
  return {
    actor_id: actor?.id,
    actor_role: role,
    can_create: ['ACCOUNTANT', 'MANAGER', 'DIRECTOR'].includes(role),
    can_reverse: canReverse,
    can_reconcile: ['ACCOUNTANT', 'MANAGER', 'DIRECTOR'].includes(role),
    can_edit: creatorId == null || Number(creatorId) === Number(actor?.id) || canReverse,
  };
}
