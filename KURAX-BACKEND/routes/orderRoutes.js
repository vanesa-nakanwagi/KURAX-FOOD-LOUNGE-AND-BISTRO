import express from 'express';
import pool from '../db.js';

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
    const query = `
      INSERT INTO orders (
        staff_id, 
        staff_role, 
        is_permitted, 
        table_name, 
        items, 
        total, 
        payment_method, 
        status, 
        date
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending', CURRENT_DATE) 
      RETURNING *
    `;

    const values = [
      staffId || 1,
      staffRole || 'WAITER',
      isPermitted || false,
      tableName || 'WALK-IN',
      JSON.stringify(items),
      total,
      paymentMethod || 'Cash'
    ];

    const result = await pool.query(query, values);
    console.log("✅ Order Synced to Database Successfully!");
    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error("❌ DATABASE INSERT ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. PATCH ORDER STATUS (Kitchen marks Ready, Waiter marks Served)
 *    PATCH /api/orders/:id/status
 *    Body: { status: "Ready" | "Served" | "Preparing" | "Delayed" }
 */
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ['Pending', 'Preparing', 'Ready', 'Delayed', 'Served', 'Closed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log(`✅ Order #${id} status updated to: ${status}`);
    res.json(result.rows[0]);

  } catch (err) {
    console.error('Update Status Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. PATCH ORDER PAYMENT (Waiter collects payment)
 *    PATCH /api/orders/:id/pay
 *    Body: { status: "Paid", payment_method: "Cash" | "Card" | "Momo-MTN" | "Momo-AIRTEL" }
 */
router.patch('/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { status = 'Paid', payment_method } = req.body;

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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log(`✅ Order #${id} marked as ${status} via ${payment_method}`);
    res.json(result.rows[0]);

  } catch (err) {
    console.error('Payment Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. POST VOID ITEM REQUEST (Waiter requests to remove an item)
 *    POST /api/orders/void-item
 *    Body: { order_id, item_name, reason, requested_by }
 *
 *    This logs the void request to a void_requests table.
 *    Make sure you run the SQL below to create the table if it doesn't exist:
 *
 *    CREATE TABLE IF NOT EXISTS void_requests (
 *      id SERIAL PRIMARY KEY,
 *      order_id INTEGER REFERENCES orders(id),
 *      item_name TEXT NOT NULL,
 *      reason TEXT NOT NULL,
 *      requested_by TEXT NOT NULL,
 *      status TEXT DEFAULT 'Pending',
 *      created_at TIMESTAMPTZ DEFAULT NOW()
 *    );
 */
router.post('/void-item', async (req, res) => {
  const { order_id, item_name, reason, requested_by } = req.body;

  if (!order_id || !item_name || !reason) {
    return res.status(400).json({ error: 'order_id, item_name, and reason are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO void_requests (order_id, item_name, reason, requested_by, status, created_at)
       VALUES ($1, $2, $3, $4, 'Pending', NOW())
       RETURNING *`,
      [order_id, item_name, reason, requested_by || 'Unknown Staff']
    );

    console.log(`🗑️ Void request logged: ${item_name} from Order #${order_id} by ${requested_by}`);
    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Void Request Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/assign-chef
router.patch('/:id/assign-chef', async (req, res) => {
  const { id } = req.params;
  const { items, item_name, assigned_to, assigned_at, assigned_by } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders SET items = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(items), id]
    );

    // Log to chef_assignments table for accountability trail
    await pool.query(
      `INSERT INTO chef_assignments (order_id, item_name, assigned_to, assigned_at, assigned_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, item_name, assigned_to, assigned_at, assigned_by]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;