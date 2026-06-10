// routes/weeklyRevenueRoutes.js
import express from "express";
import pool from "../db.js";

const router = express.Router();
// GET /api/overview/monthly-revenue
router.get("/monthly-revenue", async (req, res) => {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ error: "Month parameter is required (YYYY-MM)" });
  }
  
  console.log(`🔵 Fetching revenue for month: ${month}`);

  try {
    // 1. New sales (cash + card + mobile money) from orders
    const salesResult = await pool.query(`
      SELECT 
        EXTRACT(DAY FROM (created_at AT TIME ZONE 'Africa/Nairobi')) AS day,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'card' THEN total ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('mtn','momo-mtn','airtel','momo-airtel') THEN total ELSE 0 END), 0) AS momo
      FROM orders
      WHERE TO_CHAR(created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND payment_confirmed = true
        AND LOWER(status) IN ('paid', 'closed', 'confirmed', 'served')
        AND LOWER(payment_method) NOT IN ('credit', '')
      GROUP BY EXTRACT(DAY FROM (created_at AT TIME ZONE 'Africa/Nairobi'))
    `, [month]);

    // 2. Credit settlements for the month
    const creditResult = await pool.query(`
      SELECT 
        EXTRACT(DAY FROM (cs.created_at AT TIME ZONE 'Africa/Nairobi')) AS day,
        COALESCE(SUM(cs.amount_paid), 0) AS credit_settled
      FROM credit_settlements cs
      JOIN credits c ON cs.credit_id = c.id
      WHERE TO_CHAR(cs.created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND c.status IN ('FullySettled', 'PartiallySettled')
      GROUP BY EXTRACT(DAY FROM (cs.created_at AT TIME ZONE 'Africa/Nairobi'))
    `, [month]);

    // Create a map of sales per day
    const salesMap = new Map();
    salesResult.rows.forEach(row => {
      salesMap.set(parseInt(row.day), {
        cash: Number(row.cash),
        card: Number(row.card),
        momo: Number(row.momo)
      });
    });

    // Create a map of credit settlements per day
    const creditMap = new Map();
    creditResult.rows.forEach(row => {
      creditMap.set(parseInt(row.day), Number(row.credit_settled));
    });

    // Get the last day of the month
    const [year, monthNum] = month.split('-');
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

    // Build response for all days in the month
    const response = [];
    for (let day = 1; day <= lastDay; day++) {
      const sales = salesMap.get(day) || { cash: 0, card: 0, momo: 0 };
      const credit = creditMap.get(day) || 0;
      response.push({
        date: day,
        cash: sales.cash,
        card: sales.card,
        momo: sales.momo,
        credit_settled: credit,
        gross: sales.cash + sales.card + sales.momo
      });
    }

    console.log(`✅ Retrieved ${response.length} days for ${month}`);
    res.json(response);
  } catch (err) {
    console.error("Monthly revenue query failed:", err);
    res.status(500).json({ error: err.message });
  }
});
// GET /api/overview/monthly-revenue
router.get("/monthly-revenue", async (req, res) => {
  const { month } = req.query;
  if (!month) {
    return res.status(400).json({ error: "Month parameter is required (YYYY-MM)" });
  }
  
  console.log(`🔵 Fetching revenue for month: ${month}`);
  
  try {
    const result = await pool.query(`
      SELECT 
        EXTRACT(DAY FROM summary_date) as day,
        COALESCE(total_cash, 0) as cash,
        COALESCE(total_card, 0) as card,
        COALESCE(total_mtn + total_airtel, 0) as momo,
        COALESCE(total_settled_credits, 0) as credit_settled,
        COALESCE(total_gross, 0) as gross
      FROM daily_summary 
      WHERE TO_CHAR(summary_date, 'YYYY-MM') = $1
      ORDER BY summary_date ASC
    `, [month]);
    
    const response = result.rows.map(row => ({
      date: row.day,
      cash: Number(row.cash),
      card: Number(row.card),
      momo: Number(row.momo),
      credit_settled: Number(row.credit_settled),
      gross: Number(row.gross)
    }));
    
    console.log(`✅ Retrieved ${response.length} days for ${month}`);
    res.json(response);
    
  } catch (err) {
    console.error("Monthly revenue query failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;