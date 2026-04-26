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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders - Fetch all orders with parsed items
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, s.name as staff_name, s.role as staff_role_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       ORDER BY o.id DESC 
       LIMIT 200`
    );
    
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
      return { ...order, items };
    });
    
    res.json(parsedOrders);
  } catch (err) {
    console.error('Fetch orders error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/cashier-queue - Fetch orders pending cashier confirmation
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
         o.payment_method,
         o.created_at,
         s.name AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled')
         AND o.shift_cleared = FALSE
         AND (o.payment_method IS NULL OR o.payment_method = '')
       ORDER BY o.created_at DESC`
    );
    
    const parsedOrders = result.rows.map(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      return { ...order, items };
    });
    
    res.json(parsedOrders);
  } catch (err) {
    console.error('Queue Fetch Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/tables/all - Fetch all tables with active orders
// ─────────────────────────────────────────────────────────────────────────────
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
          AND (o.payment_method IS NULL OR o.payment_method = '')
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
// GET /api/orders/cashier-history - Fetch cashier confirmation history
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
    
    const parsedHistory = result.rows.map(history => {
      let item = history.item;
      if (item && typeof item === 'string') {
        try {
          item = JSON.parse(item);
        } catch (e) {
          item = null;
        }
      }
      return { ...history, item };
    });
    
    res.json(parsedHistory);
  } catch (err) {
    console.error('cashier-history failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/credits - Fetch all credits
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
// GET /api/orders/void-requests - Fetch pending void requests for accountant
// ─────────────────────────────────────────────────────────────────────────────
router.get('/void-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, 
              o.table_name, 
              o.staff_name as waiter_name,
              o.items
       FROM void_requests vr
       LEFT JOIN orders o ON vr.order_id = o.id
       WHERE vr.status = 'Pending'
       ORDER BY vr.created_at DESC`
    );
    
    const parsedRequests = result.rows.map(req => {
      let items = req.items;
      if (items && typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      
      return { 
        ...req, 
        items,
        chef_name: req.chef_name || 'Not assigned'
      };
    });
    
    res.json(parsedRequests);
  } catch (err) {
    console.error('Fetch void requests error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/void-requests/history - Fetch resolved voids for today
// ─────────────────────────────────────────────────────────────────────────────
router.get('/void-requests/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, 
              o.table_name, 
              o.staff_name as waiter_name
       FROM void_requests vr
       LEFT JOIN orders o ON vr.order_id = o.id
       WHERE DATE(vr.created_at AT TIME ZONE 'Africa/Nairobi') = CURRENT_DATE
         AND vr.status IN ('Approved', 'Rejected', 'Expired')
       ORDER BY vr.resolved_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch void history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders - Create new order (FIXED: No default payment_method)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { staffId, staffRole, tableName, items, total, paymentMethod } = req.body;

  try {
    // CRITICAL FIX: Do NOT set payment_method by default
    // Payment method should be NULL until cashier confirms payment
    const orderResult = await pool.query(
      `INSERT INTO orders (
         staff_id, staff_role, table_name,
         items, total, payment_method, status, date, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, NOW())
       RETURNING *`,
      [
        staffId       || 1,
        staffRole     || 'WAITER',
        tableName     || 'WALK-IN',
        JSON.stringify(items),
        total,
        null,  // ← FIXED: No default payment method
        'Pending',   // ← FIXED: Status is Pending, not Served
      ]
    );

    const newOrder = orderResult.rows[0];
    
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
      type:    'ORDER_CREATED',
      actor:   `Staff ID: ${staffId}`,
      role:    staffRole,
      message: `New order created for ${tableName}`,
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/void-item - Waiter requests to void an item (FIXED)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/void-item', async (req, res) => {
  const { order_id, item_name, reason, requested_by } = req.body;

  console.log("Received void request:", { order_id, item_name, reason, requested_by });

  if (!order_id || !item_name || !reason) {
    console.log("Missing required fields");
    return res.status(400).json({ error: 'order_id, item_name, and reason are required' });
  }

  try {
    // Get order details
    const orderRes = await pool.query(
      `SELECT o.table_name, o.staff_id, o.items, o.total, COALESCE(s.name, $2) AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.id = $1`,
      [order_id, requested_by || 'Unknown']
    );

    if (orderRes.rows.length === 0) {
      console.log("Order not found:", order_id);
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];
    const tableName = order.table_name;
    const waiterName = order.waiter_name;
    
    let items = [];
    try {
      items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    } catch (e) {
      console.error("Error parsing items:", e);
      items = [];
    }
    
    const targetItem = items.find(item => item.name === item_name && !item.voidRequested && !item.voidProcessed);
    
    if (!targetItem) {
      console.log("Item not found or already voided:", item_name);
      return res.status(404).json({ error: 'Item not found or already voided' });
    }
    
    // FIND THE ASSIGNED CHEF FROM KITCHEN_TICKETS
    let chefName = null;
    
    try {
      const kitchenResult = await pool.query(
        `SELECT staff_name, staff_role, items
         FROM kitchen_tickets 
         WHERE order_id = $1 
           AND cleared_by_kitchen = false
         ORDER BY created_at DESC 
         LIMIT 1`,
        [order_id]
      );
      
      console.log("Kitchen tickets found:", kitchenResult.rows.length);
      
      if (kitchenResult.rows.length > 0) {
        const kitchenTicket = kitchenResult.rows[0];
        
        let kitchenItems = kitchenTicket.items;
        if (typeof kitchenItems === 'string') {
          try {
            kitchenItems = JSON.parse(kitchenItems);
          } catch (e) {
            kitchenItems = [];
          }
        }
        
        if (Array.isArray(kitchenItems)) {
          const foundItem = kitchenItems.find(kItem => 
            kItem.name === item_name || kItem.item_name === item_name
          );
          
          if (foundItem) {
            chefName = foundItem.assignedTo || foundItem.assigned_to || foundItem.chef_name || null;
            console.log(`Found chef from kitchen_tickets item: ${chefName}`);
          }
        }
      }
    } catch (err) {
      console.error("Error checking kitchen_tickets:", err.message);
    }
    
    if (!chefName && targetItem.assignedChef) {
      chefName = targetItem.assignedChef;
      console.log(`Found chef from order item: ${chefName}`);
    }
    
    if (!chefName && targetItem.assignedTo) {
      chefName = targetItem.assignedTo;
      console.log(`Found chef from target item assignedTo: ${chefName}`);
    }
    
    const originalPrice = Number(targetItem.price || 0);
    const originalQuantity = Number(targetItem.quantity || 1);
    const itemTotal = originalPrice * originalQuantity;

    console.log("Inserting void request with:", {
      order_id, item_name, reason, requested_by, tableName, waiterName,
      originalPrice, originalQuantity, itemTotal, chefName
    });

    const voidRes = await pool.query(
      `INSERT INTO void_requests
         (order_id, item_name, reason, requested_by,
          table_name, waiter_name, status, created_at,
          original_price, original_quantity, chef_name)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', NOW(), 
               $7, $8, $9)
       RETURNING *`,
      [order_id, item_name, reason, requested_by, tableName, waiterName, 
       originalPrice, originalQuantity, chefName]
    );

    console.log("Void request inserted, ID:", voidRes.rows[0].id);

    let found = false;
    const updatedItems = items.map(item => {
      if (!found && item.name === item_name && !item.voidRequested && !item.voidProcessed) {
        found = true; 
        return { 
          ...item, 
          voidRequested: true, 
          voidReason: reason, 
          voidRequestedBy: requested_by,
          voidRequestedAt: new Date().toISOString(),
          original_price: originalPrice,
          price: originalPrice,
          chefName: chefName
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
      message: `Void requested: ${item_name} (UGX ${itemTotal.toLocaleString()}) from Order #${order_id}${chefName ? ` - Chef: ${chefName}` : ' - No chef assigned'}`,
      meta: { reason, order_id, table: tableName, amount: itemTotal, chef_name: chefName }
    });

    res.status(201).json({ 
      success: true, 
      void_request: voidRes.rows[0],
      message: `Void request for ${item_name} sent to accountant`
    });
  } catch (err) {
    console.error('Void Request Error:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status - Update order status (FIXED: No revenue impact)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, staff_name, role, void_reason } = req.body;

  const allowed = ['Pending', 'Preparing', 'Ready', 'Delayed', 'Served', 'Closed', 'Voided'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }

  try {
    // Get current order to check if it's already paid or credit
    const currentOrder = await pool.query(
      `SELECT payment_method, status FROM orders WHERE id = $1`,
      [id]
    );
    
    if (currentOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = currentOrder.rows[0];
    
    // CRITICAL FIX: Prevent changing status of paid or credit orders to Served
    if ((order.payment_method === 'Credit' || order.payment_method === 'Paid') && status === 'Served') {
      return res.status(400).json({ 
        error: `Cannot mark ${order.payment_method === 'Credit' ? 'credit' : 'paid'} order as Served` 
      });
    }
    
    // If marking as Served, ensure payment_method is still NULL
    if (status === 'Served') {
      await pool.query(
        `UPDATE orders SET status = $1, void_reason = $2, updated_at = NOW() WHERE id = $3`,
        [status, void_reason || null, id]
      );
    } else {
      const result = await pool.query(
        `UPDATE orders SET status = $1, void_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [status, void_reason || null, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const updatedOrder = result.rows[0];
      
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

      return res.json({
        ...updatedOrder,
        items: items
      });
    }
    
    res.json({ success: true, status });
  } catch (err) {
    console.error('Update Status Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/pay - Mark order as paid (ONLY THIS AFFECTS REVENUE)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { status = 'Paid', payment_method } = req.body;

  if (!payment_method) {
    return res.status(400).json({ error: 'payment_method is required' });
  }

  try {
    // Get current order to check if it's already paid
    const currentOrder = await pool.query(
      `SELECT status, payment_method, total, table_name FROM orders WHERE id = $1`,
      [id]
    );
    
    if (currentOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = currentOrder.rows[0];
    
    // Prevent double payment
    if (order.status === 'Paid') {
      return res.status(400).json({ error: 'Order is already paid' });
    }
    
    // Update order to paid
    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, 
           payment_method = $2, 
           is_paid = true, 
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [status, payment_method, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updatedOrder = result.rows[0];
    
    let items = updatedOrder.items;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    // Mark individual items as paid
    const updatedItems = items.map(item => ({
      ...item,
      _rowPaid: true,
      payment_method: payment_method,
      paid_at: new Date().toISOString()
    }));
    
    await pool.query(
      `UPDATE orders SET items = $1 WHERE id = $2`,
      [JSON.stringify(updatedItems), id]
    );

    // Update table status if this table has no more pending orders
    if (updatedOrder.table_name && updatedOrder.table_name !== 'WALK-IN') {
      try {
        const pendingCheck = await pool.query(
          `SELECT COUNT(*) AS cnt FROM orders
           WHERE UPPER(table_name) = UPPER($1)
             AND status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled')
             AND shift_cleared = FALSE`,
          [updatedOrder.table_name]
        );
        const remaining = parseInt(pendingCheck.rows[0].cnt, 10);
        if (remaining === 0) {
          await pool.query(
            `UPDATE tables
             SET status = 'Available', last_order_id = NULL, updated_at = NOW()
             WHERE UPPER(name) = UPPER($1)`,
            [updatedOrder.table_name]
          ).catch(err => console.warn('Table update skipped:', err.message));
        }
      } catch (err) {
        console.warn('Table release check failed:', err.message);
      }
    }

    // ✅ ONLY HERE do we update daily summary (affects revenue)
    await updateDailySummary({ amount: updatedOrder.total, method: payment_method });
    
    // Record in cashier_queue
    try {
      await pool.query(
        `INSERT INTO cashier_queue 
           (order_ids, table_name, label, method, amount, status, confirmed_by, confirmed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, 'Confirmed', 'Cashier', NOW(), NOW())`,
        [
          JSON.stringify([updatedOrder.id]),
          updatedOrder.table_name || 'WALK-IN',
          `Order #${updatedOrder.id}`,
          payment_method,
          Number(updatedOrder.total),
        ]
      );
    } catch (err) {
      console.warn('Failed to record in cashier_queue:', err.message);
    }
    
    await logActivity(pool, {
      type: 'PAYMENT_CONFIRMED',
      actor: 'Cashier',
      role: 'CASHIER',
      message: `Order #${id} (${updatedOrder.table_name}) paid via ${payment_method} - UGX ${Number(updatedOrder.total).toLocaleString()}`,
      meta: { order_id: id, amount: updatedOrder.total, method: payment_method }
    });
    
    res.json({
      ...updatedOrder,
      items: updatedItems
    });
  } catch (err) {
    console.error('Pay Order Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/void-requests/:id/approve - Accountant approves void
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/void-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;
  
  try {
    const voidReq = await pool.query(
      `SELECT * FROM void_requests WHERE id = $1 AND status = 'Pending'`,
      [id]
    );
    
    if (!voidReq.rows.length) {
      return res.status(404).json({ error: 'Void request not found or already processed' });
    }
    
    const vr = voidReq.rows[0];
    
    const orderRes = await pool.query(
      `SELECT items FROM orders WHERE id = $1`,
      [vr.order_id]
    );
    
    if (orderRes.rows.length) {
      let items = orderRes.rows[0].items;
      if (typeof items === 'string') {
        items = JSON.parse(items);
      }
      
      let found = false;
      const updatedItems = items.map(item => {
        if (!found && item.name === vr.item_name && !item.voidProcessed) {
          found = true;
          return {
            ...item,
            status: 'VOIDED',
            voidProcessed: true,
            voidApprovedBy: approved_by || 'Accountant',
            voidApprovedAt: new Date().toISOString(),
            voidReason: vr.reason
          };
        }
        return item;
      });
      
      const newTotal = updatedItems
        .filter(item => item.status !== 'VOIDED' && !item.voidProcessed)
        .reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);
      
      await pool.query(
        `UPDATE orders SET items = $1, total = $2 WHERE id = $3`,
        [JSON.stringify(updatedItems), newTotal, vr.order_id]
      );
    }
    
    const result = await pool.query(
      `UPDATE void_requests 
       SET status = 'Approved', 
           approved_by = $1,
           resolved_by = $1, 
           resolved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approved_by || 'Accountant', id]
    );
    
    await logActivity(pool, {
      type: 'VOID_APPROVED',
      actor: approved_by || 'Accountant',
      role: 'ACCOUNTANT',
      message: `Approved void request for ${vr.item_name} (Order #${vr.order_id}) - Chef: ${vr.chef_name || 'Unknown'}`,
      meta: { void_id: id, order_id: vr.order_id, item: vr.item_name, chef: vr.chef_name }
    });
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Approve void error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/void-requests/:id/reject - Accountant rejects void
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/void-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { rejected_by } = req.body;
  
  try {
    const voidReq = await pool.query(
      `SELECT * FROM void_requests WHERE id = $1 AND status = 'Pending'`,
      [id]
    );
    
    if (!voidReq.rows.length) {
      return res.status(404).json({ error: 'Void request not found or already processed' });
    }
    
    const vr = voidReq.rows[0];
    
    const orderRes = await pool.query(
      `SELECT items FROM orders WHERE id = $1`,
      [vr.order_id]
    );
    
    if (orderRes.rows.length) {
      let items = orderRes.rows[0].items;
      if (typeof items === 'string') {
        items = JSON.parse(items);
      }
      
      const updatedItems = items.map(item => {
        if (item.name === vr.item_name && item.voidRequested && !item.voidProcessed) {
          return {
            ...item,
            voidRequested: false,
            voidRejected: true,
            voidRejectedBy: rejected_by || 'Accountant',
            voidRejectedAt: new Date().toISOString()
          };
        }
        return item;
      });
      
      await pool.query(
        `UPDATE orders SET items = $1 WHERE id = $2`,
        [JSON.stringify(updatedItems), vr.order_id]
      );
    }
    
    const result = await pool.query(
      `UPDATE void_requests 
       SET status = 'Rejected', 
           rejected_by = $1,
           resolved_by = $1, 
           resolved_at = NOW()
       WHERE id = $2 AND status = 'Pending'
       RETURNING *`,
      [rejected_by || 'Accountant', id]
    );
    
    await logActivity(pool, {
      type: 'VOID_REJECTED',
      actor: rejected_by || 'Accountant',
      role: 'ACCOUNTANT',
      message: `Rejected void request for ${vr.item_name} (Order #${vr.order_id})`,
      meta: { void_id: id, order_id: vr.order_id, item: vr.item_name }
    });
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Reject void error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Debug endpoint - Check staff orders
// ─────────────────────────────────────────────────────────────────────────────
router.get('/debug/staff-orders/:staffId', async (req, res) => {
  const { staffId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const allOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, payment_method,
              DATE(timestamp) as order_date, timestamp, shift_cleared
       FROM orders 
       ORDER BY id DESC 
       LIMIT 50`
    );
    
    const staffOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, payment_method,
              DATE(timestamp) as order_date, timestamp, shift_cleared
       FROM orders 
       WHERE staff_id = $1 OR waiter_name ILIKE $2 OR staff_name ILIKE $2
       ORDER BY id DESC`,
      [staffId, `%${req.query.name || ''}%`]
    );
    
    const todayOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, payment_method,
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
      todayOrdersCount: todayOrders.rows.length,
      note: "Orders only affect revenue when payment_method is set and status is 'Paid'"
    });
  } catch (err) {
    console.error('Debug error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Debug endpoint - Check void requests
// ─────────────────────────────────────────────────────────────────────────────
router.get('/debug/void-requests', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        item_name,
        chef_name,
        status,
        created_at
      FROM void_requests 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    res.json({
      count: result.rows.length,
      requests: result.rows,
      sample: result.rows[0] || null
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test endpoint
// ─────────────────────────────────────────────────────────────────────────────
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Order routes are working!', 
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /',
      'GET /cashier-queue',
      'GET /tables/all',
      'GET /cashier-history',
      'GET /credits',
      'GET /void-requests',
      'GET /void-requests/history',
      'POST /',
      'POST /void-item',
      'PATCH /:id/status',
      'PATCH /:id/pay',
      'PATCH /void-requests/:id/approve',
      'PATCH /void-requests/:id/reject',
      'GET /debug/void-requests',
      'GET /debug/staff-orders/:staffId'
    ],
    important_note: "✅ Orders only affect revenue when payment_method is set and status is 'Paid' via the /pay endpoint"
  });
});

export default router;