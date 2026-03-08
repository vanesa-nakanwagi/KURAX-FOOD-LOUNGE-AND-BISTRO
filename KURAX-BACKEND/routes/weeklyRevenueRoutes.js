// routes/weeklyRevenueRoutes.js
// GET /api/overview/weekly-revenue

import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/weekly-revenue", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE(paid_at AT TIME ZONE 'Africa/Kampala'), 'YYYY-MM-DD') AS day,
        SUM(CASE WHEN LOWER(payment_method) = 'cash'        THEN total ELSE 0 END) AS cash,
        SUM(CASE WHEN LOWER(payment_method) = 'card'        THEN total ELSE 0 END) AS card,
        SUM(CASE WHEN LOWER(payment_method) = 'momo-mtn'    THEN total ELSE 0 END) AS momo_mtn,
        SUM(CASE WHEN LOWER(payment_method) = 'momo-airtel' THEN total ELSE 0 END) AS momo_airtel,
        SUM(total) AS gross
      FROM orders
      WHERE
        status = 'Paid'
        AND paid_at IS NOT NULL
        AND paid_at AT TIME ZONE 'Africa/Kampala' >= CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala' - INTERVAL '6 days'
      GROUP BY TO_CHAR(DATE(paid_at AT TIME ZONE 'Africa/Kampala'), 'YYYY-MM-DD')
      ORDER BY day ASC
    `);

    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Build 7-day map using local time (Kampala = UTC+3)
    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      // Convert to Kampala local date (UTC+3)
      const kampala = new Date(d.getTime() + 3 * 60 * 60 * 1000);
      const iso = [
        kampala.getUTCFullYear(),
        String(kampala.getUTCMonth() + 1).padStart(2, "0"),
        String(kampala.getUTCDate()).padStart(2, "0"),
      ].join("-");
      dayMap[iso] = {
        date:        DAY_LABELS[kampala.getUTCDay()],
        full_date:   iso,
        cash:        0,
        card:        0,
        momo_mtn:    0,
        momo_airtel: 0,
        gross:       0,
      };
    }

    // Merge DB rows — row.day is already a plain string "YYYY-MM-DD" from TO_CHAR
    for (const row of result.rows) {
      const iso = String(row.day);
      if (dayMap[iso]) {
        dayMap[iso].cash        = Number(row.cash        || 0);
        dayMap[iso].card        = Number(row.card        || 0);
        dayMap[iso].momo_mtn    = Number(row.momo_mtn    || 0);
        dayMap[iso].momo_airtel = Number(row.momo_airtel || 0);
        dayMap[iso].gross       = Number(row.gross       || 0);
      }
    }

    res.json(Object.values(dayMap));

  } catch (err) {
    console.error("Weekly revenue query failed:", err);
    res.status(500).json({ error: "Failed to fetch weekly revenue" });
  }
});

export default router;