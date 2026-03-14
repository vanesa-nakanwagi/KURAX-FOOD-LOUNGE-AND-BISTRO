// routes/accountantRoutes.js
// Register in server.js:
//   import accountantRoutes from './routes/accountantRoutes.js';
//   app.use('/api/accountant', accountantRoutes);

import express from 'express';
import pool from '../db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Ensure physical_counts table exists (run once on startup or via schema.sql)
// CREATE TABLE IF NOT EXISTS physical_counts (
//   id           SERIAL PRIMARY KEY,
//   count_date   DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
//   cash         NUMERIC(12,2) DEFAULT 0,
//   momo_mtn     NUMERIC(12,2) DEFAULT 0,
//   momo_airtel  NUMERIC(12,2) DEFAULT 0,
//   card         NUMERIC(12,2) DEFAULT 0,
//   notes        TEXT,
//   submitted_by TEXT,
//   updated_at   TIMESTAMPTZ DEFAULT NOW()
// );
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/accountant/physical-count?date=YYYY-MM-DD
// Returns today's physical count (or empty zeros)
router.get('/physical-count', async (req, res) => {
  const date = req.query.date || (() => {
    const k = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return [k.getUTCFullYear(), String(k.getUTCMonth()+1).padStart(2,'0'), String(k.getUTCDate()).padStart(2,'0')].join('-');
  })();
  try {
    const result = await pool.query(
      `SELECT * FROM physical_counts WHERE count_date = $1`, [date]
    );
    res.json(result.rows[0] || { count_date: date, cash: 0, momo_mtn: 0, momo_airtel: 0, card: 0, notes: '', submitted_by: null });
  } catch (err) {
    console.error('physical-count fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accountant/physical-count
// Upserts physical count for today
router.post('/physical-count', async (req, res) => {
  const { cash, momo_mtn, momo_airtel, card, notes, submitted_by, count_date } = req.body;
  const date = count_date || (() => {
    const k = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return [k.getUTCFullYear(), String(k.getUTCMonth()+1).padStart(2,'0'), String(k.getUTCDate()).padStart(2,'0')].join('-');
  })();
  try {
    const result = await pool.query(
      `INSERT INTO physical_counts (count_date, cash, momo_mtn, momo_airtel, card, notes, submitted_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (count_date) DO UPDATE SET
         cash         = EXCLUDED.cash,
         momo_mtn     = EXCLUDED.momo_mtn,
         momo_airtel  = EXCLUDED.momo_airtel,
         card         = EXCLUDED.card,
         notes        = EXCLUDED.notes,
         submitted_by = EXCLUDED.submitted_by,
         updated_at   = NOW()
       RETURNING *`,
      [date, Number(cash)||0, Number(momo_mtn)||0, Number(momo_airtel)||0, Number(card)||0, notes||null, submitted_by||null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('physical-count save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/accountant/physical-count/history?days=30
// Returns last N days of physical counts
router.get('/physical-count/history', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  try {
    const result = await pool.query(
      `SELECT * FROM physical_counts
       ORDER BY count_date DESC LIMIT $1`, [days]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('physical-count history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/accountant/void-requests
// Returns all orders that have items with void_requested = true
router.get('/void-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, 
              json_agg(oi.*) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.void_requested = true
         AND oi.void_processed = false
       GROUP BY o.id
       ORDER BY o.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    // Fallback: if order_items table doesn't exist, return empty
    console.error('void-requests error:', err.message);
    res.json([]);
  }
});

// PATCH /api/accountant/void-requests/:orderId/item/:itemId/approve
router.patch('/void-requests/:orderId/item/:itemId/approve', async (req, res) => {
  const { orderId, itemId } = req.params;
  const { approved_by } = req.body;
  try {
    await pool.query(
      `UPDATE order_items
       SET void_requested = false, void_processed = true, status = 'VOIDED', price = 0
       WHERE id = $1 AND order_id = $2`,
      [itemId, orderId]
    );
    // Recalculate order total
    await pool.query(
      `UPDATE orders SET total = (
         SELECT COALESCE(SUM(price * quantity), 0) FROM order_items WHERE order_id = $1 AND status != 'VOIDED'
       ) WHERE id = $1`,
      [orderId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('void approve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/accountant/void-requests/:orderId/item/:itemId/reject
router.patch('/void-requests/:orderId/item/:itemId/reject', async (req, res) => {
  const { orderId, itemId } = req.params;
  try {
    await pool.query(
      `UPDATE order_items SET void_requested = false WHERE id = $1 AND order_id = $2`,
      [itemId, orderId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('void reject error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;