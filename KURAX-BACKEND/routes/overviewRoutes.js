import express from 'express';
import pool from '../db.js';

const router = express.Router();

// --- 1. GET SUMMARY (Matching frontend :5000/api/overview/summary) ---
router.get('/summary', async (req, res) => {
  const { date } = req.query; // Expecting YYYY-MM-DD
  try {
    const query = `
      SELECT 
        COUNT(*) as total_orders, 
        COALESCE(SUM(total), 0) as total_revenue,
        COUNT(CASE WHEN is_archived = false THEN 1 END) as active_tables
      FROM orders 
      WHERE DATE(timestamp) = $1
    `;
    const result = await pool.query(query, [date || new Date().toISOString().split('T')[0]]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Overview Summary Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 2. GET ACTIVITY LOGS (Matching frontend :5000/api/overview/logs) ---
router.get('/logs', async (req, res) => {
  const limit = req.query.limit || 5;
  try {
    const query = `
      SELECT * FROM activity_logs 
      ORDER BY created_at DESC 
      LIMIT $1
    `;
    const result = await pool.query(query, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error("Overview Logs Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 3. GET SHIFTS (Matching frontend :5000/api/overview/shifts) ---
router.get('/shifts', async (req, res) => {
  const { date } = req.query;
  try {
    const query = `
      SELECT * FROM shifts 
      WHERE shift_date = $1 
      ORDER BY start_time ASC
    `;
    const result = await pool.query(query, [date || new Date().toISOString().split('T')[0]]);
    res.json(result.rows);
  } catch (err) {
    console.error("Overview Shifts Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;