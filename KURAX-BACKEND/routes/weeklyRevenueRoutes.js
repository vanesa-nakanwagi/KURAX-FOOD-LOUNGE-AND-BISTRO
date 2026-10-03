// routes/weeklyRevenueRoutes.js
import express from "express";
import pool from "../db.js";
import { calculateMonthlyFinancials } from "../helpers/monthlyFinancials.js";

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
        EXTRACT(DAY FROM (COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi')) AS day,
        COALESCE(SUM(total), 0) AS gross_sales,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'card' THEN total ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('mtn','momo-mtn','airtel','momo-airtel') THEN total ELSE 0 END), 0) AS momo
      FROM orders
      WHERE TO_CHAR(COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND (is_archived = true OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'served'))
        AND payment_confirmed = true
        AND UPPER(COALESCE(payment_method, '')) NOT LIKE '%CREDIT%'
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.original_order_ids IS NOT NULL
            AND o2.original_order_ids::text LIKE '%' || orders.id::text || '%'
        )
      GROUP BY EXTRACT(DAY FROM (COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi'))
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

    const pettyResult = await pool.query(`
      SELECT
        EXTRACT(DAY FROM entry_date) AS day,
        COALESCE(SUM(amount), 0) AS expenses
      FROM petty_cash
      WHERE TO_CHAR(entry_date, 'YYYY-MM') = $1 AND direction = 'OUT'
      GROUP BY EXTRACT(DAY FROM entry_date)
    `, [month]);

    // Create a map of sales per day
    const salesMap = new Map();
    salesResult.rows.forEach(row => {
      salesMap.set(parseInt(row.day), {
        grossSales: Number(row.gross_sales),
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

    const pettyMap = new Map();
    pettyResult.rows.forEach(row => {
      pettyMap.set(parseInt(row.day), Number(row.expenses));
    });

    // Get the last day of the month
    const [year, monthNum] = month.split('-');
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0).getDate();

    // Build response for all days in the month
    const response = [];
    for (let day = 1; day <= lastDay; day++) {
      const sales = salesMap.get(day) || { cash: 0, card: 0, momo: 0 };
      const credit = creditMap.get(day) || 0;
      const expenses = pettyMap.get(day) || 0;
      const dailyCash = calculateMonthlyFinancials({
        grossSales: sales.grossSales,
        creditSettlements: credit,
        expenses,
      });
      response.push({
        date: day,
        cash: sales.cash,
        card: sales.card,
        momo: sales.momo,
        credit_settled: credit,
        gross_sales: dailyCash.grossSales,
        expenses,
        petty: expenses,
        cash_after_petty_expenses: dailyCash.currentCash,
      });
    }

    console.log(`✅ Retrieved ${response.length} days for ${month}`);
    res.json(response);
  } catch (err) {
    console.error("Monthly revenue query failed:", err);
    res.status(500).json({ error: err.message });
  }
});
export default router;