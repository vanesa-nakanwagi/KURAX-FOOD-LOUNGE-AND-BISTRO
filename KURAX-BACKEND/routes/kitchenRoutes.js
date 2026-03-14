/**
 * kitchenRoutes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in server.js:
 * import kitchenRoutes from './routes/kitchenRoutes.js';
 * app.use('/api/kitchen', kitchenRoutes);
 */

import express from 'express';
import pool    from '../db.js';
// ✅ IMPORT THE LOGGER (Ensure this matches your actual filename: logsActivity.js)
import logActivity from '../utils/logsActivity.js';

const router = express.Router();

// ── Kampala / EAT date helper (UTC+3) ────────────────────────────────────────
function kampalaDate(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }))
    .toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  POST /api/kitchen/tickets
//     Upsert a ticket. Now logs the "Sent to Kitchen" event.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tickets', async (req, res) => {
  const { order_id, table_name, staff_name, staff_role, items = [], total = 0, status = 'Pending' } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO kitchen_tickets (order_id, table_name, staff_name, staff_role, items, total, status, ticket_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (order_id) DO UPDATE SET items = EXCLUDED.items, status = EXCLUDED.status, staff_name = EXCLUDED.staff_name, updated_at = NOW()
       RETURNING *`,
      [order_id, table_name, staff_name || 'System', staff_role || 'WAITER', JSON.stringify(items), Number(total), status, kampalaDate()]
    );

    // ✅ LOG: Now specifically uses staff_name (The Waiter)
    const itemCount = items.length;
    // ✅ Inside POST /api/kitchen/tickets
await logActivity(pool, {
  type: 'ORDER',
  actor: staff_name, // Make sure this is the string "BULAFU" and not the ID
  role: staff_role,
  message: `New order sent to kitchen — ${table_name}`,
  meta: { table_name, staff_name, order_id },
});

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Kitchen upsert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2a. GET /api/kitchen/tickets/summary (Must be before /:id)
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
       FROM kitchen_tickets WHERE ticket_date = $1`, [date]
    );

    const chefRes = await pool.query(
      `SELECT ca.assigned_to AS chef, COUNT(*) AS items_handled, MIN(ca.assigned_at) AS first_at, MAX(ca.assigned_at) AS last_at
       FROM chef_assignments ca JOIN kitchen_tickets kt ON ca.ticket_id = kt.id
       WHERE kt.ticket_date = $1 GROUP BY ca.assigned_to ORDER BY items_handled DESC`, [date]
    );

    const ticketsRes = await pool.query(
      `SELECT id, order_id, table_name, staff_name, items, total, status, ready_at, cleared_by_kitchen, cleared_by, cleared_at, created_at
       FROM kitchen_tickets WHERE ticket_date = $1 ORDER BY created_at ASC`, [date]
    );

    res.json({ date, totals: totalsRes.rows[0], chefs: chefRes.rows, tickets: ticketsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2b. GET /api/kitchen/tickets
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tickets', async (req, res) => {
  const date = req.query.date || kampalaDate();
  try {
    const result = await pool.query(`SELECT * FROM kitchen_tickets WHERE ticket_date = $1 ORDER BY created_at ASC`, [date]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/tickets/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, chef_name } = req.body; // Added chef_name to req.body

  try {
    const result = await pool.query(
       `UPDATE kitchen_tickets SET status = $1, ready_at = CASE WHEN $1 = 'Ready' THEN NOW() ELSE ready_at END, updated_at = NOW()
        WHERE id = $2 RETURNING *`, [status, id]
    );
    const ticket = result.rows[0];

    // ✅ LOG: Order Ready (Shows which chef finished it if provided)
    if (status === 'Ready') {
      await logActivity(pool, {
        type: 'ORDER',
        actor: chef_name || 'Kitchen', 
        role: 'CHEF',
        message: `KITCHEN READY: ${ticket.table_name} (Order #${ticket.order_id})`,
        meta: { table_name: ticket.table_name }
      });
    }

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4.  PATCH /api/kitchen/tickets/:id/assign-chef
//     Logs which chef is handling specific items
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/tickets/:id/assign-chef', async (req, res) => {
  const { id } = req.params;
  const { items, item_name, assigned_to, assigned_at, assigned_by } = req.body;

  if (!items || !assigned_to || !item_name) {
    return res.status(400).json({ error: 'items, item_name, and assigned_to are required' });
  }

  try {
    const ticketResult = await pool.query(`UPDATE kitchen_tickets SET items = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [JSON.stringify(items), id]);
    if (!ticketResult.rows.length) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = ticketResult.rows[0];

    await pool.query(
      `INSERT INTO chef_assignments (order_id, ticket_id, item_name, assigned_to, assigned_at, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ticket.order_id, id, item_name, assigned_to, assigned_at || new Date().toISOString(), assigned_by || null]
    );

    // ✅ LOG: CHEF ASSIGNED
    await logActivity(pool, {
      type: 'STAFF',
      actor: assigned_to,
      role: 'CHEF',
      message: `Chef ${assigned_to} is now preparing: ${item_name} (${ticket.table_name})`,
      meta: { table_name: ticket.table_name, item_name, chef: assigned_to },
    });

    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.  PATCH /api/kitchen/clear-shift
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/clear-shift', async (req, res) => {
  const { cleared_by = 'Head Chef' } = req.body;
  const date = kampalaDate();

  try {
    const result = await pool.query(
      `UPDATE kitchen_tickets SET cleared_by_kitchen = TRUE, cleared_at = NOW(), cleared_by = $1, updated_at = NOW()
       WHERE ticket_date = $2 AND cleared_by_kitchen = FALSE RETURNING id`, [cleared_by, date]
    );

    // ✅ LOG: KITCHEN SHIFT CLEARED
    await logActivity(pool, {
      type: 'SHIFT',
      actor: cleared_by,
      role: 'CHEF',
      message: `Kitchen shift cleared — ${result.rowCount} tickets archived`,
      meta: { cleared_count: result.rowCount, date },
    });

    res.json({ cleared: result.rowCount, cleared_by, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;