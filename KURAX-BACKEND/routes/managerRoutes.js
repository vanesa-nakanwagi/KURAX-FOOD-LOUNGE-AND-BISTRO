import express from 'express';
import pool from '../db.js';
import PDFDocument from 'pdfkit';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET TARGET PROGRESS - Monthly revenue target vs actual
// ─────────────────────────────────────────────────────────────────────────────
router.get('/target-progress', async (req, res) => {
  try {
    const monthKey = new Date().toISOString().substring(0, 7);
    
    const revenueQuery = `
      SELECT COALESCE(SUM(total), 0) AS current_total
      FROM orders 
      WHERE (timestamp >= date_trunc('month', CURRENT_DATE) 
             OR date >= date_trunc('month', CURRENT_DATE))
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
        AND shift_cleared = false
    `;
    
    const revenueResult = await pool.query(revenueQuery);
    const currentTotal = parseFloat(revenueResult.rows[0].current_total || 0);
    
    const targetQuery = `
      SELECT revenue_goal FROM business_targets 
      WHERE month_key = $1
    `;
    const targetResult = await pool.query(targetQuery, [monthKey]);
    
    const targetGoal = targetResult.rows[0]?.revenue_goal 
      ? parseFloat(targetResult.rows[0].revenue_goal) 
      : 6000000;
    
    const percentage = targetGoal > 0 ? ((currentTotal / targetGoal) * 100).toFixed(2) : 0;
    
    const todayQuery = `
      SELECT COALESCE(SUM(total), 0) AS today_revenue
      FROM orders 
      WHERE DATE(timestamp) = CURRENT_DATE
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
    `;
    const todayResult = await pool.query(todayQuery);
    const todayRevenue = parseFloat(todayResult.rows[0].today_revenue || 0);
    
    res.json({
      target: targetGoal,
      current: currentTotal,
      percentage: parseFloat(percentage),
      todayRevenue: todayRevenue
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
        COALESCE(SUM(total), 0) AS total_gross,
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CASH%' THEN total ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%MTN%' THEN total ELSE 0 END), 0) AS mtn_total,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS airtel_total,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CARD%' OR payment_method ILIKE '%VISA%' OR payment_method ILIKE '%POS%' THEN total ELSE 0 END), 0) AS card_total,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CREDIT%' OR status = 'Credit' THEN total ELSE 0 END), 0) AS credit_total
      FROM orders 
      WHERE DATE(timestamp) = $1 
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
    `;
    const result = await pool.query(query, [targetDate]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Daily Analytics Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET DETAILED REPORT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/report', async (req, res) => {
  try {
    const { type, startDate, endDate, month } = req.query;
    let dateCondition = "";
    let params = [];
    
    if (type === "daily" && startDate) {
      dateCondition = "DATE(timestamp) = $1";
      params = [startDate];
    } else if (type === "weekly" && startDate && endDate) {
      dateCondition = "DATE(timestamp) BETWEEN $1 AND $2";
      params = [startDate, endDate];
    } else if (type === "monthly" && month) {
      dateCondition = "TO_CHAR(timestamp, 'YYYY-MM') = $1";
      params = [month];
    } else {
      dateCondition = "DATE(timestamp) = CURRENT_DATE";
      params = [];
    }
    
    const ordersQuery = `
      SELECT 
        id, table_name, waiter_name, staff_name, staff_role,
        total, payment_method, timestamp, status, items, is_archived
      FROM orders 
      WHERE ${dateCondition}
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
      ORDER BY timestamp DESC
    `;
    let ordersResult;
    if (params.length > 0) {
      ordersResult = await pool.query(ordersQuery, params);
    } else {
      ordersResult = await pool.query(ordersQuery);
    }
    
    const summaryQuery = `
      SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CASH%' THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%MTN%' THEN total ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS total_airtel,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CARD%' OR payment_method ILIKE '%VISA%' OR payment_method ILIKE '%POS%' THEN total ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CREDIT%' OR status = 'Credit' THEN total ELSE 0 END), 0) AS total_credit
      FROM orders 
      WHERE ${dateCondition}
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
    `;
    let summaryResult;
    if (params.length > 0) {
      summaryResult = await pool.query(summaryQuery, params);
    } else {
      summaryResult = await pool.query(summaryQuery);
    }
    
    const staffQuery = `
      SELECT 
        COALESCE(waiter_name, staff_name, 'Unknown') AS staff_name,
        COUNT(*) AS orders_count,
        COALESCE(SUM(total), 0) AS total_revenue,
        MAX(staff_role) AS role
      FROM orders 
      WHERE ${dateCondition}
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
      GROUP BY COALESCE(waiter_name, staff_name, 'Unknown')
      ORDER BY total_revenue DESC
    `;
    let staffResult;
    if (params.length > 0) {
      staffResult = await pool.query(staffQuery, params);
    } else {
      staffResult = await pool.query(staffQuery);
    }
    
    const allOrders = ordersResult.rows;
    let kitchenCount = 0;
    let baristaCount = 0;
    let barmanCount = 0;
    
    allOrders.forEach(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (Array.isArray(items)) {
        items.forEach(item => {
          const station = (item.station || "").toLowerCase();
          const category = (item.category || "").toLowerCase();
          if (station === "barista" || category.includes("barista") || category.includes("coffee")) {
            baristaCount += (item.quantity || 1);
          } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink")) {
            barmanCount += (item.quantity || 1);
          } else {
            kitchenCount += (item.quantity || 1);
          }
        });
      }
    });
    
    res.json({
      orders: allOrders,
      summary: summaryResult.rows[0],
      staffPerformance: staffResult.rows,
      stationBreakdown: {
        kitchen: kitchenCount,
        barista: baristaCount,
        barman: barmanCount
      }
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
         id, 
         name, 
         email, 
         role, 
         is_permitted, 
         is_requesting,
         monthly_income_target, 
         daily_order_target
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
         END, 
         name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Performance List Error:", err.message);
    res.status(500).json({ error: "Failed to load staff performance directory" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET MONTHLY STAFF PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/staff-performance/monthly', async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    
    const staffQuery = `
      SELECT 
        COALESCE(s.name, 'Unknown') AS staff_name,
        COALESCE(s.role, 'WAITER') AS role,
        COUNT(DISTINCT o.id) AS orders_count,
        COALESCE(SUM(o.total), 0) AS total_revenue,
        ARRAY_AGG(DISTINCT o.id) AS order_ids
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE TO_CHAR(o.timestamp, 'YYYY-MM') = $1
        AND (o.is_archived = true OR o.status IN ('Paid', 'Closed', 'CLOSED'))
      GROUP BY s.id, s.name, s.role
      ORDER BY total_revenue DESC
    `;
    const staffResult = await pool.query(staffQuery, [targetMonth]);
    
    const targetQuery = `
      SELECT revenue_goal FROM business_targets WHERE month_key = $1
    `;
    const targetResult = await pool.query(targetQuery, [targetMonth]);
    const monthlyTarget = targetResult.rows[0]?.revenue_goal || 6000000;
    
    const revenueQuery = `
      SELECT COALESCE(SUM(o.total), 0) AS total_revenue
      FROM orders o
      WHERE TO_CHAR(o.timestamp, 'YYYY-MM') = $1
        AND (o.is_archived = true OR o.status IN ('Paid', 'Closed', 'CLOSED'))
    `;
    const revenueResult = await pool.query(revenueQuery, [targetMonth]);
    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue || 0);
    
    const activeStaffCount = staffResult.rows.length;
    const targetPerStaff = activeStaffCount > 0 ? monthlyTarget / activeStaffCount : 0;
    
    const staffWithProgress = staffResult.rows.map(staff => ({
      ...staff,
      target: targetPerStaff,
      progress: targetPerStaff > 0 ? ((staff.total_revenue / targetPerStaff) * 100).toFixed(1) : 0
    }));
    
    res.json({
      staff: staffWithProgress,
      summary: {
        total_revenue: totalRevenue,
        total_orders: staffResult.rows.reduce((sum, s) => sum + parseInt(s.orders_count), 0),
        active_staff: activeStaffCount,
        monthly_target: monthlyTarget,
        target_per_staff: targetPerStaff,
        progress_percentage: monthlyTarget > 0 ? ((totalRevenue / monthlyTarget) * 100).toFixed(1) : 0
      },
      month: targetMonth
    });
  } catch (err) {
    console.error("Staff Performance Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET PETTY CASH TOTAL
// ─────────────────────────────────────────────────────────────────────────────
router.get('/petty-cash', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const query = `
      SELECT COALESCE(SUM(amount), 0) AS total_petty_cash
      FROM petty_cash 
      WHERE DATE(created_at) = $1 AND direction = 'OUT'
    `;
    const result = await pool.query(query, [targetDate]);
    res.json({ total_petty_cash: parseFloat(result.rows[0].total_petty_cash || 0) });
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
  
  if (!month_key || !revenue_goal) {
    return res.status(400).json({ error: "month_key and revenue_goal are required" });
  }
  
  try {
    const query = `
      INSERT INTO business_targets (month_key, revenue_goal, waiter_quota)
      VALUES ($1, $2, $3)
      ON CONFLICT (month_key) 
      DO UPDATE SET 
        revenue_goal = EXCLUDED.revenue_goal,
        waiter_quota = COALESCE(EXCLUDED.waiter_quota, business_targets.waiter_quota),
        updated_at = NOW()
      RETURNING *
    `;
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
    const query = `
      SELECT month_key, revenue_goal, waiter_quota, created_at, updated_at
      FROM business_targets 
      ORDER BY month_key DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Get Targets Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET FLOOR MONITORING
// ─────────────────────────────────────────────────────────────────────────────
router.get('/floor-monitor', async (req, res) => {
  try {
    const query = `
      SELECT 
        table_name, 
        waiter_name, 
        total, 
        timestamp AS start_time,
        is_archived,
        status,
        (EXTRACT(EPOCH FROM (NOW() - timestamp)) / 60)::INTEGER AS minutes_active
      FROM orders 
      WHERE is_archived = false 
        OR (is_archived = true AND timestamp > NOW() - INTERVAL '1 hour')
      ORDER BY is_archived ASC, timestamp DESC
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
    
    const ordersQuery = `
      SELECT items FROM orders 
      WHERE DATE(timestamp) = $1
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
    `;
    const result = await pool.query(ordersQuery, [targetDate]);
    
    let kitchenCount = 0;
    let baristaCount = 0;
    let barmanCount = 0;
    
    result.rows.forEach(row => {
      let items = row.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (Array.isArray(items)) {
        items.forEach(item => {
          const station = (item.station || "").toLowerCase();
          const category = (item.category || "").toLowerCase();
          if (station === "barista" || category.includes("barista") || category.includes("coffee")) {
            baristaCount += (item.quantity || 1);
          } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink")) {
            barmanCount += (item.quantity || 1);
          } else {
            kitchenCount += (item.quantity || 1);
          }
        });
      }
    });
    
    res.json({
      kitchen: kitchenCount,
      barista: baristaCount,
      barman: barmanCount,
      date: targetDate
    });
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
      dateCondition = "DATE(timestamp) BETWEEN $1 AND $2";
      params = [startDate, endDate];
    } else if (type === "monthly" && month) {
      dateCondition = "TO_CHAR(timestamp, 'YYYY-MM') = $1";
      params = [month];
    } else {
      dateCondition = "DATE(timestamp) = CURRENT_DATE";
      params = [];
    }
    
    const query = `
      SELECT 
        DATE(timestamp) AS date,
        COUNT(*) AS daily_orders,
        COALESCE(SUM(total), 0) AS daily_revenue,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CASH%' THEN total ELSE 0 END), 0) AS daily_cash,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%MTN%' THEN total ELSE 0 END), 0) AS daily_mtn,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS daily_airtel,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CARD%' OR payment_method ILIKE '%VISA%' OR payment_method ILIKE '%POS%' THEN total ELSE 0 END), 0) AS daily_card
      FROM orders 
      WHERE ${dateCondition}
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
      GROUP BY DATE(timestamp)
      ORDER BY DATE(timestamp) ASC
    `;
    
    let result;
    if (params.length > 0) {
      result = await pool.query(query, params);
    } else {
      result = await pool.query(query);
    }
    
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
    const result = await pool.query(`SELECT order_count_goal FROM staff_order_goals WHERE target_date = CURRENT_DATE`);
    res.json(result.rows[0] || { order_count_goal: 20 });
  } catch (err) {
    console.error("Get Staff Goal Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 14. GET CREDITS SUMMARY (Updated to return more detailed data)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits-summary', async (req, res) => {
  try {
    const { period, startDate, endDate, month } = req.query;
    let dateCondition = "";
    let params = [];
    
    if (period === "daily" && startDate) {
      dateCondition = "DATE(created_at) = $1";
      params = [startDate];
    } else if (period === "weekly" && startDate && endDate) {
      dateCondition = "DATE(created_at) BETWEEN $1 AND $2";
      params = [startDate, endDate];
    } else if (period === "monthly" && month) {
      dateCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";
      params = [month];
    } else {
      // Default to today
      dateCondition = "DATE(created_at) = CURRENT_DATE";
      params = [];
    }
    
    const query = `
      SELECT 
        COUNT(*) AS total_credits,
        COALESCE(SUM(CASE WHEN status = 'Approved' THEN amount ELSE 0 END), 0) AS approved_amount,
        COALESCE(SUM(CASE WHEN status = 'FullySettled' OR status = 'PartiallySettled' THEN amount_paid ELSE 0 END), 0) AS settled_amount,
        COALESCE(SUM(CASE WHEN status = 'PendingCashier' OR status = 'PendingManagerApproval' THEN amount ELSE 0 END), 0) AS pending_amount,
        COALESCE(SUM(CASE WHEN status = 'Rejected' THEN amount ELSE 0 END), 0) AS rejected_amount,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved_count,
        COUNT(CASE WHEN status = 'FullySettled' OR status = 'PartiallySettled' THEN 1 END) AS settled_count,
        COUNT(CASE WHEN status = 'PendingCashier' OR status = 'PendingManagerApproval' THEN 1 END) AS pending_count,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected_count
      FROM credits 
      WHERE ${dateCondition}
    `;
    
    let result;
    if (params.length > 0) {
      result = await pool.query(query, params);
    } else {
      result = await pool.query(query);
    }
    
    const row = result.rows[0];
    
    // Calculate outstanding = approved + pending
    const outstanding_amount = Number(row.approved_amount) + Number(row.pending_amount);
    
    res.json({
      total_credits: Number(row.total_credits),
      approved_amount: Number(row.approved_amount),
      settled_amount: Number(row.settled_amount),
      pending_amount: Number(row.pending_amount),
      rejected_amount: Number(row.rejected_amount),
      outstanding_amount: outstanding_amount,
      approved_count: Number(row.approved_count),
      settled_count: Number(row.settled_count),
      pending_count: Number(row.pending_count),
      rejected_count: Number(row.rejected_count)
    });
  } catch (err) {
    console.error("Credits Summary Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. EXPORT TRANSACTION REPORT PDF - WITH CREDITS SUMMARY
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
    
    if (reportType === "daily" && date) {
      dateCondition = "DATE(timestamp) = $1";
      params = [date];
      title = "DAILY TRANSACTION REPORT";
      periodText = new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      filename = `Kurax_Daily_Report_${date}.pdf`;
    } else if (reportType === "weekly" && date) {
      const selectedDate = new Date(date);
      const dayOfWeek = selectedDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      dateCondition = "DATE(timestamp) BETWEEN $1 AND $2";
      params = [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]];
      title = "WEEKLY TRANSACTION REPORT";
      periodText = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      filename = `Kurax_Weekly_Report_${date}.pdf`;
    } else if (reportType === "monthly" && month) {
      dateCondition = "TO_CHAR(timestamp, 'YYYY-MM') = $1";
      params = [month];
      title = "MONTHLY TRANSACTION REPORT";
      const [y, m] = month.split("-");
      periodText = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      filename = `Kurax_Monthly_Report_${month}.pdf`;
    } else {
      return res.status(400).json({ error: "Invalid parameters" });
    }
    
    // Fetch orders
    const ordersQuery = `
      SELECT 
        o.id, 
        o.table_name, 
        COALESCE(s.name, 'Unknown') as staff_name,
        o.total, 
        o.payment_method, 
        o.timestamp, 
        o.status,
        o.items
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE ${dateCondition}
        AND (o.is_archived = true OR o.status IN ('Paid', 'Closed', 'CLOSED'))
      ORDER BY o.timestamp DESC
    `;
    const ordersResult = await pool.query(ordersQuery, params);
    
    // Fetch summary
    const summaryQuery = `
      SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CASH%' THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%MTN%' THEN total ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS total_airtel,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CARD%' OR payment_method ILIKE '%VISA%' OR payment_method ILIKE '%POS%' THEN total ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN payment_method ILIKE '%CREDIT%' OR status = 'Credit' THEN total ELSE 0 END), 0) AS total_credit
      FROM orders 
      WHERE ${dateCondition}
        AND (is_archived = true OR status IN ('Paid', 'Closed', 'CLOSED'))
    `;
    const summaryResult = await pool.query(summaryQuery, params);
    
    // Fetch credits summary for the period
    let creditsCondition = "";
    let creditsParams = [];
    
    if (reportType === "daily" && date) {
      creditsCondition = "DATE(created_at) = $1";
      creditsParams = [date];
    } else if (reportType === "weekly" && date) {
      const selectedDate = new Date(date);
      const dayOfWeek = selectedDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(selectedDate);
      weekStart.setDate(selectedDate.getDate() - diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      creditsCondition = "DATE(created_at) BETWEEN $1 AND $2";
      creditsParams = [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]];
    } else if (reportType === "monthly" && month) {
      creditsCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";
      creditsParams = [month];
    }
    
    const creditsQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'FullySettled' OR status = 'PartiallySettled' THEN amount_paid ELSE 0 END), 0) AS total_settled,
        COALESCE(SUM(CASE WHEN status = 'Approved' THEN amount ELSE 0 END), 0) AS total_approved,
        COALESCE(SUM(CASE WHEN status = 'PendingCashier' OR status = 'PendingManagerApproval' THEN amount ELSE 0 END), 0) AS total_pending,
        COUNT(CASE WHEN status = 'FullySettled' OR status = 'PartiallySettled' THEN 1 END) AS settled_count,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved_count,
        COUNT(CASE WHEN status = 'PendingCashier' OR status = 'PendingManagerApproval' THEN 1 END) AS pending_count,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected_count
      FROM credits 
      WHERE ${creditsCondition}
    `;
    const creditsResult = await pool.query(creditsQuery, creditsParams);
    const credits = creditsResult.rows[0];
    
    // Calculate outstanding = approved + pending
    const totalOutstanding = Number(credits.total_approved) + Number(credits.total_pending);
    const totalSettled = Number(credits.total_settled);
    
    // Fetch petty cash for the period
    let pettyCondition = "";
    let pettyParams = [];
    
    if (reportType === "daily" && date) {
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
      pettyCondition = "DATE(created_at) BETWEEN $1 AND $2";
      pettyParams = [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]];
    } else if (reportType === "monthly" && month) {
      pettyCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";
      pettyParams = [month];
    }
    
    const pettyQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN direction = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN direction = 'IN' THEN amount ELSE 0 END), 0) AS total_in,
        COUNT(CASE WHEN direction = 'OUT' THEN 1 END) AS out_count,
        COUNT(CASE WHEN direction = 'IN' THEN 1 END) AS in_count
      FROM petty_cash 
      WHERE ${pettyCondition}
    `;
    const pettyResult = await pool.query(pettyQuery, pettyParams);
    const petty = pettyResult.rows[0];
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    doc.pipe(res);
    
    // Header
    doc.rect(0, 0, doc.page.width, 5).fill('#EAB308');
    
    doc.font('Helvetica-Bold');
    doc.fontSize(20);
    doc.fillColor('#1a1a2e');
    doc.text('KURAX FOOD LOUNGE & BISTRO', doc.page.width / 2, 45, { align: 'center' });
    
    doc.font('Helvetica');
    doc.fontSize(9);
    doc.fillColor('#d97706');
    doc.text('Luxury Dining & Rooftop Vibes', doc.page.width / 2, 68, { align: 'center' });
    
    doc.font('Helvetica-Bold');
    doc.fontSize(14);
    doc.fillColor('#EAB308');
    doc.text(title, doc.page.width / 2, 95, { align: 'center' });
    
    doc.strokeColor('#E5E7EB');
    doc.lineWidth(1);
    doc.moveTo(50, 115).lineTo(doc.page.width - 50, 115).stroke();
    
    doc.font('Helvetica');
    doc.fontSize(9);
    doc.fillColor('#6B7280');
    doc.text(`Period: ${periodText}`, doc.page.width / 2, 130, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, doc.page.width / 2, 143, { align: 'center' });
    
    let currentY = 170;
    
    // Executive Summary
    const summary = summaryResult.rows[0];
    
    doc.font('Helvetica-Bold');
    doc.fontSize(11);
    doc.fillColor('#1a1a2e');
    doc.text('EXECUTIVE SUMMARY', 50, currentY);
    
    doc.strokeColor('#E5E7EB');
    doc.moveTo(50, currentY + 15).lineTo(doc.page.width - 50, currentY + 15).stroke();
    
    currentY += 25;
    
    const summaryStats = [
      { label: 'Total Orders', value: summary.total_transactions, color: '#3B82F6' },
      { label: 'Total Revenue', value: `UGX ${Number(summary.total_revenue).toLocaleString()}`, color: '#10B981' },
      { label: 'Cash', value: `UGX ${Number(summary.total_cash).toLocaleString()}`, color: '#059669' },
      { label: 'MTN Momo', value: `UGX ${Number(summary.total_mtn).toLocaleString()}`, color: '#D97706' },
      { label: 'Airtel', value: `UGX ${Number(summary.total_airtel).toLocaleString()}`, color: '#DC2626' },
      { label: 'Card/POS', value: `UGX ${Number(summary.total_card).toLocaleString()}`, color: '#8B5CF6' }
    ];
    
    let colX = 50;
    let colY = currentY;
    summaryStats.forEach((stat, idx) => {
      doc.font('Helvetica');
      doc.fontSize(8);
      doc.fillColor('#6B7280');
      doc.text(stat.label, colX, colY);
      doc.font('Helvetica-Bold');
      doc.fontSize(10);
      doc.fillColor(stat.color);
      doc.text(stat.value, colX, colY + 12);
      
      colX += 95;
      if ((idx + 1) % 3 === 0) {
        colX = 50;
        colY += 35;
      }
    });
    
    currentY = colY + 35;
    
    // Credits Summary Section
    doc.font('Helvetica-Bold');
    doc.fontSize(11);
    doc.fillColor('#1a1a2e');
    doc.text('CREDITS SUMMARY', 50, currentY);
    
    doc.strokeColor('#E5E7EB');
    doc.moveTo(50, currentY + 15).lineTo(doc.page.width - 50, currentY + 15).stroke();
    
    currentY += 25;
    
    const creditsStats = [
      { label: 'Credits Settled (Paid)', value: `UGX ${totalSettled.toLocaleString()}`, color: '#10B981' },
      { label: 'Credits Outstanding', value: `UGX ${totalOutstanding.toLocaleString()}`, color: '#F59E0B' },
      { label: 'Approved Credits', value: `UGX ${Number(credits.total_approved).toLocaleString()}`, color: '#8B5CF6' },
      { label: 'Pending Approval', value: `UGX ${Number(credits.total_pending).toLocaleString()}`, color: '#EF4444' },
      { label: 'Total Credits', value: `${Number(credits.settled_count) + Number(credits.approved_count) + Number(credits.pending_count) + Number(credits.rejected_count)}`, color: '#6B7280' }
    ];
    
    colX = 50;
    colY = currentY;
    creditsStats.forEach((stat, idx) => {
      doc.rect(colX, colY, 110, 40).fill('#F9FAFB');
      doc.rect(colX, colY, 110, 40).stroke('#E5E7EB');
      
      doc.font('Helvetica');
      doc.fontSize(7);
      doc.fillColor('#6B7280');
      doc.text(stat.label, colX + 8, colY + 10);
      
      doc.font('Helvetica-Bold');
      doc.fontSize(9);
      doc.fillColor(stat.color);
      doc.text(stat.value, colX + 8, colY + 24);
      
      colX += 120;
      if ((idx + 1) % 4 === 0) {
        colX = 50;
        colY += 55;
      }
    });
    
    currentY = colY + 55;
    
    // Petty Cash Section
    doc.font('Helvetica-Bold');
    doc.fontSize(11);
    doc.fillColor('#1a1a2e');
    doc.text('PETTY CASH SUMMARY', 50, currentY);
    
    doc.strokeColor('#E5E7EB');
    doc.moveTo(50, currentY + 15).lineTo(doc.page.width - 50, currentY + 15).stroke();
    
    currentY += 25;
    
    const pettyStats = [
      { label: 'Total Expenses (OUT)', value: `UGX ${Number(petty.total_out).toLocaleString()}`, color: '#EF4444' },
      { label: 'Total Replenishment (IN)', value: `UGX ${Number(petty.total_in).toLocaleString()}`, color: '#10B981' },
      { label: 'Net Position', value: `UGX ${(Number(petty.total_in) - Number(petty.total_out)).toLocaleString()}`, color: '#8B5CF6' },
      { label: 'Transactions', value: `${petty.out_count || 0} OUT / ${petty.in_count || 0} IN`, color: '#6B7280' }
    ];
    
    colX = 50;
    colY = currentY;
    pettyStats.forEach((stat, idx) => {
      doc.rect(colX, colY, 110, 40).fill('#F9FAFB');
      doc.rect(colX, colY, 110, 40).stroke('#E5E7EB');
      
      doc.font('Helvetica');
      doc.fontSize(7);
      doc.fillColor('#6B7280');
      doc.text(stat.label, colX + 8, colY + 10);
      
      doc.font('Helvetica-Bold');
      doc.fontSize(9);
      doc.fillColor(stat.color);
      doc.text(stat.value, colX + 8, colY + 24);
      
      colX += 120;
    });
    
    currentY += 55;
    
    // Station Breakdown
    let kitchenCount = 0;
    let baristaCount = 0;
    let barmanCount = 0;
    
    ordersResult.rows.forEach(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (Array.isArray(items)) {
        items.forEach(item => {
          const station = (item.station || "").toLowerCase();
          const category = (item.category || "").toLowerCase();
          const qty = item.quantity || 1;
          if (station === "barista" || category.includes("barista") || category.includes("coffee")) {
            baristaCount += qty;
          } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink")) {
            barmanCount += qty;
          } else {
            kitchenCount += qty;
          }
        });
      }
    });
    
    doc.font('Helvetica-Bold');
    doc.fontSize(11);
    doc.fillColor('#1a1a2e');
    doc.text('STATION BREAKDOWN', 50, currentY);
    
    doc.strokeColor('#E5E7EB');
    doc.moveTo(50, currentY + 15).lineTo(doc.page.width - 50, currentY + 15).stroke();
    
    currentY += 30;
    
    const stations = [
      { name: 'KITCHEN', count: kitchenCount, color: '#F59E0B' },
      { name: 'BARISTA (COFFEE)', count: baristaCount, color: '#10B981' },
      { name: 'BARMAN (BAR)', count: barmanCount, color: '#8B5CF6' }
    ];
    
    let stationX = 50;
    stations.forEach(station => {
      doc.rect(stationX, currentY, 140, 50).fill('#F9FAFB');
      doc.rect(stationX, currentY, 140, 50).stroke('#E5E7EB');
      
      doc.font('Helvetica-Bold');
      doc.fontSize(9);
      doc.fillColor('#374151');
      doc.text(station.name, stationX + 10, currentY + 12);
      
      doc.font('Helvetica-Bold');
      doc.fontSize(18);
      doc.fillColor(station.color);
      doc.text(station.count.toString(), stationX + 10, currentY + 28);
      
      stationX += 155;
    });
    
    currentY += 70;
    
    // Order Details Table
    if (ordersResult.rows.length > 0) {
      doc.font('Helvetica-Bold');
      doc.fontSize(11);
      doc.fillColor('#1a1a2e');
      doc.text('ORDER DETAILS', 50, currentY);
      
      doc.strokeColor('#E5E7EB');
      doc.moveTo(50, currentY + 15).lineTo(doc.page.width - 50, currentY + 15).stroke();
      
      currentY += 25;
      
      const headers = ['Order ID', 'Table', 'Staff', 'Amount', 'Method', 'Time'];
      const colWidths = [50, 70, 80, 80, 70, 70];
      
      doc.rect(50, currentY - 3, doc.page.width - 100, 20).fill('#F3F4F6');
      doc.font('Helvetica-Bold');
      doc.fontSize(8);
      doc.fillColor('#374151');
      let headerX = 55;
      headers.forEach((header, i) => {
        doc.text(header, headerX, currentY);
        headerX += colWidths[i];
      });
      
      currentY += 17;
      
      ordersResult.rows.slice(0, 20).forEach((order, idx) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
          doc.font('Helvetica-Bold');
          doc.fontSize(11);
          doc.fillColor('#1a1a2e');
          doc.text('ORDER DETAILS (continued)', 50, currentY);
          currentY += 20;
          doc.rect(50, currentY - 3, doc.page.width - 100, 20).fill('#F3F4F6');
          headerX = 55;
          headers.forEach((header, i) => {
            doc.text(header, headerX, currentY);
            headerX += colWidths[i];
          });
          currentY += 17;
        }
        
        if (idx % 2 === 0) {
          doc.rect(50, currentY - 3, doc.page.width - 100, 16).fill('#F9FAFB');
        }
        
        const row = [
          String(order.id).slice(-6),
          (order.table_name || "—").substring(0, 12),
          (order.staff_name || "—").substring(0, 15),
          `UGX ${Number(order.total).toLocaleString()}`,
          order.payment_method || "—",
          new Date(order.timestamp).toLocaleTimeString()
        ];
        
        let rowX = 55;
        row.forEach((cell, i) => {
          doc.font('Helvetica');
          doc.fontSize(8);
          doc.fillColor('#1F2937');
          doc.text(cell, rowX, currentY);
          rowX += colWidths[i];
        });
        currentY += 16;
      });
    }
    
    // Footer
    const pageCount = doc.page;
    for (let i = 1; i <= pageCount; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica');
      doc.fontSize(8);
      doc.fillColor('#9CA3AF');
      doc.text(
        `KURAX FOOD LOUNGE & BISTRO - Luxury Dining & Rooftop Vibes - Page ${i} of ${pageCount}`,
        doc.page.width / 2,
        doc.page.height - 30,
        { align: 'center' }
      );
    }
    
    doc.end();
  } catch (err) {
    console.error("PDF Export Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;