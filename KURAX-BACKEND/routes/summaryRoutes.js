import express      from 'express';
import pool         from '../db.js';
import logActivity  from '../utils/logsActivity.js';
import PDFDocument  from 'pdfkit';

const router = express.Router();

// ── Kampala date helper - FIXED ───────────────────────────────────────────────
function kampalaDate(d = new Date()) {
  // Create date in Kampala timezone
  const kampalaDate = new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
  const year = kampalaDate.getFullYear();
  const month = String(kampalaDate.getMonth() + 1).padStart(2, '0');
  const day = String(kampalaDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
// ─────────────────────────────────────────────────────────────────────────────
// 1. DAILY SUMMARY (TODAY) - FIXED: Get data directly from orders
// ─────────────────────────────────────────────────────────────────────────────
router.get('/today', async (req, res) => {
  try {
    const today = kampalaDate();
    
    // Get confirmed payments directly from orders (more reliable)
    const ordersResult = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_method != 'Credit' THEN total ELSE 0 END), 0) AS total_gross,
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN total ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN payment_method = 'Momo-MTN' THEN total ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN payment_method = 'Momo-Airtel' THEN total ELSE 0 END), 0) AS total_airtel,
        COALESCE(SUM(CASE WHEN payment_method = 'Credit' THEN total ELSE 0 END), 0) AS total_credit,
        COUNT(*) AS order_count
      FROM orders
      WHERE status IN ('Paid', 'Confirmed', 'Closed', 'Served')
        AND DATE(timestamp AT TIME ZONE 'Africa/Nairobi') = $1
    `, [today]);
    
    // Get credit settlements from credits table for today (informational only)
    const creditSettlements = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN settle_method = 'Cash' THEN amount_paid ELSE 0 END), 0) AS settled_cash,
        COALESCE(SUM(CASE WHEN settle_method = 'Momo-MTN' THEN amount_paid ELSE 0 END), 0) AS settled_mtn,
        COALESCE(SUM(CASE WHEN settle_method = 'Momo-Airtel' THEN amount_paid ELSE 0 END), 0) AS settled_airtel,
        COALESCE(SUM(CASE WHEN settle_method = 'Card' THEN amount_paid ELSE 0 END), 0) AS settled_card,
        COALESCE(SUM(amount_paid), 0) AS total_settled,
        COUNT(*) AS settlement_count
      FROM credits 
      WHERE status IN ('FullySettled', 'PartiallySettled')
        AND DATE(paid_at AT TIME ZONE 'Africa/Nairobi') = $1
    `, [today]);
    
    const orders = ordersResult.rows[0];
    const settlements = creditSettlements.rows[0];
    
    console.log("Today's summary from orders:", {
      date: today,
      total_gross: orders.total_gross,
      total_cash: orders.total_cash,
      total_card: orders.total_card,
      order_count: orders.order_count
    });
    
    res.json({
      summary_date: today,
      total_gross: Number(orders.total_gross),
      total_cash: Number(orders.total_cash),
      total_card: Number(orders.total_card),
      total_mtn: Number(orders.total_mtn),
      total_airtel: Number(orders.total_airtel),
      total_credit: Number(orders.total_credit),
      total_mixed: 0,
      order_count: Number(orders.order_count),
      credit_settlements_today: Number(settlements.total_settled),
      credit_settlements_count: Number(settlements.settlement_count),
      credit_settlements_breakdown: {
        cash: Number(settlements.settled_cash),
        card: Number(settlements.settled_card),
        mtn: Number(settlements.settled_mtn),
        airtel: Number(settlements.settled_airtel)
      }
    });
  } catch (err) {
    console.error('Today summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 2. RANGE & MONTHLY (SALES DATA)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/range', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'Dates required' });
  try {
    const result = await pool.query(
      `SELECT * FROM daily_summary WHERE summary_date BETWEEN $1 AND $2 ORDER BY summary_date DESC`,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PETTY CASH MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────
router.get('/petty-cash', async (req, res) => {
  const date = req.query.date || kampalaDate();
  try {
    const result = await pool.query(
      `SELECT * FROM petty_cash WHERE entry_date = $1 ORDER BY created_at DESC`,
      [date]
    );
    const total_in  = result.rows.filter(r => r.direction === 'IN' ).reduce((s, r) => s + Number(r.amount), 0);
    const total_out = result.rows.filter(r => r.direction === 'OUT').reduce((s, r) => s + Number(r.amount), 0);
    res.json({ date, total_in, total_out, net: total_in - total_out, entries: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/petty-cash', async (req, res) => {
  const { amount, direction, description, logged_by, entry_date, category } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO petty_cash (entry_date, amount, direction, category, description, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [entry_date || kampalaDate(), Number(amount), direction, category || 'General', description, logged_by]
    );
    
    await logActivity(pool, {
      type: 'PETTY',
      actor: logged_by,
      role: 'ACCOUNTANT',
      message: `Petty ${direction}: UGX ${Number(amount).toLocaleString()} (${description})`
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/petty-cash/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM petty_cash WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Petty cash entry not found' });
    }
    res.json({ success: true, entry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/petty-cash/:id', async (req, res) => {
  const { id } = req.params;
  const { amount, direction, category, description, logged_by } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE petty_cash 
       SET amount = $1, direction = $2, category = $3, description = $4, logged_by = $5
       WHERE id = $6
       RETURNING *`,
      [amount, direction, category, description, logged_by, id]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Petty cash update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. MONTHLY FIXED EXPENSES (ACCOUNTANT SETUP)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/monthly-expenses', async (req, res) => {
  const month = req.query.month || kampalaDate().substring(0, 7);
  try {
    const result = await pool.query(
      `SELECT * FROM monthly_expenses WHERE month = $1 ORDER BY category ASC`,
      [month]
    );
    res.json({ month, total: result.rows.reduce((s, r) => s + Number(r.amount), 0), fixed_items: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/monthly-expenses', async (req, res) => {
  const { month, category, amount, description, entered_by } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO monthly_expenses (month, category, amount, description, entered_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (month, category) 
       DO UPDATE SET amount = $3, description = $4, entered_by = $5, updated_at = NOW()
       RETURNING *`,
      [month, category, Number(amount), description, entered_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/monthly-expenses/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM monthly_expenses WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MONTHLY P&L (DIRECTOR AUDIT VIEW) - FIXED: Credit settlements removed from revenue
// ─────────────────────────────────────────────────────────────────────────────
router.get('/monthly-profit', async (req, res) => {
  const month = req.query.month || kampalaDate().substring(0, 7);
  try {
    const salesRes = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN method != 'Credit' THEN amount ELSE 0 END), 0) AS total_gross,
         COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) AS total_cash,
         COALESCE(SUM(CASE WHEN method = 'Card' THEN amount ELSE 0 END), 0) AS total_card,
         COALESCE(SUM(CASE WHEN method IN ('Momo-MTN','Momo-Airtel') THEN amount ELSE 0 END), 0) AS total_momo,
         COUNT(*) AS order_count
       FROM cashier_queue 
       WHERE status = 'Confirmed' 
       AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1`,
      [month]
    );
    
    const creditSettlements = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN settle_method = 'Cash' THEN amount_paid ELSE 0 END), 0) AS settled_cash,
         COALESCE(SUM(CASE WHEN settle_method = 'Momo-MTN' THEN amount_paid ELSE 0 END), 0) AS settled_mtn,
         COALESCE(SUM(CASE WHEN settle_method = 'Momo-Airtel' THEN amount_paid ELSE 0 END), 0) AS settled_airtel,
         COALESCE(SUM(CASE WHEN settle_method = 'Card' THEN amount_paid ELSE 0 END), 0) AS settled_card,
         COALESCE(SUM(amount_paid), 0) AS total_settled,
         COUNT(*) AS settlement_count
       FROM credits 
       WHERE status IN ('FullySettled', 'PartiallySettled')
         AND TO_CHAR((paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1`,
      [month]
    );

    const pettyRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS petty_out FROM petty_cash 
       WHERE direction = 'OUT' AND TO_CHAR(entry_date, 'YYYY-MM') = $1`, [month]
    );
    
    const expRes = await pool.query(`SELECT * FROM monthly_expenses WHERE month = $1`, [month]);

    const sales = salesRes.rows[0];
    const settlements = creditSettlements.rows[0];
    const pettyOut = Number(pettyRes.rows[0].petty_out);
    const fixedTotal = expRes.rows.reduce((s, r) => s + Number(r.amount), 0);
    
    const totalRevenue = Number(sales.total_gross);
    const totalCosts = pettyOut + fixedTotal;
    const netProfit = totalRevenue - totalCosts;

    res.json({
      month,
      sales: { 
        ...sales, 
        total_gross: totalRevenue,
        cashier_gross: Number(sales.total_gross),
        credit_settlements_collected: Number(settlements.total_settled),
        settlement_count: Number(settlements.settlement_count),
        settlement_breakdown: {
          cash: Number(settlements.settled_cash),
          card: Number(settlements.settled_card),
          mtn: Number(settlements.settled_mtn),
          airtel: Number(settlements.settled_airtel)
        }
      },
      costs: { 
        petty_out: pettyOut, 
        fixed_total: fixedTotal, 
        fixed_items: expRes.rows, 
        total: totalCosts 
      },
      net_profit: netProfit,
      margin_pct: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0"
    });
  } catch (err) {
    console.error('Monthly profit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 6. STAFF MONTHLY INCOME (For Performance Dashboard) - FULLY FIXED
// ─────────────────────────────────────────────────────────────────────────────
router.get('/staff-monthly-income', async (req, res) => {
  const { staffId, staffName, month } = req.query;
  
  // Validate required parameters
  if (!staffId && !staffName) {
    return res.status(400).json({ error: 'Either staffId or staffName is required' });
  }
  
  const targetMonth = month || kampalaDate().substring(0, 7);
  
  try {
    let queueTotal = 0;
    let creditTotal = 0;
    let queueBreakdown = { cash: 0, card: 0, mtn: 0, airtel: 0, transaction_count: 0 };
    let creditBreakdown = { cash: 0, card: 0, mtn: 0, airtel: 0, settlement_count: 0 };
    let staffDetails = null;
    
    if (staffId) {
      // ─── Using staffId (preferred method) ────────────────────────────────
      
      // 1. Get cashier_queue payments (these have staff_id directly)
      const queuePayments = await pool.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total,
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) as cash_amount,
          COALESCE(SUM(CASE WHEN method = 'Card' THEN amount ELSE 0 END), 0) as card_amount,
          COALESCE(SUM(CASE WHEN method = 'Momo-MTN' THEN amount ELSE 0 END), 0) as mtn_amount,
          COALESCE(SUM(CASE WHEN method = 'Momo-Airtel' THEN amount ELSE 0 END), 0) as airtel_amount
        FROM cashier_queue
        WHERE status = 'Confirmed'
          AND staff_id = $1
          AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
      `, [staffId, targetMonth]);
      
      queueTotal = Number(queuePayments.rows[0].total);
      queueBreakdown = {
        cash: Number(queuePayments.rows[0].cash_amount),
        card: Number(queuePayments.rows[0].card_amount),
        mtn: Number(queuePayments.rows[0].mtn_amount),
        airtel: Number(queuePayments.rows[0].airtel_amount),
        transaction_count: Number(queuePayments.rows[0].transaction_count)
      };
      
      // 2. Get credit settlements - FIXED: Use LEFT JOIN and fallback to waiter_name
      // First, get the staff's name to use as fallback
      const staffInfo = await pool.query(`
        SELECT name FROM staff WHERE id = $1
      `, [staffId]);
      const staffMemberName = staffInfo.rows[0]?.name || '';
      
      const creditSettlements = await pool.query(`
        SELECT 
          COALESCE(SUM(c.amount_paid), 0) as total,
          COUNT(*) as settlement_count,
          COALESCE(SUM(CASE WHEN c.settle_method = 'Cash' THEN c.amount_paid ELSE 0 END), 0) as cash_amount,
          COALESCE(SUM(CASE WHEN c.settle_method = 'Card' THEN c.amount_paid ELSE 0 END), 0) as card_amount,
          COALESCE(SUM(CASE WHEN c.settle_method = 'Momo-MTN' THEN c.amount_paid ELSE 0 END), 0) as mtn_amount,
          COALESCE(SUM(CASE WHEN c.settle_method = 'Momo-Airtel' THEN c.amount_paid ELSE 0 END), 0) as airtel_amount
        FROM credits c
        LEFT JOIN cashier_queue cq ON c.cashier_queue_id = cq.id
        WHERE c.status IN ('FullySettled', 'PartiallySettled')
          AND TO_CHAR((c.paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
          AND (
            -- If cashier_queue_id exists, match by staff_id
            (c.cashier_queue_id IS NOT NULL AND cq.staff_id = $1)
            OR
            -- If cashier_queue_id is NULL, match by waiter_name
            (c.cashier_queue_id IS NULL AND c.waiter_name ILIKE $3)
          )
      `, [staffId, targetMonth, `%${staffMemberName}%`]);
      
      creditTotal = Number(creditSettlements.rows[0].total);
      creditBreakdown = {
        cash: Number(creditSettlements.rows[0].cash_amount),
        card: Number(creditSettlements.rows[0].card_amount),
        mtn: Number(creditSettlements.rows[0].mtn_amount),
        airtel: Number(creditSettlements.rows[0].airtel_amount),
        settlement_count: Number(creditSettlements.rows[0].settlement_count)
      };
      
      // 3. Get staff details
      const staffDetailsRes = await pool.query(`
        SELECT id, name, role, daily_order_target, monthly_income_target
        FROM staff
        WHERE id = $1
      `, [staffId]);
      
      if (staffDetailsRes.rows.length > 0) {
        staffDetails = staffDetailsRes.rows[0];
      }
      
    } else if (staffName) {
      // ─── Using staffName (fallback) ──────────────────────────────────────
      
      // 1. Get cashier_queue payments
      const queuePayments = await pool.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total,
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) as cash_amount,
          COALESCE(SUM(CASE WHEN method = 'Card' THEN amount ELSE 0 END), 0) as card_amount,
          COALESCE(SUM(CASE WHEN method = 'Momo-MTN' THEN amount ELSE 0 END), 0) as mtn_amount,
          COALESCE(SUM(CASE WHEN method = 'Momo-Airtel' THEN amount ELSE 0 END), 0) as airtel_amount
        FROM cashier_queue
        WHERE status = 'Confirmed'
          AND requested_by ILIKE $1
          AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
      `, [`%${staffName}%`, targetMonth]);
      
      queueTotal = Number(queuePayments.rows[0].total);
      queueBreakdown = {
        cash: Number(queuePayments.rows[0].cash_amount),
        card: Number(queuePayments.rows[0].card_amount),
        mtn: Number(queuePayments.rows[0].mtn_amount),
        airtel: Number(queuePayments.rows[0].airtel_amount),
        transaction_count: Number(queuePayments.rows[0].transaction_count)
      };
      
      // 2. Get credit settlements - FIXED: Use waiter_name directly
      const creditSettlements = await pool.query(`
        SELECT 
          COALESCE(SUM(amount_paid), 0) as total,
          COUNT(*) as settlement_count,
          COALESCE(SUM(CASE WHEN settle_method = 'Cash' THEN amount_paid ELSE 0 END), 0) as cash_amount,
          COALESCE(SUM(CASE WHEN settle_method = 'Card' THEN amount_paid ELSE 0 END), 0) as card_amount,
          COALESCE(SUM(CASE WHEN settle_method = 'Momo-MTN' THEN amount_paid ELSE 0 END), 0) as mtn_amount,
          COALESCE(SUM(CASE WHEN settle_method = 'Momo-Airtel' THEN amount_paid ELSE 0 END), 0) as airtel_amount
        FROM credits
        WHERE status IN ('FullySettled', 'PartiallySettled')
          AND waiter_name ILIKE $1
          AND TO_CHAR((paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
      `, [`%${staffName}%`, targetMonth]);
      
      creditTotal = Number(creditSettlements.rows[0].total);
      creditBreakdown = {
        cash: Number(creditSettlements.rows[0].cash_amount),
        card: Number(creditSettlements.rows[0].card_amount),
        mtn: Number(creditSettlements.rows[0].mtn_amount),
        airtel: Number(creditSettlements.rows[0].airtel_amount),
        settlement_count: Number(creditSettlements.rows[0].settlement_count)
      };
    }
    
    const monthlyIncome = queueTotal + creditTotal;
    
    res.json({
      staff_id: staffId || null,
      staff_name: staffName || (staffDetails?.name || null),
      role: staffDetails?.role || null,
      month: targetMonth,
      monthly_income: monthlyIncome,
      daily_target: staffDetails?.daily_order_target || null,
      monthly_target: staffDetails?.monthly_income_target || null,
      progress_percentage: staffDetails?.monthly_income_target 
        ? Math.min(Math.round((monthlyIncome / staffDetails.monthly_income_target) * 100), 100)
        : null,
      breakdown: {
        from_cashier_queue: {
          amount: queueTotal,
          transaction_count: queueBreakdown.transaction_count,
          details: {
            cash: queueBreakdown.cash,
            card: queueBreakdown.card,
            mtn: queueBreakdown.mtn,
            airtel: queueBreakdown.airtel
          }
        },
        from_credit_settlements: {
          amount: creditTotal,
          settlement_count: creditBreakdown.settlement_count,
          details: {
            cash: creditBreakdown.cash,
            card: creditBreakdown.card,
            mtn: creditBreakdown.mtn,
            airtel: creditBreakdown.airtel
          }
        }
      }
    });
    
  } catch (err) {
    console.error('Staff monthly income error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 7. ALL STAFF MONTHLY INCOME (For Manager/Director View) - FULLY FIXED
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all-staff-monthly-income', async (req, res) => {
  const { month } = req.query;
  const targetMonth = month || kampalaDate().substring(0, 7);
  
  try {
    // Get all staff members
    const staffList = await pool.query(`
      SELECT id, name, role, daily_order_target, monthly_income_target
      FROM staff
      WHERE role IN ('WAITER', 'CASHIER', 'MANAGER', 'SUPERVISOR')
      ORDER BY name
    `);
    
    const staffPerformance = [];
    
    for (const staff of staffList.rows) {
      // Get queue payments
      const queuePayments = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM cashier_queue
        WHERE status = 'Confirmed'
          AND staff_id = $1
          AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
      `, [staff.id, targetMonth]);
      
      // Get credit settlements - FIXED with proper fallback
      const creditSettlements = await pool.query(`
        SELECT COALESCE(SUM(c.amount_paid), 0) as total
        FROM credits c
        LEFT JOIN cashier_queue cq ON c.cashier_queue_id = cq.id
        WHERE c.status IN ('FullySettled', 'PartiallySettled')
          AND TO_CHAR((c.paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
          AND (
            (c.cashier_queue_id IS NOT NULL AND cq.staff_id = $1)
            OR
            (c.cashier_queue_id IS NULL AND c.waiter_name ILIKE $3)
          )
      `, [staff.id, targetMonth, `%${staff.name}%`]);
      
      const queueTotal = Number(queuePayments.rows[0].total);
      const creditTotal = Number(creditSettlements.rows[0].total);
      const monthlyIncome = queueTotal + creditTotal;
      
      staffPerformance.push({
        id: staff.id,
        name: staff.name,
        role: staff.role,
        monthly_income: monthlyIncome,
        monthly_target: staff.monthly_income_target,
        progress_percentage: staff.monthly_income_target 
          ? Math.min(Math.round((monthlyIncome / staff.monthly_income_target) * 100), 100)
          : null,
        breakdown: {
          from_queue: queueTotal,
          from_credits: creditTotal
        }
      });
    }
    
    // Sort by monthly income (highest first)
    staffPerformance.sort((a, b) => b.monthly_income - a.monthly_income);
    
    res.json({
      month: targetMonth,
      total_staff: staffPerformance.length,
      total_company_income: staffPerformance.reduce((sum, s) => sum + s.monthly_income, 0),
      staff_performance: staffPerformance
    });
    
  } catch (err) {
    console.error('All staff monthly income error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────
// 8. DOWNLOAD PDF REPORT (DIRECTOR FEATURE)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export-pdf', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).send("Month is required");

  try {
    const salesData = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN method != 'Credit' THEN amount ELSE 0 END), 0) AS total_gross,
        COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN method = 'Card' THEN amount ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN method = 'Momo-MTN' THEN amount ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN method = 'Momo-Airtel' THEN amount ELSE 0 END), 0) AS total_airtel,
        COUNT(*) AS order_count
      FROM cashier_queue 
      WHERE status = 'Confirmed' 
        AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1
    `, [month]);

    const creditData = await pool.query(`
      SELECT 
        COALESCE(SUM(amount_paid), 0) AS total_settled,
        COALESCE(SUM(CASE WHEN settle_method = 'Cash' THEN amount_paid ELSE 0 END), 0) AS settled_cash,
        COALESCE(SUM(CASE WHEN settle_method = 'Card' THEN amount_paid ELSE 0 END), 0) AS settled_card,
        COALESCE(SUM(CASE WHEN settle_method = 'Momo-MTN' THEN amount_paid ELSE 0 END), 0) AS settled_mtn,
        COALESCE(SUM(CASE WHEN settle_method = 'Momo-Airtel' THEN amount_paid ELSE 0 END), 0) AS settled_airtel,
        COUNT(*) AS settlement_count
      FROM credits 
      WHERE status IN ('FullySettled', 'PartiallySettled')
        AND TO_CHAR((paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1
    `, [month]);

    const pettyData = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS petty_out 
      FROM petty_cash 
      WHERE direction = 'OUT' 
        AND TO_CHAR(entry_date, 'YYYY-MM') = $1
    `, [month]);

    const expenses = await pool.query(`
      SELECT * FROM monthly_expenses WHERE month = $1
    `, [month]);
    
    const sales = salesData.rows[0];
    const credits = creditData.rows[0];
    const pettyOut = Number(pettyData.rows[0].petty_out);
    const fixedTotal = expenses.rows.reduce((s, r) => s + Number(r.amount), 0);
    
    const totalRevenue = Number(sales.total_gross);
    const totalExpenses = pettyOut + fixedTotal;
    const netProfit = totalRevenue - totalExpenses;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Kurax_Report_${month}.pdf`);
    doc.pipe(res);

    doc.fillColor('#EAB308').fontSize(24).font('Helvetica-Bold').text('KURAX BISTRO', { align: 'center' });
    doc.fillColor('#444444').fontSize(12).font('Helvetica').text('Monthly Financial Oversight Report', { align: 'center' }).moveDown();
    doc.text(`Report Period: ${month}`, { align: 'center' }).moveDown(2);

    doc.rect(50, 150, 500, 180).fill('#f9f9f9').stroke('#eeeeee');
    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('Executive Summary', 70, 165);
    
    doc.fontSize(10).font('Helvetica-Bold').text('Total Revenue (Sales Only):', 70, 195);
    doc.fillColor('#EAB308').font('Helvetica-Bold').text(`UGX ${totalRevenue.toLocaleString()}`, 280, 195);
    
    doc.fillColor('#000000').font('Helvetica').text('Breakdown:', 70, 215);
    doc.text(`  • Cash Payments: UGX ${Number(sales.total_cash).toLocaleString()}`, 80, 230);
    doc.text(`  • Card Payments: UGX ${Number(sales.total_card).toLocaleString()}`, 80, 245);
    doc.text(`  • MTN Mobile Money: UGX ${Number(sales.total_mtn).toLocaleString()}`, 80, 260);
    doc.text(`  • Airtel Money: UGX ${Number(sales.total_airtel).toLocaleString()}`, 80, 275);
    
    doc.fillColor('#000000').font('Helvetica-Bold').text('Total Expenses:', 70, 300);
    doc.fillColor('#DC2626').text(`UGX ${totalExpenses.toLocaleString()}`, 280, 300);
    
    doc.fillColor('#000000').font('Helvetica-Bold').text('Net Profit:', 70, 325);
    const profitColor = netProfit >= 0 ? '#10B981' : '#DC2626';
    doc.fillColor(profitColor).text(`UGX ${netProfit.toLocaleString()}`, 280, 325);
    
    if (Number(credits.total_settled) > 0) {
      doc.moveDown(2);
      doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('Credit Settlements Collected', { underline: true }).moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Credit Collections: UGX ${Number(credits.total_settled).toLocaleString()}`, 70, doc.y);
      doc.text(`Number of Settlements: ${Number(credits.settlement_count)}`, 70, doc.y + 15);
      doc.text(`Breakdown:`, 70, doc.y + 30);
      if (Number(credits.settled_cash) > 0) doc.text(`  • Cash: UGX ${Number(credits.settled_cash).toLocaleString()}`, 80, doc.y);
      if (Number(credits.settled_card) > 0) doc.text(`  • Card: UGX ${Number(credits.settled_card).toLocaleString()}`, 80, doc.y);
      if (Number(credits.settled_mtn) > 0) doc.text(`  • MTN: UGX ${Number(credits.settled_mtn).toLocaleString()}`, 80, doc.y);
      if (Number(credits.settled_airtel) > 0) doc.text(`  • Airtel: UGX ${Number(credits.settled_airtel).toLocaleString()}`, 80, doc.y);
      doc.moveDown();
    }

    doc.moveDown(2);
    doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('Verified Fixed Expenses', { underline: true }).moveDown();
    
    if (expenses.rows.length > 0) {
      expenses.rows.forEach((item, index) => {
        doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold').text(`${index + 1}. ${item.category}:`);
        doc.fillColor('#666666').font('Helvetica').text(`   Amount: UGX ${Number(item.amount).toLocaleString()}`, 70, doc.y);
        doc.text(`   Description: ${item.description || 'N/A'}`, 70, doc.y);
        doc.text(`   Recorded by: ${item.entered_by}`, 70, doc.y);
        doc.moveDown(0.5);
      });
    } else {
      doc.fontSize(10).text("No fixed expenses recorded for this period.");
    }

    if (pettyOut > 0) {
      doc.moveDown();
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold').text(`Petty Cash Expenses: UGX ${pettyOut.toLocaleString()}`, 70, doc.y);
    }

    doc.moveDown(3);
    doc.fillColor('#999999').fontSize(8).font('Helvetica').text(
      `Generated on ${new Date().toLocaleString()} · Kurax Bistro Financial System`,
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).send("Error generating report");
  }
});

export default router;