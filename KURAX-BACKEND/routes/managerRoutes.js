import express from 'express';
import pool from '../db.js';
import PDFDocument from 'pdfkit';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET TARGET PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/target-progress', async (req, res) => {
  try {
    const monthKey = req.query.month || new Date().toISOString().substring(0, 7);

    const revenueQuery = `
      SELECT COALESCE(SUM(total), 0) AS current_total
      FROM orders 
      WHERE TO_CHAR(COALESCE(timestamp, created_at), 'YYYY-MM') = $1
        AND (
          is_archived = true 
          OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit')
        )
    `;
    const revenueResult = await pool.query(revenueQuery, [monthKey]);
    const currentTotal = parseFloat(revenueResult.rows[0].current_total || 0);

    const targetQuery = `
      SELECT revenue_goal FROM business_targets 
      WHERE month_key = $1
    `;
    const targetResult = await pool.query(targetQuery, [monthKey]);
    const targetGoal = targetResult.rows[0]?.revenue_goal
      ? parseFloat(targetResult.rows[0].revenue_goal)
      : 6000000;

    const percentage = targetGoal > 0
      ? parseFloat(((currentTotal / targetGoal) * 100).toFixed(2))
      : 0;

    const todayQuery = `
      SELECT COALESCE(SUM(CASE WHEN UPPER(payment_method) NOT LIKE '%CREDIT%' THEN total ELSE 0 END), 0) 
             + COALESCE((
                SELECT SUM(amount_paid) FROM credit_settlements
                WHERE DATE(created_at AT TIME ZONE 'Africa/Nairobi') = DATE(NOW() AT TIME ZONE 'Africa/Nairobi')
             ), 0) AS today_revenue
      FROM orders 
      WHERE DATE(COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi') = DATE(NOW() AT TIME ZONE 'Africa/Nairobi')
        AND (
          is_archived = true 
          OR LOWER(status) IN ('paid', 'closed', 'confirmed')
        )
    `;
    const todayResult = await pool.query(todayQuery);
    const todayRevenue = parseFloat(todayResult.rows[0].today_revenue || 0);

    res.json({
      target: targetGoal,
      current: currentTotal,
      percentage,
      todayRevenue
    });
  } catch (err) {
    console.error("Target Progress Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET DAILY ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN UPPER(payment_method) NOT LIKE '%CREDIT%' THEN total ELSE 0 END), 0) + COALESCE(settled.total_settled, 0) AS total_gross,
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CASH%' AND UPPER(payment_method) NOT LIKE '%CREDIT%' THEN total ELSE 0 END), 0) + COALESCE(settled.cash, 0) AS cash_total,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%MTN%' AND UPPER(payment_method) NOT LIKE '%CREDIT%' THEN total ELSE 0 END), 0) + COALESCE(settled.mtn, 0) AS mtn_total,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%AIRTEL%' AND UPPER(payment_method) NOT LIKE '%CREDIT%' THEN total ELSE 0 END), 0) + COALESCE(settled.airtel, 0) AS airtel_total,
        COALESCE(SUM(CASE WHEN (UPPER(payment_method) LIKE '%CARD%' OR UPPER(payment_method) LIKE '%VISA%' OR UPPER(payment_method) LIKE '%POS%') AND UPPER(payment_method) NOT LIKE '%CREDIT%' THEN total ELSE 0 END), 0) + COALESCE(settled.card, 0) AS card_total,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CREDIT%' OR LOWER(status) = 'credit' THEN total ELSE 0 END), 0) AS credit_total
      FROM orders 
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(amount_paid), 0) AS total_settled,
          COALESCE(SUM(CASE WHEN LOWER(method) = 'cash' THEN amount_paid ELSE 0 END), 0) AS cash,
          COALESCE(SUM(CASE WHEN LOWER(method) = 'card' OR LOWER(method) = 'visa' OR LOWER(method) = 'pos' THEN amount_paid ELSE 0 END), 0) AS card,
          COALESCE(SUM(CASE WHEN LOWER(method) = 'momo-mtn' THEN amount_paid ELSE 0 END), 0) AS mtn,
          COALESCE(SUM(CASE WHEN LOWER(method) = 'momo-airtel' THEN amount_paid ELSE 0 END), 0) AS airtel
        FROM credit_settlements
        WHERE DATE(created_at AT TIME ZONE 'Africa/Nairobi') = $1
      ) AS settled ON TRUE
      WHERE DATE(COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi') = $1
        AND (
          is_archived = true
          OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit')
        )
    `;
    const result = await pool.query(query, [targetDate]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Daily Analytics Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET DETAILED REPORT - FIXED column names
// ─────────────────────────────────────────────────────────────────────────────
router.get('/report', async (req, res) => {
  try {
    const { type, startDate, endDate, month } = req.query;
    let dateCondition = "";
    let params = [];

    if (type === "daily" && startDate) {
      dateCondition = "DATE(COALESCE(o.timestamp, o.created_at)) = $1";
      params = [startDate];
    } else if (type === "weekly" && startDate && endDate) {
      dateCondition = "DATE(COALESCE(o.timestamp, o.created_at)) BETWEEN $1 AND $2";
      params = [startDate, endDate];
    } else if (type === "monthly" && month) {
      dateCondition = "TO_CHAR(COALESCE(o.timestamp, o.created_at), 'YYYY-MM') = $1";
      params = [month];
    } else {
      dateCondition = "DATE(COALESCE(o.timestamp, o.created_at)) = CURRENT_DATE";
      params = [];
    }

    const statusFilter = `AND (o.is_archived = true OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'credit'))`;

    const ordersQuery = `
      SELECT 
        o.id, o.table_name,
        COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name,
        o.total, o.payment_method,
        COALESCE(o.timestamp, o.created_at) AS timestamp,
        o.status, o.items, o.is_archived
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE ${dateCondition} ${statusFilter}
      ORDER BY COALESCE(o.timestamp, o.created_at) DESC
    `;
    const ordersResult = params.length > 0
      ? await pool.query(ordersQuery, params)
      : await pool.query(ordersQuery);

    const plainDateCondition = dateCondition.replace(/o\./g, '');
    const plainStatusFilter = `AND (is_archived = true OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit'))`;

    const summaryQuery = `
      SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CASH%' THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%MTN%' THEN total ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS total_airtel,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CARD%' OR UPPER(payment_method) LIKE '%VISA%' OR UPPER(payment_method) LIKE '%POS%' THEN total ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CREDIT%' OR LOWER(status) = 'credit' THEN total ELSE 0 END), 0) AS total_credit
      FROM orders 
      WHERE ${plainDateCondition} ${plainStatusFilter}
    `;
    const summaryResult = params.length > 0
      ? await pool.query(summaryQuery, params)
      : await pool.query(summaryQuery);

    const staffQuery = `
      SELECT 
        COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name,
        COUNT(*) AS orders_count,
        COALESCE(SUM(o.total), 0) AS total_revenue,
        MAX(COALESCE(s.role, 'WAITER')) AS role
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE ${dateCondition} ${statusFilter}
      GROUP BY COALESCE(s.name, o.staff_name, 'Unknown')
      ORDER BY total_revenue DESC
    `;
    const staffResult = params.length > 0
      ? await pool.query(staffQuery, params)
      : await pool.query(staffQuery);

    let kitchenCount = 0, baristaCount = 0, barmanCount = 0;
    ordersResult.rows.forEach(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (Array.isArray(items)) {
        items.forEach(item => {
          const station = (item.station || "").toLowerCase();
          const category = (item.category || "").toLowerCase();
          const qty = Number(item.quantity) || 1;
          if (station === "barista" || category.includes("barista") || category.includes("coffee") || category.includes("tea")) {
            baristaCount += qty;
          } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink") || category.includes("beer")) {
            barmanCount += qty;
          } else {
            kitchenCount += qty;
          }
        });
      }
    });

    res.json({
      orders: ordersResult.rows,
      summary: summaryResult.rows[0],
      staffPerformance: staffResult.rows,
      stationBreakdown: { kitchen: kitchenCount, barista: baristaCount, barman: barmanCount }
    });
  } catch (err) {
    console.error("Report Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET PERFORMANCE LIST
// ─────────────────────────────────────────────────────────────────────────────
router.get("/performance-list", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         id, name, email, role, is_permitted, is_requesting,
         monthly_income_target, daily_order_target
       FROM staff 
       WHERE role IN ('WAITER', 'MANAGER', 'SUPERVISOR', 'CHEF', 'BARISTA', 'BARMAN')
       ORDER BY 
         CASE role 
           WHEN 'MANAGER' THEN 1 
           WHEN 'SUPERVISOR' THEN 2 
           WHEN 'WAITER' THEN 3 
           WHEN 'BARISTA' THEN 4
           WHEN 'BARMAN' THEN 5
           WHEN 'CHEF' THEN 6
           ELSE 7 
         END, name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Performance List Error:", err.message);
    res.status(500).json({ error: "Failed to load staff performance directory" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET MONTHLY STAFF PERFORMANCE - FIXED (removed waiter_name)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/staff-performance/monthly', async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().substring(0, 7);

    const staffQuery = `
      SELECT 
        COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name,
        COALESCE(s.role, 'WAITER') AS role,
        COUNT(DISTINCT o.id) AS orders_count,
        COALESCE(SUM(o.total), 0) AS total_revenue
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE TO_CHAR(COALESCE(o.timestamp, o.created_at), 'YYYY-MM') = $1
        AND (
          o.is_archived = true
          OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'credit')
        )
      GROUP BY 
        COALESCE(s.name, o.staff_name, 'Unknown'),
        COALESCE(s.role, 'WAITER')
      ORDER BY total_revenue DESC
    `;
    const staffResult = await pool.query(staffQuery, [targetMonth]);

    const targetQuery = `SELECT revenue_goal FROM business_targets WHERE month_key = $1`;
    const targetResult = await pool.query(targetQuery, [targetMonth]);
    const monthlyTarget = parseFloat(targetResult.rows[0]?.revenue_goal || 6000000);

    const revenueQuery = `
      SELECT COALESCE(SUM(total), 0) AS total_revenue
      FROM orders
      WHERE TO_CHAR(COALESCE(timestamp, created_at), 'YYYY-MM') = $1
        AND (
          is_archived = true
          OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit')
        )
    `;
    const revenueResult = await pool.query(revenueQuery, [targetMonth]);
    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue || 0);

    const activeStaffCount = staffResult.rows.length;
    const targetPerStaff = activeStaffCount > 0 ? monthlyTarget / activeStaffCount : 0;

    const staffWithProgress = staffResult.rows.map(staff => ({
      ...staff,
      total_revenue: parseFloat(staff.total_revenue),
      orders_count: parseInt(staff.orders_count),
      target: targetPerStaff,
      progress: targetPerStaff > 0
        ? parseFloat(((parseFloat(staff.total_revenue) / targetPerStaff) * 100).toFixed(1))
        : 0
    }));

    res.json({
      staff: staffWithProgress,
      summary: {
        total_revenue: totalRevenue,
        total_orders: staffResult.rows.reduce((sum, s) => sum + parseInt(s.orders_count), 0),
        active_staff: activeStaffCount,
        monthly_target: monthlyTarget,
        target_per_staff: targetPerStaff,
        progress_percentage: monthlyTarget > 0
          ? parseFloat(((totalRevenue / monthlyTarget) * 100).toFixed(1))
          : 0
      },
      month: targetMonth
    });
  } catch (err) {
    console.error("Staff Performance Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PETTY CASH SUMMARY (unified endpoint)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/petty-cash-summary', async (req, res) => {
  try {
    const { period, date, startDate, endDate, month } = req.query;
    let dateCondition = "";
    let params = [];

    if (period === "daily" && date) {
      dateCondition = "DATE(created_at) = $1";
      params = [date];
    } else if (period === "weekly" && startDate && endDate) {
      dateCondition = "DATE(created_at) BETWEEN $1 AND $2";
      params = [startDate, endDate];
    } else if (period === "monthly" && month) {
      dateCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";
      params = [month];
    } else {
      dateCondition = "DATE(created_at) = CURRENT_DATE";
      params = [];
    }

    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'IN'  THEN amount ELSE 0 END), 0) AS total_in,
        COUNT(CASE WHEN UPPER(direction) = 'OUT' THEN 1 END) AS out_count,
        COUNT(CASE WHEN UPPER(direction) = 'IN'  THEN 1 END) AS in_count
      FROM petty_cash
      WHERE ${dateCondition}
    `;

    const result = params.length > 0
      ? await pool.query(query, params)
      : await pool.query(query);

    const row = result.rows[0];
    res.json({
      total_out: parseFloat(row.total_out || 0),
      total_in:  parseFloat(row.total_in  || 0),
      net:       parseFloat(row.total_in  || 0) - parseFloat(row.total_out || 0),
      out_count: parseInt(row.out_count   || 0),
      in_count:  parseInt(row.in_count    || 0)
    });
  } catch (err) {
    console.error("Petty Cash Summary Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Keep old single-date route for backward compatibility
router.get('/petty-cash', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'IN'  THEN amount ELSE 0 END), 0) AS total_in
      FROM petty_cash 
      WHERE DATE(created_at) = $1
    `;
    const result = await pool.query(query, [targetDate]);
    const row = result.rows[0];
    res.json({
      total_petty_cash: parseFloat(row.total_out || 0),
      total_out: parseFloat(row.total_out || 0),
      total_in:  parseFloat(row.total_in  || 0)
    });
  } catch (err) {
    console.error("Petty Cash Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 7. SET/UPDATE MONTHLY TARGET
// ─────────────────────────────────────────────────────────────────────────────
router.post('/targets', async (req, res) => {
  const { month_key, revenue_goal, waiter_quota = 0 } = req.body;

  if (!month_key || revenue_goal === undefined) {
    return res.status(400).json({ error: "month_key and revenue_goal are required" });
  }

  try {
    // Check if the updated_at column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'business_targets' AND column_name = 'updated_at'
    `);
    const hasUpdatedAt = checkColumn.rows.length > 0;

    let query;
    if (hasUpdatedAt) {
      query = `
        INSERT INTO business_targets (month_key, revenue_goal, waiter_quota, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (month_key) 
        DO UPDATE SET 
          revenue_goal = EXCLUDED.revenue_goal,
          waiter_quota = COALESCE(EXCLUDED.waiter_quota, business_targets.waiter_quota),
          updated_at = NOW()
        RETURNING *
      `;
    } else {
      query = `
        INSERT INTO business_targets (month_key, revenue_goal, waiter_quota)
        VALUES ($1, $2, $3)
        ON CONFLICT (month_key) 
        DO UPDATE SET 
          revenue_goal = EXCLUDED.revenue_goal,
          waiter_quota = COALESCE(EXCLUDED.waiter_quota, business_targets.waiter_quota)
        RETURNING *
      `;
    }
    
    const result = await pool.query(query, [month_key, revenue_goal, waiter_quota]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Set Target Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 8. GET ALL TARGETS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/targets/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT month_key, revenue_goal, waiter_quota, created_at, updated_at
      FROM business_targets 
      ORDER BY month_key DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Get Targets Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET FLOOR MONITORING - FIXED (removed waiter_name)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/floor-monitor', async (req, res) => {
  try {
    const query = `
      SELECT 
        o.table_name, 
        COALESCE(s.name, o.staff_name, 'Unknown') AS waiter_name,
        o.total,
        COALESCE(o.timestamp, o.created_at) AS start_time,
        o.is_archived, 
        o.status,
        (EXTRACT(EPOCH FROM (NOW() - COALESCE(o.timestamp, o.created_at))) / 60)::INTEGER AS minutes_active
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE o.is_archived = false 
        OR (o.is_archived = true AND COALESCE(o.timestamp, o.created_at) > NOW() - INTERVAL '1 hour')
      ORDER BY o.is_archived ASC, COALESCE(o.timestamp, o.created_at) DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Floor Monitor Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. GET STATION BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────
router.get('/station-breakdown', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT items FROM orders 
      WHERE DATE(COALESCE(timestamp, created_at)) = $1
        AND (
          is_archived = true
          OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit')
        )
    `, [targetDate]);

    let kitchenCount = 0, baristaCount = 0, barmanCount = 0;
    result.rows.forEach(row => {
      let items = row.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (Array.isArray(items)) {
        items.forEach(item => {
          const station = (item.station || "").toLowerCase();
          const category = (item.category || "").toLowerCase();
          const qty = Number(item.quantity) || 1;
          if (station === "barista" || category.includes("barista") || category.includes("coffee") || category.includes("tea")) {
            baristaCount += qty;
          } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink") || category.includes("beer")) {
            barmanCount += qty;
          } else {
            kitchenCount += qty;
          }
        });
      }
    });

    res.json({ kitchen: kitchenCount, barista: baristaCount, barman: barmanCount, date: targetDate });
  } catch (err) {
    console.error("Station Breakdown Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET PERIOD SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/period-summary', async (req, res) => {
  try {
    const { type, startDate, endDate, month } = req.query;
    let dateCondition = "";
    let params = [];

    if (type === "weekly" && startDate && endDate) {
      dateCondition = "DATE(COALESCE(timestamp, created_at)) BETWEEN $1 AND $2";
      params = [startDate, endDate];
    } else if (type === "monthly" && month) {
      dateCondition = "TO_CHAR(COALESCE(timestamp, created_at), 'YYYY-MM') = $1";
      params = [month];
    } else {
      dateCondition = "DATE(COALESCE(timestamp, created_at)) = CURRENT_DATE";
      params = [];
    }

    const query = `
      SELECT 
        DATE(COALESCE(timestamp, created_at)) AS date,
        COUNT(*) AS daily_orders,
        COALESCE(SUM(total), 0) AS daily_revenue,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CASH%' THEN total ELSE 0 END), 0) AS daily_cash,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%MTN%' THEN total ELSE 0 END), 0) AS daily_mtn,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS daily_airtel,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CARD%' OR UPPER(payment_method) LIKE '%VISA%' OR UPPER(payment_method) LIKE '%POS%' THEN total ELSE 0 END), 0) AS daily_card
      FROM orders 
      WHERE ${dateCondition}
        AND (
          is_archived = true
          OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit')
        )
      GROUP BY DATE(COALESCE(timestamp, created_at))
      ORDER BY DATE(COALESCE(timestamp, created_at)) ASC
    `;

    const result = params.length > 0
      ? await pool.query(query, params)
      : await pool.query(query);

    res.json(result.rows);
  } catch (err) {
    console.error("Period Summary Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. SAVE DAILY ORDER GOAL
// ─────────────────────────────────────────────────────────────────────────────
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
    console.error("Save Staff Goal Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. GET DAILY ORDER GOAL
// ─────────────────────────────────────────────────────────────────────────────
router.get('/staff-goals/today', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT order_count_goal FROM staff_order_goals WHERE target_date = CURRENT_DATE`
    );
    res.json(result.rows[0] || { order_count_goal: 20 });
  } catch (err) {
    console.error("Get Staff Goal Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. GET CREDITS SUMMARY - FIXED to include partially settled outstanding
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits-summary', async (req, res) => {
  try {
    const { period, date, startDate, endDate, month } = req.query;
    let dateCondition = "";
    let params = [];

    if (period === "daily" && date) {
      dateCondition = "DATE(created_at) = $1";
      params = [date];
    } else if (period === "weekly" && startDate && endDate) {
      dateCondition = "DATE(created_at) BETWEEN $1 AND $2";
      params = [startDate, endDate];
    } else if (period === "monthly" && month) {
      dateCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";
      params = [month];
    } else {
      dateCondition = "DATE(created_at) = CURRENT_DATE";
      params = [];
    }

    const query = `
      SELECT 
        COUNT(*) AS total_credits,
        
        COALESCE(SUM(CASE WHEN status = 'Approved' THEN amount ELSE 0 END), 0) AS approved_amount,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved_count,
        
        COALESCE(SUM(CASE WHEN status = 'FullySettled' THEN COALESCE(amount_paid, amount) ELSE 0 END), 0) AS settled_amount,
        COUNT(CASE WHEN status = 'FullySettled' THEN 1 END) AS settled_count,
        
        COALESCE(SUM(CASE WHEN status IN ('PendingCashier', 'PendingManager') THEN amount ELSE 0 END), 0) AS pending_amount,
        COUNT(CASE WHEN status IN ('PendingCashier', 'PendingManager') THEN 1 END) AS pending_count,
        
        COALESCE(SUM(CASE WHEN status = 'Rejected' THEN amount ELSE 0 END), 0) AS rejected_amount,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected_count,
        
        COALESCE(SUM(CASE WHEN status = 'PartiallySettled' THEN (amount - COALESCE(amount_paid, 0)) ELSE 0 END), 0) AS partially_settled_outstanding,
        COUNT(CASE WHEN status = 'PartiallySettled' THEN 1 END) AS partially_settled_count,
        
        COALESCE(SUM(CASE WHEN status = 'PartiallySettled' THEN COALESCE(amount_paid, 0) ELSE 0 END), 0) AS partially_settled_paid
      FROM credits 
      WHERE ${dateCondition}
    `;

    const result = params.length > 0
      ? await pool.query(query, params)
      : await pool.query(query);

    const row = result.rows[0];
    
    const approvedAmount = Number(row.approved_amount) || 0;
    const pendingAmount = Number(row.pending_amount) || 0;
    const partiallySettledOutstanding = Number(row.partially_settled_outstanding) || 0;
    const totalOutstanding = approvedAmount + pendingAmount + partiallySettledOutstanding;
    
    const settledAmount = Number(row.settled_amount) || 0;
    const partiallySettledPaid = Number(row.partially_settled_paid) || 0;
    const totalSettled = settledAmount + partiallySettledPaid;

    res.json({
      total_credits:    Number(row.total_credits) || 0,
      approved_amount:  approvedAmount,
      settled_amount:   totalSettled,
      pending_amount:   pendingAmount,
      rejected_amount:  Number(row.rejected_amount) || 0,
      outstanding_amount: totalOutstanding,
      partially_settled_outstanding: partiallySettledOutstanding,
      partially_settled_paid: partiallySettledPaid,
      approved_count:   Number(row.approved_count) || 0,
      settled_count:    Number(row.settled_count) || 0,
      pending_count:    Number(row.pending_count) || 0,
      rejected_count:   Number(row.rejected_count) || 0,
      partially_settled_count: Number(row.partially_settled_count) || 0
    });
  } catch (err) {
    console.error("Credits Summary Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 16. APPROVE CREDIT REQUEST (Manager Action)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/credits/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;
  
  try {
    // First, get the credit request from cashier_queue
    const creditRequest = await pool.query(
      `SELECT * FROM cashier_queue WHERE id = $1 AND method = 'Credit' AND status = 'PendingManagerApproval'`,
      [id]
    );
    
    if (creditRequest.rows.length === 0) {
      return res.status(404).json({ error: 'Credit request not found or already processed' });
    }
    
    const request = creditRequest.rows[0];
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Update the cashier_queue status to 'Approved' (NO shift_cleared column)
    await pool.query(
      `UPDATE cashier_queue 
       SET status = 'Approved', 
           approved_by = $1, 
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [approved_by, id]
    );
    
    // Create a credit record in the credits table
    const creditResult = await pool.query(
      `INSERT INTO credits (
        cashier_queue_id, 
        table_name, 
        amount, 
        client_name, 
        client_phone,
        pay_by,
        waiter_name,
        status,
        approved_by,
        approved_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        id,
        request.table_name,
        request.amount,
        request.credit_name,
        request.credit_phone,
        request.credit_pay_by,
        request.requested_by,
        'Approved',
        approved_by
      ]
    );
    
    // Also create an entry in cashier_history for tracking if needed
    await pool.query(
      `INSERT INTO cashier_history (
        cashier_queue_id,
        table_name,
        amount,
        method,
        status,
        requested_by,
        confirmed_by,
        confirmed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (cashier_queue_id) DO NOTHING`,
      [
        id,
        request.table_name,
        request.amount,
        'Credit',
        'Approved',
        request.requested_by,
        approved_by
      ]
    );
    
    await pool.query('COMMIT');
    
    console.log(`✅ Credit ${id} approved by ${approved_by}`);
    
    res.json({
      success: true,
      message: 'Credit request approved successfully',
      credit: creditResult.rows[0]
    });
    
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Credit approval error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. REJECT CREDIT REQUEST (Manager Action)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/credits/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { rejected_by, reason } = req.body;
  
  try {
    const creditRequest = await pool.query(
      `SELECT * FROM cashier_queue WHERE id = $1 AND method = 'Credit' AND status = 'PendingManagerApproval'`,
      [id]
    );
    
    if (creditRequest.rows.length === 0) {
      return res.status(404).json({ error: 'Credit request not found' });
    }
    
    const request = creditRequest.rows[0];
    
    await pool.query('BEGIN');
    
    // Update the cashier_queue status to 'Rejected'
    await pool.query(
      `UPDATE cashier_queue 
       SET status = 'Rejected', 
           rejected_by = $1, 
           reject_reason = $2,
           rejected_at = NOW(),
           updated_at = NOW()
       WHERE id = $3`,
      [rejected_by, reason || 'Rejected by manager', id]
    );
    
    // Create a rejected credit record
    await pool.query(
      `INSERT INTO credits (
        cashier_queue_id, 
        table_name, 
        amount, 
        client_name, 
        client_phone,
        pay_by,
        waiter_name,
        status,
        reject_reason,
        rejected_by,
        rejected_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        id,
        request.table_name,
        request.amount,
        request.credit_name,
        request.credit_phone,
        request.credit_pay_by,
        request.requested_by,
        'Rejected',
        reason || 'Rejected by manager',
        rejected_by
      ]
    );
    
    await pool.query('COMMIT');
    
    console.log(`❌ Credit ${id} rejected by ${rejected_by}`);
    
    res.json({
      success: true,
      message: 'Credit request rejected'
    });
    
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Credit rejection error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. GET PENDING CREDITS FOR MANAGER
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits/pending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cq.id,
        cq.table_name,
        cq.amount,
        cq.requested_by AS waiter_name,
        cq.credit_name AS client_name,
        cq.credit_phone AS client_phone,
        cq.credit_pay_by AS pay_by_date,
        cq.created_at,
        cq.status,
        EXTRACT(EPOCH FROM (NOW() - cq.created_at)) / 60 AS waiting_minutes
      FROM cashier_queue cq
      WHERE cq.method = 'Credit' 
        AND cq.status = 'PendingManagerApproval'
      ORDER BY cq.created_at ASC
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Get pending credits error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. GET CREDIT SUMMARY FOR MANAGER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits/manager-summary', async (req, res) => {
  try {
    const pendingQuery = await pool.query(`
      SELECT 
        COUNT(*) AS pending_count,
        COALESCE(SUM(amount), 0) AS pending_amount
      FROM cashier_queue
      WHERE method = 'Credit' 
        AND status = 'PendingManagerApproval'
    `);
    
    const approvedQuery = await pool.query(`
      SELECT 
        COUNT(*) AS approved_count,
        COALESCE(SUM(amount), 0) AS approved_amount
      FROM credits
      WHERE status = 'Approved'
    `);
    
    const settledQuery = await pool.query(`
      SELECT 
        COUNT(*) AS settled_count,
        COALESCE(SUM(amount_paid), 0) AS settled_amount
      FROM credits
      WHERE status = 'FullySettled'
    `);
    
    const rejectedQuery = await pool.query(`
      SELECT 
        COUNT(*) AS rejected_count,
        COALESCE(SUM(amount), 0) AS rejected_amount
      FROM credits
      WHERE status = 'Rejected'
    `);
    
    res.json({
      pending: {
        count: parseInt(pendingQuery.rows[0]?.pending_count || 0),
        amount: parseFloat(pendingQuery.rows[0]?.pending_amount || 0)
      },
      approved: {
        count: parseInt(approvedQuery.rows[0]?.approved_count || 0),
        amount: parseFloat(approvedQuery.rows[0]?.approved_amount || 0)
      },
      settled: {
        count: parseInt(settledQuery.rows[0]?.settled_count || 0),
        amount: parseFloat(settledQuery.rows[0]?.settled_amount || 0)
      },
      rejected: {
        count: parseInt(rejectedQuery.rows[0]?.rejected_count || 0),
        amount: parseFloat(rejectedQuery.rows[0]?.rejected_amount || 0)
      }
    });
  } catch (err) {
    console.error('Manager credit summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. EXPORT TRANSACTION REPORT PDF - FIXED
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export-pdf', async (req, res) => {
  const { type, date, month } = req.query;
  const reportType = type || 'daily';

  try {
    let dateCondition = "";
    let params = [];
    let title = "";
    let periodText = "";
    let filename = "";
    let creditsCondition = "";
    let creditsParams = [];
    let pettyCondition = "";
    let pettyParams = [];

    if (reportType === "daily" && date) {
      dateCondition = "DATE(COALESCE(o.timestamp, o.created_at)) = $1";
      params = [date];
      title = "DAILY TRANSACTION REPORT";
      periodText = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      filename = `Kurax_Daily_Report_${date}.pdf`;
      creditsCondition = "DATE(created_at) = $1";
      creditsParams = [date];
      pettyCondition = "DATE(created_at) = $1";
      pettyParams = [date];

    } else if (reportType === "weekly" && date) {
      const selectedDate = new Date(date);
      const dayOfWeek = selectedDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const ws = weekStart.toISOString().split('T')[0];
      const we = weekEnd.toISOString().split('T')[0];

      dateCondition = "DATE(COALESCE(o.timestamp, o.created_at)) BETWEEN $1 AND $2";
      params = [ws, we];
      title = "WEEKLY TRANSACTION REPORT";
      periodText = `${new Date(ws + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${new Date(we + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      filename = `Kurax_Weekly_Report_${date}.pdf`;
      creditsCondition = "DATE(created_at) BETWEEN $1 AND $2";
      creditsParams = [ws, we];
      pettyCondition = "DATE(created_at) BETWEEN $1 AND $2";
      pettyParams = [ws, we];

    } else if (reportType === "monthly" && month) {
      dateCondition = "TO_CHAR(COALESCE(o.timestamp, o.created_at), 'YYYY-MM') = $1";
      params = [month];
      title = "MONTHLY TRANSACTION REPORT";
      const [y, m] = month.split("-");
      periodText = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      filename = `Kurax_Monthly_Report_${month}.pdf`;
      creditsCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";
      creditsParams = [month];
      pettyCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";
      pettyParams = [month];

    } else {
      return res.status(400).json({ error: "Invalid parameters. Provide type + date (or month for monthly)." });
    }

    const statusFilter = `AND (o.is_archived = true OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'credit'))`;

    const ordersResult = await pool.query(`
      SELECT 
        o.id, o.table_name,
        COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name,
        o.total, o.payment_method,
        COALESCE(o.timestamp, o.created_at) AS timestamp,
        o.status, o.items
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE ${dateCondition} ${statusFilter}
      ORDER BY COALESCE(o.timestamp, o.created_at) DESC
    `, params);

    const plainDateCond = dateCondition.replace(/o\./g, '');
    const plainStatusFilter = `AND (is_archived = true OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit'))`;

    const summaryResult = await pool.query(`
      SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CASH%' THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%MTN%' THEN total ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS total_airtel,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CARD%' OR UPPER(payment_method) LIKE '%VISA%' OR UPPER(payment_method) LIKE '%POS%' THEN total ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CREDIT%' OR LOWER(status) = 'credit' THEN total ELSE 0 END), 0) AS total_credit
      FROM orders 
      WHERE ${plainDateCond} ${plainStatusFilter}
    `, params);

    const creditsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'FullySettled' THEN COALESCE(amount_paid, amount) ELSE 0 END), 0) AS total_settled,
        COUNT(CASE WHEN status = 'FullySettled' THEN 1 END) AS settled_count,
        COALESCE(SUM(CASE WHEN status = 'Approved' THEN amount ELSE 0 END), 0) AS total_approved,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved_count,
        COALESCE(SUM(CASE WHEN status IN ('PendingCashier', 'PendingManager') THEN amount ELSE 0 END), 0) AS total_pending,
        COUNT(CASE WHEN status IN ('PendingCashier', 'PendingManager') THEN 1 END) AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'Rejected' THEN amount ELSE 0 END), 0) AS total_rejected,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected_count,
        COALESCE(SUM(CASE WHEN status = 'PartiallySettled' THEN (amount - COALESCE(amount_paid, 0)) ELSE 0 END), 0) AS partially_outstanding,
        COUNT(CASE WHEN status = 'PartiallySettled' THEN 1 END) AS partially_count,
        COALESCE(SUM(CASE WHEN status = 'PartiallySettled' THEN COALESCE(amount_paid, 0) ELSE 0 END), 0) AS partially_paid
      FROM credits WHERE ${creditsCondition}
    `, creditsParams);

    const credits = creditsResult.rows[0];
    const totalSettled = Number(credits.total_settled) + Number(credits.partially_paid);
    const totalOutstanding = Number(credits.total_approved) + Number(credits.total_pending) + Number(credits.partially_outstanding);

    const pettyResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'IN'  THEN amount ELSE 0 END), 0) AS total_in,
        COUNT(CASE WHEN UPPER(direction) = 'OUT' THEN 1 END) AS out_count,
        COUNT(CASE WHEN UPPER(direction) = 'IN'  THEN 1 END) AS in_count
      FROM petty_cash WHERE ${pettyCondition}
    `, pettyParams);
    const petty = pettyResult.rows[0];

    let kitchenCount = 0, baristaCount = 0, barmanCount = 0;
    ordersResult.rows.forEach(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (Array.isArray(items)) {
        items.forEach(item => {
          const station = (item.station || "").toLowerCase();
          const category = (item.category || "").toLowerCase();
          const qty = Number(item.quantity) || 1;
          if (station === "barista" || category.includes("barista") || category.includes("coffee") || category.includes("tea")) {
            baristaCount += qty;
          } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink") || category.includes("beer")) {
            barmanCount += qty;
          } else {
            kitchenCount += qty;
          }
        });
      }
    });

    const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageW = doc.page.width;

    doc.rect(0, 0, pageW, 5).fill('#EAB308');

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#1a1a2e')
      .text('KURAX FOOD LOUNGE & BISTRO', pageW / 2, 45, { align: 'center' });

    doc.font('Helvetica').fontSize(9).fillColor('#d97706')
      .text('Luxury Dining & Rooftop Vibes', pageW / 2, 68, { align: 'center' });

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#EAB308')
      .text(title, pageW / 2, 95, { align: 'center' });

    doc.strokeColor('#E5E7EB').lineWidth(1)
      .moveTo(50, 115).lineTo(pageW - 50, 115).stroke();

    doc.font('Helvetica').fontSize(9).fillColor('#6B7280')
      .text(`Period: ${periodText}`, pageW / 2, 130, { align: 'center' })
      .text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 143, { align: 'center' });

    let currentY = 170;

    const summary = summaryResult.rows[0];
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e')
      .text('EXECUTIVE SUMMARY', 50, currentY);
    doc.strokeColor('#E5E7EB').moveTo(50, currentY + 15).lineTo(pageW - 50, currentY + 15).stroke();
    currentY += 25;

    const summaryStats = [
      { label: 'Total Orders',  value: summary.total_transactions,                                      color: '#3B82F6' },
      { label: 'Total Revenue', value: `UGX ${Number(summary.total_revenue).toLocaleString()}`,          color: '#10B981' },
      { label: 'Cash',          value: `UGX ${Number(summary.total_cash).toLocaleString()}`,             color: '#059669' },
      { label: 'MTN Momo',      value: `UGX ${Number(summary.total_mtn).toLocaleString()}`,              color: '#D97706' },
      { label: 'Airtel',        value: `UGX ${Number(summary.total_airtel).toLocaleString()}`,           color: '#DC2626' },
      { label: 'Card/POS',      value: `UGX ${Number(summary.total_card).toLocaleString()}`,             color: '#8B5CF6' }
    ];

    let colX = 50, colY = currentY;
    summaryStats.forEach((stat, idx) => {
      doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(stat.label, colX, colY);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(stat.color).text(String(stat.value), colX, colY + 12);
      colX += 95;
      if ((idx + 1) % 3 === 0) { colX = 50; colY += 35; }
    });
    currentY = colY + 35;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e').text('CREDITS SUMMARY', 50, currentY);
    doc.strokeColor('#E5E7EB').moveTo(50, currentY + 15).lineTo(pageW - 50, currentY + 15).stroke();
    currentY += 25;

    const creditsStats = [
      { label: 'Credits Settled',   value: `UGX ${totalSettled.toLocaleString()}`,                          color: '#10B981' },
      { label: 'Outstanding',        value: `UGX ${totalOutstanding.toLocaleString()}`,                      color: '#F59E0B' },
      { label: 'Approved Credits',   value: `UGX ${Number(credits.total_approved).toLocaleString()}`,        color: '#8B5CF6' },
      { label: 'Pending Approval',   value: `UGX ${Number(credits.total_pending).toLocaleString()}`,         color: '#EF4444' },
      { label: 'Total Records',      value: String(Number(credits.settled_count) + Number(credits.approved_count) + Number(credits.pending_count) + Number(credits.rejected_count) + Number(credits.partially_count)), color: '#6B7280' }
    ];

    colX = 50; colY = currentY;
    creditsStats.forEach((stat, idx) => {
      doc.rect(colX, colY, 110, 40).fill('#F9FAFB');
      doc.rect(colX, colY, 110, 40).stroke('#E5E7EB');
      doc.font('Helvetica').fontSize(7).fillColor('#6B7280').text(stat.label, colX + 8, colY + 10);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(stat.color).text(stat.value, colX + 8, colY + 24);
      colX += 120;
      if ((idx + 1) % 4 === 0) { colX = 50; colY += 55; }
    });
    currentY = colY + 55;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e').text('PETTY CASH SUMMARY', 50, currentY);
    doc.strokeColor('#E5E7EB').moveTo(50, currentY + 15).lineTo(pageW - 50, currentY + 15).stroke();
    currentY += 25;

    const netPetty = Number(petty.total_in) - Number(petty.total_out);
    const pettyStats = [
      { label: 'Total Expenses (OUT)',       value: `UGX ${Number(petty.total_out).toLocaleString()}`, color: '#EF4444' },
      { label: 'Total Replenishment (IN)',   value: `UGX ${Number(petty.total_in).toLocaleString()}`,  color: '#10B981' },
      { label: 'Net Position',               value: `UGX ${netPetty.toLocaleString()}`,                color: netPetty >= 0 ? '#10B981' : '#EF4444' },
      { label: 'Transactions',               value: `${petty.out_count || 0} OUT / ${petty.in_count || 0} IN`, color: '#6B7280' }
    ];

    colX = 50; colY = currentY;
    pettyStats.forEach(stat => {
      doc.rect(colX, colY, 110, 40).fill('#F9FAFB');
      doc.rect(colX, colY, 110, 40).stroke('#E5E7EB');
      doc.font('Helvetica').fontSize(7).fillColor('#6B7280').text(stat.label, colX + 8, colY + 10);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(stat.color).text(stat.value, colX + 8, colY + 24);
      colX += 120;
    });
    currentY += 55;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e').text('STATION BREAKDOWN', 50, currentY);
    doc.strokeColor('#E5E7EB').moveTo(50, currentY + 15).lineTo(pageW - 50, currentY + 15).stroke();
    currentY += 30;

    [
      { name: 'KITCHEN',          count: kitchenCount, color: '#F59E0B' },
      { name: 'BARISTA (COFFEE)', count: baristaCount, color: '#10B981' },
      { name: 'BARMAN (BAR)',     count: barmanCount,  color: '#8B5CF6' }
    ].forEach((station, i) => {
      const sx = 50 + i * 155;
      doc.rect(sx, currentY, 140, 50).fill('#F9FAFB');
      doc.rect(sx, currentY, 140, 50).stroke('#E5E7EB');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151').text(station.name, sx + 10, currentY + 12);
      doc.font('Helvetica-Bold').fontSize(18).fillColor(station.color).text(String(station.count), sx + 10, currentY + 28);
    });
    currentY += 70;

    if (ordersResult.rows.length > 0) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e').text('ORDER DETAILS', 50, currentY);
      doc.strokeColor('#E5E7EB').moveTo(50, currentY + 15).lineTo(pageW - 50, currentY + 15).stroke();
      currentY += 25;

      const headers = ['Order ID', 'Table', 'Staff', 'Amount', 'Method', 'Time'];
      const colWidths = [55, 70, 85, 85, 70, 65];

      const drawHeader = (y) => {
        doc.rect(50, y - 3, pageW - 100, 20).fill('#F3F4F6');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151');
        let hx = 55;
        headers.forEach((h, i) => { doc.text(h, hx, y); hx += colWidths[i]; });
      };

      drawHeader(currentY);
      currentY += 17;

      ordersResult.rows.forEach((order, idx) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e')
            .text('ORDER DETAILS (continued)', 50, currentY);
          currentY += 20;
          drawHeader(currentY);
          currentY += 17;
        }

        if (idx % 2 === 0) {
          doc.rect(50, currentY - 3, pageW - 100, 16).fill('#F9FAFB');
        }

        const row = [
          String(order.id || '').slice(-6),
          (order.table_name || "—").substring(0, 12),
          (order.staff_name || "—").substring(0, 16),
          `UGX ${Number(order.total || 0).toLocaleString()}`,
          (order.payment_method || "—").substring(0, 10),
          order.timestamp ? new Date(order.timestamp).toLocaleTimeString() : "—"
        ];

        let rx = 55;
        row.forEach((cell, i) => {
          doc.font('Helvetica').fontSize(8).fillColor('#1F2937').text(cell, rx, currentY);
          rx += colWidths[i];
        });
        currentY += 16;
      });
    }

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF')
        .text(
          `KURAX FOOD LOUNGE & BISTRO  ·  Page ${i + 1} of ${totalPages}`,
          pageW / 2,
          doc.page.height - 30,
          { align: 'center' }
        );
    }

    doc.end();
  } catch (err) {
    console.error("PDF Export Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;