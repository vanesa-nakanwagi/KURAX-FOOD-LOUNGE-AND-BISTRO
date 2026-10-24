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
import notificationService from '../helpers/notificationService.js';
import { resolveNotificationUser } from '../middleware/notificationAuth.js';
import { refreshPublicOrderPreparationStatus } from '../helpers/publicOrderWorkflow.js';
import { getRoutableStationItems, getStationItemsTotal } from '../helpers/confirmedStationItems.js';
import { syncRoutableStationTickets } from '../helpers/stationOrderTickets.js';

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
    const orderResult = await pool.query('SELECT items FROM public.orders WHERE id=$1', [order_id]);
    if (!orderResult.rows.length) return res.status(404).json({ error: 'Order not found.' });
    const orderItems = Array.isArray(orderResult.rows[0].items) ? orderResult.rows[0].items : [];
    const stationItems = getRoutableStationItems(orderItems, orderItems)
      .filter(item => ['barman', 'bar'].includes(String(item.station || '').trim().toLowerCase()));
    if (!stationItems.length) {
      return res.status(409).json({ error: 'This order has no items routed to the bar station.' });
    }
    const ticketTotal = getStationItemsTotal(stationItems);
    const result = await pool.query(
      `INSERT INTO barman_tickets
         (order_id, table_name, staff_name, items, total, status, ticket_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (order_id) DO UPDATE SET
         items      = EXCLUDED.items,
         staff_name = EXCLUDED.staff_name,
         updated_at = NOW()
       RETURNING *`,
      [order_id, table_name, staff_name || null, JSON.stringify(stationItems), ticketTotal || Number(total) || 0, status, kampalaDate()]
    );
    const actor = await resolveNotificationUser(req);
    if (actor?.scope === 'restaurant' && ['WAITER', 'SUPERVISOR', 'MANAGER', 'DIRECTOR', 'BAR_HOD'].includes(actor.role)) {
      void notificationService.sendToRoles(['BAR_HOD', 'BARMAN'], {
        type: 'BAR_ORDER',
        title: 'New Bar Order',
        body: `Order #${order_id} requires preparation.`,
        department: 'Bar',
        referenceId: order_id,
        link: `/barman?order=${order_id}`,
      });
    }
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
    await syncRoutableStationTickets(pool, 'bar');
    const result = req.query.active === 'true'
      ? await pool.query(
        `SELECT t.* FROM barman_tickets t
         JOIN public.orders o ON o.id = t.order_id
         WHERE t.status IN ('Pending', 'Preparing')
           AND t.cleared_at IS NULL
           AND COALESCE(o.day_cleared, false) = false
           AND COALESCE(o.shift_cleared, false) = false
           AND LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'voided', 'closed', 'served')
         ORDER BY t.created_at ASC`
      )
      : await pool.query(
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
    const actor = await resolveNotificationUser(req);
    if (!actor) return res.status(401).json({ error: 'Staff sign-in is required.' });
    if (!['BAR_HOD', 'MANAGER', 'DIRECTOR'].includes(actor.role)) {
      return res.status(403).json({ error: 'Claim this item with your PIN and update it in My Production.' });
    }
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
    await refreshPublicOrderPreparationStatus(result.rows[0].order_id, pool);
    if (status === 'Ready' && actor?.scope === 'restaurant' && ['BARMAN', 'BAR_HOD'].includes(actor.role)) {
      try {
        const orderResult = await pool.query('SELECT staff_id FROM public.orders WHERE id = $1', [result.rows[0].order_id]);
        if (orderResult.rows[0]?.staff_id) {
          void notificationService.sendToUser(orderResult.rows[0].staff_id, {
            type: 'ORDER_READY',
            title: 'Bar Order Ready',
            body: `Order #${result.rows[0].order_id} is ready for service.`,
            department: 'Bar',
            referenceId: result.rows[0].order_id,
            link: `/staff/waiter?order=${result.rows[0].order_id}`,
          });
        }
      } catch (notificationError) {
        console.error('Bar ready notification lookup failed:', notificationError.message);
      }
    }
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
  res.status(410).json({ error: 'Manual assignments are retired. Claim the item using its station PIN.' });
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