// routes/orderRoutes.js
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

// FIXED: GET /api/orders - Properly parse items JSON
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, s.name as staff_name, s.role as staff_role_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       ORDER BY o.id DESC 
       LIMIT 200`
    );
    
    // Parse the items JSON for each order
    const parsedOrders = result.rows.map(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          console.error(`Failed to parse items for order ${order.id}:`, e);
          items = [];
        }
      }
      return {
        ...order,
        items: items
      };
    });
    
    res.json(parsedOrders);
  } catch (err) {
    console.error('Fetch orders error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// FIXED: GET /api/orders/cashier-queue - Parse items JSON
router.get('/cashier-queue', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         o.id, 
         o.table_name, 
         o.total, 
         o.status, 
         o.items, 
         o.payment_method,
         o.created_at,
         s.name AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled')
         AND o.shift_cleared = FALSE
       ORDER BY o.created_at DESC`
    );
    
    // Parse items JSON for each order
    const parsedOrders = result.rows.map(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      return {
        ...order,
        items: items
      };
    });
    
    res.json(parsedOrders);
  } catch (err) {
    console.error('Queue Fetch Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// FIXED: GET /api/orders/tables/all - Parse items JSON
router.get('/tables/all', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH active_orders AS (
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

// FIXED: GET /api/orders/cashier-history - Parse items if needed
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
    
    // Parse item JSON if it exists
    const parsedHistory = result.rows.map(history => {
      let item = history.item;
      if (item && typeof item === 'string') {
        try {
          item = JSON.parse(item);
        } catch (e) {
          item = null;
        }
      }
      return {
        ...history,
        item: item
      };
    });
    
    res.json(parsedHistory);
  } catch (err) {
    console.error('cashier-history failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Keep your other endpoints as they are...
// GET /api/orders/credits
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

// POST /api/orders
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
    
    // Parse items for the response
    let parsedItems = newOrder.items;
    if (typeof parsedItems === 'string') {
      parsedItems = JSON.parse(parsedItems);
    }

    if (tableName && tableName !== 'WALK-IN') {
      await pool.query(
        `INSERT INTO tables (name, status, last_order_id, updated_at)
         VALUES ($1, 'Occupied', $2, NOW())
         ON CONFLICT (name)
         DO UPDATE SET
           status     = 'Occupied',
           updated_at = NOW()`,
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

    res.status(201).json({
      ...newOrder,
      items: parsedItems
    });
  } catch (err) {
    console.error('POST Order Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Keep the rest of your endpoints (void-item, status, pay, etc.) as they are
// ... (copy the rest of your existing endpoints below)

// PATCH /api/orders/:id/status
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
    
    // Parse items
    let items = updatedOrder.items;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    await logActivity(pool, {
      type:    status === 'Voided' ? 'ORDER_VOIDED' : 'STATUS_UPDATE',
      actor:   staff_name || 'System',
      role:    role || 'STAFF',
      message: status === 'Voided'
        ? `Order #${id} was VOIDED. Reason: ${void_reason}`
        : `Order #${id} (${updatedOrder.table_name}) is now ${status}`,
      meta:    { status, order_id: id, reason: void_reason },
    });

    res.json({
      ...updatedOrder,
      items: items
    });
  } catch (err) {
    console.error('Update Status Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/pay
router.patch('/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { status = 'Paid', payment_method } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1, payment_method = $2, is_paid = true, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, payment_method, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = result.rows[0];
    
    // Parse items
    let items = order.items;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    if (order.table_name) {
      try {
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
          ).catch(err => console.warn('Table update skipped:', err.message));
        }
      } catch (err) {
        console.warn('Table release check failed:', err.message);
      }
    }

    await updateDailySummary({ amount: order.total, method: payment_method });
    
    try {
      await pool.query(
        `INSERT INTO cashier_queue 
           (order_ids, table_name, label, method, amount, status, confirmed_by, confirmed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Confirmed', 'Cashier', NOW(), NOW())`,
        [
          JSON.stringify([order.id]),
          order.table_name || 'WALK-IN',
          `Order #${order.id}`,
          payment_method || 'Cash',
          Number(order.total),
        ]
      );
    } catch (err) {
      console.warn('Failed to record in cashier_queue:', err.message);
    }
    
    res.json({
      ...order,
      items: items
    });
  } catch (err) {
    console.error('Pay Order Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/void-item
router.post('/void-item', async (req, res) => {
  const { order_id, item_name, reason, requested_by } = req.body;

  if (!order_id || !item_name || !reason) {
    return res.status(400).json({ error: 'order_id, item_name, and reason are required' });
  }

  try {
    const orderRes = await pool.query(
      `SELECT o.table_name, o.staff_id, o.items, o.total, COALESCE(s.name, $2) AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.id = $1`,
      [order_id, requested_by || 'Unknown']
    );

    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = orderRes.rows[0];
    const tableName = order.table_name;
    const waiterName = order.waiter_name;
    
    let items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    const targetItem = items.find(item => item.name === item_name && !item.voidRequested && !item.voidProcessed);
    
    if (!targetItem) {
      return res.status(404).json({ error: 'Item not found or already voided' });
    }
    
    const originalPrice = Number(targetItem.price || 0);
    const originalQuantity = Number(targetItem.quantity || 1);
    const itemTotal = originalPrice * originalQuantity;

    const voidRes = await pool.query(
      `INSERT INTO void_requests
         (order_id, item_name, reason, requested_by,
          table_name, waiter_name, status, created_at,
          original_price, original_quantity, item_total)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', NOW(), $7, $8, $9)
       RETURNING *`,
      [order_id, item_name, reason, requested_by, tableName, waiterName, 
       originalPrice, originalQuantity, itemTotal]
    );

    let found = false;
    const updatedItems = items.map(item => {
      if (!found && item.name === item_name && !item.voidRequested && !item.voidProcessed) {
        found = true; 
        return { 
          ...item, 
          voidRequested: true, 
          voidReason: reason, 
          voidRequestedBy: requested_by,
          original_price: originalPrice,
          price: originalPrice
        };
      }
      return item;
    });

    await pool.query(
      `UPDATE orders SET items = $1 WHERE id = $2`,
      [JSON.stringify(updatedItems), order_id]
    );

    await logActivity(pool, {
      type: 'VOID_REQUESTED',
      actor: requested_by,
      role: 'WAITER',
      message: `Void requested: ${item_name} (UGX ${itemTotal.toLocaleString()}) from Order #${order_id}`,
      meta: { reason, order_id, table: tableName, amount: itemTotal }
    });

    res.status(201).json(voidRes.rows[0]);
  } catch (err) {
    console.error('Void Request Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add debug endpoint
router.get('/debug/staff-orders/:staffId', async (req, res) => {
  const { staffId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const allOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, 
              DATE(timestamp) as order_date, timestamp, shift_cleared
       FROM orders 
       ORDER BY id DESC 
       LIMIT 50`
    );
    
    const staffOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, 
              DATE(timestamp) as order_date, timestamp, shift_cleared
       FROM orders 
       WHERE staff_id = $1 OR waiter_name ILIKE $2 OR staff_name ILIKE $2
       ORDER BY id DESC`,
      [staffId, `%${req.query.name || ''}%`]
    );
    
    const todayOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, 
              DATE(timestamp) as order_date, timestamp, shift_cleared
       FROM orders 
       WHERE (staff_id = $1 OR waiter_name ILIKE $2 OR staff_name ILIKE $2)
         AND DATE(timestamp) = $3
         AND shift_cleared = FALSE
       ORDER BY id DESC`,
      [staffId, `%${req.query.name || ''}%`, today]
    );
    
    res.json({
      debug: {
        staffId: staffId,
        staffName: req.query.name || 'unknown',
        today: today
      },
      allOrdersSample: allOrders.rows.slice(0, 10),
      allOrdersCount: allOrders.rows.length,
      staffOrders: staffOrders.rows,
      staffOrdersCount: staffOrders.rows.length,
      todayOrders: todayOrders.rows,
      todayOrdersCount: todayOrders.rows.length
    });
  } catch (err) {
    console.error('Debug error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/test', (req, res) => {
  res.json({ 
    message: 'Order routes are working!', 
    timestamp: new Date().toISOString(),
    endpoints: ['GET /', 'GET /cashier-history', 'GET /credits', 'POST /', 'PATCH /:id/status']
  });
});

export default router;