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
  const limit    = Math.min(parseInt(req.query.limit)  || 100, 500); // cap at 500
  const date     = req.query.date     || null;
  const staffId  = req.query.staff_id || null;
  const status   = req.query.status   || null;
  const from     = req.query.from     || null;
  const to       = req.query.to       || null;

  try {
    // Build WHERE clauses dynamically
    const conditions = [];
    const params     = [];

    if (date) {
      // Single day — cast to Kampala timezone so late-night orders aren't missed
      params.push(date);
      conditions.push(`(o.created_at AT TIME ZONE 'Africa/Nairobi')::date = $${params.length}`);
    } else if (from && to) {
      params.push(from); conditions.push(`(o.created_at AT TIME ZONE 'Africa/Nairobi')::date >= $${params.length}`);
      params.push(to);   conditions.push(`(o.created_at AT TIME ZONE 'Africa/Nairobi')::date <= $${params.length}`);
    }

    if (staffId) {
      params.push(staffId);
      conditions.push(`o.staff_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    params.push(limit);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         o.*,
         COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name, COALESCE(s.role, 'WAITER') AS role
       FROM orders o
       LEFT JOIN staff s ON s.id = o.staff_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json(result.rows);
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