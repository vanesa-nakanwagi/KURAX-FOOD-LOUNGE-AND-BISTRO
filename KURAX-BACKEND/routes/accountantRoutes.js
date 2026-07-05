import express from 'express';
import pool from '../db.js';
import { registerSSEClient, removeSSEClient } from '../utils/logsActivity.js';

const router = express.Router();

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
  const today = kampalaDate();
  console.log(`🔵 /today endpoint called for date: ${today}`);
  
  try {
    // Ensure today's row exists
    await pool.query(
      `INSERT INTO daily_summary 
        (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel, 
         total_credit, total_mixed, order_count, total_settled_credits, day_closed, created_at, updated_at)
       VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, NOW(), NOW())
       ON CONFLICT (summary_date) DO NOTHING`,
      [today]
    );

    const summaryRes = await pool.query(
      `SELECT
         COALESCE(total_gross, 0) AS total_gross,
         COALESCE(total_cash, 0) AS total_cash,
         COALESCE(total_card, 0) AS total_card,
         COALESCE(total_mtn, 0) AS total_mtn,
         COALESCE(total_airtel, 0) AS total_airtel,
         COALESCE(order_count, 0) AS order_count,
         COALESCE(total_settled_credits, 0) AS total_settled_credits
       FROM daily_summary
       WHERE summary_date = $1`,
      [today]
    );

    const daily = summaryRes.rows[0] || {};
    const response = {
      total_gross: Number(daily.total_gross) || 0,
      total_cash: Number(daily.total_cash) || 0,
      total_card: Number(daily.total_card) || 0,
      total_mtn: Number(daily.total_mtn) || 0,
      total_airtel: Number(daily.total_airtel) || 0,
      order_count: Number(daily.order_count) || 0,
      total_settled_credits: Number(daily.total_settled_credits) || 0,
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
       WHERE entry_date = $1
       ORDER BY created_at DESC`,
      [today]
    );

    const entries   = result.rows;
    const total_out = entries.filter(e => e.direction === 'OUT').reduce((s, e) => s + Number(e.amount), 0);
    const total_in  = entries.filter(e => e.direction === 'IN' ).reduce((s, e) => s + Number(e.amount), 0);

    res.json({
      total_out,
      total_in,
      net: total_in - total_out,
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
  if (!amount || !direction || !description) {
    return res.status(400).json({ error: 'amount, direction, and description are required' });
  }
  if (!['IN', 'OUT'].includes(direction)) {
    return res.status(400).json({ error: 'direction must be IN or OUT' });
  }

  const today = kampalaDate();
  try {
    const result = await pool.query(
      `INSERT INTO petty_cash (amount, direction, category, description, logged_by, entry_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [Number(amount), direction, category || 'General', description.trim(), logged_by || 'Director', today]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Petty Cash POST Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 10. PETTY CASH — DELETE entry ───────────────────────────────────────────
router.delete('/petty-cash/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM petty_cash WHERE id = $1', [id]);
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
      `SELECT cash, mtn, airtel, card, notes,
              credit_settled_today, credit_outstanding_today
       FROM physical_counts
       WHERE saved = false
       ORDER BY created_at DESC
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
  const { startDate, endDate } = req.body;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }
  try {
    // Beginning inventory (latest snapshot before startDate)
    const beginningRes = await pool.query(
      `SELECT total_value FROM inventory_snapshots
       WHERE snapshot_date < $1
       ORDER BY snapshot_date DESC LIMIT 1`,
      [startDate]
    );
    const beginning = Number(beginningRes.rows[0]?.total_value) || 0;

    // Ending inventory (latest snapshot on or before endDate)
    const endingRes = await pool.query(
      `SELECT total_value FROM inventory_snapshots
       WHERE snapshot_date <= $1
       ORDER BY snapshot_date DESC LIMIT 1`,
      [endDate]
    );
    const ending = Number(endingRes.rows[0]?.total_value) || 0;

    // Sum of purchases in period
    const purchasesRes = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM purchases
       WHERE purchase_date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );
    const purchases = Number(purchasesRes.rows[0].total);

    const cogs = beginning + purchases - ending;

    // Total revenue from daily_summary (gross sales + credit settlements)
    const revenueRes = await pool.query(
      `SELECT COALESCE(SUM(total_gross), 0) AS total_revenue
       FROM daily_summary
       WHERE summary_date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );
    const totalRevenue = Number(revenueRes.rows[0].total_revenue);

    const grossProfit = totalRevenue - cogs;
    const netIncome = grossProfit; // you can subtract other expenses later

    res.json({
      revenue: totalRevenue,
      cogs: cogs,
      grossProfit: grossProfit,
      netIncome: netIncome,
      beginning_inventory: beginning,
      purchases: purchases,
      ending_inventory: ending,
    });
  } catch (err) {
    console.error('❌ POST /reports/income-statement error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 19. REPORT: BALANCE SHEET (simplified) ─────────────────────────────────
router.post('/reports/balance-sheet', async (req, res) => {
  const { asOfDate } = req.body;
  if (!asOfDate) {
    return res.status(400).json({ error: 'asOfDate is required' });
  }
  try {
    // Inventory asset
    const inventoryRes = await pool.query(
      `SELECT total_value FROM inventory_snapshots
       WHERE snapshot_date <= $1
       ORDER BY snapshot_date DESC LIMIT 1`,
      [asOfDate]
    );
    const inventory = Number(inventoryRes.rows[0]?.total_value) || 0;

    // You can add more asset/liability queries here (e.g., cash from daily_summary)
    // For now, return a simple structure.
    res.json({
      assets: {
        inventory: inventory,
        cash: 0,           // TODO: sum of daily cash on asOfDate
        receivables: 0,    // TODO: outstanding credits as of asOfDate
        total_assets: inventory,
      },
      liabilities: {
        total_liabilities: 0,
      },
      equity: {
        total_equity: inventory, // placeholder – should be assets - liabilities
      },
    });
  } catch (err) {
    console.error('❌ POST /reports/balance-sheet error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;