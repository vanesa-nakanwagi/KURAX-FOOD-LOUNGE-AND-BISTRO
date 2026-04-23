

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
//     THE MAIN "CLOSE DAY" ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────
router.post('/finalize-day', async (req, res) => {
  const { final_gross, recorded_by } = req.body;
  const date = kampalaDate();
  const actor = recorded_by || 'Accountant';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── a. Snapshot daily_summary → day_closings ─────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 5.  GET /api/accountant/petty-cash
//     Returns petty cash summary with IN and OUT totals for a specific date
// ─────────────────────────────────────────────────────────────────────────────
router.get('/petty-cash', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || kampalaDate();

    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS total_in,
        COUNT(CASE WHEN direction = 'OUT' THEN 1 END) AS out_count,
        COUNT(CASE WHEN direction = 'IN' THEN 1 END) AS in_count
      FROM petty_cash 
      WHERE DATE(created_at AT TIME ZONE 'Africa/Nairobi') = $1
    `;
    
    const result = await pool.query(query, [targetDate]);
    const row = result.rows[0];
    
    res.json({
      total_out: parseFloat(row.total_out) || 0,
      total_in: parseFloat(row.total_in) || 0,
      out_count: parseInt(row.out_count) || 0,
      in_count: parseInt(row.in_count) || 0,
      net: (parseFloat(row.total_in) || 0) - (parseFloat(row.total_out) || 0),
      date: targetDate
    });
  } catch (err) {
    console.error('Petty cash fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.  GET /api/accountant/petty-cash/range
//     Returns petty cash summary with entries for a date range
// ─────────────────────────────────────────────────────────────────────────────
router.get('/petty-cash/range', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required' });
    }

    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS total_in,
        COUNT(CASE WHEN direction = 'OUT' THEN 1 END) AS out_count,
        COUNT(CASE WHEN direction = 'IN' THEN 1 END) AS in_count,
        COALESCE(
          json_agg(
            json_build_object(
              'id', id,
              'amount', amount,
              'direction', direction,
              'category', category,
              'description', description,
              'logged_by', logged_by,
              'created_at', created_at
            ) ORDER BY created_at DESC
          ) FILTER (WHERE id IS NOT NULL),
          '[]'::json
        ) AS entries
      FROM petty_cash 
      WHERE DATE(created_at AT TIME ZONE 'Africa/Nairobi') BETWEEN $1 AND $2
    `;
    
    const result = await pool.query(query, [from, to]);
    const row = result.rows[0];
    
    res.json({
      total_out: parseFloat(row.total_out) || 0,
      total_in: parseFloat(row.total_in) || 0,
      out_count: parseInt(row.out_count) || 0,
      in_count: parseInt(row.in_count) || 0,
      net: (parseFloat(row.total_in) || 0) - (parseFloat(row.total_out) || 0),
      entries: row.entries || []
    });
  } catch (err) {
    console.error('Petty cash range error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7.  POST /api/accountant/petty-cash
//     Create new petty cash entry
// ─────────────────────────────────────────────────────────────────────────────
router.post('/petty-cash', async (req, res) => {
  const { amount, direction, category, description, logged_by } = req.body;
  
  if (!amount || !direction || !description) {
    return res.status(400).json({ error: 'amount, direction, and description are required' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO petty_cash 
         (amount, direction, category, description, logged_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [amount, direction, category || 'General', description, logged_by || 'Cashier']
    );
    
    await logActivity(pool, {
      type: 'PETTY_CASH_ENTRY',
      actor: logged_by || 'Cashier',
      role: 'CASHIER',
      message: `${direction === 'OUT' ? 'Expense' : 'Replenishment'} of UGX ${Number(amount).toLocaleString()} - ${description}`,
      meta: { amount, direction, category, description }
    });
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Petty cash create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8.  PUT /api/accountant/petty-cash/:id
//     Update petty cash entry
// ─────────────────────────────────────────────────────────────────────────────
router.put('/petty-cash/:id', async (req, res) => {
  const { id } = req.params;
  const { amount, direction, category, description, logged_by } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE petty_cash 
       SET amount = $1, direction = $2, category = $3, description = $4, 
           logged_by = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [amount, direction, category, description, logged_by, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    await logActivity(pool, {
      type: 'PETTY_CASH_UPDATED',
      actor: logged_by || 'Cashier',
      role: 'CASHIER',
      message: `Updated petty cash entry: ${direction === 'OUT' ? 'Expense' : 'Replenishment'} of UGX ${Number(amount).toLocaleString()} - ${description}`,
      meta: { id, amount, direction, category, description }
    });
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Petty cash update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9.  DELETE /api/accountant/petty-cash/:id
//     Delete petty cash entry
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/petty-cash/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // First get the entry to log what was deleted
    const entryResult = await pool.query(
      `SELECT * FROM petty_cash WHERE id = $1`,
      [id]
    );
    
    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    const entry = entryResult.rows[0];
    
    const result = await pool.query(
      `DELETE FROM petty_cash WHERE id = $1 RETURNING *`,
      [id]
    );
    
    await logActivity(pool, {
      type: 'PETTY_CASH_DELETED',
      actor: 'Accountant',
      role: 'ACCOUNTANT',
      message: `Deleted petty cash entry: ${entry.direction === 'OUT' ? 'Expense' : 'Replenishment'} of UGX ${Number(entry.amount).toLocaleString()} - ${entry.description}`,
      meta: { id, amount: entry.amount, direction: entry.direction, category: entry.category }
    });
    
    res.json({ message: 'Entry deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Petty cash delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

