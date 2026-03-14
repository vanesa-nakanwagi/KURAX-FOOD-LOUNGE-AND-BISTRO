import express from 'express';
import pool    from '../db.js';

const router = express.Router();

// ── Kampala date helper ───────────────────────────────────────────────────────
function kampalaDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }))
    .toISOString().split('T')[0];
}

// ── SMS helper via Africa's Talking ──────────────────────────────────────────
async function sendSMS(phone, message) {
  const apiKey   = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME || 'sandbox';
  const senderId = process.env.AT_SENDER_ID || '';

  if (!apiKey || !phone) return { success: false, reason: 'no api key or phone' };

  let e164 = phone.trim().replace(/\s+/g, '');
  if (e164.startsWith('0'))   e164 = '+256' + e164.slice(1);
  if (!e164.startsWith('+'))  e164 = '+256' + e164;

  try {
    const params = new URLSearchParams({
      username,
      to:      e164,
      message,
      ...(senderId ? { from: senderId } : {}),
    });
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey,
        Accept:         'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await res.json();
    const ok   = data?.SMSMessageData?.Recipients?.[0]?.status === 'Success';
    return { success: ok, data };
  } catch (err) {
    console.error('SMS error:', err.message);
    return { success: false, err: err.message };
  }
}

async function logSMS(orderId, phone, message, event, status) {
  try {
    await pool.query(
      `INSERT INTO sms_log (order_id, phone, message, event, status) VALUES ($1,$2,$3,$4,$5)`,
      [orderId, phone, message, event, status ? 'sent' : 'failed']
    );
  } catch (e) { console.error('SMS log error:', e.message); }
}

// ── GET /api/delivery/riders ──────────────────────────────────────────────────
router.get('/riders', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const result = await pool.query(
      `SELECT id, name, phone, active, created_at
       FROM delivery_riders
       ${includeInactive ? '' : 'WHERE active = TRUE'}
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/delivery/stats (FIXES 404 ERROR) ────────────────────────────────
router.get('/stats', async (req, res) => {
  const today = kampalaDate();
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE delivery_status = 'pending')         AS pending_assignment,
         COUNT(*) FILTER (WHERE delivery_status = 'out')             AS out_for_delivery,
         COUNT(*) FILTER (WHERE delivery_status = 'delivered')       AS delivered_unpaid,
         COALESCE(SUM(total) FILTER (WHERE delivery_status = 'collected' OR status = 'Paid'), 0) AS revenue
       FROM orders
       WHERE order_type = 'delivery'
         AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $1`,
      [today]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/delivery/create ─────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const { order_id, rider_id, client_name, client_phone, delivery_address, delivery_note } = req.body;
  if (!order_id || !rider_id || !client_phone) {
    return res.status(400).json({ error: 'order_id, rider_id and client_phone are required' });
  }

  try {
    const riderRes = await pool.query(`SELECT name, phone FROM delivery_riders WHERE id = $1`, [rider_id]);
    if (!riderRes.rows.length) return res.status(404).json({ error: 'Rider not found' });
    const rider = riderRes.rows[0];

    const updatedRes = await pool.query(
      `UPDATE orders SET
         order_type       = 'delivery',
         rider_id         = $1,
         rider_name       = $2,
         client_name      = $3,
         client_phone     = $4,
         delivery_address = $5,
         delivery_note    = $6,
         delivery_status  = 'pending'
       WHERE id = $7
       RETURNING *`,
      [rider_id, rider.name, client_name?.trim() || 'Client', client_phone.trim(),
       delivery_address?.trim() || null, delivery_note?.trim() || null, order_id]
    );
    
    const order = updatedRes.rows[0];
    const confirmMsg = `Hello ${order.client_name}! Your KURAX order has been confirmed. Total: UGX ${Number(order.total).toLocaleString()}. Rider ${rider.name} will deliver shortly.`;
    const smsResult  = await sendSMS(client_phone, confirmMsg);
    await logSMS(order_id, client_phone, confirmMsg, 'order_confirmed', smsResult.success);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/delivery/orders (FIXES "NO ACTIVE DELIVERIES") ──────────────────
router.get('/orders', async (req, res) => {
  const today = kampalaDate();
  try {
    const result = await pool.query(
      `SELECT o.*, COALESCE(s.name, 'Unknown') AS staff_name
       FROM orders o
       LEFT JOIN staff s ON s.id = o.staff_id
       WHERE o.order_type = 'delivery'
         AND (o.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1
         -- Include 'pending' so Joanah sees the order right after assigning a rider
         AND o.delivery_status IN ('pending', 'out', 'delivered')
       ORDER BY o.created_at DESC`,
      [today]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/delivery/orders/:id/dispatch ───────────────────────────────────
router.patch('/orders/:id/dispatch', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE orders SET delivery_status = 'out', dispatched_at = NOW()
       WHERE id = $1 AND order_type = 'delivery' RETURNING *`,
      [id]
    );
    const order = result.rows[0];
    if (order?.client_phone) {
      const msg = `Hi ${order.client_name}! Your KURAX order is out for delivery with ${order.rider_name}. Total: UGX ${Number(order.total).toLocaleString()}.`;
      const sms = await sendSMS(order.client_phone, msg);
      await logSMS(id, order.client_phone, msg, 'out_for_delivery', sms.success);
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/delivery/orders/:id/delivered ──────────────────────────────────
router.patch('/orders/:id/delivered', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE orders SET delivery_status = 'delivered', delivered_at = NOW()
       WHERE id = $1 AND order_type = 'delivery' RETURNING *`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/delivery/rider-ledger ────────────────────────────────────────────
router.get('/rider-ledger', async (req, res) => {
  const date = req.query.date || kampalaDate();
  try {
    const summaryRes = await pool.query(
      `SELECT
         o.rider_id, o.rider_name,
         COUNT(*) AS total_orders,
         COUNT(*) FILTER (WHERE o.delivery_status = 'collected' OR o.status = 'Paid') AS paid_orders,
         COUNT(*) FILTER (WHERE o.delivery_status = 'delivered') AS delivered_unpaid,
         COALESCE(SUM(o.total), 0) AS gross_total,
         COALESCE(SUM(o.total) FILTER (WHERE o.delivery_status = 'collected' OR o.status = 'Paid'), 0) AS collected
       FROM orders o
       WHERE o.order_type = 'delivery'
         AND (o.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1
         AND o.rider_id IS NOT NULL
       GROUP BY o.rider_id, o.rider_name
       ORDER BY collected DESC`,
      [date]
    );

    const ordersRes = await pool.query(
      `SELECT o.id, o.rider_id, o.client_name, o.total, o.created_at,
         CASE
           WHEN o.delivery_status = 'collected' OR o.status = 'Paid' THEN 'collected'
           ELSE COALESCE(o.delivery_status, 'pending')
         END AS delivery_status
       FROM orders o
       WHERE o.order_type = 'delivery'
         AND (o.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1
         AND o.rider_id IS NOT NULL
       ORDER BY o.created_at DESC`,
      [date]
    );

    const ordersByRider = ordersRes.rows.reduce((acc, row) => {
      if (!acc[row.rider_id]) acc[row.rider_id] = [];
      acc[row.rider_id].push(row);
      return acc;
    }, {});

    const ledger = summaryRes.rows.map(r => ({
      ...r,
      orders: ordersByRider[r.rider_id] || []
    }));

    res.json({ date, ledger });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;