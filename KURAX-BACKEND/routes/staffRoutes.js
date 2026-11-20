import express from 'express';
import pool from '../db.js';
import { createSessionToken, readSessionToken } from '../middleware/sessionTokens.js';
import { hashStaffPin, verifyStaffPin } from '../helpers/staffPin.js';
import notificationService from '../helpers/notificationService.js';
import { assertPinIsAvailable } from '../helpers/pinUniqueness.js';
import { sendAccountPinEmail } from '../helpers/smtp.js';

const router = express.Router();
const ORDERING_ROLES = new Set(['MANAGER', 'SUPERVISOR']);

async function authenticateStaff(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: 'Sign in to manage order permissions.' });

  let session;
  try {
    session = readSessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
  if (session.scope !== 'restaurant' || !Number.isInteger(Number(session.id)) || Number(session.id) < 1) {
    return res.status(401).json({ error: 'A valid restaurant staff session is required.' });
  }
  try {
    const result = await pool.query(
      'SELECT id, name, role, is_active FROM public.staff WHERE id = $1',
      [Number(session.id)]
    );
    const actor = result.rows[0];
    if (!actor || actor.is_active === false || actor.role !== session.role) {
      return res.status(401).json({ error: 'Staff account is inactive or has changed.' });
    }
    req.staffActor = actor;
    return next();
  } catch (error) {
    console.error('Staff permission authentication error:', error.message);
    return res.status(500).json({ error: 'Could not verify staff access.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FETCH ALL STAFF (For dropdown/selection)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_permitted, is_requesting,
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
    res.set('Cache-Control', 'no-store');
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch Staff Error:', err.message);
    res.status(500).json({ error: "Could not retrieve staff list" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STAFF ACTIVATION
router.post('/activate', async (req, res) => {
  const { name, email, pin, role } = req.body;

  if (!name || !email || !pin || !role || !/^\d{4,8}$/.test(String(pin))) {
    return res.status(400).json({ error: "All fields are required." });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const checkUser = await client.query('SELECT email FROM public.staff WHERE lower(trim(email)) = lower(trim($1))', [email]);
    if (checkUser.rows.length > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    await assertPinIsAvailable(client, pin);
    const defaultPermission = (role === 'WAITER' || role === 'DIRECTOR');
    const { salt, hash } = await hashStaffPin(pin);
    
    const newStaff = await client.query(
      `INSERT INTO public.staff (name, email, pin, pin_salt, pin_hash, role, is_permitted, monthly_income_target, daily_order_target)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, 0, 0)
       RETURNING id, name, email, role, is_permitted, monthly_income_target, daily_order_target`,
      [name, email, salt, hash, role, defaultPermission]
    );

    await sendAccountPinEmail({
      name,
      email,
      role,
      pin,
      department: 'Kurax staff',
    });
    await client.query('COMMIT');
    transactionStarted = false;
    return res.status(201).json({
      message: "Account activated and PIN emailed.",
      staff: newStaff.rows[0],
      emailSent: true,
    });
  } catch (err) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Staff activation rollback error:', rollbackError.message);
      }
    }
    if (err.code === 'PIN_ALREADY_IN_USE' || err.code === 'PIN_UNIQUENESS_CONFIG_MISSING') {
      return res.status(err.statusCode || 409).json({ error: err.message });
    }
    if (err.code === 'SMTP_CONFIG_MISSING' || err.code === 'SMTP_SEND_FAILED') {
      console.error('Staff PIN email failed:', err.cause?.message || err.message);
      return res.status(err.code === 'SMTP_CONFIG_MISSING' ? 503 : 502).json({
        error: 'Could not deliver the PIN email. The account was not created; check the backend SMTP settings and try again.',
      });
    }
    console.error('Activation Error:', err.message);
    return res.status(err.code === '23505' ? 400 : 500).json({
      error: err.code === '23505' ? "An account with this email already exists." : "System error: Could not save staff.",
    });
  } finally {
    client?.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. STAFF LOGIN
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, pin } = req.body;
  
  console.log('🔐 Login attempt received');
  
  try {
    if (!email || !pin) {
      return res.status(400).json({ error: "Email and PIN are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const databaseResult = await pool.query('SELECT current_database() AS database_name');
    const userResult = await pool.query(
      `SELECT id, email, name, role, pin_salt, pin_hash, is_active, is_permitted,
              monthly_income_target, daily_order_target
       FROM public.staff
       WHERE lower(trim(email)) = $1`,
      [normalizedEmail]
    );
    let databaseHost = 'not-configured';
    try {
      databaseHost = new URL(process.env.DATABASE_URL).hostname;
    } catch {
      databaseHost = 'invalid-database-url';
    }

    console.info('[staff-login] lookup result', {
      databaseHost,
      database: databaseResult.rows[0]?.database_name || 'unknown',
      schema: 'public',
      table: 'staff',
      matchCount: userResult.rowCount,
      found: userResult.rowCount > 0,
    });
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const foundUser = userResult.rows[0];
    if (foundUser.is_active === false) {
      return res.status(403).json({ error: "This staff account is inactive." });
    }
    if (await verifyStaffPin(String(pin).trim(), foundUser.pin_salt, foundUser.pin_hash)) {
      const user = {
          id: foundUser.id, 
          name: foundUser.name, 
          role: foundUser.role, 
          is_permitted: foundUser.is_permitted,
          monthly_income_target: foundUser.monthly_income_target || 0,
          daily_order_target: foundUser.daily_order_target || 0
      };
      return res.json({
        message: "Login successful",
        user: { ...user, token: createSessionToken({ ...user, scope: 'restaurant' }) }
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
router.patch('/toggle-permission/:id', authenticateStaff, async (req, res) => {
  const { id } = req.params;
  const { is_permitted } = req.body;
  if (req.staffActor.role !== 'DIRECTOR') {
    return res.status(403).json({ error: 'Only the Director can change order permissions.' });
  }
  if (typeof is_permitted !== 'boolean') {
    return res.status(400).json({ error: 'Order permission must be enabled or disabled.' });
  }
  try {
    const result = await pool.query(
      `UPDATE public.staff SET is_permitted = $1, is_requesting = FALSE
       WHERE id = $2 AND UPPER(role) = ANY($3::text[])
       RETURNING id, name, role, is_permitted, is_requesting`,
      [is_permitted, Number(id), [...ORDERING_ROLES]]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Manager or supervisor not found.' });
    const staff = result.rows[0];
    if (is_permitted) {
      const role = String(staff.role || '').toUpperCase();
      const notification = await notificationService.sendToUser(staff.id, {
        type: 'ORDER_PERMISSION_GRANTED',
        title: 'Order access approved',
        body: 'The Director approved your request. You can now take orders.',
        referenceId: staff.id,
        referenceType: 'staff_order_permission',
        link: role === 'SUPERVISOR' ? '/supervisor' : '/staff/manager',
      });
      console.log(
        `[PERMISSION GRANTED] ${staff.name} (${role}, ID: ${staff.id}); ` +
        `notifications sent: ${notification.sent || 0}, failed: ${notification.failed || 0}` +
        `${notification.sent === 0 && !notification.failed ? ', no registered staff devices' : ''}`
      );
    }
    return res.json({ success: true, staff: result.rows[0] });
  } catch (err) {
    console.error('Toggle Permission Error:', err.message);
    res.status(500).json({ error: "Failed to update permission" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. REQUEST ORDERING POWER
// ─────────────────────────────────────────────────────────────────────────────
router.post('/request-permission', authenticateStaff, async (req, res) => {
  if (!ORDERING_ROLES.has(req.staffActor.role)) {
    return res.status(403).json({ error: 'Only managers and supervisors can request order access.' });
  }
  try {
    const result = await pool.query(
      `UPDATE public.staff SET is_requesting = TRUE
       WHERE id = $1 AND COALESCE(is_permitted, FALSE) = FALSE AND COALESCE(is_requesting, FALSE) = FALSE
       RETURNING id, name, role`,
      [req.staffActor.id]
    );
    let staff = result.rows[0];
    if (!staff) {
      const current = await pool.query(
        'SELECT id, name, role, is_permitted, is_requesting FROM public.staff WHERE id = $1',
        [req.staffActor.id]
      );
      if (current.rows[0]?.is_permitted) {
        return res.status(409).json({ error: 'Your account already has order access.' });
      }
      if (!current.rows[0]?.is_requesting) {
        return res.status(404).json({ error: 'Staff account not found.' });
      }
      staff = current.rows[0];
    }

    const notification = await notificationService.sendToRoles(['DIRECTOR'], {
      type: 'ORDER_PERMISSION_REQUEST',
      title: 'Order access request',
      body: `${staff.name} (${staff.role.toLowerCase()}) is requesting permission to take orders.`,
      referenceId: staff.id,
      referenceType: 'staff_order_permission',
      link: '/director?tab=STAFF',
    });
    console.log(
      `[PERMISSION REQUEST] ${staff.name} (${staff.role}, ID: ${staff.id}); ` +
      `director notifications sent: ${notification.sent || 0}, failed: ${notification.failed || 0}` +
      `${notification.noRecipients ? ', no registered Director devices' : ''}`
    );
    return res.status(200).json({ success: true, is_requesting: true });
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
router.get('/permission/:id', authenticateStaff, async (req, res) => {
  const { id } = req.params;
  if (Number(id) !== req.staffActor.id) {
    return res.status(403).json({ error: 'You can only view your own order permission.' });
  }
  try {
    const result = await pool.query('SELECT is_permitted, is_requesting FROM public.staff WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({
      is_granted: result.rows[0].is_permitted,
      is_requesting: result.rows[0].is_requesting,
    });
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

  let client;
  let transactionStarted = false;
  try {
    let result;
    if (pin !== undefined && pin !== null && pin !== '') {
      const staffId = Number(id);
      if (!Number.isInteger(staffId) || staffId <= 0) {
        return res.status(400).json({ error: 'A valid staff account is required.' });
      }
      if (!/^\d{4,8}$/.test(String(pin))) {
        return res.status(400).json({ error: 'PIN must be 4-8 digits.' });
      }
      client = await pool.connect();
      await client.query('BEGIN');
      transactionStarted = true;
      await assertPinIsAvailable(client, String(pin), { excludeStaffId: staffId });
      const { salt, hash } = await hashStaffPin(pin);
      result = await client.query(
        `UPDATE public.staff
         SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role),
             pin = NULL, pin_salt = $4, pin_hash = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING id, name, email, role, monthly_income_target, daily_order_target`,
        [name, email, role, salt, hash, staffId]
      );
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(404).json({ error: "Staff member not found" });
      }
      await client.query('COMMIT');
      transactionStarted = false;
    } else {
      result = await pool.query(
        `UPDATE public.staff
         SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, name, email, role, monthly_income_target, daily_order_target`,
        [name, email, role, id]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    console.log(`👤 STAFF UPDATED | ID: ${id} | Name: ${result.rows[0].name}`);
    return res.json({ success: true, staff: result.rows[0] });
  } catch (err) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Staff update rollback error:', rollbackError.message);
      }
    }
    if (err.code === 'PIN_ALREADY_IN_USE' || err.code === 'PIN_UNIQUENESS_CONFIG_MISSING') {
      return res.status(err.statusCode || 409).json({ error: err.message });
    }
    console.error('Update Staff Error:', err.message);
    return res.status(500).json({ error: "Failed to update staff details" });
  } finally {
    client?.release();
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