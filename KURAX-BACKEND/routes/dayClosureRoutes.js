// routes/dayClosureRoutes.js
import express from 'express';
import pool from '../db.js';
import logActivity from '../utils/logsActivity.js';

const router = express.Router();

// ── Kampala date helper ───────────────────────────────────────────────────────
function kampalaDate() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLOSE DAY - Archive all data and reset for fresh start
// ─────────────────────────────────────────────────────────────────────────────
router.post('/close-day', async (req, res) => {
  const { closed_by, final_cash, final_card, final_mtn, final_airtel, final_gross, notes } = req.body;
  const closingDate = kampalaDate();
  const actor = closed_by || 'System';

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // ── 1. Archive daily summary to day_closings table ──────────────────────
    const archiveResult = await client.query(`
      INSERT INTO day_closings (
        closing_date, recorded_by, gross, cash, mtn, airtel, card, credit, order_count, 
        final_cash, final_card, final_mtn, final_airtel, final_gross, notes, closed_at
      )
      SELECT 
        $1, $2,
        COALESCE(total_gross, 0), COALESCE(total_cash, 0), 
        COALESCE(total_mtn, 0), COALESCE(total_airtel, 0), 
        COALESCE(total_card, 0), COALESCE(total_credit, 0), COALESCE(order_count, 0),
        $3, $4, $5, $6, $7, $8, NOW()
      FROM daily_summary
      WHERE summary_date = $1
      ON CONFLICT (closing_date) DO UPDATE SET
        recorded_by = EXCLUDED.recorded_by,
        gross = EXCLUDED.gross,
        cash = EXCLUDED.cash,
        mtn = EXCLUDED.mtn,
        airtel = EXCLUDED.airtel,
        card = EXCLUDED.card,
        credit = EXCLUDED.credit,
        order_count = EXCLUDED.order_count,
        final_cash = EXCLUDED.final_cash,
        final_card = EXCLUDED.final_card,
        final_mtn = EXCLUDED.final_mtn,
        final_airtel = EXCLUDED.final_airtel,
        final_gross = EXCLUDED.final_gross,
        notes = EXCLUDED.notes,
        closed_at = NOW()
    `, [closingDate, actor, final_cash || 0, final_card || 0, final_mtn || 0, final_airtel || 0, final_gross || 0, notes || '']);

    // ── 2. Reset daily_summary for new day ──────────────────────────────────
    await client.query(`
      INSERT INTO daily_summary (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel, total_credit, total_mixed, order_count, day_closed, closed_by, closed_at, created_at, updated_at)
      VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, true, $2, NOW(), NOW(), NOW())
      ON CONFLICT (summary_date) DO UPDATE SET
        total_gross = 0,
        total_cash = 0,
        total_card = 0,
        total_mtn = 0,
        total_airtel = 0,
        total_credit = 0,
        total_mixed = 0,
        order_count = 0,
        day_closed = true,
        closed_by = $2,
        closed_at = NOW(),
        updated_at = NOW()
    `, [closingDate, actor]);

    // ── 3. Mark all orders as day_cleared (archived) ────────────────────────
    const ordersResult = await client.query(`
      UPDATE orders
      SET day_cleared = true,
          shift_cleared = true,
          updated_at = NOW()
      WHERE day_cleared = false
        AND DATE(timestamp AT TIME ZONE 'Africa/Nairobi') <= $1
      RETURNING id
    `, [closingDate]);
    
    const clearedOrdersCount = ordersResult.rowCount;

    // ── 4. Clear all kitchen tickets (mark as cleared) ───────────────────────
    const ticketsResult = await client.query(`
      UPDATE kitchen_tickets
      SET cleared_by_kitchen = true,
          cleared_by = $1,
          cleared_at = NOW(),
          updated_at = NOW()
      WHERE cleared_by_kitchen = false
        AND ticket_date <= $2
      RETURNING id
    `, [actor, closingDate]);
    
    const clearedTicketsCount = ticketsResult.rowCount;

    // ── 5. Clear all pending cashier queue items ─────────────────────────────
    await client.query(`
      UPDATE cashier_queue
      SET shift_cleared = true,
          updated_at = NOW()
      WHERE shift_cleared = false
        AND DATE(created_at AT TIME ZONE 'Africa/Nairobi') <= $1
    `, [closingDate]);

    // ── 6. Mark all pending void requests as expired ─────────────────────────
    await client.query(`
      UPDATE void_requests
      SET status = 'Expired',
          resolved_by = $1,
          resolved_at = NOW()
      WHERE status = 'Pending'
        AND DATE(created_at AT TIME ZONE 'Africa/Nairobi') <= $2
    `, [actor, closingDate]);

    // ── 7. Clear all active table statuses ───────────────────────────────────
    await client.query(`
      UPDATE tables
      SET status = 'Available',
          last_order_id = NULL,
          updated_at = NOW()
      WHERE status = 'Occupied'
    `);

    // ── 8. Log the day closure activity ─────────────────────────────────────
    await logActivity(pool, {
      type: 'DAY_CLOSED',
      actor: actor,
      role: 'ACCOUNTANT',
      message: `Day closed for ${closingDate}. Orders archived: ${clearedOrdersCount}, Tickets cleared: ${clearedTicketsCount}`,
      meta: {
        closing_date: closingDate,
        cleared_orders: clearedOrdersCount,
        cleared_tickets: clearedTicketsCount,
        final_cash: final_cash || 0,
        final_card: final_card || 0,
        final_mtn: final_mtn || 0,
        final_airtel: final_airtel || 0,
        final_gross: final_gross || 0
      }
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Day closed successfully for ${closingDate}`,
      closing_date: closingDate,
      cleared_orders: clearedOrdersCount,
      cleared_tickets: clearedTicketsCount,
      archived_summary: archiveResult.rows[0] || null
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Day closure error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET DAY CLOSING HISTORY - View archived days
// ─────────────────────────────────────────────────────────────────────────────
router.get('/closing-history', async (req, res) => {
  const { limit = 90, from, to } = req.query;
  
  try {
    let query = `
      SELECT 
        id, closing_date, recorded_by,
        gross, cash, mtn, airtel, card, credit, order_count,
        final_cash, final_card, final_mtn, final_airtel, final_gross,
        notes, closed_at
      FROM day_closings
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (from) {
      query += ` AND closing_date >= $${paramIndex}`;
      params.push(from);
      paramIndex++;
    }
    
    if (to) {
      query += ` AND closing_date <= $${paramIndex}`;
      params.push(to);
      paramIndex++;
    }
    
    query += ` ORDER BY closing_date DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Closing history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET DAY STATUS - Check if day is already closed
// ─────────────────────────────────────────────────────────────────────────────
router.get('/day-status', async (req, res) => {
  const date = req.query.date || kampalaDate();
  
  try {
    const result = await pool.query(`
      SELECT 
        day_closed, closed_by, closed_at,
        total_gross, total_cash, total_card, total_mtn, total_airtel, order_count
      FROM daily_summary
      WHERE summary_date = $1
    `, [date]);
    
    if (result.rows.length === 0) {
      res.json({ 
        date, 
        is_closed: false, 
        has_data: false,
        message: "No data for this date"
      });
    } else {
      res.json({
        date,
        is_closed: result.rows[0].day_closed,
        closed_by: result.rows[0].closed_by,
        closed_at: result.rows[0].closed_at,
        totals: {
          gross: result.rows[0].total_gross,
          cash: result.rows[0].total_cash,
          card: result.rows[0].total_card,
          mtn: result.rows[0].total_mtn,
          airtel: result.rows[0].total_airtel,
          orders: result.rows[0].order_count
        },
        has_data: true
      });
    }
  } catch (err) {
    console.error('Day status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET CURRENT DAY TOTALS (Before closing)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/current-day-totals', async (req, res) => {
  const today = kampalaDate();
  
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN method = 'Card' THEN amount ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN method = 'Momo-MTN' THEN amount ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN method = 'Momo-Airtel' THEN amount ELSE 0 END), 0) AS total_airtel,
        COALESCE(SUM(CASE WHEN method != 'Credit' THEN amount ELSE 0 END), 0) AS total_gross,
        COUNT(*) AS order_count
      FROM cashier_queue
      WHERE status = 'Confirmed'
        AND DATE(confirmed_at AT TIME ZONE 'Africa/Nairobi') = $1
        AND shift_cleared = false
    `, [today]);
    
    const pettyResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS total_in
      FROM petty_cash
      WHERE entry_date = $1
    `, [today]);
    
    res.json({
      date: today,
      sales: result.rows[0],
      petty: {
        total_out: Number(pettyResult.rows[0].total_out),
        total_in: Number(pettyResult.rows[0].total_in),
        net: Number(pettyResult.rows[0].total_in) - Number(pettyResult.rows[0].total_out)
      },
      cash_on_counter: Number(result.rows[0].total_cash) - Number(pettyResult.rows[0].total_in)
    });
  } catch (err) {
    console.error('Current day totals error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. REOPEN DAY (Admin only - for corrections)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reopen-day', async (req, res) => {
  const { date, reopened_by, reason } = req.body;
  const actor = reopened_by || 'Admin';
  
  if (!date) {
    return res.status(400).json({ error: 'Date is required' });
  }
  
  try {
    const result = await pool.query(`
      UPDATE daily_summary
      SET day_closed = false,
          closed_by = NULL,
          closed_at = NULL,
          updated_at = NOW()
      WHERE summary_date = $1
        AND day_closed = true
      RETURNING *
    `, [date]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No closed day found for this date' });
    }
    
    await logActivity(pool, {
      type: 'DAY_REOPENED',
      actor: actor,
      role: 'ADMIN',
      message: `Day reopened for ${date} by ${actor}. Reason: ${reason || 'Correction needed'}`,
      meta: { date, reason }
    });
    
    res.json({
      success: true,
      message: `Day ${date} has been reopened`,
      summary: result.rows[0]
    });
  } catch (err) {
    console.error('Reopen day error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;