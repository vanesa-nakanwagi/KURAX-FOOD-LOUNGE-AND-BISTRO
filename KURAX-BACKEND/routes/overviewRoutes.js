import express from 'express';
import pool from '../db.js';
// Only import the SSE registry functions here
import { registerSSEClient, removeSSEClient } from '../utils/logsActivity.js';

const router = express.Router();

function kampalaDate() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

// ─── 1. GET SUMMARY ───────────────────────────────────────────────────────────
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

// ─── 2. GET ACTIVITY LOGS (initial page load — last 30 events) ───────────────
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

// ─── 3. SSE — REAL-TIME ACTIVITY STREAM ──────────────────────────────────────
router.get('/stream', (req, res) => {
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
    clearInterval(heartbeat);
    removeSSEClient(res);
  });
});

// ─── 4. GET WEEKLY REVENUE — for RevenueChart ────────────────────────────────
// Returns last 7 days with gross (confirmed sales), petty (OUT expenses),
// profit = gross - petty, plus cash/card/momo breakdown.
router.get('/weekly-revenue', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH day_series AS (
        SELECT
          (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')::date - n AS day
        FROM generate_series(0, 6) AS gs(n)
      ),
      -- Confirmed sales from cashier_queue
      sales AS (
        SELECT
          (confirmed_at AT TIME ZONE 'Africa/Nairobi')::date AS day,
          COALESCE(SUM(amount), 0) AS gross,
          COALESCE(SUM(CASE WHEN method = 'Cash'                      THEN amount ELSE 0 END), 0) AS cash,
          COALESCE(SUM(CASE WHEN method = 'Card'                      THEN amount ELSE 0 END), 0) AS card,
          COALESCE(SUM(CASE WHEN method IN ('Momo-MTN','Momo-Airtel') THEN amount ELSE 0 END), 0) AS momo
        FROM cashier_queue
        WHERE status = 'Confirmed'
          AND confirmed_at IS NOT NULL
          AND (confirmed_at AT TIME ZONE 'Africa/Nairobi')::date
              >= (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Nairobi')::date - 6
        GROUP BY 1
      ),
      -- Petty cash OUT per day
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
        TO_CHAR(ds.day, 'Dy')                        AS date,
        COALESCE(s.gross, 0)                         AS gross,
        COALESCE(s.cash,  0)                         AS cash,
        COALESCE(s.card,  0)                         AS card,
        COALESCE(s.momo,  0)                         AS momo,
        COALESCE(e.petty, 0)                         AS petty,
        COALESCE(s.gross, 0) - COALESCE(e.petty, 0) AS profit
      FROM day_series ds
      LEFT JOIN sales    s ON s.day = ds.day
      LEFT JOIN expenses e ON e.day = ds.day
      ORDER BY ds.day ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Weekly Revenue Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 5. GET SHIFT LIQUIDATIONS ────────────────────────────────────────────────
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

export default router;