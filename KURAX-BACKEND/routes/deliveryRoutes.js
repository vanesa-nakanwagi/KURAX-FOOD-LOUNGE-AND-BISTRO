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
    console.error('SMS send error:', err.message);
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

// ── POST /api/delivery/riders ─────────────────────────────────────────────────
router.post('/riders', async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO delivery_riders (name, phone) VALUES ($1, $2) RETURNING *`,
      [name.trim(), phone?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/delivery/riders/:id ───────────────────────────────────────────
router.patch('/riders/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, active } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE delivery_riders
       SET name   = COALESCE($1, name),
           phone  = COALESCE($2, phone),
           active = COALESCE($3, active)
       WHERE id = $4
       RETURNING *`,
      [name?.trim() || null, phone?.trim() || null, active ?? null, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Rider not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/delivery/riders/:id ──────────────────────────────────────────
router.delete('/riders/:id', async (req, res) => {
  try {
    await pool.query(`UPDATE delivery_riders SET active = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/delivery/orders ──────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  const today = kampalaDate();
  try {
    const result = await pool.query(
      `SELECT
         o.id, o.table_name, o.total, o.status, o.order_type,
         o.client_name, o.client_phone, o.delivery_address,
         o.delivery_status, o.delivery_note,
         o.rider_id, o.rider_name,
         o.dispatched_at, o.delivered_at,
         o.created_at, o.items,
         COALESCE(s.name, 'Unknown') AS staff_name,
         o.staff_role AS role
       FROM orders o
       LEFT JOIN staff s ON s.id = o.staff_id
       WHERE o.order_type = 'delivery'
         AND (o.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1
       ORDER BY o.created_at DESC`,
      [today]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/delivery/create ─────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const {
    order_id, cashier_queue_id, rider_id,
    client_name, client_phone, delivery_address, delivery_note, cashier_name
  } = req.body || {};

  if (!rider_id || !client_phone) {
    return res.status(400).json({ error: 'rider_id and client_phone are required' });
  }

  let resolvedOrderId = order_id;
  if (!resolvedOrderId && cashier_queue_id) {
    try {
      const qRes = await pool.query(`SELECT order_ids FROM cashier_queue WHERE id = $1`, [cashier_queue_id]);
      if (qRes.rows.length && qRes.rows[0].order_ids?.length) {
        resolvedOrderId = qRes.rows[0].order_ids[0];
      }
    } catch (e) { /* fall through */ }
  }

  if (!resolvedOrderId) {
    return res.status(400).json({ error: 'Could not resolve order_id' });
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
       delivery_address?.trim() || null, delivery_note?.trim() || null, resolvedOrderId]
    );
    if (!updatedRes.rows.length) return res.status(404).json({ error: `Order #${resolvedOrderId} not found` });
    const order = updatedRes.rows[0];

    const confirmMsg = `Hello ${order.client_name || 'there'}! Your order at KURAX Food Lounge has been confirmed. Total: UGX ${Number(order.total).toLocaleString()}. Your rider ${rider.name} will deliver shortly.`;
    const smsResult  = await sendSMS(client_phone, confirmMsg);
    await logSMS(resolvedOrderId, client_phone, confirmMsg, 'order_confirmed', smsResult.success);

    res.json({ success: true, order, smsSent: smsResult.success });
  } catch (err) {
    console.error('Create delivery error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/delivery/orders/:id/dispatch ───────────────────────────────────
router.patch('/orders/:id/dispatch', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE orders SET
         delivery_status = 'out',
         dispatched_at   = NOW()
       WHERE id = $1 AND order_type = 'delivery'
       RETURNING *`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = result.rows[0];

    if (order.client_phone) {
      const msg = `Hi ${order.client_name || 'there'}! Your KURAX order is now out for delivery with rider ${order.rider_name}. Expected arrival: 20–40 mins. Total: UGX ${Number(order.total).toLocaleString()}.`;
      const sms = await sendSMS(order.client_phone, msg);
      await logSMS(Number(id), order.client_phone, msg, 'out_for_delivery', sms.success);
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/delivery/orders/:id/delivered ──────────────────────────────────
// FIXED: guard req.body against undefined — was crashing at line 253 with
// "Cannot destructure property 'payment_confirmed' of undefined"
router.patch('/orders/:id/delivered', async (req, res) => {
  const { id } = req.params;
  const {
    payment_confirmed = false,
    payment_method    = 'Cash',
    amount_collected  = null,
    confirmed_by      = 'Cashier',
  } = req.body || {};   // ← THE FIX: `|| {}` prevents the crash

  try {
    const newStatus = payment_confirmed ? 'paid' : 'delivered';
    const result = await pool.query(
      `UPDATE orders SET
         delivery_status = $1,
         delivered_at    = NOW()
       WHERE id = $2 AND order_type = 'delivery'
       RETURNING *`,
      [newStatus, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = result.rows[0];

    // ── When rider brings cash/momo back, record in cashier_queue ────────────
    // This makes the payment show up in today's totals on the cashier dashboard.
    if (payment_confirmed) {
      try {
        await pool.query(
          `INSERT INTO cashier_queue
             (order_ids, table_name, label, method, amount, status,
              confirmed_by, confirmed_at, created_at)
           VALUES ($1::jsonb, $2, $3, $4, $5, 'Confirmed', $6, NOW(), NOW())`,
          [
            JSON.stringify([Number(id)]),
            order.table_name || 'DELIVERY',
            `Delivery Return – ${order.client_name || order.table_name || 'Order'}`,
            payment_method,
            Number(amount_collected || order.total || 0),
            confirmed_by,
          ]
        );
      } catch (qErr) {
        // Non-fatal — delivery still marked paid even if history fails
        console.warn('cashier_queue delivery insert skipped:', qErr.message);
      }

      if (order.client_phone) {
        const msg = `Thank you ${order.client_name || ''}! Your KURAX delivery is complete. UGX ${Number(order.total).toLocaleString()} received. Thank you for choosing KURAX Food Lounge!`;
        const sms = await sendSMS(order.client_phone, msg);
        await logSMS(Number(id), order.client_phone, msg, 'delivered', sms.success);
      }
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error('delivered patch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/delivery/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const today = kampalaDate();
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*)                                                    AS total,
         COUNT(*) FILTER (WHERE delivery_status = 'out')            AS out_for_delivery,
         COUNT(*) FILTER (WHERE delivery_status = 'delivered')      AS delivered_unpaid,
         COUNT(*) FILTER (WHERE delivery_status = 'paid')           AS paid,
         COUNT(*) FILTER (WHERE delivery_status = 'pending')        AS pending,
         COALESCE(SUM(total) FILTER (WHERE delivery_status = 'paid'), 0) AS revenue
       FROM orders
       WHERE order_type = 'delivery'
         AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $1`,
      [today]
    );
    // Always return an object — never crash
    res.json(result.rows[0] || { total:0, out_for_delivery:0, delivered_unpaid:0, paid:0, pending:0, revenue:0 });
  } catch (err) {
    console.error('Delivery stats error:', err.message);
    res.json({ total:0, out_for_delivery:0, delivered_unpaid:0, paid:0, pending:0, revenue:0 });
  }
});

// ── GET /api/delivery/rider-ledger ────────────────────────────────────────────
router.get('/rider-ledger', async (req, res) => {
  const date = req.query.date || kampalaDate();
  try {
    const summaryRes = await pool.query(
      `SELECT
         o.rider_id, o.rider_name,
         COUNT(*)                                                          AS total_orders,
         COUNT(*) FILTER (WHERE o.delivery_status='paid' OR o.status='Paid') AS paid_orders,
         COUNT(*) FILTER (WHERE o.delivery_status = 'out')                AS out_orders,
         COUNT(*) FILTER (WHERE o.delivery_status = 'pending')            AS pending_orders,
         COUNT(*) FILTER (WHERE o.delivery_status = 'delivered')          AS delivered_unpaid,
         COALESCE(SUM(o.total), 0)                                        AS gross_total,
         COALESCE(SUM(o.total) FILTER (
           WHERE o.delivery_status='paid' OR o.status='Paid'
         ), 0) AS collected
       FROM orders o
       WHERE o.order_type = 'delivery'
         AND (o.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1
         AND o.rider_id IS NOT NULL
       GROUP BY o.rider_id, o.rider_name
       ORDER BY collected DESC`,
      [date]
    );

    const ordersRes = await pool.query(
      `SELECT
         o.id, o.rider_id, o.rider_name,
         o.client_name, o.client_phone, o.delivery_address,
         CASE WHEN o.delivery_status='paid' OR o.status='Paid' THEN 'paid'
              ELSE COALESCE(o.delivery_status,'pending') END AS delivery_status,
         o.total, o.table_name, o.dispatched_at, o.delivered_at, o.created_at,
         COALESCE(s.name,'Unknown') AS cashier_name
       FROM orders o
       LEFT JOIN staff s ON s.id = o.staff_id
       WHERE o.order_type = 'delivery'
         AND (o.created_at AT TIME ZONE 'Africa/Nairobi')::date = $1
         AND o.rider_id IS NOT NULL
       ORDER BY o.rider_id, o.created_at DESC`,
      [date]
    );

    const ordersByRider = ordersRes.rows.reduce((acc, row) => {
      const key = row.rider_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});

    const ledger = summaryRes.rows.map(rider => ({
      ...rider,
      orders: ordersByRider[rider.rider_id] || [],
    }));

    res.json({ date, ledger });
  } catch (err) {
    console.error('Rider ledger error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;