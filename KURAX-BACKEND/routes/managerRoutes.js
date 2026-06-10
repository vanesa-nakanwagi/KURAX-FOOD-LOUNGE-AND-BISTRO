import express from 'express';
import pool from '../db.js';
import PDFDocument from 'pdfkit';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────
function calculateOrderStatusFromItems(items, currentStatus) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return currentStatus;
  }

  let paidItemsCount    = 0;
  let creditItemsCount  = 0;
  let pendingItemsCount = 0;
  let voidedCount       = 0;

  items.forEach(item => {
    const isVoided = item.status === 'VOIDED' || item.voidProcessed === true;
    const isCredit =
      item.creditRequested === true ||
      (item.payment_method || '').toUpperCase().includes('CREDIT');
    const isPaid = !isCredit && item._rowPaid === true;

    if (isVoided)       voidedCount++;
    else if (isPaid)    paidItemsCount++;
    else if (isCredit)  creditItemsCount++;
    else                pendingItemsCount++;
  });

  const totalActiveItems = items.length - voidedCount;
  if (totalActiveItems === 0)                                                   return 'Voided';
  if (paidItemsCount === totalActiveItems)                                      return 'Paid';
  if (paidItemsCount > 0 && (creditItemsCount > 0 || pendingItemsCount > 0))   return 'Partially Paid';
  if (creditItemsCount > 0 && paidItemsCount === 0)                             return 'Credit Pending';
  if (voidedCount > 0 && paidItemsCount === 0 && creditItemsCount === 0)        return 'Voided';
  return 'Pending';
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const PAID_ORDER_FILTER = `
  AND (
    o.is_archived = true
    OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'credit', 'served')
  )
  AND o.payment_confirmed = true
  AND UPPER(COALESCE(o.payment_method,'')) NOT LIKE '%CREDIT%'
`;

const STAFF_NAME_EXPR = `COALESCE(s.name, o.staff_name, o.waiter_name, 'Unknown')`;

function orderDateCondition(type, { date, month, startDate, endDate }) {
  const col = `COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi'`;
  if (type === 'daily')   return { cond: `DATE(${col}) = $1`,                     params: [date] };
  if (type === 'weekly')  return { cond: `DATE(${col}) BETWEEN $1 AND $2`,        params: [startDate, endDate] };
  if (type === 'monthly') return { cond: `TO_CHAR(${col}, 'YYYY-MM') = $1`,       params: [month] };
  return { cond: `DATE(${col}) = CURRENT_DATE`, params: [] };
}

function creditDateCondition(type, { date, month, startDate, endDate }) {
  const col = `cs.created_at AT TIME ZONE 'Africa/Nairobi'`;
  if (type === 'daily')   return { cond: `DATE(${col}) = $1`,               params: [date] };
  if (type === 'weekly')  return { cond: `DATE(${col}) BETWEEN $1 AND $2`,  params: [startDate, endDate] };
  if (type === 'monthly') return { cond: `TO_CHAR(${col}, 'YYYY-MM') = $1`, params: [month] };
  return { cond: `DATE(${col}) = CURRENT_DATE`, params: [] };
}

// Helper to add time filter (HH:MI) to a timestamp column
function applyTimeFilter(columnAlias, startTime, endTime) {
  if (!startTime && !endTime) return '';
  const conditions = [];
  if (startTime) conditions.push(`TO_CHAR(${columnAlias} AT TIME ZONE 'Africa/Nairobi', 'HH24:MI') >= '${startTime}'`);
  if (endTime)   conditions.push(`TO_CHAR(${columnAlias} AT TIME ZONE 'Africa/Nairobi', 'HH24:MI') <= '${endTime}'`);
  return conditions.length ? `AND ${conditions.join(' AND ')}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET TARGET PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/target-progress', async (req, res) => {
  try {
    const monthKey = req.query.month || new Date().toISOString().substring(0, 7);

    const revenueResult = await pool.query(`
      SELECT COALESCE(SUM(o.total), 0) AS current_total
      FROM orders o
      WHERE TO_CHAR(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND (
          o.is_archived = true
          OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'credit', 'served')
        )
        AND o.payment_confirmed = true
        AND UPPER(COALESCE(o.payment_method,'')) NOT LIKE '%CREDIT%'
    `, [monthKey]);

    const creditResult = await pool.query(`
      SELECT COALESCE(SUM(cs.amount_paid), 0) AS credit_settled
      FROM credit_settlements cs
      JOIN credits c ON cs.credit_id = c.id
      WHERE TO_CHAR(cs.created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND c.status IN ('FullySettled', 'PartiallySettled')
    `, [monthKey]);

    const currentTotal  = parseFloat(revenueResult.rows[0].current_total || 0);
    const creditSettled = parseFloat(creditResult.rows[0].credit_settled  || 0);
    const totalWithCredits = currentTotal + creditSettled;

    const targetResult = await pool.query(
      `SELECT revenue_goal FROM business_targets WHERE month_key = $1`, [monthKey]
    );
    const targetGoal = parseFloat(targetResult.rows[0]?.revenue_goal || 6000000);
    const percentage = targetGoal > 0
      ? parseFloat(((totalWithCredits / targetGoal) * 100).toFixed(2))
      : 0;

    const todayResult = await pool.query(`
      SELECT COALESCE(SUM(CASE 
        WHEN UPPER(COALESCE(o.payment_method,'')) NOT LIKE '%CREDIT%' AND o.payment_confirmed = true 
        THEN o.total ELSE 0 END), 0) AS cash_revenue
      FROM orders o
      WHERE DATE(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi') = DATE(NOW() AT TIME ZONE 'Africa/Nairobi')
        AND (
          o.is_archived = true
          OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'credit', 'served')
        )
    `);

    const todayCreditResult = await pool.query(`
      SELECT COALESCE(SUM(cs.amount_paid), 0) AS credit_settled
      FROM credit_settlements cs
      JOIN credits c ON cs.credit_id = c.id
      WHERE DATE(cs.created_at AT TIME ZONE 'Africa/Nairobi') = DATE(NOW() AT TIME ZONE 'Africa/Nairobi')
        AND c.status IN ('FullySettled', 'PartiallySettled')
    `);

    const todayRevenue =
      parseFloat(todayResult.rows[0].cash_revenue || 0) +
      parseFloat(todayCreditResult.rows[0].credit_settled || 0);

    res.json({ target: targetGoal, current: totalWithCredits, percentage, todayRevenue });
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
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];

    const ordersResult = await pool.query(`
      SELECT id, table_name, total, payment_method, status,
             payment_confirmed, items, timestamp
      FROM orders 
      WHERE DATE(COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi') = $1
        AND (
          is_archived = true
          OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit', 'served')
        )
        AND payment_confirmed = true
    `, [targetDate]);

    let cashTotal = 0, mtnTotal = 0, airtelTotal = 0, cardTotal = 0, creditTotal = 0, totalGross = 0;
    const uniqueOrderIds = new Set();

    for (const order of ordersResult.rows) {
      let items = order.items;
      if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
      if (!Array.isArray(items)) items = [];

      let orderConfirmedTotal = 0;
      let orderHasConfirmedPayment = false;

      for (const item of items) {
        const isItemPaid = item._rowPaid === true;
        if (!isItemPaid) continue;

        const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
        orderConfirmedTotal += itemTotal;
        orderHasConfirmedPayment = true;

        const method = ((item.payment_method || order.payment_method || 'Cash')).toUpperCase();
        if      (method.includes('CASH'))                                         cashTotal   += itemTotal;
        else if (method.includes('MTN'))                                          mtnTotal    += itemTotal;
        else if (method.includes('AIRTEL'))                                       airtelTotal += itemTotal;
        else if (method.includes('CARD') || method.includes('VISA') || method.includes('POS')) cardTotal += itemTotal;
        else if (method.includes('CREDIT')) {
          if (item.credit_approved === true || item.credit_status === 'Approved') creditTotal += itemTotal;
        } else                                                                    cashTotal   += itemTotal;
      }

      if (orderHasConfirmedPayment) {
        uniqueOrderIds.add(order.id);
        totalGross += orderConfirmedTotal;
      }
    }

    const csResult = await pool.query(`
      SELECT 
        COALESCE(SUM(cs.amount_paid), 0) AS total_settled,
        COALESCE(SUM(CASE WHEN LOWER(cs.method) = 'cash'                                    THEN cs.amount_paid ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN LOWER(cs.method) IN ('card','visa','pos')                    THEN cs.amount_paid ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN LOWER(cs.method) = 'momo-mtn'                                THEN cs.amount_paid ELSE 0 END), 0) AS mtn,
        COALESCE(SUM(CASE WHEN LOWER(cs.method) = 'momo-airtel'                             THEN cs.amount_paid ELSE 0 END), 0) AS airtel,
        COUNT(*) AS credit_settlement_count
      FROM credit_settlements cs
      JOIN credits c ON cs.credit_id = c.id
      WHERE DATE(cs.created_at AT TIME ZONE 'Africa/Nairobi') = $1
        AND c.status IN ('FullySettled', 'PartiallySettled')
    `, [targetDate]);
    const cs = csResult.rows[0];

    const pendingCreditResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS pending_credit_total, COUNT(*) AS pending_credit_count
      FROM credits
      WHERE DATE(created_at AT TIME ZONE 'Africa/Nairobi') = $1 AND status = 'Approved'
    `, [targetDate]);

    res.json({
      total_gross:             totalGross + Number(cs.total_settled),
      total_orders:            uniqueOrderIds.size,
      cash_total:              cashTotal   + Number(cs.cash),
      mtn_total:               mtnTotal    + Number(cs.mtn),
      airtel_total:            airtelTotal + Number(cs.airtel),
      card_total:              cardTotal   + Number(cs.card),
      credit_total:            Number(pendingCreditResult.rows[0].pending_credit_total),
      credit_settled:          Number(cs.total_settled),
      credit_pending_count:    pendingCreditResult.rows[0].pending_credit_count,
      credit_settlement_count: cs.credit_settlement_count
    });
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
    const { type, startDate, endDate, month, start_time, end_time } = req.query;
    const date = startDate;
    const { cond, params } = orderDateCondition(type, { date, month, startDate, endDate });
    const timeFilter = applyTimeFilter('COALESCE(o.timestamp, o.created_at)', start_time, end_time);

    const ordersResult = await pool.query(`
      SELECT 
        o.id, o.table_name,
        ${STAFF_NAME_EXPR} AS staff_name,
        o.total, o.payment_method,
        COALESCE(o.timestamp, o.created_at) AS timestamp,
        o.status, o.items, o.is_archived, o.payment_confirmed
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE ${cond} ${PAID_ORDER_FILTER}
        ${timeFilter}
      ORDER BY COALESCE(o.timestamp, o.created_at) DESC
    `, params);

    const plainCond = cond.replace(/o\./g, '');
    const plainFilter = `
      AND (
        is_archived = true
        OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit', 'served')
      )
      AND payment_confirmed = true
      AND UPPER(COALESCE(payment_method,'')) NOT LIKE '%CREDIT%'
    `;
    const plainTimeFilter = applyTimeFilter('created_at', start_time, end_time).replace(/AT TIME ZONE 'Africa\/Nairobi'/g, '');
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CASH%'   THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%MTN%'    THEN total ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS total_airtel,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CARD%'
                       OR UPPER(payment_method) LIKE '%VISA%'
                       OR UPPER(payment_method) LIKE '%POS%'         THEN total ELSE 0 END), 0) AS total_card
      FROM orders 
      WHERE ${plainCond} ${plainFilter}
        ${plainTimeFilter}
    `, params);

    const { cond: creditCond, params: creditParams } = creditDateCondition(type, { date, month, startDate, endDate });
    const creditTimeFilter = applyTimeFilter('c.created_at', start_time, end_time);
    const creditSummaryResult = await pool.query(`
      SELECT COALESCE(SUM(cs.amount_paid), 0) AS credit_settled
      FROM credit_settlements cs
      JOIN credits c ON cs.credit_id = c.id
      WHERE ${creditCond} AND c.status IN ('FullySettled', 'PartiallySettled')
        ${creditTimeFilter}
    `, creditParams);

    const staffResult = await pool.query(`
      SELECT 
        ${STAFF_NAME_EXPR} AS staff_name,
        COUNT(*) AS orders_count,
        COALESCE(SUM(o.total), 0) AS total_revenue,
        MAX(COALESCE(s.role, 'WAITER')) AS role
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE ${cond} ${PAID_ORDER_FILTER}
        ${timeFilter}
      GROUP BY ${STAFF_NAME_EXPR}
      ORDER BY total_revenue DESC
    `, params);

    let kitchenCount = 0, baristaCount = 0, barmanCount = 0;
    ordersResult.rows.forEach(order => {
      let items = order.items;
      if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
      if (Array.isArray(items)) {
        items.forEach(item => {
          const station  = (item.station  || "").toLowerCase();
          const category = (item.category || "").toLowerCase();
          const qty = Number(item.quantity) || 1;
          if (station === "barista" || category.includes("barista") || category.includes("coffee") || category.includes("tea")) baristaCount += qty;
          else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink") || category.includes("beer")) barmanCount += qty;
          else kitchenCount += qty;
        });
      }
    });

    res.json({
      orders:           ordersResult.rows,
      summary: {
        ...summaryResult.rows[0],
        total_revenue:  Number(summaryResult.rows[0].total_revenue) + Number(creditSummaryResult.rows[0].credit_settled),
        credit_settled: Number(creditSummaryResult.rows[0].credit_settled)
      },
      staffPerformance:  staffResult.rows,
      stationBreakdown:  { kitchen: kitchenCount, barista: baristaCount, barman: barmanCount }
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
    const result = await pool.query(`
      SELECT 
        id, name, email, role, is_permitted, is_requesting,
        monthly_income_target, daily_order_target
      FROM staff 
      WHERE role IN ('WAITER', 'MANAGER', 'SUPERVISOR', 'CHEF', 'BARISTA', 'BARMAN')
      ORDER BY 
        CASE role 
          WHEN 'MANAGER'    THEN 1 
          WHEN 'SUPERVISOR' THEN 2 
          WHEN 'WAITER'     THEN 3 
          WHEN 'BARISTA'    THEN 4
          WHEN 'BARMAN'     THEN 5
          WHEN 'CHEF'       THEN 6
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
// 5. STAFF PERFORMANCE MONTHLY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/staff-performance/monthly', async (req, res) => {
  try {
    const targetMonth = req.query.month || new Date().toISOString().substring(0, 7);

    const grossResult = await pool.query(`
      SELECT 
        s.id AS staff_id,
        COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name,
        COALESCE(s.role, 'WAITER') AS role,
        COUNT(DISTINCT o.id) AS orders_count,
        COALESCE(SUM(o.total), 0) AS gross_revenue
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE TO_CHAR(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'served', 'credit')
        AND UPPER(COALESCE(o.payment_method,'')) NOT LIKE '%CREDIT%'
      GROUP BY s.id, COALESCE(s.name, o.staff_name, 'Unknown'), COALESCE(s.role, 'WAITER')
    `, [targetMonth]);

    const creditsResult = await pool.query(`
      SELECT 
        COALESCE(c.requested_by, 'Unknown') AS staff_name,
        COALESCE(SUM(cs.amount_paid), 0) AS settled_credits
      FROM credits c
      JOIN credit_settlements cs ON cs.credit_id = c.id
      WHERE TO_CHAR(cs.created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND c.status IN ('FullySettled', 'PartiallySettled')
      GROUP BY COALESCE(c.requested_by, 'Unknown')
    `, [targetMonth]);

    const targetsResult = await pool.query(`
      SELECT 
        s.id AS staff_id,
        COALESCE(s.name, 'Unknown') AS staff_name,
        COALESCE(s.monthly_income_target, 0) AS target_amount
      FROM staff s
      WHERE s.role IN ('WAITER', 'MANAGER', 'SUPERVISOR', 'CHEF', 'BARISTA', 'BARMAN')
    `);

    const staffMap = new Map();
    grossResult.rows.forEach(row => {
      staffMap.set(row.staff_id || row.staff_name, {
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        role: row.role,
        orders_count: parseInt(row.orders_count),
        gross_revenue: parseFloat(row.gross_revenue),
        settled_credits: 0,
        individual_target: 0
      });
    });
    creditsResult.rows.forEach(row => {
      let key = row.staff_name;
      if (staffMap.has(key)) {
        staffMap.get(key).settled_credits = parseFloat(row.settled_credits);
      } else {
        staffMap.set(key, {
          staff_id: null,
          staff_name: row.staff_name,
          role: 'WAITER',
          orders_count: 0,
          gross_revenue: 0,
          settled_credits: parseFloat(row.settled_credits),
          individual_target: 0
        });
      }
    });
    targetsResult.rows.forEach(row => {
      const key = row.staff_id || row.staff_name;
      if (staffMap.has(key)) {
        staffMap.get(key).individual_target = parseFloat(row.target_amount || 0);
      } else {
        staffMap.set(key, {
          staff_id: row.staff_id,
          staff_name: row.staff_name,
          role: 'WAITER',
          orders_count: 0,
          gross_revenue: 0,
          settled_credits: 0,
          individual_target: parseFloat(row.target_amount || 0)
        });
      }
    });

    const staffData = Array.from(staffMap.values()).map(staff => {
      const total_revenue = staff.gross_revenue + staff.settled_credits;
      return {
        ...staff,
        total_revenue,
        progress: staff.individual_target > 0 ? (total_revenue / staff.individual_target) * 100 : 0
      };
    });
    staffData.sort((a, b) => b.total_revenue - a.total_revenue);

    let totalGross = 0, totalSettledCredits = 0;
    staffData.forEach(s => {
      totalGross += s.gross_revenue;
      totalSettledCredits += s.settled_credits;
    });
    const totalRevenue = totalGross + totalSettledCredits;

    const targetResult = await pool.query(
      `SELECT revenue_goal FROM business_targets WHERE month_key = $1`, [targetMonth]
    );
    const monthlyTarget = parseFloat(targetResult.rows[0]?.revenue_goal || 6000000);

    res.json({
      staff: staffData,
      summary: {
        total_revenue: totalRevenue,
        total_gross: totalGross,
        total_credit_settled: totalSettledCredits,
        total_orders: staffData.reduce((sum, s) => sum + s.orders_count, 0),
        active_staff: staffData.length,
        monthly_target: monthlyTarget,
        progress_percentage: monthlyTarget > 0 ? (totalRevenue / monthlyTarget) * 100 : 0
      },
      month: targetMonth
    });
  } catch (err) {
    console.error("Staff Performance Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PETTY CASH SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/petty-cash-summary', async (req, res) => {
  try {
    const { period, date, startDate, endDate, month, start_time, end_time } = req.query;
    let dateCondition, params;

    if      (period === "daily"   && date)                { dateCondition = "DATE(created_at) = $1";                     params = [date]; }
    else if (period === "weekly"  && startDate && endDate) { dateCondition = "DATE(created_at) BETWEEN $1 AND $2";       params = [startDate, endDate]; }
    else if (period === "monthly" && month)                { dateCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";      params = [month]; }
    else                                                   { dateCondition = "DATE(created_at) = CURRENT_DATE";          params = []; }

    const timeFilter = applyTimeFilter('created_at', start_time, end_time);
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'IN'  THEN amount ELSE 0 END), 0) AS total_in,
        COUNT(CASE WHEN UPPER(direction) = 'OUT' THEN 1 END) AS out_count,
        COUNT(CASE WHEN UPPER(direction) = 'IN'  THEN 1 END) AS in_count
      FROM petty_cash WHERE ${dateCondition} ${timeFilter}
    `;
    const result = params.length > 0 ? await pool.query(query, params) : await pool.query(query);
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

router.get('/petty-cash', async (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'IN'  THEN amount ELSE 0 END), 0) AS total_in
      FROM petty_cash WHERE DATE(created_at) = $1
    `, [targetDate]);
    const row = result.rows[0];
    res.json({
      total_petty_cash: parseFloat(row.total_out || 0),
      total_out:        parseFloat(row.total_out || 0),
      total_in:         parseFloat(row.total_in  || 0)
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
    const checkColumn = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'business_targets' AND column_name = 'updated_at'
    `);
    const hasUpdatedAt = checkColumn.rows.length > 0;
    const query = hasUpdatedAt
      ? `INSERT INTO business_targets (month_key, revenue_goal, waiter_quota, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (month_key) DO UPDATE SET 
           revenue_goal = EXCLUDED.revenue_goal,
           waiter_quota = COALESCE(EXCLUDED.waiter_quota, business_targets.waiter_quota),
           updated_at   = NOW()
         RETURNING *`
      : `INSERT INTO business_targets (month_key, revenue_goal, waiter_quota)
         VALUES ($1, $2, $3)
         ON CONFLICT (month_key) DO UPDATE SET 
           revenue_goal = EXCLUDED.revenue_goal,
           waiter_quota = COALESCE(EXCLUDED.waiter_quota, business_targets.waiter_quota)
         RETURNING *`;
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
    const result = await pool.query(
      `SELECT month_key, revenue_goal, waiter_quota, created_at, updated_at
       FROM business_targets ORDER BY month_key DESC`
    );
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
    const result = await pool.query(`
      SELECT 
        o.table_name, 
        ${STAFF_NAME_EXPR} AS waiter_name,
        o.total,
        COALESCE(o.timestamp, o.created_at) AS start_time,
        o.is_archived, o.status, o.payment_confirmed,
        (EXTRACT(EPOCH FROM (NOW() - COALESCE(o.timestamp, o.created_at))) / 60)::INTEGER AS minutes_active
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE o.is_archived = false 
        OR (o.is_archived = true AND COALESCE(o.timestamp, o.created_at) > NOW() - INTERVAL '1 hour')
      ORDER BY o.is_archived ASC, COALESCE(o.timestamp, o.created_at) DESC
    `);
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
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT items FROM orders 
      WHERE DATE(COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi') = $1
        AND (
          is_archived = true
          OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit', 'served')
        )
        AND payment_confirmed = true
    `, [targetDate]);

    let kitchenCount = 0, baristaCount = 0, barmanCount = 0;
    result.rows.forEach(row => {
      let items = row.items;
      if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
      if (Array.isArray(items)) {
        items.forEach(item => {
          const station  = (item.station  || "").toLowerCase();
          const category = (item.category || "").toLowerCase();
          const qty = Number(item.quantity) || 1;
          if (station === "barista" || category.includes("barista") || category.includes("coffee") || category.includes("tea")) baristaCount += qty;
          else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink") || category.includes("beer")) barmanCount += qty;
          else kitchenCount += qty;
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
    const { type, startDate, endDate, month, start_time, end_time } = req.query;
    let dateCondition, params;

    if      (type === "weekly"  && startDate && endDate) { dateCondition = "DATE(COALESCE(timestamp, created_at)) BETWEEN $1 AND $2"; params = [startDate, endDate]; }
    else if (type === "monthly" && month)                 { dateCondition = "TO_CHAR(COALESCE(timestamp, created_at), 'YYYY-MM') = $1"; params = [month]; }
    else                                                  { dateCondition = "DATE(COALESCE(timestamp, created_at)) = CURRENT_DATE"; params = []; }

    const timeFilter = applyTimeFilter('created_at', start_time, end_time);
    const query = `
      SELECT 
        DATE(COALESCE(timestamp, created_at)) AS date,
        COUNT(*) AS daily_orders,
        COALESCE(SUM(total), 0) AS daily_revenue,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CASH%'   THEN total ELSE 0 END), 0) AS daily_cash,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%MTN%'    THEN total ELSE 0 END), 0) AS daily_mtn,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS daily_airtel,
        COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CARD%' OR UPPER(payment_method) LIKE '%VISA%' OR UPPER(payment_method) LIKE '%POS%' THEN total ELSE 0 END), 0) AS daily_card
      FROM orders 
      WHERE ${dateCondition}
        AND (
          is_archived = true
          OR LOWER(status) IN ('paid', 'closed', 'confirmed', 'credit', 'served')
        )
        AND payment_confirmed = true
        AND UPPER(COALESCE(payment_method,'')) NOT LIKE '%CREDIT%'
        ${timeFilter}
      GROUP BY DATE(COALESCE(timestamp, created_at))
      ORDER BY DATE(COALESCE(timestamp, created_at)) ASC
    `;
    const result = params.length > 0 ? await pool.query(query, params) : await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Period Summary Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 12 & 13. STAFF ORDER GOALS (legacy, kept for compatibility)
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
// 14. GET CREDITS SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits-summary', async (req, res) => {
  try {
    const { period, date, startDate, endDate, month, start_time, end_time } = req.query;
    let dateCondition, params;

    if      (period === "daily"   && date)                { dateCondition = "DATE(created_at) = $1";                     params = [date]; }
    else if (period === "weekly"  && startDate && endDate) { dateCondition = "DATE(created_at) BETWEEN $1 AND $2";       params = [startDate, endDate]; }
    else if (period === "monthly" && month)                { dateCondition = "TO_CHAR(created_at, 'YYYY-MM') = $1";      params = [month]; }
    else                                                   { dateCondition = "DATE(created_at) = CURRENT_DATE";          params = []; }

    const timeFilter = applyTimeFilter('created_at', start_time, end_time);
    const query = `
      SELECT 
        COUNT(*) AS total_credits,
        COALESCE(SUM(CASE WHEN status = 'Approved'                           THEN amount                                   ELSE 0 END), 0) AS approved_amount,
        COUNT(CASE    WHEN status = 'Approved'                               THEN 1 END)                                               AS approved_count,
        COALESCE(SUM(CASE WHEN status = 'FullySettled'                       THEN COALESCE(c.amount_paid, c.amount)         ELSE 0 END), 0) AS settled_amount,
        COUNT(CASE    WHEN status = 'FullySettled'                           THEN 1 END)                                               AS settled_count,
        COALESCE(SUM(CASE WHEN status IN ('PendingCashier','PendingManager') THEN amount                                   ELSE 0 END), 0) AS pending_amount,
        COUNT(CASE    WHEN status IN ('PendingCashier','PendingManager')     THEN 1 END)                                               AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'Rejected'                          THEN amount                                   ELSE 0 END), 0) AS rejected_amount,
        COUNT(CASE    WHEN status = 'Rejected'                               THEN 1 END)                                               AS rejected_count,
        COALESCE(SUM(CASE WHEN status = 'PartiallySettled'                  THEN (c.amount - COALESCE(c.amount_paid, 0))  ELSE 0 END), 0) AS partially_settled_outstanding,
        COUNT(CASE    WHEN status = 'PartiallySettled'                       THEN 1 END)                                               AS partially_settled_count,
        COALESCE(SUM(CASE WHEN status = 'PartiallySettled'                  THEN COALESCE(c.amount_paid, 0)               ELSE 0 END), 0) AS partially_settled_paid
      FROM credits c
      WHERE ${dateCondition} ${timeFilter}
    `;
    const result = params.length > 0 ? await pool.query(query, params) : await pool.query(query);
    const row = result.rows[0];

    const approvedAmount              = Number(row.approved_amount) || 0;
    const pendingAmount               = Number(row.pending_amount) || 0;
    const partiallySettledOutstanding = Number(row.partially_settled_outstanding) || 0;
    const totalOutstanding            = approvedAmount + pendingAmount + partiallySettledOutstanding;
    const settledAmount               = Number(row.settled_amount) || 0;
    const partiallySettledPaid        = Number(row.partially_settled_paid) || 0;
    const totalSettled                = settledAmount + partiallySettledPaid;

    res.json({
      total_credits:                Number(row.total_credits) || 0,
      approved_amount:              approvedAmount,
      settled_amount:               totalSettled,
      pending_amount:               pendingAmount,
      rejected_amount:              Number(row.rejected_amount) || 0,
      outstanding_amount:           totalOutstanding,
      partially_settled_outstanding: partiallySettledOutstanding,
      partially_settled_paid:       partiallySettledPaid,
      approved_count:               Number(row.approved_count) || 0,
      settled_count:                Number(row.settled_count) || 0,
      pending_count:                Number(row.pending_count) || 0,
      rejected_count:               Number(row.rejected_count) || 0,
      partially_settled_count:      Number(row.partially_settled_count) || 0
    });
  } catch (err) {
    console.error("Credits Summary Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. GET PENDING CREDITS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits/pending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cq.id, cq.table_name, cq.amount, cq.requested_by AS waiter_name,
             cq.credit_name AS client_name, cq.credit_phone AS client_phone,
             cq.credit_pay_by AS pay_by_date, cq.created_at, cq.status, cq.item_name,
             o.id AS order_id,
             EXTRACT(EPOCH FROM (NOW() - cq.created_at)) / 60 AS waiting_minutes
      FROM cashier_queue cq
      LEFT JOIN orders o ON o.id = cq.order_id
      WHERE cq.method = 'Credit' AND cq.status = 'PendingManagerApproval'
      ORDER BY cq.created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get pending credits error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. GET CREDIT SUMMARY FOR MANAGER DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits/manager-summary', async (req, res) => {
  try {
    const [pendingQ, approvedQ, settledQ, rejectedQ] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS a FROM cashier_queue WHERE method='Credit' AND status='PendingManagerApproval'`),
      pool.query(`SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS a FROM credits WHERE status='Approved'`),
      pool.query(`SELECT COUNT(*) AS c, COALESCE(SUM(amount_paid),0) AS a FROM credits WHERE status='FullySettled'`),
      pool.query(`SELECT COUNT(*) AS c, COALESCE(SUM(amount),0) AS a FROM credits WHERE status='Rejected'`),
    ]);
    res.json({
      pending:  { count: parseInt(pendingQ.rows[0].c  || 0), amount: parseFloat(pendingQ.rows[0].a  || 0) },
      approved: { count: parseInt(approvedQ.rows[0].c || 0), amount: parseFloat(approvedQ.rows[0].a || 0) },
      settled:  { count: parseInt(settledQ.rows[0].c  || 0), amount: parseFloat(settledQ.rows[0].a  || 0) },
      rejected: { count: parseInt(rejectedQ.rows[0].c || 0), amount: parseFloat(rejectedQ.rows[0].a || 0) },
    });
  } catch (err) {
    console.error('Manager credit summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. CONFIRM CASH PAYMENT
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/confirm-payment/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { confirmed_by, item_name, payment_method } = req.body;
  if (!item_name) return res.status(400).json({ error: 'item_name is required' });
  try {
    const orderResult = await pool.query(
      `SELECT id, items, table_name, staff_name, status, payment_method FROM orders WHERE id = $1 AND is_archived = false`, [orderId]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderResult.rows[0];
    let items = order.items;
    if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
    if (!Array.isArray(items)) items = [];
    let itemFound = false;
    const updatedItems = items.map(item => {
      if (item.name === item_name && !item._rowPaid) {
        itemFound = true;
        const updatedItem = { ...item, _rowPaid: true, paid_at: new Date().toISOString(), payment_confirmed: true, payment_confirmed_by: confirmed_by, payment_confirmed_at: new Date().toISOString(), status: 'Paid' };
        if (payment_method) updatedItem.payment_method = payment_method;
        return updatedItem;
      }
      return item;
    });
    if (!itemFound) return res.status(404).json({ error: `Item "${item_name}" not found or already paid` });
    let newTotal = 0;
    updatedItems.forEach(item => {
      if (item._rowPaid === true) newTotal += (Number(item.price) || 0) * (Number(item.quantity) || 1);
    });
    const newStatus = calculateOrderStatusFromItems(updatedItems, order.status);
    let orderPaymentMethod = order.payment_method;
    if (!orderPaymentMethod && payment_method) orderPaymentMethod = payment_method;
    else if (!orderPaymentMethod && !payment_method) {
      const anyItemMethod = updatedItems.find(i => i.payment_method);
      if (anyItemMethod) orderPaymentMethod = anyItemMethod.payment_method;
    }
    const updateResult = await pool.query(
      `UPDATE orders SET items = $1, status = $2, total = $3, payment_method = COALESCE($4, payment_method), updated_at = NOW() WHERE id = $5 RETURNING *`,
      [JSON.stringify(updatedItems), newStatus, newTotal, orderPaymentMethod, orderId]
    );
    if (updateResult.rows.length === 0) return res.status(404).json({ error: 'Failed to update order' });
    res.json({ success: true, message: `Payment confirmed for ${item_name}`, order: updateResult.rows[0] });
  } catch (err) {
    console.error('Payment confirmation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/export-pdf', async (req, res) => {
  const { type, date, month, start_time, end_time } = req.query;
  const reportType = type || 'daily';

  try {
    let dateCondition = "", params = [], title = "", periodText = "", filename = "";
    let creditsCondition = "", creditsParams = [], pettyCondition = "", pettyParams = [];

    // ── Date condition setup (unchanged) ──
    if (reportType === "daily" && date) {
      dateCondition    = "DATE(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi') = $1";
      params           = [date];
      creditsCondition = "DATE(cs.created_at AT TIME ZONE 'Africa/Nairobi') = $1";
      creditsParams    = [date];
      pettyCondition   = "DATE(created_at AT TIME ZONE 'Africa/Nairobi') = $1";
      pettyParams      = [date];
      title      = "DAILY TRANSACTION REPORT";
      periodText = new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      filename   = `Kurax_Daily_Report_${date}${start_time ? `_${start_time.replace(':', '-')}` : ''}${end_time ? `_to_${end_time.replace(':', '-')}` : ''}.pdf`;
    } else if (reportType === "weekly" && date) {
      const sel  = new Date(date);
      const diff = sel.getDay() === 0 ? 6 : sel.getDay() - 1;
      const ws   = new Date(sel); ws.setDate(sel.getDate() - diff);
      const we   = new Date(ws);  we.setDate(ws.getDate() + 6);
      const wss  = ws.toISOString().split('T')[0];
      const wse  = we.toISOString().split('T')[0];
      dateCondition    = "DATE(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi') BETWEEN $1 AND $2";
      params           = [wss, wse];
      creditsCondition = "DATE(cs.created_at AT TIME ZONE 'Africa/Nairobi') BETWEEN $1 AND $2";
      creditsParams    = [wss, wse];
      pettyCondition   = "DATE(created_at AT TIME ZONE 'Africa/Nairobi') BETWEEN $1 AND $2";
      pettyParams      = [wss, wse];
      title      = "WEEKLY TRANSACTION REPORT";
      periodText = `${new Date(wss + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${new Date(wse + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
      filename   = `Kurax_Weekly_Report_${date}${start_time ? `_${start_time.replace(':', '-')}` : ''}${end_time ? `_to_${end_time.replace(':', '-')}` : ''}.pdf`;
    } else if (reportType === "monthly" && month) {
      dateCondition    = "TO_CHAR(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1";
      params           = [month];
      creditsCondition = "TO_CHAR(cs.created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1";
      creditsParams    = [month];
      pettyCondition   = "TO_CHAR(created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1";
      pettyParams      = [month];
      const [y, m] = month.split("-");
      title      = "MONTHLY TRANSACTION REPORT";
      periodText = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      filename   = `Kurax_Monthly_Report_${month}${start_time ? `_${start_time.replace(':', '-')}` : ''}${end_time ? `_to_${end_time.replace(':', '-')}` : ''}.pdf`;
    } else {
      return res.status(400).json({ error: "Invalid parameters." });
    }

   const statusFilter = `
  AND LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'served')
  AND o.payment_confirmed = true
  AND UPPER(COALESCE(o.payment_method,'')) NOT LIKE '%CREDIT%'
`;


    const orderTimeFilter = applyTimeFilter('COALESCE(o.timestamp, o.created_at)', start_time, end_time);
    const ordersResult = await pool.query(`
  SELECT 
    o.id AS source_id,
    'order' AS type,
    o.table_name,
    COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name,
    o.total AS amount,
    o.payment_method AS method,
    COALESCE(o.timestamp, o.created_at) AS timestamp,
    o.status,
    o.items,
    o.original_order_ids
  FROM orders o
  LEFT JOIN staff s ON o.staff_id = s.id
  WHERE ${dateCondition} ${statusFilter}
    ${orderTimeFilter}
    AND NOT EXISTS (
      SELECT 1 FROM orders o2 
      WHERE o2.original_order_ids IS NOT NULL 
        AND o2.original_order_ids::text LIKE '%' || o.id::text || '%'
    )
  ORDER BY COALESCE(o.timestamp, o.created_at) DESC
`, params);

    // ─── RESOLVE ITEMS: use source order items if current order has empty items ───
    const resolvedOrders = [];
    for (const order of ordersResult.rows) {
      let resolvedItems = order.items;
      const isEmpty = !resolvedItems || resolvedItems === '[]' || (Array.isArray(resolvedItems) && resolvedItems.length === 0);
      if (isEmpty && order.original_order_ids) {
        let sourceIds = order.original_order_ids;
        if (typeof sourceIds === 'string') {
          try { sourceIds = JSON.parse(sourceIds); } catch { sourceIds = []; }
        }
        if (Array.isArray(sourceIds) && sourceIds.length > 0) {
          const sourceRes = await pool.query(`SELECT items FROM orders WHERE id = ANY($1::int[])`, [sourceIds]);
          if (sourceRes.rows.length > 0) {
            resolvedItems = sourceRes.rows[0].items;
          }
        }
      }
      resolvedOrders.push({ ...order, resolved_items: resolvedItems });
    }

    // ─── Credit settlements (unchanged) ─────────────────────────────────────
    const settlementTimeFilter = applyTimeFilter('cs.created_at', start_time, end_time);
    const settlementsResult = await pool.query(`
      WITH credit_balance AS (
        SELECT 
          c.id AS credit_id,
          c.amount AS original_amount,
          COALESCE(SUM(cs2.amount_paid), 0) AS total_settled
        FROM credits c
        LEFT JOIN credit_settlements cs2 ON cs2.credit_id = c.id
        GROUP BY c.id, c.amount
      )
      SELECT
        cs.id AS source_id,
        'credit_settlement' AS type,
        c.table_name,
        COALESCE(s.name, o.staff_name, c.waiter_name, c.requested_by, 'Unknown') AS staff_name,
        COALESCE(s.role, 'WAITER') AS role,
        cs.amount_paid AS amount,
        CONCAT('credit/', LOWER(cs.method)) AS method,
        cs.created_at AS timestamp,
        CASE 
          WHEN cb.total_settled >= cb.original_amount THEN 'Fully Settled'
          ELSE 'Partially Settled'
        END AS status,
        c.order_id AS original_order_id
      FROM credit_settlements cs
      JOIN credits c ON cs.credit_id = c.id
      LEFT JOIN orders o ON o.id = c.order_id
      LEFT JOIN staff s ON s.id = o.staff_id
      LEFT JOIN credit_balance cb ON cb.credit_id = c.id
      WHERE ${creditsCondition}
        ${settlementTimeFilter}
      ORDER BY cs.created_at DESC
    `, creditsParams);

    // ─── STATION BREAKDOWN (count only once) ────────────────────────────────
    let kitchenCount = 0, baristaCount = 0, barmanCount = 0;
    const countItemsFromOrder = (itemsJson, isPaidOrder = false) => {
      let items = itemsJson;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (!Array.isArray(items)) return;
      items.forEach(item => {
        if (item.status === 'VOIDED') return;
        let include = false;
        if (isPaidOrder) {
          include = true; // paid order – count all non‑voided items
        } else {
          const isCredit = (item.creditRequested === true || item.credit_status === 'Approved');
          const isPaid   = item._rowPaid === true;
          include = isPaid || isCredit;
        }
        if (!include) return;
        const qty = Number(item.quantity) || 1;
        const station  = (item.station  || "").toLowerCase();
        const category = (item.category || "").toLowerCase();
        if (station === "barista" || category.includes("barista") || category.includes("coffee") || category.includes("tea")) {
          baristaCount += qty;
        } else if (station === "barman" || category.includes("bar") || category.includes("cocktail") || category.includes("drink") || category.includes("beer")) {
          barmanCount += qty;
        } else {
          kitchenCount += qty;
        }
      });
    };

    // Count from resolved paid orders (only the paid records, not the archived sources)
    resolvedOrders.forEach(order => {
      countItemsFromOrder(order.resolved_items, true);
    });

    // Count from original credit orders (via settlements) – these are separate
    const origOrderIds = settlementsResult.rows.map(s => s.original_order_id).filter(id => id);
    if (origOrderIds.length) {
      const origOrdersRes = await pool.query(`SELECT items FROM orders WHERE id = ANY($1::int[])`, [origOrderIds]);
      origOrdersRes.rows.forEach(o => countItemsFromOrder(o.items, false));
    }

    // Merge for ORDER DETAILS table
    let allDetails = [
      ...resolvedOrders.map(order => ({ ...order, amount: order.amount, method: order.method, items: order.resolved_items })),
      ...settlementsResult.rows
    ];
    allDetails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // ─── Summary queries (also exclude archived for daily) ──────────────────
    const plainDateCond   = dateCondition.replace(/o\./g, '').replace(/AT TIME ZONE 'Africa\/Nairobi'/g, '');
   const plainStatusFilter = `
  AND LOWER(status) IN ('paid', 'closed', 'confirmed', 'served')
`;
    const plainTimeFilter = applyTimeFilter('created_at', start_time, end_time).replace(/AT TIME ZONE 'Africa\/Nairobi'/g, '');

   const summaryResult = await pool.query(`
  SELECT 
    COUNT(*) AS total_transactions,
    COALESCE(SUM(total), 0) AS total_revenue,
    COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CASH%'   THEN total ELSE 0 END), 0) AS total_cash,
    COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%MTN%'    THEN total ELSE 0 END), 0) AS total_mtn,
    COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%AIRTEL%' THEN total ELSE 0 END), 0) AS total_airtel,
    COALESCE(SUM(CASE WHEN UPPER(payment_method) LIKE '%CARD%' OR UPPER(payment_method) LIKE '%VISA%' OR UPPER(payment_method) LIKE '%POS%' THEN total ELSE 0 END), 0) AS total_card
  FROM orders 
  WHERE ${plainDateCond} ${plainStatusFilter}
    AND UPPER(payment_method) NOT LIKE '%CREDIT%'
    ${plainTimeFilter}
    AND NOT EXISTS (
      SELECT 1 FROM orders o2 
      WHERE o2.original_order_ids IS NOT NULL 
        AND o2.original_order_ids::text LIKE '%' || orders.id::text || '%'
    )
`, params);

    const creditTimeFilter = applyTimeFilter('c.created_at', start_time, end_time);
    const creditsResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN c.status = 'FullySettled'                      THEN COALESCE(c.amount_paid, c.amount) ELSE 0 END), 0) AS total_settled,
        COUNT(CASE WHEN c.status = 'FullySettled'                              THEN 1 END) AS settled_count,
        COALESCE(SUM(CASE WHEN c.status = 'Approved'                           THEN c.amount ELSE 0 END), 0) AS total_approved,
        COUNT(CASE WHEN c.status = 'Approved'                                  THEN 1 END) AS approved_count,
        COALESCE(SUM(CASE WHEN c.status IN ('PendingCashier','PendingManager') THEN c.amount ELSE 0 END), 0) AS total_pending,
        COUNT(CASE WHEN c.status IN ('PendingCashier','PendingManager')        THEN 1 END) AS pending_count,
        COALESCE(SUM(CASE WHEN c.status = 'Rejected'                           THEN c.amount ELSE 0 END), 0) AS total_rejected,
        COUNT(CASE WHEN c.status = 'Rejected'                                  THEN 1 END) AS rejected_count,
        COALESCE(SUM(CASE WHEN c.status = 'PartiallySettled'                   THEN (c.amount - COALESCE(c.amount_paid, 0)) ELSE 0 END), 0) AS partially_outstanding,
        COUNT(CASE WHEN c.status = 'PartiallySettled'                          THEN 1 END) AS partially_count,
        COALESCE(SUM(CASE WHEN c.status = 'PartiallySettled'                   THEN COALESCE(c.amount_paid, 0) ELSE 0 END), 0) AS partially_paid
      FROM credits c
      WHERE ${creditsCondition.replace(/cs\./g, 'c.')}
        ${creditTimeFilter}
    `, creditsParams);
    const credits = creditsResult.rows[0];
    const totalSettled   = Number(credits.total_settled) + Number(credits.partially_paid);
    const totalOutstanding = Number(credits.total_approved) + Number(credits.total_pending) + Number(credits.partially_outstanding);

    const pettyTimeFilter = applyTimeFilter('created_at', start_time, end_time);
    const pettyResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'OUT' THEN amount ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN UPPER(direction) = 'IN'  THEN amount ELSE 0 END), 0) AS total_in,
        COUNT(CASE WHEN UPPER(direction) = 'OUT' THEN 1 END) AS out_count,
        COUNT(CASE WHEN UPPER(direction) = 'IN'  THEN 1 END) AS in_count
      FROM petty_cash WHERE ${pettyCondition}
        ${pettyTimeFilter}
    `, pettyParams);
    const petty = pettyResult.rows[0];

    // PDF generation (same as before – uses kitchenCount, baristaCount, barmanCount, allDetails)
    const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageW        = doc.page.width;
    const margin       = 50;
    const contentWidth = pageW - 2 * margin;

    doc.rect(0, 0, pageW, 5).fill('#EAB308');
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#1a1a2e').text('KURAX FOOD LOUNGE & BISTRO', pageW / 2, 45, { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#d97706').text('Luxury Dining & Rooftop Vibes', pageW / 2, 68, { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#EAB308').text(title, pageW / 2, 95, { align: 'center' });
    doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(margin, 115).lineTo(pageW - margin, 115).stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#6B7280')
      .text(`Period: ${periodText}${start_time ? ` | Time: ${start_time} - ${end_time || '23:59'}` : ''}`, pageW / 2, 130, { align: 'center' })
      .text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 143, { align: 'center' });

    let currentY = 170;
    const summary = summaryResult.rows[0];
    const totalRevenue = Number(summary.total_revenue) + totalSettled;

    // Executive Summary (unchanged)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('EXECUTIVE SUMMARY', margin, currentY);
    currentY += 20;
    const summaryHeaders = ['Metric', 'Value'];
    const summaryData = [
      ['Total Orders',   summary.total_transactions.toString()],
      ['Total Revenue',  `UGX ${totalRevenue.toLocaleString()}`],
      ['Cash',           `UGX ${Number(summary.total_cash).toLocaleString()}`],
      ['MTN Momo',       `UGX ${Number(summary.total_mtn).toLocaleString()}`],
      ['Airtel',         `UGX ${Number(summary.total_airtel).toLocaleString()}`],
      ['Card/POS',       `UGX ${Number(summary.total_card).toLocaleString()}`],
    ];
    const colWidthsSum = [contentWidth * 0.3, contentWidth * 0.7];
    let tableY = currentY;
    doc.rect(margin, tableY, contentWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
    let hx = margin;
    summaryHeaders.forEach((h, i) => { doc.text(h, hx + 5, tableY + 5); hx += colWidthsSum[i]; });
    tableY += 20;
    summaryData.forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(margin, tableY, contentWidth, 16).fill('#F9FAFB').stroke('#E5E7EB');
      else doc.rect(margin, tableY, contentWidth, 16).stroke('#E5E7EB');
      doc.font('Helvetica').fontSize(8).fillColor('#1F2937');
      let dx = margin;
      row.forEach((cell, i) => { doc.text(cell, dx + 5, tableY + 4); dx += colWidthsSum[i]; });
      tableY += 16;
    });
    currentY = tableY + 15;

    // Credits Summary (unchanged)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('CREDITS SUMMARY', margin, currentY);
    currentY += 20;
    const creditHeaders = ['Status', 'Amount', 'Count'];
    const creditData = [
      ['Credits Settled',  `UGX ${totalSettled.toLocaleString()}`,     String(Number(credits.settled_count) + Number(credits.partially_count))],
      ['Outstanding',      `UGX ${totalOutstanding.toLocaleString()}`, String(Number(credits.approved_count)+Number(credits.pending_count)+Number(credits.partially_count))],
      ['Approved',         `UGX ${Number(credits.total_approved).toLocaleString()}`, String(credits.approved_count)],
      ['Pending Approval', `UGX ${Number(credits.total_pending).toLocaleString()}`,  String(credits.pending_count)],
      ['Rejected',         `UGX ${Number(credits.total_rejected).toLocaleString()}`, String(credits.rejected_count)],
    ];
    const colWidthsCred = [contentWidth * 0.4, contentWidth * 0.35, contentWidth * 0.25];
    let credY = currentY;
    doc.rect(margin, credY, contentWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
    let cx = margin;
    creditHeaders.forEach((h, i) => { doc.text(h, cx + 5, credY + 5); cx += colWidthsCred[i]; });
    credY += 20;
    creditData.forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(margin, credY, contentWidth, 16).fill('#F9FAFB').stroke('#E5E7EB');
      else doc.rect(margin, credY, contentWidth, 16).stroke('#E5E7EB');
      doc.font('Helvetica').fontSize(8).fillColor('#1F2937');
      let dx = margin;
      row.forEach((cell, i) => { doc.text(cell, dx + 5, credY + 4); dx += colWidthsCred[i]; });
      credY += 16;
    });
    currentY = credY + 15;

    // Petty Cash (unchanged)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('PETTY CASH SUMMARY', margin, currentY);
    currentY += 20;
    const pettyHeaders = ['Category', 'Amount', 'Transactions'];
    const netPetty = Number(petty.total_in) - Number(petty.total_out);
    const pettyData = [
      ['Expenses (OUT)',      `UGX ${Number(petty.total_out).toLocaleString()}`, `${petty.out_count || 0} OUT`],
      ['Replenishment (IN)',  `UGX ${Number(petty.total_in).toLocaleString()}`,  `${petty.in_count  || 0} IN`],
      ['Net Position',        `UGX ${netPetty.toLocaleString()}`,                `${(petty.out_count || 0)+(petty.in_count || 0)} transactions`],
    ];
    const colWidthsPetty = [contentWidth * 0.4, contentWidth * 0.35, contentWidth * 0.25];
    let pettyY = currentY;
    doc.rect(margin, pettyY, contentWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
    let px = margin;
    pettyHeaders.forEach((h, i) => { doc.text(h, px + 5, pettyY + 5); px += colWidthsPetty[i]; });
    pettyY += 20;
    pettyData.forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(margin, pettyY, contentWidth, 16).fill('#F9FAFB').stroke('#E5E7EB');
      else doc.rect(margin, pettyY, contentWidth, 16).stroke('#E5E7EB');
      doc.font('Helvetica').fontSize(8).fillColor('#1F2937');
      let dx = margin;
      row.forEach((cell, i) => { doc.text(cell, dx + 5, pettyY + 4); dx += colWidthsPetty[i]; });
      pettyY += 16;
    });
    currentY = pettyY + 15;

    // Station Breakdown (now will show correct count)
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('STATION BREAKDOWN', margin, currentY);
    currentY += 20;
    const stationHeaders = ['Station', 'Items Count'];
    const stationData = [
      ['KITCHEN',           kitchenCount],
      ['BARISTA (COFFEE)',  baristaCount],
      ['BARMAN (BAR)',      barmanCount],
    ];
    const colWidthsStation = [contentWidth * 0.6, contentWidth * 0.4];
    let stationY = currentY;
    doc.rect(margin, stationY, contentWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
    let sx = margin;
    stationHeaders.forEach((h, i) => { doc.text(h, sx + 5, stationY + 5); sx += colWidthsStation[i]; });
    stationY += 20;
    stationData.forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(margin, stationY, contentWidth, 16).fill('#F9FAFB').stroke('#E5E7EB');
      else doc.rect(margin, stationY, contentWidth, 16).stroke('#E5E7EB');
      doc.font('Helvetica').fontSize(8).fillColor('#1F2937');
      let dx = margin;
      doc.text(String(row[0]), dx + 5, stationY + 4); dx += colWidthsStation[0];
      doc.text(String(row[1]), dx + 5, stationY + 4);
      stationY += 16;
    });
    currentY = stationY + 15;

    // Order Details (using allDetails)
    if (allDetails.length > 0) {
      if (currentY > 700) { doc.addPage(); currentY = 50; }
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('ORDER DETAILS', margin, currentY);
      currentY += 20;

      const headers   = ['Order ID', 'Table', 'Staff', 'Amount', 'Method', 'Time'];
      const colWidths = [55, 70, 85, 85, 85, 65];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const startX = margin;

      doc.rect(startX, currentY, tableWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151');
      let hdX = startX;
      headers.forEach((h, i) => { doc.text(h, hdX + 5, currentY + 6); hdX += colWidths[i]; });
      currentY += 20;

      allDetails.forEach((item, idx) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
          doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('ORDER DETAILS (continued)', margin, currentY);
          currentY += 20;
          doc.rect(startX, currentY, tableWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151');
          hdX = startX;
          headers.forEach((h, i) => { doc.text(h, hdX + 5, currentY + 6); hdX += colWidths[i]; });
          currentY += 20;
        }

        if (idx % 2 === 0) doc.rect(startX, currentY, tableWidth, 16).fill('#F9FAFB').stroke('#E5E7EB');
        else doc.rect(startX, currentY, tableWidth, 16).stroke('#E5E7EB');

        doc.font('Helvetica').fontSize(8).fillColor('#1F2937');
        let displayMethod = (item.method || "—");
        if      (displayMethod === 'credit/cash')   displayMethod = 'Cr/Cash';
        else if (displayMethod === 'credit/card')   displayMethod = 'Cr/Card';
        else if (displayMethod === 'credit/mtn')    displayMethod = 'Cr/MTN';
        else if (displayMethod === 'credit/airtel') displayMethod = 'Cr/Airtel';
        const row = [
          String(item.source_id || '').slice(-6),
          (item.table_name  || "—").substring(0, 12),
          (item.staff_name  || "—").substring(0, 16),
          `UGX ${Number(item.amount || 0).toLocaleString()}`,
          displayMethod.substring(0, 10),
          item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "—"
        ];
        let rx = startX;
        row.forEach((cell, i) => { doc.text(cell, rx + 5, currentY + 4); rx += colWidths[i]; });
        currentY += 16;
      });
    }

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF')
        .text(`KURAX FOOD LOUNGE & BISTRO  ·  Page ${i + 1} of ${totalPages}`, pageW / 2, doc.page.height - 30, { align: 'center' });
    }

    doc.end();
  } catch (err) {
    console.error("PDF Export Error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// 19. EXPORT STAFF PERFORMANCE PDF (with time filter)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export-staff-pdf', async (req, res) => {
  const { month, start_time, end_time } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Invalid month format. Use YYYY-MM." });
  }

  try {
    const orderTimeFilter = applyTimeFilter('COALESCE(o.timestamp, o.created_at)', start_time, end_time);
    const grossResult = await pool.query(`
      SELECT 
        COALESCE(s.name, o.staff_name, 'Unknown') AS staff_name,
        s.id AS staff_id,
        COALESCE(s.role, 'WAITER') AS role,
        COUNT(DISTINCT o.id) AS orders_count,
        COALESCE(SUM(o.total), 0) AS gross_revenue
      FROM orders o
      LEFT JOIN staff s ON o.staff_id = s.id
      WHERE TO_CHAR(COALESCE(o.timestamp, o.created_at) AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND (o.is_archived = true OR LOWER(o.status) IN ('paid', 'closed', 'confirmed', 'credit', 'served'))
        AND o.payment_confirmed = true
        AND UPPER(COALESCE(o.payment_method,'')) NOT LIKE '%CREDIT%'
        AND COALESCE(s.role, 'WAITER') IN ('WAITER', 'MANAGER', 'SUPERVISOR')
        ${orderTimeFilter}
      GROUP BY s.id, COALESCE(s.name, o.staff_name, 'Unknown'), COALESCE(s.role, 'WAITER')
    `, [month]);

    const settlementTimeFilter = applyTimeFilter('cs.created_at', start_time, end_time);
    const creditsResult = await pool.query(`
      SELECT 
        COALESCE(c.waiter_name, c.requested_by, 'Unknown') AS staff_name,
        COALESCE(SUM(cs.amount_paid), 0) AS settled_credits
      FROM credits c
      JOIN credit_settlements cs ON cs.credit_id = c.id
      WHERE TO_CHAR(cs.created_at AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM') = $1
        AND c.status IN ('FullySettled', 'PartiallySettled')
        ${settlementTimeFilter}
      GROUP BY COALESCE(c.waiter_name, c.requested_by, 'Unknown')
    `, [month]);

    const targetsResult = await pool.query(`
      SELECT 
        s.id AS staff_id,
        COALESCE(s.name, 'Unknown') AS staff_name,
        COALESCE(s.monthly_income_target, 0) AS monthly_target,
        COALESCE(s.daily_order_target, 0) AS daily_order_goal
      FROM staff s
      WHERE s.role IN ('WAITER', 'MANAGER', 'SUPERVISOR')
    `);

    const staffMap = new Map();
    grossResult.rows.forEach(row => {
      staffMap.set(row.staff_name, {
        staff_name:       row.staff_name,
        staff_id:         row.staff_id,
        role:             row.role,
        orders_count:     parseInt(row.orders_count),
        gross_revenue:    parseFloat(row.gross_revenue),
        settled_credits:  0,
        daily_order_goal: 0,
        monthly_target:   0,
      });
    });
    creditsResult.rows.forEach(row => {
      const name = row.staff_name;
      if (staffMap.has(name)) {
        staffMap.get(name).settled_credits = parseFloat(row.settled_credits);
      } else {
        staffMap.set(name, {
          staff_name: name, staff_id: null, role: 'WAITER',
          orders_count: 0, gross_revenue: 0,
          settled_credits: parseFloat(row.settled_credits),
          daily_order_goal: 0, monthly_target: 0,
        });
      }
    });
    targetsResult.rows.forEach(row => {
      const name = row.staff_name;
      if (staffMap.has(name)) {
        staffMap.get(name).daily_order_goal = parseInt(row.daily_order_goal || 0);
        staffMap.get(name).monthly_target   = parseFloat(row.monthly_target || 0);
      } else {
        staffMap.set(name, {
          staff_name: name, staff_id: row.staff_id, role: 'WAITER',
          orders_count: 0, gross_revenue: 0, settled_credits: 0,
          daily_order_goal: parseInt(row.daily_order_goal || 0),
          monthly_target:   parseFloat(row.monthly_target || 0),
        });
      }
    });

    let staffData = Array.from(staffMap.values()).map(staff => {
      const total_revenue = staff.gross_revenue + staff.settled_credits;
      return {
        ...staff,
        total_revenue,
        progress: staff.monthly_target > 0 ? (total_revenue / staff.monthly_target) * 100 : 0,
      };
    });
    staffData.sort((a, b) => b.total_revenue - a.total_revenue);

    let totalGross = 0, totalSettledCredits = 0;
    staffData.forEach(s => {
      totalGross          += s.gross_revenue;
      totalSettledCredits += s.settled_credits;
    });
    const totalRevenue = totalGross + totalSettledCredits;

    const targetResult = await pool.query(
      `SELECT revenue_goal FROM business_targets WHERE month_key = $1`, [month]
    );
    const monthlyTarget = parseFloat(targetResult.rows[0]?.revenue_goal || 0);

    const monthDate = new Date(month + "-01");
    const monthName = monthDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    // PDF generation (same as before)
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Kurax_Staff_Performance_${month}${start_time ? `_${start_time.replace(':', '-')}` : ''}${end_time ? `_to_${end_time.replace(':', '-')}` : ''}.pdf"`);
    doc.pipe(res);

    const pageW        = doc.page.width;
    const margin       = 50;
    const contentWidth = pageW - 2 * margin;

    doc.rect(0, 0, pageW, 5).fill('#EAB308');
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#1a1a2e').text('KURAX FOOD LOUNGE & BISTRO', pageW / 2, 45, { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#d97706').text('Luxury Dining & Rooftop Vibes', pageW / 2, 68, { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#EAB308').text('STAFF PERFORMANCE REPORT', pageW / 2, 95, { align: 'center' });
    doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(margin, 115).lineTo(pageW - margin, 115).stroke();
    doc.font('Helvetica').fontSize(9).fillColor('#6B7280')
      .text(`Period: ${monthName}${start_time ? ` | Time: ${start_time} - ${end_time || '23:59'}` : ''}`, pageW / 2, 130, { align: 'center' })
      .text(`Generated: ${new Date().toLocaleString()}`, pageW / 2, 143, { align: 'center' });

    let currentY = 180;

    // Executive Summary
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('EXECUTIVE SUMMARY', margin, currentY);
    currentY += 20;
    const summaryHeaders = ['Metric', 'Value'];
    const summaryData = [
      ['Total Revenue (Gross + Credit)', `UGX ${totalRevenue.toLocaleString()}`],
      ['Gross Sales',                    `UGX ${totalGross.toLocaleString()}`],
      ['Credit Settlements',             `UGX ${totalSettledCredits.toLocaleString()}`],
    ];
    if (monthlyTarget > 0) {
      summaryData.push(['Monthly Target',    `UGX ${monthlyTarget.toLocaleString()}`]);
      summaryData.push(['Overall Progress',  `${((totalRevenue / monthlyTarget) * 100).toFixed(1)}%`]);
    }
    summaryData.push(['Active Staff', staffData.length.toString()]);

    const colWidthsSum = [contentWidth * 0.4, contentWidth * 0.6];
    let tableY = currentY;
    doc.rect(margin, tableY, contentWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
    let hx = margin;
    summaryHeaders.forEach((h, i) => { doc.text(h, hx + 5, tableY + 5); hx += colWidthsSum[i]; });
    tableY += 20;
    summaryData.forEach((row, idx) => {
      if (idx % 2 === 0) doc.rect(margin, tableY, contentWidth, 16).fill('#F9FAFB').stroke('#E5E7EB');
      else doc.rect(margin, tableY, contentWidth, 16).stroke('#E5E7EB');
      doc.font('Helvetica').fontSize(8).fillColor('#1F2937');
      let dx = margin;
      row.forEach((cell, i) => { doc.text(cell, dx + 5, tableY + 4); dx += colWidthsSum[i]; });
      tableY += 16;
    });
    currentY = tableY + 20;

    // Staff Breakdown Table
    if (staffData.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#9CA3AF').text('No staff performance data for this period.', margin, currentY);
    } else {
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('STAFF BREAKDOWN', margin, currentY);
      currentY += 20;

      const headers   = ['Staff Name', 'Role', 'Orders', 'Gross Sales', 'Credits Settled', 'Total Revenue', 'Monthly Target', 'Daily Order Goal', 'Progress'];
      const colWidths = [60, 35, 30, 55, 55, 60, 65, 45, 45];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const startX = margin;

      doc.rect(startX, currentY, tableWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
      doc.font('Helvetica-Bold').fontSize(6).fillColor('#374151');
      let hdX = startX;
      headers.forEach((h, i) => { doc.text(h, hdX + 2, currentY + 6); hdX += colWidths[i]; });
      currentY += 20;

      staffData.forEach((staff, idx) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
          doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e').text('STAFF BREAKDOWN (continued)', margin, currentY);
          currentY += 20;
          doc.rect(startX, currentY, tableWidth, 20).fill('#F3F4F6').stroke('#D1D5DB');
          doc.font('Helvetica-Bold').fontSize(6).fillColor('#374151');
          hdX = startX;
          headers.forEach((h, i) => { doc.text(h, hdX + 2, currentY + 6); hdX += colWidths[i]; });
          currentY += 20;
        }

        if (idx % 2 === 0) doc.rect(startX, currentY, tableWidth, 16).fill('#F9FAFB').stroke('#E5E7EB');
        else doc.rect(startX, currentY, tableWidth, 16).stroke('#E5E7EB');

        doc.font('Helvetica').fontSize(6).fillColor('#1F2937');
        const monthlyTargetDisplay = staff.monthly_target > 0 ? `UGX ${staff.monthly_target.toLocaleString()}` : 'Not set';
        const dailyGoalDisplay     = staff.daily_order_goal > 0 ? staff.daily_order_goal.toString() : 'Not set';
        const row = [
          staff.staff_name.substring(0, 11),
          staff.role,
          staff.orders_count.toString(),
          `UGX ${staff.gross_revenue.toLocaleString()}`,
          `UGX ${staff.settled_credits.toLocaleString()}`,
          `UGX ${staff.total_revenue.toLocaleString()}`,
          monthlyTargetDisplay,
          dailyGoalDisplay,
          `${staff.progress.toFixed(1)}%`
        ];
        let rx = startX;
        row.forEach((cell, i) => { doc.text(cell, rx + 2, currentY + 4); rx += colWidths[i]; });
        currentY += 16;
      });
    }

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF')
        .text(`KURAX FOOD LOUNGE & BISTRO  ·  Page ${i + 1} of ${totalPages}`, pageW / 2, doc.page.height - 30, { align: 'center' });
    }

    doc.end();
  } catch (err) {
    console.error("Staff Performance PDF Error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG: Check order payment status
// ─────────────────────────────────────────────────────────────────────────────
router.get('/debug/check-payments', async (req, res) => {
  try {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT id, table_name, total, payment_method, status,
             payment_confirmed, credit_approved, items, timestamp, created_at
      FROM orders 
      WHERE DATE(COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi') = $1
        AND is_archived = false
      ORDER BY table_name, id
    `, [targetDate]);

    const analyzedOrders = result.rows.map(order => {
      let items = order.items;
      if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
      if (!Array.isArray(items)) items = [];
      const itemsAnalysis = items.map(item => ({
        name: item.name, price: item.price, quantity: item.quantity,
        payment_method: item.payment_method || order.payment_method,
        _rowPaid: item._rowPaid, paid_at: item.paid_at,
        payment_confirmed: item.payment_confirmed, status: item.status,
        credit_approved: item.credit_approved, credit_status: item.credit_status,
        isItemPaid: item._rowPaid === true
      }));
      const paidItems   = itemsAnalysis.filter(i => i.isItemPaid);
      const unpaidItems = itemsAnalysis.filter(i => !i.isItemPaid);
      return {
        order_id: order.id, table_name: order.table_name, order_total: order.total,
        order_payment_method: order.payment_method, order_status: order.status,
        order_payment_confirmed: order.payment_confirmed, order_credit_approved: order.credit_approved,
        items_count: items.length, paid_items_count: paidItems.length, unpaid_items_count: unpaidItems.length,
        has_any_paid_item: paidItems.length > 0, all_items_paid: unpaidItems.length === 0 && items.length > 0,
        paid_items:   paidItems.map(i  => ({ name: i.name, amount: (Number(i.price)||0)*(Number(i.quantity)||1), payment_method: i.payment_method, _rowPaid: i._rowPaid, paid_at: i.paid_at })),
        unpaid_items: unpaidItems.map(i => ({ name: i.name, amount: (Number(i.price)||0)*(Number(i.quantity)||1), payment_method: i.payment_method, is_credit: (i.payment_method||'').toUpperCase().includes('CREDIT') })),
        timestamp: order.timestamp || order.created_at
      };
    });

    const tablesGrouped = {};
    analyzedOrders.forEach(order => {
      if (!tablesGrouped[order.table_name]) {
        tablesGrouped[order.table_name] = { table_name: order.table_name, orders: [], total_paid: 0, total_unpaid: 0, all_orders_fully_paid: true, has_any_paid_item: false, has_pending_credit: false };
      }
      const tg = tablesGrouped[order.table_name];
      tg.orders.push(order);
      tg.total_paid   += order.paid_items.reduce((s, i) => s + i.amount, 0);
      tg.total_unpaid += order.unpaid_items.reduce((s, i) => s + i.amount, 0);
      tg.has_any_paid_item = tg.has_any_paid_item || order.has_any_paid_item;
      if (!order.all_items_paid) tg.all_orders_fully_paid = false;
      if (order.unpaid_items.some(i => i.is_credit)) tg.has_pending_credit = true;
    });

    res.json({
      date: targetDate, total_orders: analyzedOrders.length,
      tables: Object.values(tablesGrouped), raw_orders: analyzedOrders,
      message: "isItemPaid uses _rowPaid === true only"
    });
  } catch (err) {
    console.error("Debug Check Payments Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE CREDIT
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/credits/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;
  try {
    const creditRes = await pool.query(`SELECT * FROM credits WHERE id = $1`, [id]);
    if (creditRes.rows.length === 0) return res.status(404).json({ error: 'Credit not found' });
    await pool.query(
      `UPDATE credits SET status = 'Approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [approved_by || 'Manager', id]
    );
    res.json({ success: true, message: 'Credit approved' });
  } catch (err) {
    console.error('Credit approval error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// REJECT CREDIT
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/credits/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { rejected_by, reason } = req.body;
  try {
    const creditRes = await pool.query(`SELECT * FROM credits WHERE id = $1`, [id]);
    if (creditRes.rows.length === 0) return res.status(404).json({ error: 'Credit not found' });
    await pool.query(
      `UPDATE credits SET status = 'Rejected', rejected_by = $1, reject_reason = $2, rejected_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [rejected_by || 'Manager', reason || 'Rejected by manager', id]
    );
    res.json({ success: true, message: 'Credit rejected' });
  } catch (err) {
    console.error('Credit rejection error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;