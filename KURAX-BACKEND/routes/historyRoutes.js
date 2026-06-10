import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Kampala date helper
function kampalaDate() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

// ── GET /api/history/orders ───────────────────────────────────────────────────
// Returns paginated order history, newest first.
// Query params:
//   limit        — max rows to return (default 100)
//   date         — filter to a specific YYYY-MM-DD (Kampala time, optional)
//   staff_id     — filter to a specific staff member (optional)
//   status       — filter to a specific status e.g. "Paid" (optional)
//   from / to    — date range YYYY-MM-DD (optional, ignored if date is set)
router.get('/orders', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  try {
    // 1. Orders (excluding ghost orders)
    const ordersResult = await pool.query(`
      SELECT
        o.id AS source_id,
        'order' AS type,
        o.table_name,
        COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name,
        COALESCE(s.role, 'WAITER') AS role,
        o.total AS amount,
        CASE 
          WHEN o.payment_method IS NOT NULL AND o.payment_method != '' THEN o.payment_method
          WHEN LOWER(o.status) = 'credit' THEN 'Credit'
          ELSE '—'
        END AS method,
        o.created_at AS date,
        o.status,
        NULL AS settle_method,
        NULL AS client_name,
        NULL AS client_phone
      FROM orders o
      LEFT JOIN staff s ON s.id = o.staff_id
      WHERE (o.payment_method IS NOT NULL AND o.payment_method != '')
         OR LOWER(o.status) = 'credit'
      ORDER BY o.created_at DESC
      LIMIT $1
    `, [limit]);

    // 2. Credit settlements with "Partial Settlement" vs "Settled" status
    const settlementsResult = await pool.query(`
      WITH credit_balance AS (
        SELECT 
          c.id AS credit_id,
          c.amount AS original_amount,
          COALESCE(SUM(cs2.amount_paid), 0) AS total_settled
        FROM credits c
        LEFT JOIN credit_settlements cs2 ON cs2.credit_id = c.id
        GROUP BY c.id, c.amount
      )
      SELECT
        cs.id AS source_id,
        'credit_settlement' AS type,
        c.table_name,
        COALESCE(s.name, o.staff_name, c.waiter_name, c.requested_by, 'Unknown') AS staff_name,
        COALESCE(s.role, 'WAITER') AS role,
        cs.amount_paid AS amount,
        CONCAT('credit/', LOWER(cs.method)) AS method,
        cs.created_at AS date,
        CASE 
          WHEN cb.total_settled >= cb.original_amount THEN 'Settled'
          ELSE 'Partial Settlement'
        END AS status,
        cs.method AS settle_method,
        c.client_name,
        c.client_phone
      FROM credit_settlements cs
      JOIN credits c ON cs.credit_id = c.id
      JOIN credit_balance cb ON cb.credit_id = c.id
      LEFT JOIN orders o ON o.id = c.order_id
      LEFT JOIN staff s ON s.id = o.staff_id
      ORDER BY cs.created_at DESC
      LIMIT $1
    `, [limit]);

    let all = [...ordersResult.rows, ...settlementsResult.rows];
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(all.slice(0, limit));
  } catch (err) {
    console.error('History orders error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/history/orders/:id ───────────────────────────────────────────────
// Single order detail with full items breakdown
router.get('/orders/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name, COALESCE(s.role, 'WAITER') AS role
       FROM orders o
       LEFT JOIN staff s ON s.id = o.staff_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('History order detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/history/shifts ───────────────────────────────────────────────────
// Returns all shift records from staff_shifts, newest first.
// Query params:
//   limit        — max rows (default 100, cap 500)
//   date         — single day YYYY-MM-DD (optional)
//   from / to    — date range (optional)
//   staff_id     — filter by staff (optional)
router.get('/shifts', async (req, res) => {
  const limit   = Math.min(parseInt(req.query.limit) || 100, 500);
  const date    = req.query.date    || null;
  const from    = req.query.from    || null;
  const to      = req.query.to      || null;
  const staffId = req.query.staff_id || null;

  try {
    const conditions = [];
    const params     = [];

    if (date) {
      params.push(date);
      conditions.push(`shift_date = $${params.length}`);
    } else if (from && to) {
      params.push(from); conditions.push(`shift_date >= $${params.length}`);
      params.push(to);   conditions.push(`shift_date <= $${params.length}`);
    }

    if (staffId) {
      params.push(staffId);
      conditions.push(`staff_id = $${params.length}`);
    }

    params.push(limit);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         ss.id, ss.staff_id, ss.role,
         COALESCE(
           CASE WHEN ss.staff_name ~ '^[0-9,.]+$' THEN NULL ELSE NULLIF(ss.staff_name,'') END,
           s.name,
           'Unknown'
         ) AS staff_name,
         ss.total_orders,
         ss.total_cash, ss.total_mtn, ss.total_airtel, ss.total_card,
         ss.gross_total,
         ss.shift_date,
         ss.created_at AS clock_out
       FROM staff_shifts ss
       LEFT JOIN staff s ON s.id = ss.staff_id
       ${whereClause.replace('WHERE ', 'WHERE ss.')}
       ORDER BY ss.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    // Compute total_momo and net_digital for convenience
    const rows = result.rows.map(r => ({
      ...r,
      total_momo:    Number(r.total_mtn || 0) + Number(r.total_airtel || 0),
      total_digital: Number(r.total_mtn || 0) + Number(r.total_airtel || 0) + Number(r.total_card || 0),
    }));

    res.json(rows);
  } catch (err) {
    console.error('History shifts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;