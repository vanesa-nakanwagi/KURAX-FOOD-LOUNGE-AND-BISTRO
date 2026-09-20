import express from 'express';
import pool from '../db.js';

const router = express.Router();

function kampalaDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }))
    .toISOString().split('T')[0];
}

router.post('/tickets', async (req, res) => {
  const { order_id, table_name, staff_name, items = [], total = 0, status = 'Pending' } = req.body;
  if (!order_id || !table_name) return res.status(400).json({ error: 'order_id and table_name are required' });

  try {
    const result = await pool.query(
      `INSERT INTO shisha_tickets
        (order_id, table_name, staff_name, items, total, status, ticket_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (order_id) DO UPDATE SET
         items = EXCLUDED.items, status = EXCLUDED.status,
         staff_name = EXCLUDED.staff_name, updated_at = NOW()
       RETURNING *`,
      [order_id, table_name, staff_name || null, JSON.stringify(items), Number(total) || 0, status, kampalaDate()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Shisha ticket upsert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/tickets', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM shisha_tickets WHERE ticket_date = $1 ORDER BY created_at ASC',
      [req.query.date || kampalaDate()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/tickets/:id/status', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE shisha_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [req.body.status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Shisha ticket not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
