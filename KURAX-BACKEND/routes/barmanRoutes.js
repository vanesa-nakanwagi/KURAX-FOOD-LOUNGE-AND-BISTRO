/**
 * barmanRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in server.js:
 *   import barmanRoutes from './routes/barmanRoutes.js';
 *   app.use('/api/barman', barmanRoutes);
 *
 * Endpoints
 * ─────────────────────────────────────────────────────────────────────────────
 *  POST   /tickets                      upsert ticket when order enters bar
 *  GET    /tickets?date=YYYY-MM-DD      all tickets for a date (default today Kampala)
 *  GET    /tickets/summary?date=…       daily report — count, drinks, mixologist breakdown
 *  PATCH  /tickets/:id/status           Pending → Preparing → Ready
 *  PATCH  /tickets/:id/assign-barman    assign a mixologist to one drink item
 *  PATCH  /clear-shift                  archive active tickets (End Shift)
 */

import express from 'express';
import pool    from '../db.js';

const router = express.Router();

function kampalaDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }))
    .toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  POST /api/barman/tickets  — upsert
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tickets', async (req, res) => {
  const { order_id, table_name, staff_name, items = [], total = 0, status = 'Pending' } = req.body;

  if (!order_id || !table_name) {
    return res.status(400).json({ error: 'order_id and table_name are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO barman_tickets
         (order_id, table_name, staff_name, items, total, status, ticket_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (order_id) DO UPDATE SET
         items      = EXCLUDED.items,
         status     = EXCLUDED.status,
         staff_name = EXCLUDED.staff_name,
         updated_at = NOW()
       RETURNING *`,
      [order_id, table_name, staff_name || null, JSON.stringify(items), Number(total) || 0, status, kampalaDate()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Barman upsert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2a. GET /api/barman/tickets/summary  — ⚠️ registered BEFORE /:id routes
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tickets/summary', async (req, res) => {
  const date = req.query.date || kampalaDate();
  try {
    const totalsRes = await pool.query(
      `SELECT
         COUNT(*)                                                    AS ticket_count,
         COALESCE(SUM(total), 0)                                     AS total_value,
         COALESCE(SUM(jsonb_array_length(items)), 0)                 AS total_items,
         COUNT(*) FILTER (WHERE status IN ('Ready','Served','Paid')) AS completed_count,
         COUNT(*) FILTER (WHERE status = 'Preparing')                AS preparing_count,
         COUNT(*) FILTER (WHERE status = 'Pending')                  AS pending_count
       FROM barman_tickets
       WHERE ticket_date = $1`,
      [date]
    );

    const barmanRes = await pool.query(
      `SELECT
         ba.assigned_to              AS barman,
         COUNT(*)                    AS drinks_made,
         MIN(ba.assigned_at)         AS first_at,
         MAX(ba.assigned_at)         AS last_at
       FROM barman_assignments ba
       JOIN barman_tickets bt ON ba.ticket_id = bt.id
       WHERE bt.ticket_date = $1
       GROUP BY ba.assigned_to
       ORDER BY drinks_made DESC`,
      [date]
    );

    // FIXED: Removed cleared_by_barman column that doesn't exist
    const ticketsRes = await pool.query(
      `SELECT id, order_id, table_name, staff_name, items,
              total, status, ready_at, cleared_at, created_at
       FROM barman_tickets
       WHERE ticket_date = $1
       ORDER BY created_at ASC`,
      [date]
    );

    res.json({ date, totals: totalsRes.rows[0], barmen: barmanRes.rows, tickets: ticketsRes.rows });
  } catch (err) {
    console.error('Barman summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2b. GET /api/barman/tickets?date=…
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tickets', async (req, res) => {
  const date = req.query.date || kampalaDate();
  try {
    const result = await pool.query(
      `SELECT * FROM barman_tickets WHERE ticket_date = $1 ORDER BY created_at ASC`,
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Barman fetch tickets error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.  PATCH /api/barman/tickets/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/tickets/:id/status', async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;
  const allowed    = ['Pending','Preparing','Ready','Served','Paid','Closed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `Invalid status: ${status}` });

  try {
    const result = await pool.query(
      `UPDATE barman_tickets
       SET status     = $1,
           ready_at   = CASE WHEN $1 = 'Ready' THEN NOW() ELSE ready_at END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Barman status update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4.  PATCH /api/barman/tickets/:id/assign-barman
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/tickets/:id/assign-barman', async (req, res) => {
  const { id } = req.params;
  const { items, item_name, assigned_to, assigned_at, assigned_by } = req.body;

  if (!items || !assigned_to || !item_name) {
    return res.status(400).json({ error: 'items, item_name, and assigned_to are required' });
  }

  try {
    const ticketResult = await pool.query(
      `UPDATE barman_tickets SET items = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [JSON.stringify(items), id]
    );
    if (!ticketResult.rows.length) return res.status(404).json({ error: 'Ticket not found' });

    const ticket = ticketResult.rows[0];

    await pool.query(
      `INSERT INTO barman_assignments (order_id, ticket_id, item_name, assigned_to, assigned_at, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ticket.order_id, id, item_name, assigned_to, assigned_at || new Date().toISOString(), assigned_by || null]
    );

    res.json(ticket);
  } catch (err) {
    console.error('Assign barman error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.  PATCH /api/barman/clear-shift
//     Marks all active tickets cleared — tickets stay in DB for accountant.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/clear-shift', async (req, res) => {
  const { cleared_by = 'Head Barman' } = req.body;
  const date = kampalaDate();
  try {
    const result = await pool.query(
      `UPDATE barman_tickets
       SET cleared_at    = NOW(),
           cleared_by    = $1,
           updated_at    = NOW()
       WHERE ticket_date = $2
         AND cleared_at IS NULL
       RETURNING id`,
      [cleared_by, date]
    );
    console.log(`✅ Barman shift cleared by ${cleared_by} — ${result.rowCount} ticket(s) archived`);
    res.json({ cleared: result.rowCount, cleared_by, date });
  } catch (err) {
    console.error('Clear barman shift error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;