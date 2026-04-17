import express from 'express';
import pool from '../db.js';
import nodemailer from 'nodemailer';

const router = express.Router();

/**
 * EMAIL CONFIGURATION
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. FETCH ALL STAFF (For dropdown/selection)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, pin, is_permitted, is_requesting, 
              monthly_income_target, daily_order_target 
       FROM staff 
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
    console.error('Fetch Staff Error:', err.message);
    res.status(500).json({ error: "Could not retrieve staff list" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STAFF ACTIVATION
// ─────────────────────────────────────────────────────────────────────────────
router.post('/activate', async (req, res) => {
  const { name, email, pin, role } = req.body;

  if (!name || !email || !pin || !role) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const checkUser = await pool.query('SELECT email FROM staff WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const defaultPermission = (role === 'WAITER' || role === 'DIRECTOR');
    
    const newStaff = await pool.query(
      `INSERT INTO staff (name, email, pin, role, is_permitted, monthly_income_target, daily_order_target) 
       VALUES ($1, $2, $3, $4, $5, 0, 0) 
       RETURNING id, name, email, role, is_permitted, monthly_income_target, daily_order_target`,
      [name, email, pin, role, defaultPermission]
    );

    res.status(201).json({ message: "✅ Account activated!", staff: newStaff.rows[0] });

    // Background Email
    transporter.sendMail({
      from: `"Kurax Lounge & Bistro" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to the Team',
      html: `<h1 style="color: #eab308;">Welcome, ${name}!</h1><p>Your PIN: <b>${pin}</b></p><p>Role: ${role}</p>`
    }).catch(err => console.error("Mail Error:", err.message));

  } catch (err) {
    console.error('Activation Error:', err.message);
    res.status(500).json({ error: "System error: Could not save staff." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. STAFF LOGIN
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, pin } = req.body;
  
  console.log('🔐 Login attempt received');
  console.log('📧 Email:', email);
  
  try {
    if (!email || !pin) {
      return res.status(400).json({ error: "Email and PIN are required" });
    }

    const userResult = await pool.query('SELECT * FROM staff WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const foundUser = userResult.rows[0];
    const inputPin = String(pin).trim();
    const storedPin = String(foundUser.pin).trim();

    if (inputPin === storedPin) {
      return res.json({
        message: "Login successful",
        user: { 
          id: foundUser.id, 
          name: foundUser.name, 
          role: foundUser.role, 
          is_permitted: foundUser.is_permitted,
          monthly_income_target: foundUser.monthly_income_target || 0,
          daily_order_target: foundUser.daily_order_target || 0
        }
      });
    } else {
      return res.status(401).json({ error: "Invalid PIN" });
    }
  } catch (err) {
    console.error('Login Error:', err.message);
    return res.status(500).json({ error: "Server error during login" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. TOGGLE PERMISSION & RESET REQUEST
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/toggle-permission/:id', async (req, res) => {
  const { id } = req.params;
  const { is_permitted } = req.body;
  try {
    await pool.query(
      'UPDATE staff SET is_permitted = $1, is_requesting = FALSE WHERE id = $2',
      [is_permitted, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle Permission Error:', err.message);
    res.status(500).json({ error: "Failed to update permission" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. REQUEST ORDERING POWER
// ─────────────────────────────────────────────────────────────────────────────
router.post('/request-permission', async (req, res) => {
  const { staffId, staffName } = req.body;
  try {
    await pool.query('UPDATE staff SET is_requesting = TRUE WHERE id = $1', [staffId]);
    console.log(`\n[PERMISSION REQUEST] 🔔 from ${staffName} (ID: ${staffId})`);
    res.status(200).json({ success: true, message: "Request logged." });
  } catch (err) {
    console.error('Request Permission Error:', err.message);
    res.status(500).json({ error: "Failed to send request." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. FETCH PERFORMANCE LIST (For Manager Targets Dashboard)
// Returns staff with their targets and actual performance
// ─────────────────────────────────────────────────────────────────────────────
router.get("/performance-list", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         id, 
         name, 
         role, 
         monthly_income_target, 
         daily_order_target,
         is_permitted
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
// 7. FETCH STAFF WITH ACTUAL PERFORMANCE (For Reports)
// Returns staff with their actual performance data for a given period
// ─────────────────────────────────────────────────────────────────────────────
router.get("/performance-with-actuals", async (req, res) => {
  try {
    const { period, month, startDate, endDate } = req.query;
    let dateCondition = "";
    let params = [];
    
    // Build date condition based on period
    if (period === "monthly" && month) {
      dateCondition = "TO_CHAR(o.timestamp, 'YYYY-MM') = $1";
      params = [month];
    } else if (period === "daily" && startDate) {
      dateCondition = "DATE(o.timestamp) = $1";
      params = [startDate];
    } else if (period === "weekly" && startDate && endDate) {
      dateCondition = "DATE(o.timestamp) BETWEEN $1 AND $2";
      params = [startDate, endDate];
    } else {
      // Default to current month
      const currentMonth = new Date().toISOString().substring(0, 7);
      dateCondition = "TO_CHAR(o.timestamp, 'YYYY-MM') = $1";
      params = [currentMonth];
    }
    
    // Query to get staff with their actual performance
    const query = `
      SELECT 
        s.id,
        s.name,
        s.role,
        s.monthly_income_target,
        s.daily_order_target,
        COALESCE(COUNT(DISTINCT o.id), 0) AS actual_orders,
        COALESCE(SUM(o.total), 0) AS actual_revenue,
        COALESCE(SUM(CASE WHEN o.payment_method ILIKE '%CASH%' THEN o.total ELSE 0 END), 0) AS cash_revenue,
        COALESCE(SUM(CASE WHEN o.payment_method ILIKE '%MTN%' THEN o.total ELSE 0 END), 0) AS mtn_revenue,
        COALESCE(SUM(CASE WHEN o.payment_method ILIKE '%AIRTEL%' THEN o.total ELSE 0 END), 0) AS airtel_revenue,
        COALESCE(SUM(CASE WHEN o.payment_method ILIKE '%CARD%' OR o.payment_method ILIKE '%VISA%' OR o.payment_method ILIKE '%POS%' THEN o.total ELSE 0 END), 0) AS card_revenue
      FROM staff s
      LEFT JOIN orders o ON (o.waiter_name ILIKE s.name OR o.staff_name ILIKE s.name)
        AND ${dateCondition}
        AND (o.is_archived = true OR o.status IN ('Paid', 'Closed', 'CLOSED'))
      WHERE s.role IN ('WAITER', 'MANAGER', 'SUPERVISOR')
      GROUP BY s.id, s.name, s.role, s.monthly_income_target, s.daily_order_target
      ORDER BY actual_revenue DESC
    `;
    
    const result = await pool.query(query, params);
    
    // Calculate target per staff if monthly target exists
    let monthlyTarget = 0;
    if (period === "monthly" && month) {
      const targetQuery = await pool.query(
        `SELECT revenue_goal FROM business_targets WHERE month_key = $1`,
        [month]
      );
      monthlyTarget = targetQuery.rows[0]?.revenue_goal || 0;
    }
    
    const activeStaffCount = result.rows.length;
    const targetPerStaff = activeStaffCount > 0 && monthlyTarget > 0 ? monthlyTarget / activeStaffCount : 0;
    
    // Add progress percentage
    const staffWithProgress = result.rows.map(staff => ({
      ...staff,
      target: targetPerStaff,
      progress: targetPerStaff > 0 ? ((staff.actual_revenue / targetPerStaff) * 100).toFixed(1) : 0
    }));
    
    res.json({
      staff: staffWithProgress,
      summary: {
        total_revenue: staffWithProgress.reduce((sum, s) => sum + s.actual_revenue, 0),
        total_orders: staffWithProgress.reduce((sum, s) => sum + parseInt(s.actual_orders), 0),
        active_staff: activeStaffCount,
        monthly_target: monthlyTarget,
        target_per_staff: targetPerStaff
      }
    });
  } catch (err) {
    console.error("Performance With Actuals Error:", err.message);
    res.status(500).json({ error: "Failed to load staff performance data" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. UPDATE STAFF TARGETS
// Allows Manager/Director to set quotas for staff members
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/update-targets", async (req, res) => {
  const { staff_id, income_target, order_target } = req.body;

  if (!staff_id) {
    return res.status(400).json({ error: "Staff ID is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE staff 
       SET monthly_income_target = $1, 
           daily_order_target = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, name, role`,
      [
        Number(income_target) || 0, 
        Number(order_target) || 0, 
        staff_id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    console.log(`🎯 TARGET UPDATED | ${result.rows[0].name} | Income: ${income_target} | Orders: ${order_target}`);

    res.json({ 
      success: true, 
      message: `Targets synchronized for ${result.rows[0].name}`,
      staff: result.rows[0]
    });
  } catch (err) {
    console.error("Target Update Error:", err.message);
    res.status(500).json({ error: "Database synchronization failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET STAFF DETAILS BY ID
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_permitted, is_requesting, 
              monthly_income_target, daily_order_target, created_at
       FROM staff WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get Staff Error:', err.message);
    res.status(500).json({ error: "Failed to retrieve staff details" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. TERMINATE STAFF
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/terminate/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // First check if staff exists
    const checkResult = await pool.query('SELECT name FROM staff WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    
    await pool.query('DELETE FROM staff WHERE id = $1', [id]);
    console.log(`🗑️ STAFF TERMINATED | ${checkResult.rows[0].name} (ID: ${id})`);
    res.json({ success: true, message: `Staff member terminated successfully` });
  } catch (err) {
    console.error('Terminate Staff Error:', err.message);
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. LIVE PERMISSION SYNC (For Frontend polling)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/permission/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT is_permitted FROM staff WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ is_granted: result.rows[0].is_permitted });
  } catch (err) {
    console.error('Permission Sync Error:', err.message);
    res.status(500).json({ error: "Sync error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. UPDATE STAFF DETAILS (General)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/update/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, role, pin } = req.body;

  try {
    const result = await pool.query(
      `UPDATE staff 
       SET name = COALESCE($1, name), 
           email = COALESCE($2, email), 
           role = COALESCE($3, role),
           pin = COALESCE($4, pin),
           updated_at = NOW()
       WHERE id = $5 
       RETURNING id, name, email, role, monthly_income_target, daily_order_target`,
      [name, email, role, pin, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    console.log(`👤 STAFF UPDATED | ID: ${id} | Name: ${result.rows[0].name}`);
    res.json({ success: true, staff: result.rows[0] });
  } catch (err) {
    console.error('Update Staff Error:', err.message);
    res.status(500).json({ error: "Failed to update staff details" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. GET STAFF PERFORMANCE SUMMARY (For Dashboard)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/performance-summary', async (req, res) => {
  try {
    const { period, date } = req.query;
    let dateCondition = "";
    let params = [];
    
    if (period === "daily" && date) {
      dateCondition = "DATE(o.timestamp) = $1";
      params = [date];
    } else if (period === "monthly" && date) {
      dateCondition = "TO_CHAR(o.timestamp, 'YYYY-MM') = $1";
      params = [date];
    } else {
      // Default to current month
      const currentMonth = new Date().toISOString().substring(0, 7);
      dateCondition = "TO_CHAR(o.timestamp, 'YYYY-MM') = $1";
      params = [currentMonth];
    }
    
    const query = `
      SELECT 
        s.id,
        s.name,
        s.role,
        s.monthly_income_target,
        s.daily_order_target,
        COUNT(DISTINCT o.id) AS total_orders,
        COALESCE(SUM(o.total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN o.payment_method ILIKE '%CASH%' THEN o.total ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN o.payment_method ILIKE '%MTN%' OR o.payment_method ILIKE '%AIRTEL%' THEN o.total ELSE 0 END), 0) AS mobile_money_sales,
        COALESCE(SUM(CASE WHEN o.payment_method ILIKE '%CARD%' OR o.payment_method ILIKE '%VISA%' OR o.payment_method ILIKE '%POS%' THEN o.total ELSE 0 END), 0) AS card_sales
      FROM staff s
      LEFT JOIN orders o ON (o.waiter_name ILIKE s.name OR o.staff_name ILIKE s.name)
        AND ${dateCondition}
        AND (o.is_archived = true OR o.status IN ('Paid', 'Closed', 'CLOSED'))
      WHERE s.role IN ('WAITER', 'MANAGER', 'SUPERVISOR')
      GROUP BY s.id, s.name, s.role, s.monthly_income_target, s.daily_order_target
      ORDER BY total_revenue DESC
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Performance Summary Error:', err.message);
    res.status(500).json({ error: "Failed to load performance summary" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. BULK UPDATE STAFF TARGETS (For setting targets for multiple staff)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/bulk-update-targets', async (req, res) => {
  const { targets } = req.body; // Array of { staff_id, income_target, order_target }
  
  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ error: "Targets array is required" });
  }
  
  try {
    const results = [];
    for (const target of targets) {
      const { staff_id, income_target, order_target } = target;
      const result = await pool.query(
        `UPDATE staff 
         SET monthly_income_target = $1, 
             daily_order_target = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, name`,
        [Number(income_target) || 0, Number(order_target) || 0, staff_id]
      );
      if (result.rowCount > 0) {
        results.push(result.rows[0]);
      }
    }
    
    console.log(`🎯 BULK TARGETS UPDATED | ${results.length} staff members`);
    res.json({ success: true, updated: results.length, staff: results });
  } catch (err) {
    console.error('Bulk Update Targets Error:', err.message);
    res.status(500).json({ error: "Failed to update targets" });
  }
});

export default router;