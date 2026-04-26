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

    await client.query(`
      UPDATE cashier_queue
      SET shift_cleared = true,
          updated_at = NOW()
      WHERE shift_cleared = false
        AND DATE(created_at AT TIME ZONE 'Africa/Nairobi') <= $1
    `, [closingDate]);

    await client.query(`
      UPDATE void_requests
      SET status = 'Expired',
          resolved_by = $1,
          resolved_at = NOW()
      WHERE status = 'Pending'
        AND DATE(created_at AT TIME ZONE 'Africa/Nairobi') <= $2
    `, [actor, closingDate]);

    await client.query(`
      UPDATE tables
      SET status = 'Available',
          last_order_id = NULL,
          updated_at = NOW()
      WHERE status = 'Occupied'
    `);

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
// 2. GET DAY CLOSING HISTORY
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
// 3. GET DAY STATUS
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
        is_closed: result.rows[0].day_closed || false,
        closed_by: result.rows[0].closed_by,
        closed_at: result.rows[0].closed_at,
        totals: {
          gross: result.rows[0].total_gross || 0,
          cash: result.rows[0].total_cash || 0,
          card: result.rows[0].total_card || 0,
          mtn: result.rows[0].total_mtn || 0,
          airtel: result.rows[0].total_airtel || 0,
          orders: result.rows[0].order_count || 0
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
// 4. GET CURRENT DAY TOTALS
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
// 5. REOPEN DAY - Restore a previously closed day
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reopen-day', async (req, res) => {
  const { date, reopened_by, reason } = req.body;
  const actor = reopened_by || 'Accountant';
  const targetDate = date || kampalaDate();
  
  try {
    const closingCheck = await pool.query(
      `SELECT * FROM day_closings WHERE closing_date = $1`,
      [targetDate]
    );
    
    if (closingCheck.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No closing record found for this date. The day may not have been closed.',
        hint: 'Only previously closed days can be reopened.'
      });
    }
    
    const closedDay = closingCheck.rows[0];
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      await client.query(`
        INSERT INTO daily_summary (summary_date, total_gross, total_cash, total_card, total_mtn, total_airtel, total_credit, order_count, day_closed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, NOW(), NOW())
        ON CONFLICT (summary_date) DO UPDATE SET
          total_gross = EXCLUDED.total_gross,
          total_cash = EXCLUDED.total_cash,
          total_card = EXCLUDED.total_card,
          total_mtn = EXCLUDED.total_mtn,
          total_airtel = EXCLUDED.total_airtel,
          total_credit = EXCLUDED.total_credit,
          order_count = EXCLUDED.order_count,
          day_closed = false,
          closed_by = NULL,
          closed_at = NULL,
          updated_at = NOW()
      `, [
        targetDate,
        closedDay.gross,
        closedDay.cash,
        closedDay.card,
        closedDay.mtn,
        closedDay.airtel,
        closedDay.credit || 0,
        closedDay.order_count
      ]);
      
      await client.query(`
        UPDATE orders
        SET day_cleared = false,
            updated_at = NOW()
        WHERE DATE(timestamp AT TIME ZONE 'Africa/Nairobi') = $1
          AND day_cleared = true
      `, [targetDate]);
      
      await client.query(`
        UPDATE kitchen_tickets
        SET cleared_by_kitchen = false,
            cleared_by = NULL,
            cleared_at = NULL,
            updated_at = NOW()
        WHERE ticket_date = $1
          AND cleared_by_kitchen = true
      `, [targetDate]);
      
      await client.query(`
        UPDATE cashier_queue
        SET shift_cleared = false,
            updated_at = NOW()
        WHERE DATE(created_at AT TIME ZONE 'Africa/Nairobi') = $1
          AND shift_cleared = true
      `, [targetDate]);
      
      await logActivity(pool, {
        type: 'DAY_REOPENED',
        actor: actor,
        role: 'ACCOUNTANT',
        message: `Day reopened for ${targetDate} by ${actor}. Reason: ${reason || 'Correction needed'}`,
        meta: { date: targetDate, reason, restored_from: closedDay }
      });
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `Day ${targetDate} has been successfully reopened. Staff can now resume work.`,
        date: targetDate,
        reopened_by: actor,
        restored_totals: {
          gross: closedDay.gross,
          cash: closedDay.cash,
          card: closedDay.card,
          mtn: closedDay.mtn,
          airtel: closedDay.airtel,
          order_count: closedDay.order_count
        }
      });
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('Reopen day error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET CLOSED DAYS LIST
// ─────────────────────────────────────────────────────────────────────────────
router.get('/closed-days', async (req, res) => {
  const { limit = 30 } = req.query;
  
  try {
    const result = await pool.query(`
      SELECT 
        closing_date,
        recorded_by,
        gross,
        cash,
        card,
        mtn,
        airtel,
        order_count,
        closed_at
      FROM day_closings
      ORDER BY closing_date DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      closed_days: result.rows,
      count: result.rows.length,
      message: result.rows.length === 0 ? 'No closed days found' : null
    });
  } catch (err) {
    console.error('Get closed days error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. START BRAND NEW DAY
// ─────────────────────────────────────────────────────────────────────────────
router.post('/start-new-day', async (req, res) => {
  const { date, started_by, notes } = req.body;
  const targetDate = date || kampalaDate();
  const actor = started_by || 'Accountant';
  
  try {
    const existingSummary = await pool.query(
      `SELECT * FROM daily_summary WHERE summary_date = $1`,
      [targetDate]
    );
    
    const existingClosure = await pool.query(
      `SELECT * FROM day_closings WHERE closing_date = $1`,
      [targetDate]
    );
    
    if (existingSummary.rows.length > 0 && !existingSummary.rows[0].day_closed) {
      return res.status(400).json({ 
        error: `Day ${targetDate} is already open and active.`,
        hint: 'If you want to reset this day, please close it first, then start a new one.'
      });
    }
    
    if (existingClosure.rows.length > 0) {
      return res.status(400).json({ 
        error: `Day ${targetDate} has already been closed and archived.`,
        hint: 'Use "Reopen Day" to restore it, or choose a different date for a new day.'
      });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      await client.query(`
        INSERT INTO daily_summary (
          summary_date, total_gross, total_cash, total_card, 
          total_mtn, total_airtel, total_credit, total_mixed, 
          order_count, day_closed, created_at, updated_at
        ) VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, false, NOW(), NOW())
        ON CONFLICT (summary_date) DO UPDATE SET
          total_gross = 0,
          total_cash = 0,
          total_card = 0,
          total_mtn = 0,
          total_airtel = 0,
          total_credit = 0,
          total_mixed = 0,
          order_count = 0,
          day_closed = false,
          closed_by = NULL,
          closed_at = NULL,
          updated_at = NOW()
      `, [targetDate]);
      
      await client.query(`
        UPDATE orders
        SET day_cleared = false,
            updated_at = NOW()
        WHERE DATE(timestamp AT TIME ZONE 'Africa/Nairobi') = $1
      `, [targetDate]);
      
      await client.query(`
        UPDATE kitchen_tickets
        SET cleared_by_kitchen = false,
            cleared_by = NULL,
            cleared_at = NULL,
            updated_at = NOW()
        WHERE ticket_date = $1
      `, [targetDate]);
      
      await logActivity(pool, {
        type: 'NEW_DAY_STARTED',
        actor: actor,
        role: 'ACCOUNTANT',
        message: `Brand new day started for ${targetDate} by ${actor}. All totals initialized to zero.`,
        meta: { date: targetDate, notes }
      });
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `Brand new day ${targetDate} has been started. All totals are zero.`,
        date: targetDate,
        started_by: actor,
        is_new_day: true
      });
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('Start new day error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. 24-HOUR AUTO-RESET CHECK
// ─────────────────────────────────────────────────────────────────────────────
router.post('/auto-reset', async (req, res) => {
  const today = kampalaDate();
  
  try {
    const todaySummary = await pool.query(
      `SELECT * FROM daily_summary WHERE summary_date = $1`,
      [today]
    );
    
    if (todaySummary.rows.length === 0) {
      await pool.query(`
        INSERT INTO daily_summary (
          summary_date, total_gross, total_cash, total_card, 
          total_mtn, total_airtel, total_credit, total_mixed, 
          order_count, day_closed, created_at, updated_at
        ) VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, false, NOW(), NOW())
      `, [today]);
      
      res.json({
        success: true,
        message: `Auto-reset: New day ${today} initialized`,
        date: today,
        is_new_day: true
      });
    } else {
      res.json({
        success: true,
        message: `Day ${today} already exists`,
        date: today,
        is_new_day: false
      });
    }
  } catch (err) {
    console.error('Auto-reset error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;