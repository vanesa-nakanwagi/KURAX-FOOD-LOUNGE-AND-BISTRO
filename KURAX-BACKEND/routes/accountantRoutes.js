/**
 * accountantRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in server.js:
 *   import accountantRoutes from './routes/accountantRoutes.js';
 *   app.use('/api/accountant', accountantRoutes);
 */

import express from 'express';
import pool    from '../db.js';
import logActivity from '../utils/logsActivity.js';

const router = express.Router();

// ── Kampala / EAT date helper (UTC+3) ────────────────────────────────────────
function kampalaDate(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }))
    .toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  GET /api/accountant/physical-count
//     Returns today's physical count entry (or zeros if none recorded yet).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/physical-count', async (req, res) => {
  const date = req.query.date || kampalaDate();
  try {
    const result = await pool.query(
      `SELECT * FROM physical_counts WHERE count_date = $1 ORDER BY created_at DESC LIMIT 1`,
      [date]
    );
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json({ cash: 0, momo_mtn: 0, momo_airtel: 0, card: 0, notes: '' });
    }
  } catch (err) {
    console.error('Physical count GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.  POST /api/accountant/physical-count
//     Upserts the physical count for today.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/physical-count', async (req, res) => {
  const { cash, momo_mtn, momo_airtel, card, notes, submitted_by } = req.body;
  const date = kampalaDate();
  try {
    const result = await pool.query(
      `INSERT INTO physical_counts (count_date, cash, momo_mtn, momo_airtel, card, notes, submitted_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (count_date) DO UPDATE
         SET cash        = EXCLUDED.cash,
             momo_mtn    = EXCLUDED.momo_mtn,
             momo_airtel = EXCLUDED.momo_airtel,
             card        = EXCLUDED.card,
             notes       = EXCLUDED.notes,
             submitted_by= EXCLUDED.submitted_by,
             updated_at  = NOW()
       RETURNING *`,
      [date, cash || 0, momo_mtn || 0, momo_airtel || 0, card || 0, notes || '', submitted_by || 'Accountant']
    );

    await logActivity(pool, {
      type:    'PHYSICAL_COUNT',
      actor:   submitted_by || 'Accountant',
      role:    'ACCOUNTANT',
      message: `Physical count saved for ${date}`,
      meta:    { cash, momo_mtn, momo_airtel, card },
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Physical count POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.  POST /api/accountant/finalize-day
//
//     THE MAIN "CLOSE DAY" ENDPOINT
//     ─────────────────────────────
//     Called by the accountant's "Close Accounts & Reset Dashboard" button.
//
//     What it does (all in one DB transaction):
//       a. Snapshot today's daily_summary into day_closings for audit trail
//       b. Mark all today's orders as day_cleared = true
//          → waiters/supervisors/managers stop seeing them in Live / Served / Voided
//       c. Clear kitchen_tickets for today (cleared_by_kitchen = true)
//          → kitchen, barista, barman boards go blank
//       d. Zero-out / archive today's daily_summary row
//          → gross / cash / mtn / airtel / card totals reset to 0
//       e. Mark all pending void_requests as expired
//          → Live Audit queue empties
//       f. Log the close-day event
//
//     What it does NOT delete:
//       - The order rows themselves (preserved for reporting)
//       - staff_shifts (archived per-waiter records)
//       - chef_assignments (historical)
//       - Credits ledger (carries forward)
//
//     Response: { success: true, cleared_orders, cleared_tickets, date }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/finalize-day', async (req, res) => {
  const { final_gross, recorded_by } = req.body;
  const date = kampalaDate();
  const actor = recorded_by || 'Accountant';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── a. Snapshot daily_summary → day_closings ─────────────────────────────
    // Ensures we have a permanent audit record even after the summary is zeroed.
    // day_closings table DDL is at the bottom of this file.
    await client.query(
      `INSERT INTO day_closings
         (closing_date, recorded_by, gross, cash, mtn, airtel, card, credit, order_count, closed_at)
       SELECT
         $1, $2,
         COALESCE(total_gross,  0),
         COALESCE(total_cash,   0),
         COALESCE(total_mtn,    0),
         COALESCE(total_airtel, 0),
         COALESCE(total_card,   0),
         COALESCE(total_credit, 0),
         COALESCE(order_count,  0),
         NOW()
       FROM daily_summary
       WHERE summary_date = $1
       ON CONFLICT (closing_date) DO UPDATE
         SET recorded_by  = EXCLUDED.recorded_by,
             gross        = EXCLUDED.gross,
             cash         = EXCLUDED.cash,
             mtn          = EXCLUDED.mtn,
             airtel       = EXCLUDED.airtel,
             card         = EXCLUDED.card,
             credit       = EXCLUDED.credit,
             order_count  = EXCLUDED.order_count,
             closed_at    = NOW()`,
      [date, actor]
    );

    // ── b. Mark all today's orders as day_cleared ─────────────────────────────
    // Waiter / supervisor / manager dashboards filter out day_cleared orders,
    // so their Live, Served, Voided, and All Floor views all go blank.
    // We also set shift_cleared = true for consistency with the existing
    // per-waiter end-shift logic (some queries filter on that too).
    const ordersResult = await client.query(
      `UPDATE orders
       SET day_cleared    = true,
           shift_cleared  = true,
           updated_at     = NOW()
       WHERE DATE(timestamp AT TIME ZONE 'Africa/Nairobi') = $1
         AND day_cleared IS NOT TRUE
       RETURNING id`,
      [date]
    );
    const clearedOrders = ordersResult.rowCount;

    // ── c. Clear kitchen / barista / barman tickets ───────────────────────────
    // Sets cleared_by_kitchen = true on ALL stations (kitchen, barista, barman).
    // Each station's board already filters on cleared_by_kitchen = false,
    // so every board goes blank immediately on next poll.
    const ticketsResult = await client.query(
      `UPDATE kitchen_tickets
       SET cleared_by_kitchen = true,
           cleared_by         = $1,
           cleared_at         = NOW(),
           updated_at         = NOW()
       WHERE ticket_date       = $2
         AND cleared_by_kitchen = false
       RETURNING id`,
      [actor, date]
    );
    const clearedTickets = ticketsResult.rowCount;

    // ── d. Zero out today's daily_summary ─────────────────────────────────────
    // This resets the gross / cash / breakdown tiles on every dashboard
    // that reads from todaySummary (DataContext → /api/daily-summary/today).
    await client.query(
      `UPDATE daily_summary
       SET total_gross   = 0,
           total_cash    = 0,
           total_mtn     = 0,
           total_airtel  = 0,
           total_card    = 0,
           total_credit  = 0,
           total_mixed   = 0,
           order_count   = 0,
           day_closed    = true,
           closed_by     = $1,
           closed_at     = NOW()
       WHERE summary_date = $2`,
      [actor, date]
    );

    // If no row existed yet for today, insert a zeroed + closed one
    await client.query(
      `INSERT INTO daily_summary
         (summary_date, total_gross, total_cash, total_mtn, total_airtel,
          total_card, total_credit, total_mixed, order_count, day_closed, closed_by, closed_at)
       VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, true, $2, NOW())
       ON CONFLICT (summary_date) DO NOTHING`,
      [date, actor]
    );

    // ── e. Expire pending void requests ──────────────────────────────────────
    // Clears the accountant's Live Audit queue.
    // Pending void requests from today that were never actioned are marked
    // "Expired" so they don't carry over into tomorrow.
    await client.query(
      `UPDATE void_requests
       SET status      = 'Expired',
           resolved_by = $1,
           resolved_at = NOW()
       WHERE status    = 'Pending'
         AND DATE(created_at AT TIME ZONE 'Africa/Nairobi') = $2`,
      [actor, date]
    );

    // ── f. Log the close-day event ────────────────────────────────────────────
    await logActivity(pool, {
      type:    'DAY_CLOSED',
      actor,
      role:    'ACCOUNTANT',
      message: `Day closed by ${actor}. ${clearedOrders} orders archived, ${clearedTickets} tickets cleared.`,
      meta:    { date, final_gross, cleared_orders: clearedOrders, cleared_tickets: clearedTickets },
    });

    await client.query('COMMIT');

    res.json({
      success:         true,
      date,
      cleared_orders:  clearedOrders,
      cleared_tickets: clearedTickets,
      message:         `Day closed successfully. ${clearedOrders} orders and ${clearedTickets} kitchen tickets cleared.`,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Finalize day error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4.  GET /api/accountant/day-closings
//     Returns the audit trail of all past day-closings.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/day-closings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM day_closings ORDER BY closing_date DESC LIMIT 90`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Day closings GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

/*
═══════════════════════════════════════════════════════════════════════════════
  REQUIRED DATABASE MIGRATIONS
  Run these once in your PostgreSQL database.
═══════════════════════════════════════════════════════════════════════════════

-- 1. Add day_cleared column to orders
--    (shift_cleared already exists from waiter end-shift; day_cleared is the
--     accountant-level flag that clears ALL staff's orders at once)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS day_cleared  BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

-- 2. Add day_closed columns to daily_summary
ALTER TABLE daily_summary
  ADD COLUMN IF NOT EXISTS day_closed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_by  TEXT,
  ADD COLUMN IF NOT EXISTS closed_at  TIMESTAMPTZ;

-- 3. Create day_closings audit table
CREATE TABLE IF NOT EXISTS day_closings (
  id           SERIAL PRIMARY KEY,
  closing_date DATE        NOT NULL UNIQUE,
  recorded_by  TEXT        NOT NULL,
  gross        NUMERIC     DEFAULT 0,
  cash         NUMERIC     DEFAULT 0,
  mtn          NUMERIC     DEFAULT 0,
  airtel       NUMERIC     DEFAULT 0,
  card         NUMERIC     DEFAULT 0,
  credit       NUMERIC     DEFAULT 0,
  order_count  INTEGER     DEFAULT 0,
  closed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create physical_counts table (if not already there)
CREATE TABLE IF NOT EXISTS physical_counts (
  id           SERIAL PRIMARY KEY,
  count_date   DATE        NOT NULL UNIQUE,
  cash         NUMERIC     DEFAULT 0,
  momo_mtn     NUMERIC     DEFAULT 0,
  momo_airtel  NUMERIC     DEFAULT 0,
  card         NUMERIC     DEFAULT 0,
  notes        TEXT,
  submitted_by TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ
);

-- 5. Index for fast day_cleared filtering on orders
CREATE INDEX IF NOT EXISTS idx_orders_day_cleared ON orders (day_cleared);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp_tz
  ON orders (DATE(timestamp AT TIME ZONE 'Africa/Nairobi'));

═══════════════════════════════════════════════════════════════════════════════
  FRONTEND FILTER CHANGE REQUIRED
  In every component that filters today's orders, add day_cleared check:

  BEFORE:
    const cleared = o.shift_cleared === true || o.shift_cleared === "t" ...

  AFTER:
    const cleared = o.shift_cleared === true || o.shift_cleared === "t"
                 || o.day_cleared   === true || o.day_cleared   === "t";

  Components to update:
    - OrderHistory.jsx          (waiter)
    - ManagerOrderHistory.jsx   (supervisor)
    - LiveTableGrid.jsx         (all floor)
    - LiveOrderStatus.jsx       (operations monitor)
═══════════════════════════════════════════════════════════════════════════════
*/