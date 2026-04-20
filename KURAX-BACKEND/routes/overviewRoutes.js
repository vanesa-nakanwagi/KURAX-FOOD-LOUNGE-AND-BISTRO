import express from 'express';
import pool from '../db.js';
import { registerSSEClient, removeSSEClient } from '../utils/logsActivity.js';

const router = express.Router();

// ─── Kampala/Nairobi local date string ───────────────────────────────────────
function kampalaDate() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

// ─── 1. SIMPLE ORDER SUMMARY (used by older endpoints) ───────────────────────
router.get('/summary', async (req, res) => {
  const date = req.query.date || kampalaDate();
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
    console.error('Overview Summary Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. TODAY'S STAT-CARD SUMMARY ────────────────────────────────────────────
//
// Returns all the fields the Overview stat cards need in ONE query:
//   total_cash, total_card, total_mtn, total_airtel, total_gross
//   credit_settlements_today  (grand total of settlements made today)
//   credit_settlements_breakdown  { cash, card, mtn, airtel }
//
// The frontend SUBTRACTS each breakdown field from the corresponding raw total
// to show true new-sales revenue (not inflated by credit settlement payments).
//
// This route is polled every 10 seconds AND triggered by SSE events so the
// stat cards increment in real time throughout the day.
// The daily_summary table accumulates rows from midnight to midnight Kampala
// time — giving automatic 24-hour persistence with no extra work.
//
router.get('/today', async (req, res) => {
  const today = kampalaDate();
  try {
    // ── Daily payment totals ──────────────────────────────────────────────────
    // Pull from daily_summary (written by the cashier confirmation flow).
    // Falls back to zeros if the row does not yet exist today.
    const summaryRes = await pool.query(
      `SELECT
         COALESCE(total_gross,  0) AS total_gross,
         COALESCE(total_cash,   0) AS total_cash,
         COALESCE(total_card,   0) AS total_card,
         COALESCE(total_mtn,    0) AS total_mtn,
         COALESCE(total_airtel, 0) AS total_airtel,
         COALESCE(order_count,  0) AS order_count
       FROM daily_summary
       WHERE date = $1`,
      [today]
    );

    // ── Credit settlements collected today — grand total ──────────────────────
    const settleGrandRes = await pool.query(
      `SELECT COALESCE(SUM(cs.amount_paid), 0) AS total
       FROM credit_settlements cs
       WHERE (cs.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1`,
      [today]
    );

    // ── Credit settlements today — broken down by payment method ─────────────
    // We join credit_settlements back to cashier_queue to find which method
    // was used when the credit was settled (cash, card, mtn, airtel).
    const settleBreakdownRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN LOWER(cq.method) = 'cash'        THEN cs.amount_paid ELSE 0 END), 0) AS cash,
         COALESCE(SUM(CASE WHEN LOWER(cq.method) = 'card'        THEN cs.amount_paid ELSE 0 END), 0) AS card,
         COALESCE(SUM(CASE WHEN LOWER(cq.method) = 'momo-mtn'    THEN cs.amount_paid ELSE 0 END), 0) AS mtn,
         COALESCE(SUM(CASE WHEN LOWER(cq.method) = 'momo-airtel' THEN cs.amount_paid ELSE 0 END), 0) AS airtel
       FROM credit_settlements cs
       -- cashier_queue row that was created when this settlement was confirmed
       JOIN cashier_queue cq
         ON cq.reference_id = cs.id::text
        AND cq.status = 'Confirmed'
        AND cq.method != 'Credit'
       WHERE (cs.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1`,
      [today]
    );

    const daily      = summaryRes.rows[0]       || {};
    const grandTotal = settleGrandRes.rows[0]   || {};
    const breakdown  = settleBreakdownRes.rows[0] || {};

    res.json({
      // Raw payment totals for the day (include credit settlement amounts)
      total_gross:  Number(daily.total_gross  || 0),
      total_cash:   Number(daily.total_cash   || 0),
      total_card:   Number(daily.total_card   || 0),
      total_mtn:    Number(daily.total_mtn    || 0),
      total_airtel: Number(daily.total_airtel || 0),
      order_count:  Number(daily.order_count  || 0),

      // Grand total of credit settlements received today
      // Frontend subtracts this from total_gross to get true gross revenue.
      credit_settlements_today: Number(grandTotal.total || 0),

      // Per-method breakdown so each stat card can subtract correctly:
      //   displayCash   = total_cash   - credit_settlements_breakdown.cash
      //   displayCard   = total_card   - credit_settlements_breakdown.card
      //   displayMTN    = total_mtn    - credit_settlements_breakdown.mtn
      //   displayAirtel = total_airtel - credit_settlements_breakdown.airtel
      credit_settlements_breakdown: {
        cash:   Number(breakdown.cash   || 0),
        card:   Number(breakdown.card   || 0),
        mtn:    Number(breakdown.mtn    || 0),
        airtel: Number(breakdown.airtel || 0),
      },
    });
  } catch (err) {
    console.error('Today Summary Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. MONTHLY CREDIT SUMMARY ────────────────────────────────────────────────
//
// Returns aggregate credit figures for the given month (defaults to current).
// The Credit Summary card on the Overview page uses this for its "persists for
// a month" display.  The frontend /api/cashier-ops/credits endpoint returns the
// full ledger which the Overview component also uses for the same card —
// this endpoint is an alternative if you prefer a pre-aggregated response.
//
router.get('/credit-summary-monthly', async (req, res) => {
  const { month } = req.query;
  const targetMonth = month || new Date().toISOString().slice(0, 7); // "YYYY-MM"

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
    console.error('Monthly Credit Summary Error:', err.message);
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
    console.error('Overview Logs Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 5. SSE — REAL-TIME ACTIVITY STREAM ──────────────────────────────────────
//
// The Overview component connects here on mount.  When payment events are
// broadcast (ORDER_CONFIRMED, PAYMENT_CONFIRMED, CREDIT_SETTLED, etc.) the
// frontend immediately calls fetchSummary() instead of waiting for the 10-second
// poll — giving true real-time increments on the stat cards.
//
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Immediately confirm connection to the client
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Live feed connected' })}\n\n`);

  registerSSEClient(res);

  // Keep-alive heartbeat (proxies close idle connections after ~30 s)
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); }
    catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSSEClient(res);
  });
});

// ─── 6. WEEKLY REVENUE — for RevenueChart ────────────────────────────────────
//
// Last 7 Kampala days.  Returns gross (confirmed sales excluding credit method),
// credit_settled (settled credits that day — counted as revenue when paid),
// petty (OUT expenses), and profit = gross + credit_settled - petty.
//
router.get('/weekly-revenue', async (req, res) => {
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
    console.error('Weekly Revenue Error:', err.message);
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
    console.error('Overview Shifts Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 8. PETTY CASH — GET today's entries ─────────────────────────────────────
router.get('/petty-cash', async (req, res) => {
  const today = kampalaDate();
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
    console.error('Petty Cash GET Error:', err.message);
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
    console.error('Petty Cash POST Error:', err.message);
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
    console.error('Petty Cash DELETE Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 11. DIRECTOR DAILY SUMMARY (combined endpoint) ──────────────────────────
//
// One-shot endpoint that returns both the daily payment breakdown AND the
// monthly credit aggregates.  Useful if the director dashboard needs a single
// fetch on load rather than two parallel requests.
//
router.get('/director/daily-summary', async (req, res) => {
  const today = kampalaDate();
  try {
    // Daily totals
    const dailyRes = await pool.query(
      `SELECT
         COALESCE(total_gross,  0) AS total_gross,
         COALESCE(total_cash,   0) AS total_cash,
         COALESCE(total_card,   0) AS total_card,
         COALESCE(total_mtn,    0) AS total_mtn,
         COALESCE(total_airtel, 0) AS total_airtel,
         COALESCE(order_count,  0) AS order_count
       FROM daily_summary
       WHERE date = $1`,
      [today]
    );

    // Credit settlements today
    const settleRes = await pool.query(
      `SELECT COALESCE(SUM(cs.amount_paid), 0) AS total_settled
       FROM credit_settlements cs
       WHERE (cs.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1`,
      [today]
    );

    // Monthly credits with settlement totals
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
        gross:                    Number(dailyRes.rows[0]?.total_gross  || 0),
        cash:                     Number(dailyRes.rows[0]?.total_cash   || 0),
        card:                     Number(dailyRes.rows[0]?.total_card   || 0),
        mtn:                      Number(dailyRes.rows[0]?.total_mtn    || 0),
        airtel:                   Number(dailyRes.rows[0]?.total_airtel || 0),
        orders:                   Number(dailyRes.rows[0]?.order_count  || 0),
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
    console.error('Director Daily Summary Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;