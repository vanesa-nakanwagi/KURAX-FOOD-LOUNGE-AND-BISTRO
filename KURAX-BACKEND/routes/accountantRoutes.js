import express from 'express';
import pool from '../db.js';
import logActivity, { registerSSEClient, removeSSEClient } from '../utils/logsActivity.js';
import { createPettyExpense, getCounterCash } from '../helpers/pettyCash.js';
import {
  createExpenseJournalEntry,
  createSalesJournalEntry,
  ensureAccountingDataModel,
  getAuditTrail,
  getBalanceSheet,
  getCashFlowStatement,
  getGeneralLedger,
  getIncomeStatement,
  getJournalEntries,
  getTrialBalance,
  listAccounts,
  postBackdatedExpense,
  resolveRevenueAccountCode,
  reverseJournalEntry,
} from '../helpers/accounting.js';

const router = express.Router();
ensureAccountingDataModel().catch((error) => {
  console.error('Accounting schema bootstrap warning:', error.message);
});

// ─── HELPER: Kampala date (YYYY-MM-DD) ──────────────────────────────────────
function kampalaDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── 0. TEST ROUTE ──────────────────────────────────────────────────────────
router.get('/test', (req, res) => {
  console.log('🔵 TEST endpoint called');
  res.json({ 
    status: 'ok', 
    message: 'Accountant routes are working!',
    timestamp: new Date().toISOString()
  });
});

// ─── 1. SIMPLE ORDER SUMMARY (used by older endpoints) ───────────────────────
router.get('/summary', async (req, res) => {
  const date = req.query.date || kampalaDate();
  console.log(`🔵 /summary endpoint called for date: ${date}`);
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)                                             AS total_orders,
         COALESCE(SUM(total), 0)                             AS total_revenue,
         COUNT(CASE WHEN is_archived = false THEN 1 END)     AS active_tables
       FROM orders
       WHERE (timestamp AT TIME ZONE 'Africa/Nairobi')::date = $1`,
      [date]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Overview Summary Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. TODAY'S STAT-CARD SUMMARY ───────────────────────────────────────────
router.get('/today', async (req, res) => {
  const businessDate = String(req.query.date || kampalaDate());
  const parsedBusinessDate = new Date(`${businessDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)
    || !Number.isFinite(parsedBusinessDate.getTime())
    || parsedBusinessDate.toISOString().slice(0, 10) !== businessDate) {
    return res.status(400).json({ error: 'A valid business date is required.' });
  }
  const isLiveDate = businessDate === kampalaDate();
  console.log(`🔵 /today endpoint called for date: ${businessDate}`);
  
  try {
    if (isLiveDate) {
      await pool.query(
        `INSERT INTO daily_summary
          (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel,
           total_credit, total_mixed, order_count, total_settled_credits, day_closed, created_at, updated_at)
         VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, NOW(), NOW())
         ON CONFLICT (summary_date) DO NOTHING`,
        [businessDate]
      );
    }

    const summaryRes = await pool.query(
      `SELECT
         COALESCE(total_gross, 0) AS total_gross,
         COALESCE(total_cash, 0) AS total_cash,
         COALESCE(total_card, 0) AS total_card,
         COALESCE(total_mtn, 0) AS total_mtn,
         COALESCE(total_airtel, 0) AS total_airtel,
         COALESCE(order_count, 0) AS order_count,
         COALESCE(total_settled_credits, 0) AS total_settled_credits,
         COALESCE(day_closed, false) AS day_closed
       FROM daily_summary
       WHERE summary_date = $1`,
      [businessDate]
    );

    const daily = summaryRes.rows[0] || {};
    const { cashOnCounter } = await getCounterCash(pool, businessDate);
    const response = {
      summary_date: businessDate,
      total_gross: Number(daily.total_gross) || 0,
      total_cash: Number(daily.total_cash) || 0,
      cash_on_counter: cashOnCounter,
      total_card: Number(daily.total_card) || 0,
      total_mtn: Number(daily.total_mtn) || 0,
      total_airtel: Number(daily.total_airtel) || 0,
      order_count: Number(daily.order_count) || 0,
      total_settled_credits: Number(daily.total_settled_credits) || 0,
      day_closed: Boolean(daily.day_closed),
    };
    
    res.json(response);
  } catch (err) {
    console.error('❌ Today Summary Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 2a. CREATE TODAY'S SUMMARY IF NOT EXISTS ────────────────────────────────
router.post('/ensure-today', async (req, res) => {
  const today = kampalaDate();
  try {
    const result = await pool.query(
      `INSERT INTO daily_summary 
        (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel, 
         total_credit, total_mixed, order_count, total_settled_credits, day_closed, created_at, updated_at)
       VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, NOW(), NOW())
       ON CONFLICT (summary_date) DO NOTHING
       RETURNING *`,
      [today]
    );
    res.json({ success: true, created: result.rows.length > 0 });
  } catch (err) {
    console.error('❌ Ensure today summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. MONTHLY CREDIT SUMMARY ────────────────────────────────────────────────
router.get('/credit-summary-monthly', async (req, res) => {
  const { month } = req.query;
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  console.log(`🔵 /credit-summary-monthly called for month: ${targetMonth}`);

  try {
    const creditsRes = await pool.query(
      `SELECT
         c.*,
         COALESCE(cs.total_settled, 0) AS amount_paid
       FROM credits c
       LEFT JOIN (
         SELECT credit_id, SUM(amount_paid) AS total_settled
         FROM credit_settlements
         GROUP BY credit_id
       ) cs ON cs.credit_id = c.id
       WHERE DATE_TRUNC('month', c.created_at AT TIME ZONE 'Africa/Nairobi')
           = DATE_TRUNC('month', ($1 || '-01')::date)
       ORDER BY c.created_at DESC`,
      [targetMonth]
    );

    const credits = creditsRes.rows;
    let totalSettled = 0, totalOutstanding = 0, totalRejected = 0;

    credits.forEach(credit => {
      const status  = String(credit.status || '').toLowerCase();
      const amount  = Number(credit.amount     || 0);
      const paid    = Number(credit.amount_paid || 0);

      if (status === 'fullysettled') {
        totalSettled += paid || amount;
      } else if (status === 'partiallysettled') {
        totalSettled     += paid;
        totalOutstanding += amount - paid;
      } else if (['approved', 'pendingcashier', 'pendingmanagerapproval'].includes(status)) {
        totalOutstanding += amount;
      } else if (status === 'rejected') {
        totalRejected += amount;
      }
    });

    res.json({
      month:             targetMonth,
      total_credits:     credits.length,
      total_settled:     totalSettled,
      total_outstanding: totalOutstanding,
      total_expected:    totalSettled + totalOutstanding,
      total_rejected:    totalRejected,
      credits,
    });
  } catch (err) {
    console.error('❌ Monthly Credit Summary Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. ACTIVITY LOGS — initial page load ────────────────────────────────────
router.get('/logs', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  try {
    const result = await pool.query(
      `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Overview Logs Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 5. SSE — REAL-TIME ACTIVITY STREAM ──────────────────────────────────────
router.get('/stream', (req, res) => {
  console.log('🔵 SSE stream connection established');
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Live feed connected' })}\n\n`);

  registerSSEClient(res);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); }
    catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on('close', () => {
    console.log('🔴 SSE stream closed');
    clearInterval(heartbeat);
    removeSSEClient(res);
  });
});

// ─── 6. WEEKLY REVENUE — for RevenueChart ────────────────────────────────────
router.get('/weekly-revenue', async (req, res) => {
  console.log('🔵 /weekly-revenue called');
  try {
    const result = await pool.query(`
      WITH day_series AS (
        SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')::date - n AS day
        FROM generate_series(0, 6) AS gs(n)
      ),
      sales AS (
        SELECT
          (confirmed_at AT TIME ZONE 'Africa/Nairobi')::date AS day,
          COALESCE(SUM(amount), 0) AS gross,
          COALESCE(SUM(CASE WHEN method = 'Cash'                      THEN amount ELSE 0 END), 0) AS cash,
          COALESCE(SUM(CASE WHEN method = 'Card'                      THEN amount ELSE 0 END), 0) AS card,
          COALESCE(SUM(CASE WHEN method IN ('Momo-MTN','Momo-Airtel') THEN amount ELSE 0 END), 0) AS momo
        FROM cashier_queue
        WHERE status = 'Confirmed'
          AND method != 'Credit'
          AND confirmed_at IS NOT NULL
          AND (confirmed_at AT TIME ZONE 'Africa/Nairobi')::date
              >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')::date - 6
        GROUP BY 1
      ),
      settled AS (
        SELECT
          (cs.created_at AT TIME ZONE 'Africa/Nairobi')::date AS day,
          COALESCE(SUM(cs.amount_paid), 0) AS credit_settled
        FROM credit_settlements cs
        WHERE (cs.created_at AT TIME ZONE 'Africa/Nairobi')::date
              >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')::date - 6
        GROUP BY 1
      ),
      expenses AS (
        SELECT
          entry_date AS day,
          COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS petty
        FROM petty_cash
        WHERE entry_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')::date - 6
        GROUP BY 1
      )
      SELECT
        ds.day,
        TO_CHAR(ds.day, 'Dy')                                                   AS date,
        COALESCE(s.gross, 0) + COALESCE(st.credit_settled, 0)                  AS gross,
        COALESCE(s.cash,  0)                                                    AS cash,
        COALESCE(s.card,  0)                                                    AS card,
        COALESCE(s.momo,  0)                                                    AS momo,
        COALESCE(st.credit_settled, 0)                                          AS credit_settled,
        COALESCE(e.petty, 0)                                                    AS petty,
        (COALESCE(s.gross, 0) + COALESCE(st.credit_settled, 0))
          - COALESCE(e.petty, 0)                                                AS profit
      FROM day_series ds
      LEFT JOIN sales    s  ON s.day  = ds.day
      LEFT JOIN settled  st ON st.day = ds.day
      LEFT JOIN expenses e  ON e.day  = ds.day
      ORDER BY ds.day ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Weekly Revenue Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 7. SHIFT LIQUIDATIONS ────────────────────────────────────────────────────
router.get('/shifts', async (req, res) => {
  const date = req.query.date || kampalaDate();
  try {
    const result = await pool.query(
      `SELECT
         id, staff_id, staff_name, role,
         total_orders,
         total_cash, total_mtn, total_airtel, total_card, gross_total,
         shift_date,
         created_at AS clock_out
       FROM staff_shifts
       WHERE shift_date = $1
       ORDER BY created_at ASC`,
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Overview Shifts Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 8. PETTY CASH — GET today's entries ─────────────────────────────────────
router.get('/petty-cash', async (req, res) => {
  const today = kampalaDate();
  console.log(`🔵 /petty-cash GET called for ${today}`);
  try {
    const result = await pool.query(
      `SELECT *
       FROM petty_cash
      WHERE entry_date = $1 AND direction = 'OUT'
       ORDER BY created_at DESC`,
      [today]
    );

    const entries   = result.rows;
    const total_out = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const { cashOnCounter } = await getCounterCash(pool, today);

    res.json({
      total_out,
      cash_on_counter: cashOnCounter,
      entries,
    });
  } catch (err) {
    console.error('❌ Petty Cash GET Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 9. PETTY CASH — POST new entry ──────────────────────────────────────────
router.post('/petty-cash', async (req, res) => {
  const { amount, direction, category, description, logged_by } = req.body;
  const expenseAmount = Number(amount);
  if (!Number.isFinite(expenseAmount) || expenseAmount <= 0 || !description?.trim()) {
    return res.status(400).json({ error: 'A positive amount and description are required' });
  }
  if (direction && direction !== 'OUT') {
    return res.status(400).json({ error: 'Petty cash entries must be expenses' });
  }

  const today = kampalaDate();
  try {
    const saved = await createPettyExpense(pool, {
      amount: expenseAmount,
      category: category || 'General',
      description: description.trim(),
      logged_by: logged_by || 'Director',
      entry_date: today,
    });

    const journal = await createExpenseJournalEntry({
      amount: expenseAmount,
      category: category || 'Petty Expenses',
      description: description.trim(),
      paymentAccountCode: '1001',
      sourceTransaction: `petty_cash:${saved.entry.id}`,
      postedBy: logged_by || 'Director',
      entryDate: today,
    });

    await logActivity(pool, {
      type: 'PETTY',
      actor: logged_by || 'Director',
      role: 'ACCOUNTANT',
      message: `Petty expense: UGX ${expenseAmount.toLocaleString()} (${description.trim()})`,
      meta: { journal_entry: journal.reference, cash_after: saved.cashAfter },
    });
    res.status(201).json({ ...saved.entry, cash_before: saved.cashBefore, cash_after: saved.cashAfter, journal_entry: journal.reference });
  } catch (err) {
    console.error('❌ Petty Cash POST Error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── 10. PETTY CASH — DELETE entry ───────────────────────────────────────────
router.delete('/petty-cash/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM petty_cash WHERE id = $1 AND direction = 'OUT' RETURNING amount",
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Petty expense not found' });
    await logActivity(pool, {
      type: 'PETTY',
      actor: 'Accountant',
      role: 'ACCOUNTANT',
      message: `Petty expense deleted: UGX ${Number(result.rows[0].amount).toLocaleString()}`,
    });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Petty Cash DELETE Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 11. DIRECTOR DAILY SUMMARY (combined endpoint) ──────────────────────────
router.get('/director/daily-summary', async (req, res) => {
  const today = kampalaDate();
  try {
    const dailyRes = await pool.query(
      `SELECT
         COALESCE(total_gross,  0) AS total_gross,
         COALESCE(total_cash,   0) AS total_cash,
         COALESCE(total_card,   0) AS total_card,
         COALESCE(total_mtn,    0) AS total_mtn,
         COALESCE(total_airtel, 0) AS total_airtel,
         COALESCE(order_count,  0) AS order_count,
         COALESCE(total_settled_credits, 0) AS total_settled_credits
       FROM daily_summary
       WHERE summary_date = $1`,
      [today]
    );

    const settleRes = await pool.query(
      `SELECT COALESCE(SUM(cs.amount_paid), 0) AS total_settled
       FROM credit_settlements cs
       WHERE (cs.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1`,
      [today]
    );

    const monthlyRes = await pool.query(
      `SELECT
         c.*,
         COALESCE(cs.total_paid, 0) AS amount_paid_total
       FROM credits c
       LEFT JOIN (
         SELECT credit_id, SUM(amount_paid) AS total_paid
         FROM credit_settlements
         GROUP BY credit_id
       ) cs ON cs.credit_id = c.id
       WHERE DATE_TRUNC('month', c.created_at AT TIME ZONE 'Africa/Nairobi')
           = DATE_TRUNC('month', CURRENT_DATE)
       ORDER BY c.created_at DESC`
    );

    let totalSettledMonthly = 0, totalOutstandingMonthly = 0;
    monthlyRes.rows.forEach(credit => {
      const status = String(credit.status || '').toLowerCase();
      const amount = Number(credit.amount           || 0);
      const paid   = Number(credit.amount_paid_total || credit.amount_paid || 0);

      if (status === 'fullysettled') {
        totalSettledMonthly += paid || amount;
      } else if (status === 'partiallysettled') {
        totalSettledMonthly     += paid;
        totalOutstandingMonthly += amount - paid;
      } else if (['approved', 'pendingcashier', 'pendingmanagerapproval'].includes(status)) {
        totalOutstandingMonthly += amount;
      }
    });

    res.json({
      daily: {
        gross:                    Number(dailyRes.rows[0]?.total_gross || 0),
        cash:                     Number(dailyRes.rows[0]?.total_cash || 0),
        card:                     Number(dailyRes.rows[0]?.total_card || 0),
        mtn:                      Number(dailyRes.rows[0]?.total_mtn || 0),
        airtel:                   Number(dailyRes.rows[0]?.total_airtel || 0),
        orders:                   Number(dailyRes.rows[0]?.order_count || 0),
        total_settled_credits:    Number(dailyRes.rows[0]?.total_settled_credits || 0),
        credit_settlements_today: Number(settleRes.rows[0]?.total_settled || 0),
      },
      monthly_credits: {
        total_settled:     totalSettledMonthly,
        total_outstanding: totalOutstandingMonthly,
        total_expected:    totalSettledMonthly + totalOutstandingMonthly,
        total_records:     monthlyRes.rows.length,
      },
    });
  } catch (err) {
    console.error('❌ Director Daily Summary Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 12. PHYSICAL COUNT – GET latest unsaved entry (if any) ─────────────────
router.get('/physical-count', async (req, res) => {
  console.log('🔵 GET /physical-count called');
  try {
    const result = await pool.query(
          `SELECT cash,
            COALESCE(NULLIF(mtn, 0), momo_mtn, 0) AS mtn,
            COALESCE(NULLIF(airtel, 0), momo_airtel, 0) AS airtel,
            card, notes,
              credit_settled_today, credit_outstanding_today
       FROM physical_counts
       ORDER BY CASE WHEN
         COALESCE(cash, 0) <> 0 OR
         COALESCE(mtn, 0) <> 0 OR
         COALESCE(airtel, 0) <> 0 OR
         COALESCE(momo_mtn, 0) <> 0 OR
         COALESCE(momo_airtel, 0) <> 0 OR
         COALESCE(card, 0) <> 0 OR
         COALESCE(credit_settled_today, 0) <> 0 OR
         COALESCE(credit_outstanding_today, 0) <> 0
         THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.json({
        cash: 0,
        mtn: 0,
        airtel: 0,
        card: 0,
        notes: '',
        creditSettledToday: 0,
        creditOutstandingToday: 0
      });
    }
    const row = result.rows[0];
    res.json({
      cash: Number(row.cash) || 0,
      mtn: Number(row.mtn) || 0,
      airtel: Number(row.airtel) || 0,
      card: Number(row.card) || 0,
      notes: row.notes || '',
      creditSettledToday: Number(row.credit_settled_today) || 0,
      creditOutstandingToday: Number(row.credit_outstanding_today) || 0
    });
  } catch (err) {
    console.error('❌ GET /physical-count error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 13. PHYSICAL COUNT – SAVE (or update) ──────────────────────────────────
router.post('/physical-count', async (req, res) => {
  const {
    cash, mtn, airtel, card, notes,
    creditSettledToday, creditOutstandingToday
  } = req.body;

  console.log(`🔵 POST /physical-count – cash: ${cash}, settled: ${creditSettledToday}`);

  if (cash === undefined || mtn === undefined || airtel === undefined || card === undefined) {
    return res.status(400).json({ error: 'Missing required numeric fields' });
  }

  try {
    // Mark any previous unsaved records as saved (only one working copy)
    await pool.query(`UPDATE physical_counts SET saved = true WHERE saved = false`);

    const result = await pool.query(
      `INSERT INTO physical_counts
         (cash, mtn, airtel, card, notes,
          credit_settled_today, credit_outstanding_today, saved, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
       RETURNING id`,
      [
        Number(cash),
        Number(mtn),
        Number(airtel),
        Number(card),
        notes || '',
        Number(creditSettledToday || 0),
        Number(creditOutstandingToday || 0)
      ]
    );

    console.log(`✅ Physical count saved with id ${result.rows[0].id}`);
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('❌ POST /physical-count error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== INVENTORY AND REPORTS ROUTES (ADDED) ==========

// ─── 14. PURCHASES – Record a new purchase invoice ──────────────────────────
router.post('/purchases', async (req, res) => {
  const { purchase_date, supplier, total_amount, invoice_number, notes } = req.body;
  if (!purchase_date || total_amount === undefined) {
    return res.status(400).json({ error: 'purchase_date and total_amount are required' });
  }
  // Optionally get logged-in user from JWT (if you have auth middleware)
  const user = req.user?.name || 'Accountant';
  try {
    await pool.query(
      `INSERT INTO purchases (purchase_date, supplier, total_amount, invoice_number, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [purchase_date, supplier || null, total_amount, invoice_number || null, notes || null, user]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('❌ POST /purchases error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 15. PURCHASES – Get purchases (optionally filtered by date range) ───────
router.get('/purchases', async (req, res) => {
  const { start, end } = req.query;
  try {
    let query = 'SELECT * FROM purchases ORDER BY purchase_date DESC';
    const params = [];
    if (start && end) {
      query = 'SELECT * FROM purchases WHERE purchase_date BETWEEN $1 AND $2 ORDER BY purchase_date DESC';
      params.push(start, end);
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /purchases error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 16. INVENTORY SNAPSHOTS – Record a snapshot ────────────────────────────
router.post('/inventory-snapshots', async (req, res) => {
  const { snapshot_date, total_value, notes } = req.body;
  if (!snapshot_date || total_value === undefined) {
    return res.status(400).json({ error: 'snapshot_date and total_value are required' });
  }
  const user = req.user?.name || 'Accountant';
  try {
    await pool.query(
      `INSERT INTO inventory_snapshots (snapshot_date, total_value, notes, created_by)
       VALUES ($1, $2, $3, $4)`,
      [snapshot_date, total_value, notes || null, user]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('❌ POST /inventory-snapshots error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 17. INVENTORY SNAPSHOTS – Get snapshots (by date or latest) ────────────
router.get('/inventory-snapshots', async (req, res) => {
  const { date, latest } = req.query;
  try {
    if (latest === 'true') {
      const result = await pool.query(
        `SELECT * FROM inventory_snapshots ORDER BY snapshot_date DESC LIMIT 1`
      );
      return res.json(result.rows[0] || null);
    }
    if (date) {
      const result = await pool.query(
        `SELECT * FROM inventory_snapshots WHERE snapshot_date = $1 ORDER BY snapshot_date DESC`,
        [date]
      );
      return res.json(result.rows[0] || null);
    }
    const result = await pool.query(`SELECT * FROM inventory_snapshots ORDER BY snapshot_date DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /inventory-snapshots error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 18. REPORT: INCOME STATEMENT ───────────────────────────────────────────
router.post('/reports/income-statement', async (req, res) => {
  const { startDate, endDate, startTime, endTime } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }
  try {
    const report = await getIncomeStatement(startDate, endDate, startTime || null, endTime || null);
    res.json(report);
  } catch (err) {
    console.error('❌ POST /reports/income-statement error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 19. REPORT: BALANCE SHEET ───────────────────────────────────────────────
router.post('/reports/balance-sheet', async (req, res) => {
  const { asOfDate, startTime, endTime } = req.body;
  if (!asOfDate) {
    return res.status(400).json({ error: 'asOfDate is required' });
  }
  try {
    const report = await getBalanceSheet(asOfDate, startTime || null, endTime || null);
    res.json(report);
  } catch (err) {
    console.error('❌ POST /reports/balance-sheet error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 20. ACCOUNTING FOUNDATION ROUTES ───────────────────────────────────────
router.get('/accounting/overview', async (req, res) => {
  try {
    const today = kampalaDate();
    const [trial, income, cashFlow, accounts] = await Promise.all([
      getTrialBalance(today, today),
      getIncomeStatement('2000-01-01', today),
      getCashFlowStatement('2000-01-01', today),
      listAccounts(),
    ]);

    const accountMap = Object.fromEntries(accounts.map((account) => [account.code, account]));
    const cashAccount = accountMap['1001'];
    const revenueTotal = income.totalRevenue || 0;
    const expenseTotal = income.totalExpenses || 0;

    res.json({
      accounts: accounts.length,
      cash_account: cashAccount,
      total_revenue: revenueTotal,
      total_expenses: expenseTotal,
      net_profit: revenueTotal - expenseTotal,
      trial_balance: trial,
      cash_flow: cashFlow,
    });
  } catch (err) {
    console.error('Accounting overview error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/chart-of-accounts', async (req, res) => {
  try {
    const accounts = await listAccounts();
    res.json({ accounts });
  } catch (err) {
    console.error('Chart of accounts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounting/chart-of-accounts', async (req, res) => {
  const { code, name, category, account_type, normal_balance, description, created_by } = req.body;
  if (!code || !name || !category) {
    return res.status(400).json({ error: 'code, name, and category are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO chart_of_accounts (code, name, category, account_type, normal_balance, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         account_type = COALESCE(EXCLUDED.account_type, chart_of_accounts.account_type),
         normal_balance = COALESCE(EXCLUDED.normal_balance, chart_of_accounts.normal_balance),
         description = EXCLUDED.description,
         updated_at = NOW()
       RETURNING *`,
      [
        String(code),
        String(name),
        String(category),
        account_type || 'General',
        normal_balance || 'Debit',
        description || '',
        created_by || 'Accountant',
      ]
    );
    res.status(201).json({ account: result.rows[0] });
  } catch (err) {
    console.error('Create account error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/general-ledger', async (req, res) => {
  const { startDate, endDate, startTime, endTime } = req.query;
  try {
    const entries = await getGeneralLedger(startDate || null, endDate || null, startTime || null, endTime || null);
    res.json({ entries });
  } catch (err) {
    console.error('General ledger error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/journal-entries', async (req, res) => {
  const { startDate, endDate, startTime, endTime, limit } = req.query;
  try {
    const journal = await getJournalEntries({ startDate: startDate || null, endDate: endDate || null, startTime: startTime || null, endTime: endTime || null, limit: limit ? Number(limit) : null });
    res.json({ entries: journal });
  } catch (err) {
    console.error('Journal entry fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/historical-summary', async (req, res) => {
  const { startDate, endDate, startTime, endTime } = req.query;
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  const validTime = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate
    || !validTime(startTime) || !validTime(endTime) || (startTime && endTime && startTime > endTime)) {
    return res.status(400).json({ error: 'A valid startDate and endDate range is required.' });
  }

  try {
    const [dailyResult, expenseResult, pettyResult, journalEntries, cashFlow, ordersResult, creditsResult, settlementsResult, ticketsResult, shishaResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS business_days,
                COALESCE(SUM(total_gross), 0) AS total_gross,
                COALESCE(SUM(total_cash), 0) AS total_cash,
                COALESCE(SUM(total_card), 0) AS total_card,
                COALESCE(SUM(total_mtn), 0) AS total_mtn,
                COALESCE(SUM(total_airtel), 0) AS total_airtel,
                COALESCE(SUM(total_credit), 0) AS total_credit,
                COALESCE(SUM(total_settled_credits), 0) AS credit_settlements,
                COALESCE(SUM(order_count), 0) AS order_count
         FROM public.daily_summary WHERE summary_date BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
      pool.query(
        `SELECT gl.account_code, gl.account_name,
                COALESCE(SUM(gl.debit - gl.credit), 0) AS amount
         FROM public.general_ledger gl
         JOIN public.journal_entries je ON je.id = gl.journal_entry_id AND je.system_type = 'MAIN'
         JOIN public.chart_of_accounts coa ON coa.code = gl.account_code
         WHERE coa.category = 'Expense' AND gl.entry_date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR gl.business_time >= $3::time)
           AND ($4::time IS NULL OR gl.business_time <= $4::time)
         GROUP BY gl.account_code, gl.account_name ORDER BY gl.account_code`,
        [startDate, endDate, startTime || null, endTime || null]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_out
         FROM public.petty_cash
         WHERE direction = 'OUT' AND entry_date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time <= $4::time)`,
        [startDate, endDate, startTime || null, endTime || null]
      ),
      getJournalEntries({ startDate, endDate, startTime, endTime, limit: 500 }),
      getCashFlowStatement(startDate, endDate, startTime || null, endTime || null),
      pool.query(
        `SELECT o.id, o.table_name, o.staff_name, o.items, o.total, o.status,
                o.payment_method, o.payment_confirmed,
                COALESCE(o.timestamp, o.created_at) AS transaction_at
         FROM public.orders o
         WHERE COALESCE(o.timestamp, o.created_at) >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND COALESCE(o.timestamp, o.created_at) < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
           AND ($3::time IS NULL OR (COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         ORDER BY transaction_at DESC LIMIT 500`,
        [startDate, endDate, startTime || null, endTime || null]
      ),
      pool.query(
        `SELECT id, client_name, amount, amount_paid, status, created_at, paid_at, pay_by
         FROM public.credits
         WHERE (created_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         ORDER BY created_at DESC LIMIT 500`,
        [startDate, endDate, startTime || null, endTime || null]
      ),
      pool.query(
        `SELECT cs.id, cs.credit_id, cs.amount_paid, cs.method, cs.created_at, c.client_name
         FROM public.credit_settlements cs
         JOIN public.credits c ON c.id = cs.credit_id
         WHERE (cs.created_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR (cs.created_at AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (cs.created_at AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         ORDER BY cs.created_at DESC LIMIT 500`,
        [startDate, endDate, startTime || null, endTime || null]
      ),
      pool.query(
        `SELECT 'Kitchen' AS station, id, order_id, table_name, staff_name, total, status, created_at
         FROM public.kitchen_tickets WHERE ticket_date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         UNION ALL
         SELECT 'Bar' AS station, id, order_id, table_name, staff_name, total, status, created_at
         FROM public.barman_tickets WHERE ticket_date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         UNION ALL
         SELECT 'Barista' AS station, id, order_id, table_name, staff_name, total, status, created_at
         FROM public.barista_tickets WHERE ticket_date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         ORDER BY created_at DESC LIMIT 500`,
        [startDate, endDate, startTime || null, endTime || null]
      ),
      pool.query(
        `SELECT id, total_amount, amount_paid, outstanding_amount, order_status, created_at,
                shisha_waiter_id, assigned_chef_id
         FROM public.shisha_orders
         WHERE (created_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1 AND $2
           AND ($3::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time >= $3::time)
           AND ($4::time IS NULL OR (created_at AT TIME ZONE 'Africa/Kampala')::time <= $4::time)
         ORDER BY created_at DESC LIMIT 500`,
        [startDate, endDate, startTime || null, endTime || null]
      ),
    ]);

    const daily = dailyResult.rows[0] || {};
    res.json({
      startDate,
      endDate,
      startTime: startTime || null,
      endTime: endTime || null,
      business_days: Number(daily.business_days || 0),
      sales: {
        total_gross: Number(daily.total_gross || 0),
        cash: Number(daily.total_cash || 0),
        card: Number(daily.total_card || 0),
        mtn: Number(daily.total_mtn || 0),
        airtel: Number(daily.total_airtel || 0),
        credit: Number(daily.total_credit || 0),
        credit_settlements: Number(daily.credit_settlements || 0),
        order_count: Number(daily.order_count || 0),
      },
      expenses: expenseResult.rows.map((row) => ({ ...row, amount: Number(row.amount || 0) })),
      petty_cash_out: Number(pettyResult.rows[0]?.total_out || 0),
      cash_flow: cashFlow,
      journal_entries: journalEntries,
      orders: ordersResult.rows,
      credits: creditsResult.rows,
      credit_settlements: settlementsResult.rows,
      station_tickets: ticketsResult.rows,
      shisha_orders: shishaResult.rows,
    });
  } catch (err) {
    console.error('Historical accounting summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounting/journal-entries/:id/reverse', async (req, res) => {
  const journalEntryId = Number(req.params.id);
  const { reversalDate, reason, actor } = req.body || {};
  if (!Number.isInteger(journalEntryId) || journalEntryId < 1) {
    return res.status(400).json({ error: 'A valid journal entry ID is required.' });
  }

  try {
    const result = await reverseJournalEntry({
      journalEntryId,
      reversalDate,
      reason,
      actor: req.user?.name || actor || 'Accountant',
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('Journal reversal error:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/accounting/backdated-expenses', async (req, res) => {
  const { amount, category, description, paymentAccountCode, transactionDate, businessTime, reason, postedBy } = req.body || {};
  try {
    const result = await postBackdatedExpense({
      amount,
      category,
      description,
      paymentAccountCode,
      transactionDate,
      businessTime,
      reason,
      actor: req.user?.name || postedBy || 'Accountant',
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    console.error('Backdated expense posting error:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/accounting/trial-balance', async (req, res) => {
  const { startDate, endDate, startTime, endTime } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  try {
    const trialBalance = await getTrialBalance(startDate, endDate, startTime || null, endTime || null);
    const totalDebits = trialBalance.reduce((sum, row) => sum + row.total_debit, 0);
    const totalCredits = trialBalance.reduce((sum, row) => sum + row.total_credit, 0);
    res.json({ startDate, endDate, trial_balance: trialBalance, total_debits: totalDebits, total_credits: totalCredits, imbalance: totalDebits - totalCredits });
  } catch (err) {
    console.error('Trial balance error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/income-statement', async (req, res) => {
  const { startDate, endDate, startTime, endTime } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }
  try {
    const report = await getIncomeStatement(startDate, endDate, startTime || null, endTime || null);
    res.json(report);
  } catch (err) {
    console.error('Income statement error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/balance-sheet', async (req, res) => {
  const { asOfDate, startTime, endTime } = req.query;
  if (!asOfDate) {
    return res.status(400).json({ error: 'asOfDate is required' });
  }
  try {
    const report = await getBalanceSheet(asOfDate, startTime || null, endTime || null);
    res.json(report);
  } catch (err) {
    console.error('Balance sheet error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/cash-flow', async (req, res) => {
  const { startDate, endDate, startTime, endTime } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }
  try {
    const report = await getCashFlowStatement(startDate, endDate, startTime || null, endTime || null);
    res.json(report);
  } catch (err) {
    console.error('Cash flow statement error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/accounts-receivable', async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const params = [];
    const dateFilter = startDate && endDate ? ` AND c.created_at::date BETWEEN $1 AND $2` : '';
    if (startDate && endDate) params.push(startDate, endDate);
    const rows = await pool.query(
      `SELECT
         COALESCE(c.cashier_queue_id::text, 'CREDIT-' || c.id::text) AS reference,
         c.client_name AS customer_name,
         c.amount,
         COALESCE(c.amount_paid, 0) AS amount_paid,
         GREATEST(c.amount - COALESCE(c.amount_paid, 0), 0) AS outstanding_balance,
         CASE
           WHEN c.amount - COALESCE(c.amount_paid, 0) <= 0 THEN 'Fully Settled'
           WHEN COALESCE(c.amount_paid, 0) > 0 THEN 'Partially Paid'
           ELSE 'Outstanding'
         END AS status,
         c.pay_by AS due_date,
         c.created_at
       FROM public.credits c
       WHERE c.status IN ('Approved', 'PartiallySettled', 'FullySettled')
       ${dateFilter}
       ORDER BY c.created_at DESC`,
      params
    );
    res.json({ entries: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/accounts-payable', async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    const params = [];
    const dateFilter = startDate && endDate ? `WHERE c.created_at::date BETWEEN $1 AND $2` : '';
    const purchaseDateFilter = startDate && endDate ? `AND pr.business_date BETWEEN $1 AND $2` : '';
    if (startDate && endDate) params.push(startDate, endDate);
    const rows = await pool.query(
      `SELECT c.reference, c.supplier_name, c.amount, c.amount_paid, c.outstanding_balance,
              c.status, c.due_date, c.payment_method, c.created_at, c.updated_at
       FROM public.accounts_payable c ${dateFilter}
       UNION ALL
       SELECT 'INV-PUR-' || pr.id::text AS reference, s.name AS supplier_name,
              pr.total_amount AS amount, 0 AS amount_paid, pr.total_amount AS outstanding_balance,
              'Unpaid' AS status, NULL::date AS due_date, pr.payment_method,
              pr.created_at, pr.created_at AS updated_at
       FROM public.purchase_receipts pr
       LEFT JOIN public.suppliers s ON s.id = pr.supplier_id
       WHERE pr.total_amount > 0
         AND (
           LOWER(COALESCE(pr.payment_method, '')) LIKE '%credit%'
           OR LOWER(COALESCE(pr.payment_method, '')) LIKE '%payable%'
           OR LOWER(COALESCE(pr.payment_method, '')) LIKE '%supplier%'
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.accounts_payable existing
           WHERE existing.reference = 'INV-PUR-' || pr.id::text
         )
         ${purchaseDateFilter}
       ORDER BY created_at DESC`,
      params
    );
    res.json({ entries: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/periods', async (req, res) => {
  try {
    const rows = await pool.query(`SELECT * FROM accounting_periods ORDER BY start_date DESC`);
    res.json({ periods: rows.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounting/periods', async (req, res) => {
  const { period_name, start_date, end_date, status = 'Open', created_by = 'Accountant' } = req.body;
  if (!period_name || !start_date || !end_date) {
    return res.status(400).json({ error: 'period_name, start_date, and end_date are required' });
  }
  if (!['Open', 'Closed'].includes(status)) {
    return res.status(400).json({ error: "Period status must be 'Open' or 'Closed'." });
  }
  try {
    const existing = await pool.query(
      `SELECT id, status FROM accounting_periods WHERE period_name = $1 LIMIT 1`,
      [period_name]
    );
    if (existing.rows[0]?.status === 'Closed') {
      return res.status(409).json({ error: 'Closed accounting periods cannot be edited or reopened through this endpoint. A controlled, authorized reopening process is required.' });
    }

    const result = await pool.query(
      `INSERT INTO accounting_periods (period_name, start_date, end_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (period_name) DO UPDATE SET
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         status = EXCLUDED.status,
         created_by = EXCLUDED.created_by
       RETURNING *`,
      [period_name, start_date, end_date, status, created_by]
    );
    await pool.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('accounting_period', $1, $2, $3, $4)`,
      [result.rows[0].id, existing.rows.length ? 'period_updated' : 'period_created', created_by || 'Accountant', JSON.stringify({ period_name, start_date, end_date, status })]
    );
    res.status(201).json({ period: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/accounting/audit-trail', async (req, res) => {
  try {
    const rows = await getAuditTrail();
    res.json({ entries: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/accounting/sales', async (req, res) => {
  const { amount, department, station, paymentMethod = 'Cash', settlementStatus = 'Pending', description, sourceTransaction, postedBy, entryDate } = req.body;
  if (!amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid sale amount is required' });
  }
  let revenueAccountCode;
  try {
    revenueAccountCode = resolveRevenueAccountCode(department || station);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  try {
    const entry = await createSalesJournalEntry({
      amount,
      paymentMethod,
      settlementStatus,
      revenueAccountCode,
      description,
      sourceTransaction,
      postedBy,
      entryDate,
    });
    res.status(201).json({ success: true, entry });
  } catch (err) {
    console.error('Accounting sale sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;