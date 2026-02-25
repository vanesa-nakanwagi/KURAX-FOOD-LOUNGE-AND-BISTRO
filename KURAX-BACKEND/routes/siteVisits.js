import express from 'express';
import pool from '../db.js';

const router = express.Router();

// POST: Track a new visit (Upsert logic)
router.post('/track', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO site_visits (visit_date, count) 
       VALUES (CURRENT_DATE, 1) 
       ON CONFLICT (visit_date) 
       DO UPDATE SET count = site_visits.count + 1`
    );
    res.status(200).json({ message: "Visit tracked" });
  } catch (err) {
    console.error("Error tracking visit:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// GET: Fetch today's total for the Dashboard
router.get('/today', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT count FROM site_visits WHERE visit_date = CURRENT_DATE"
    );
    const total = result.rows.length > 0 ? result.rows[0].count : 0;
    res.json({ totalVisits: total });
  } catch (err) {
    console.error("Error fetching daily visits:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;