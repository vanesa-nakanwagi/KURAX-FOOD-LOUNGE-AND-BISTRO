import express from 'express';
import pool from '../db.js';
import { updateDailySummary } from '../helpers/summaryHelper.js';
import logActivity from '../utils/logsActivity.js'; // Added Logger

const router = express.Router();

/**
 * 1. FETCH ALL ORDERS
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, COALESCE(s.name, 'Unknown Staff') as staff_name 
      FROM orders o 
      LEFT JOIN staff s ON o.staff_id = s.id 
      ORDER BY o.timestamp DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch Orders Error:', err.message);
    res.status(500).json({ error: "Could not retrieve orders" });
  }
});

/**
 * 2. POST NEW ORDER
 */
router.post('/', async (req, res) => {
  const { staffId, staffRole, isPermitted, tableName, items, total, paymentMethod } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO orders (
        staff_id, staff_role, is_permitted, table_name,
        items, total, payment_method, status, date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', CURRENT_DATE)
      RETURNING *`,
      [
        staffId       || 1,
        staffRole     || 'WAITER',
        isPermitted   || false,
        tableName     || 'WALK-IN',
        JSON.stringify(items),
        total,
        paymentMethod || 'Cash'
      ]
    );
    
    const newOrder = result.rows[0];

    // ─── LOG: ORDER CREATED ───
    await logActivity(pool, {
      type: 'ORDER_SENT',
      actor: `Staff ID: ${staffId}`,
      role: staffRole,
      message: `New order sent to kitchen for ${tableName}`,
      meta: { order_id: newOrder.id, total, item_count: items.length }
    });

    console.log("✅ Order Synced and Logged Successfully!");
    res.status(201).json(newOrder);
  } catch (err) {
    console.error("❌ DATABASE INSERT ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. PATCH ORDER STATUS (Updated for Voided + Reasons)
 */
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, staff_name, role, void_reason } = req.body; // Added void_reason here

  // 1. Add 'Voided' to the allowed list
  const allowed = ['Pending', 'Preparing', 'Ready', 'Delayed', 'Served', 'Closed', 'Voided'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }

  try {
    // 2. Update the SQL to handle the void_reason column
    // Note: Ensure you have added a 'void_reason' column to your 'orders' table in PostgreSQL
    const result = await pool.query(
      `UPDATE orders SET status = $1, void_reason = $2 WHERE id = $3 RETURNING *`,
      [status, void_reason || null, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    
    const updatedOrder = result.rows[0];

    // ─── LOG: STATUS UPDATE ───
    await logActivity(pool, {
      type: status === 'Voided' ? 'ORDER_VOIDED' : 'STATUS_UPDATE',
      actor: staff_name || 'System',
      role: role || 'STAFF',
      message: status === 'Voided' 
        ? `Order #${id} was VOIDED. Reason: ${void_reason}` 
        : `Order #${id} (${updatedOrder.table_name}) is now ${status}`,
      meta: { status, order_id: id, reason: void_reason }
    });

    res.json(updatedOrder);
  } catch (err) {
    console.error('Update Status Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. PATCH ORDER PAYMENT
 */
router.patch('/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { status = 'Paid', payment_method, cashier_name } = req.body;

  if (!payment_method) {
    return res.status(400).json({ error: 'payment_method is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, payment_method = $2, paid_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [status, payment_method, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const order = result.rows[0];
    await updateDailySummary({ amount: order.total, method: payment_method });

    // ─── LOG: PAYMENT ───
    await logActivity(pool, {
      type: 'PAYMENT_CONFIRMED',
      actor: cashier_name || 'Cashier',
      role: 'CASHIER',
      message: `Confirmed ${payment_method} payment of UGX ${order.total} for ${order.table_name}`,
      meta: { amount: order.total, method: payment_method, order_id: id }
    });

    res.json(order);
  } catch (err) {
    console.error('Payment Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. POST VOID ITEM REQUEST
 */
router.post('/void-item', async (req, res) => {
  const { order_id, item_name, reason, requested_by } = req.body;

  if (!order_id || !item_name || !reason) {
    return res.status(400).json({ error: 'order_id, item_name, and reason are required' });
  }

  try {
    const voidRes = await pool.query(
      `INSERT INTO void_requests (order_id, item_name, reason, requested_by, status, created_at)
       VALUES ($1, $2, $3, $4, 'Pending', NOW())
       RETURNING *`,
      [order_id, item_name, reason, requested_by || 'Unknown Staff']
    );

    const orderRes = await pool.query(`SELECT items FROM orders WHERE id = $1`, [order_id]);

    if (orderRes.rows.length > 0) {
      let items = orderRes.rows[0].items;
      if (typeof items === 'string') items = JSON.parse(items);

      let patched = false;
      const updatedItems = items.map(item => {
        if (!patched && item.name === item_name && !item.voidRequested) {
          patched = true;
          return { ...item, voidRequested: true, voidReason: reason, voidRequestedBy: requested_by };
        }
        return item;
      });

      await pool.query(`UPDATE orders SET items = $1 WHERE id = $2`, [JSON.stringify(updatedItems), order_id]);
    }

    // ─── LOG: VOID REQUESTED ───
    await logActivity(pool, {
      type: 'VOID_REQUESTED',
      actor: requested_by,
      role: 'WAITER',
      message: `Void requested for ${item_name} (Order #${order_id})`,
      meta: { reason, order_id }
    });

    res.status(201).json(voidRes.rows[0]);
  } catch (err) {
    console.error('Void Request Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 6. GET PENDING VOID REQUESTS
 */
router.get('/void-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         vr.*,
         o.table_name,
         o.total         AS order_total,
         o.items         AS order_items,
         COALESCE(s.name, vr.requested_by) AS waiter_name
       FROM void_requests vr
       LEFT JOIN orders o  ON vr.order_id = o.id
       LEFT JOIN staff  s  ON o.staff_id  = s.id
       WHERE vr.status = 'Pending'
       ORDER BY vr.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Void requests fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 7. PATCH VOID REQUEST — APPROVE
 */
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

    // ─── LOG: VOID APPROVED ───
    await logActivity(pool, {
      type: 'VOID_APPROVED',
      actor: approved_by || 'Accountant',
      role: 'ACCOUNTANT',
      message: `Approved void for ${vr.item_name} on Order #${vr.order_id}`,
      meta: { void_id: id, order_id: vr.order_id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Void approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 7. PATCH VOID REQUEST — REJECT
 */
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

      await pool.query(`UPDATE orders SET items = $1 WHERE id = $2`, [JSON.stringify(updatedItems), vr.order_id]);
    }

    // ─── LOG: VOID REJECTED ───
    await logActivity(pool, {
      type: 'VOID_REJECTED',
      actor: rejected_by || 'Accountant',
      role: 'ACCOUNTANT',
      message: `Rejected void for ${vr.item_name} on Order #${vr.order_id}`,
      meta: { void_id: id, order_id: vr.order_id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Void reject error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 8. PATCH ASSIGN CHEF
 */
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

    // ─── LOG: CHEF ASSIGNED ───
    await logActivity(pool, {
      type: 'CHEF_ASSIGNED',
      actor: assigned_by,
      role: 'MANAGER',
      message: `Assigned Chef ${assigned_to} to ${item_name} (Order #${id})`,
      meta: { chef: assigned_to, item: item_name }
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Assign Chef Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;