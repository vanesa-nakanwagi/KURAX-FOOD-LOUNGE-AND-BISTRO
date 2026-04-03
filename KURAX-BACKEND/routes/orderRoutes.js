import express from 'express';
import pool from '../db.js';
import { updateDailySummary } from '../helpers/summaryHelper.js';
import logActivity from '../utils/logsActivity.js';

const router = express.Router();

// ── Kampala date helper ───────────────────────────────────────────────────────
function kampalaDate() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM orders ORDER BY id DESC LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch orders error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/tables/all
//
// FIX: Instead of joining only on last_order_id (which only has the latest
// order's items), we now aggregate ALL active orders for each table so that
// chicken + meat both appear when a waiter adds to an existing table.
//
// Strategy:
//   1. Find all active (non-Paid/Closed/Voided) orders grouped by table_name
//   2. Merge their items arrays into one combined array
//   3. Sum their totals
//   4. Join to the tables row for status / waiter info
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tables/all', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH active_orders AS (
        -- Aggregate all active orders per table into one merged row
        SELECT
          o.table_name,
          jsonb_agg(item ORDER BY o.id ASC) AS active_items,
          SUM(o.total)                       AS current_total,
          MIN(o.created_at)                  AS order_start,
          MAX(o.id)                          AS latest_order_id,
          MAX(o.staff_id)                    AS staff_id
        FROM orders o,
             jsonb_array_elements(
               CASE
                 WHEN jsonb_typeof(o.items::jsonb) = 'array' THEN o.items::jsonb
                 ELSE '[]'::jsonb
               END
             ) AS item
        WHERE o.status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled')
          AND o.table_name IS NOT NULL
          AND o.table_name != 'WALK-IN'
          AND o.shift_cleared = FALSE
        GROUP BY o.table_name
      )
      SELECT
        t.id,
        t.name,
        t.status,
        t.last_order_id,
        COALESCE(ao.current_total, 0)  AS current_total,
        ao.order_start,
        ao.active_items,
        ao.latest_order_id,
        s.name                          AS waiter_name
      FROM tables t
      LEFT JOIN active_orders ao ON UPPER(ao.table_name) = UPPER(t.name)
      LEFT JOIN staff s ON ao.staff_id = s.id
      ORDER BY t.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch tables error:', err.message);
    res.status(500).json({ error: 'Could not retrieve table list' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/cashier-history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cashier-history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         cq.*,
         cq.credit_name    AS client_name,
         cq.credit_phone   AS client_phone,
         cq.credit_pay_by  AS pay_by
       FROM cashier_queue cq
       WHERE cq.status IN ('Confirmed', 'Rejected')
         AND (cq.created_at AT TIME ZONE 'Africa/Nairobi')::date = CURRENT_DATE
         AND cq.shift_cleared = FALSE
       ORDER BY cq.confirmed_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('cashier-history failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW ROUTE: GET /api/orders/cashier-queue
// This stops the 404 error your frontend is throwing!
// ─────────────────────────────────────────────────────────────────────────────


router.get('/cashier-queue', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         o.id, 
         o.table_name, 
         o.total, 
         o.status, 
         o.items, 
         o.created_at,
         s.name AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled')
         AND o.shift_cleared = FALSE
       ORDER BY o.created_at DESC`
    );
    
    // Always return an array, even if it's empty []
    res.json(result.rows); 
  } catch (err) {
    console.error('Queue Fetch Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/void-requests
// ─────────────────────────────────────────────────────────────────────────────
router.get('/void-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         vr.id, vr.order_id, vr.item_name, vr.reason, vr.status,
         vr.created_at, vr.resolved_by, vr.resolved_at, vr.station,
         COALESCE(vr.table_name,  o.table_name)    AS table_name,
         COALESCE(vr.waiter_name, vr.requested_by)  AS waiter_name,
         vr.chef_name,
         o.total AS order_total
       FROM void_requests vr
       LEFT JOIN orders o ON vr.order_id = o.id
       WHERE vr.status = 'Pending'
       ORDER BY vr.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Void requests fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/void-requests/history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/void-requests/history', async (req, res) => {
  try {
    const today = kampalaDate();
    const result = await pool.query(
      `SELECT
         vr.id, vr.order_id, vr.item_name, vr.reason, vr.status,
         vr.created_at, vr.resolved_by, vr.resolved_at, vr.station,
         COALESCE(vr.table_name,  o.table_name)    AS table_name,
         COALESCE(vr.waiter_name, vr.requested_by)  AS waiter_name,
         vr.chef_name,
         o.total AS order_total
       FROM void_requests vr
       LEFT JOIN orders o ON vr.order_id = o.id
       WHERE vr.status IN ('Approved', 'Rejected', 'Expired')
         AND DATE(vr.created_at AT TIME ZONE 'Africa/Nairobi') = $1
       ORDER BY vr.resolved_at DESC NULLS LAST, vr.created_at DESC`,
      [today]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Void history fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/credits
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM credits ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Credits fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders
//
// FIX: When adding to an existing occupied table, do NOT overwrite
// last_order_id — it should always point to the FIRST/original order so that
// the table's identity stays stable. We only set last_order_id on first insert.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { staffId, staffRole, tableName, items, total, paymentMethod } = req.body;

  try {
    const orderResult = await pool.query(
      `INSERT INTO orders (
         staff_id, staff_role, table_name,
         items, total, payment_method, status, date
       ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending', CURRENT_DATE)
       RETURNING *`,
      [
        staffId       || 1,
        staffRole     || 'WAITER',
        tableName     || 'WALK-IN',
        JSON.stringify(items),
        total,
        paymentMethod || 'Cash',
      ]
    );

    const newOrder = orderResult.rows[0];

    if (tableName && tableName !== 'WALK-IN') {
      await pool.query(
        // KEY FIX: On conflict (table already exists/occupied), we do NOT
        // update last_order_id — we keep pointing to the first order so
        // GET /tables/all can still identify the table correctly.
        // The active_orders CTE in GET /tables/all aggregates ALL order rows
        // by table_name so all items always show regardless of last_order_id.
        `INSERT INTO tables (name, status, last_order_id, updated_at)
         VALUES ($1, 'Occupied', $2, NOW())
         ON CONFLICT (name)
         DO UPDATE SET
           status     = 'Occupied',
           updated_at = NOW()
           -- last_order_id intentionally NOT updated on conflict
           -- so the table identity remains stable across multiple orders`,
        [tableName.toUpperCase(), newOrder.id]
      );
    }

    await logActivity(pool, {
      type:    'ORDER_SENT',
      actor:   `Staff ID: ${staffId}`,
      role:    staffRole,
      message: `New order sent for ${tableName}`,
      meta:    { order_id: newOrder.id, total },
    });

    res.status(201).json(newOrder);
  } catch (err) {
    console.error('POST Order Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/void-item
// ─────────────────────────────────────────────────────────────────────────────
router.post('/void-item', async (req, res) => {
  const { order_id, item_name, reason, requested_by } = req.body;

  if (!order_id || !item_name || !reason) {
    return res.status(400).json({ error: 'order_id, item_name, and reason are required' });
  }

  try {
    const orderRes = await pool.query(
      `SELECT o.table_name, o.staff_id, o.items, COALESCE(s.name, $2) AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.id = $1`,
      [order_id, requested_by || 'Unknown']
    );

    const order      = orderRes.rows[0] || {};
    const tableName  = order.table_name  || null;
    const waiterName = order.waiter_name || requested_by || 'Unknown';

    const chefRes = await pool.query(
      `SELECT assigned_to FROM chef_assignments
       WHERE order_id = $1 AND item_name = $2
       ORDER BY assigned_at DESC LIMIT 1`,
      [order_id, item_name]
    );
    const chefName = chefRes.rows[0]?.assigned_to || null;

    let station = null;
    if (order.items) {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const found = items.find(i => i.name === item_name);
      station = found?.station || found?.category || null;
    }

    const voidRes = await pool.query(
      `INSERT INTO void_requests
         (order_id, item_name, reason, requested_by,
          table_name, waiter_name, chef_name, station, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending', NOW())
       RETURNING *`,
      [order_id, item_name, reason, requested_by || 'Unknown Staff',
       tableName, waiterName, chefName, station]
    );

    if (order.items) {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      let patched = false;
      const updatedItems = items.map(item => {
        if (!patched && item.name === item_name && !item.voidRequested) {
          patched = true;
          return { ...item, voidRequested: true, voidReason: reason, voidRequestedBy: requested_by };
        }
        return item;
      });
      await pool.query(
        `UPDATE orders SET items = $1 WHERE id = $2`,
        [JSON.stringify(updatedItems), order_id]
      );
    }

    await logActivity(pool, {
      type:    'VOID_REQUESTED',
      actor:   requested_by,
      role:    'WAITER',
      message: `Void requested for "${item_name}" on Order #${order_id} at ${tableName || 'Unknown Table'}`,
      meta:    { reason, order_id, chef: chefName, table: tableName },
    });

    res.status(201).json(voidRes.rows[0]);
  } catch (err) {
    console.error('Void Request Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, staff_name, role, void_reason } = req.body;

  const allowed = ['Pending', 'Preparing', 'Ready', 'Delayed', 'Served', 'Closed', 'Voided'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1, void_reason = $2 WHERE id = $3 RETURNING *`,
      [status, void_reason || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const updatedOrder = result.rows[0];

    await logActivity(pool, {
      type:    status === 'Voided' ? 'ORDER_VOIDED' : 'STATUS_UPDATE',
      actor:   staff_name || 'System',
      role:    role || 'STAFF',
      message: status === 'Voided'
        ? `Order #${id} was VOIDED. Reason: ${void_reason}`
        : `Order #${id} (${updatedOrder.table_name}) is now ${status}`,
      meta:    { status, order_id: id, reason: void_reason },
    });

    res.json(updatedOrder);
  } catch (err) {
    console.error('Update Status Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/pay
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { status = 'Paid', payment_method } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1, payment_method = $2, paid_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, payment_method, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = result.rows[0];

    // Release table only when ALL orders for this table are paid
    if (order.table_name) {
      const pendingCheck = await pool.query(
        `SELECT COUNT(*) AS cnt FROM orders
         WHERE UPPER(table_name) = UPPER($1)
           AND status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled', 'Credit')
           AND shift_cleared = FALSE`,
        [order.table_name]
      );
      const remaining = parseInt(pendingCheck.rows[0].cnt, 10);
      if (remaining === 0) {
        await pool.query(
          `UPDATE tables
           SET status = 'Available', last_order_id = NULL, updated_at = NOW()
           WHERE UPPER(name) = UPPER($1)`,
          [order.table_name]
        );
      }
    }

    await updateDailySummary({ amount: order.total, method: payment_method });
    res.json(order);
  } catch (err) {
    console.error('Pay Order Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/void-requests/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/void-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  try {
    const vrRes = await pool.query(`SELECT * FROM void_requests WHERE id = $1`, [id]);
    if (!vrRes.rows.length) return res.status(404).json({ error: 'Void request not found' });
    const vr = vrRes.rows[0];

    await pool.query(
      `UPDATE void_requests SET status = 'Approved', resolved_by = $1, resolved_at = NOW() WHERE id = $2`,
      [approved_by || 'Accountant', id]
    );

    const orderRes = await pool.query(`SELECT items, total FROM orders WHERE id = $1`, [vr.order_id]);
    if (orderRes.rows.length > 0) {
      let items = orderRes.rows[0].items;
      if (typeof items === 'string') items = JSON.parse(items);

      let patched = false;
      const updatedItems = items.map(item => {
        if (!patched && item.name === vr.item_name && item.voidRequested) {
          patched = true;
          return { ...item, voidRequested: false, voidProcessed: true, status: 'VOIDED', price: 0 };
        }
        return item;
      });

      const newTotal = updatedItems.reduce(
        (sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0
      );

      await pool.query(
        `UPDATE orders SET items = $1, total = $2 WHERE id = $3`,
        [JSON.stringify(updatedItems), newTotal, vr.order_id]
      );
    }

    await logActivity(pool, {
      type:    'VOID_APPROVED',
      actor:   approved_by || 'Accountant',
      role:    'ACCOUNTANT',
      message: `Approved void for "${vr.item_name}" on Order #${vr.order_id} (${vr.table_name || 'Unknown Table'})`,
      meta:    { void_id: id, order_id: vr.order_id, item: vr.item_name, chef: vr.chef_name },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Void approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/void-requests/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/void-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { rejected_by } = req.body;

  try {
    const vrRes = await pool.query(`SELECT * FROM void_requests WHERE id = $1`, [id]);
    if (!vrRes.rows.length) return res.status(404).json({ error: 'Void request not found' });
    const vr = vrRes.rows[0];

    await pool.query(
      `UPDATE void_requests SET status = 'Rejected', resolved_by = $1, resolved_at = NOW() WHERE id = $2`,
      [rejected_by || 'Accountant', id]
    );

    const orderRes = await pool.query(`SELECT items FROM orders WHERE id = $1`, [vr.order_id]);
    if (orderRes.rows.length > 0) {
      let items = orderRes.rows[0].items;
      if (typeof items === 'string') items = JSON.parse(items);

      let patched = false;
      const updatedItems = items.map(item => {
        if (!patched && item.name === vr.item_name && item.voidRequested) {
          patched = true;
          return { ...item, voidRequested: false, voidRejected: true };
        }
        return item;
      });

      await pool.query(
        `UPDATE orders SET items = $1 WHERE id = $2`,
        [JSON.stringify(updatedItems), vr.order_id]
      );
    }

    await logActivity(pool, {
      type:    'VOID_REJECTED',
      actor:   rejected_by || 'Accountant',
      role:    'ACCOUNTANT',
      message: `Rejected void for "${vr.item_name}" on Order #${vr.order_id} (${vr.table_name || 'Unknown Table'})`,
      meta:    { void_id: id, order_id: vr.order_id, item: vr.item_name, chef: vr.chef_name },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Void reject error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/assign-chef
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/assign-chef', async (req, res) => {
  const { id } = req.params;
  const { items, item_name, assigned_to, assigned_at, assigned_by } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders SET items = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(items), id]
    );

    await pool.query(
      `INSERT INTO chef_assignments (order_id, item_name, assigned_to, assigned_at, assigned_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, item_name, assigned_to, assigned_at, assigned_by]
    );

    await logActivity(pool, {
      type:    'CHEF_ASSIGNED',
      actor:   assigned_by,
      role:    'MANAGER',
      message: `Assigned Chef ${assigned_to} to "${item_name}" (Order #${id})`,
      meta:    { chef: assigned_to, item: item_name },
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Assign Chef Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;