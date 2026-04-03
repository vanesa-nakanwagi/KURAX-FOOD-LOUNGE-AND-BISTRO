import express from 'express';
import pool from '../db.js';

const router = express.Router();

// 1. GET ANALYTICS (Standardized for all payment types)
router.get('/analytics/daily', async (req, res) => {
  try {
    const query = `
      SELECT 
        COALESCE(SUM(total), 0) AS total_gross,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%MTN%' THEN total ELSE 0 END), 0) AS mtn_total,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS airtel_total,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CARD%' OR payment_method ILIKE '%VISA%' OR payment_method ILIKE '%POS%' THEN total ELSE 0 END), 0) AS card_total,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CASH%' THEN total ELSE 0 END), 0) AS cash_total
      FROM orders 
      WHERE DATE(timestamp) = CURRENT_DATE AND is_archived = true
    `;
    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. FLOOR MONITORING (Standardized for Manager oversight)
router.get('/floor-monitor', async (req, res) => {
  try {
    const query = `
      SELECT 
        table_name, 
        waiter_name, 
        total, 
        timestamp AS start_time,
        is_archived,
        (EXTRACT(EPOCH FROM (NOW() - timestamp)) / 60)::INTEGER AS minutes_active
      FROM orders 
      WHERE is_archived = false 
         OR (is_archived = true AND timestamp > NOW() - INTERVAL '1 hour')
      ORDER BY is_archived ASC, timestamp DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/target-progress', async (req, res) => {
  try {
    const monthKey = new Date().toISOString().substring(0, 7);
    
    const query = `
      SELECT 
        (SELECT COALESCE(SUM(total), 0) FROM orders 
         WHERE timestamp >= date_trunc('month', CURRENT_DATE) 
         AND status IN ('Paid', 'Closed')) AS current_total,
        (SELECT revenue_goal FROM business_targets WHERE month_key = $1) AS target_goal
    `;
    const result = await pool.query(query, [monthKey]);
    
    // Fallback to 6,000,000 if the database row doesn't exist yet
    const targetGoal = result.rows[0].target_goal ? parseFloat(result.rows[0].target_goal) : 6000000;
    const currentTotal = parseFloat(result.rows[0].current_total || 0);
    
    const percentage = targetGoal > 0 ? ((currentTotal / targetGoal) * 100).toFixed(2) : 0;

    res.json({
      target: targetGoal,
      current: currentTotal,
      percentage: parseFloat(percentage)
    });
  } catch (err) {
    console.error("Target Progress Crash:", err.message);
    res.status(500).json({ error: "Check if business_targets table exists in DB." });
  }
});

// KURAX-BACKEND/routes/managerRoutes.js

router.post('/targets', async (req, res) => {
    // We default waiter_quota to 0 if it's not provided in the request
    const { month_key, revenue_goal, waiter_quota = 0 } = req.body;
    
    try {
        const query = `
            INSERT INTO business_targets (month_key, revenue_goal, waiter_quota)
            VALUES ($1, $2, $3)
            ON CONFLICT (month_key) 
            DO UPDATE SET 
                revenue_goal = EXCLUDED.revenue_goal,
                waiter_quota = COALESCE(EXCLUDED.waiter_quota, business_targets.waiter_quota)
            RETURNING *;
        `;
        const result = await pool.query(query, [month_key, revenue_goal, waiter_quota]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Database Error:", err.message);
        res.status(500).json({ error: "Database sync failed" });
    }
});
// Save Daily Order Goal
router.post('/staff-goals', async (req, res) => {
    const { order_count_goal } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO staff_order_goals (target_date, order_count_goal)
             VALUES (CURRENT_DATE, $1)
             ON CONFLICT (target_date) DO UPDATE SET order_count_goal = EXCLUDED.order_count_goal
             RETURNING *`,
            [order_count_goal]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Daily Order Goal
router.get('/staff-goals/today', async (req, res) => {
    try {
        const result = await pool.query(`SELECT order_count_goal FROM staff_order_goals WHERE target_date = CURRENT_DATE`);
        res.json(result.rows[0] || { order_count_goal: 20 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;