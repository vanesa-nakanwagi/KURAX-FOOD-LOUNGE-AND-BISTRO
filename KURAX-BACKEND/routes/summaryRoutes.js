import express      from 'express';
import pool         from '../db.js';
import logActivity  from '../utils/logsActivity.js';
import PDFDocument  from 'pdfkit';

const router = express.Router();

// ── Kampala date helper ───────────────────────────────────────────────────────
function kampalaDate(d = new Date()) {
  const kampala = new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }));
  const year  = kampala.getFullYear();
  const month = String(kampala.getMonth() + 1).padStart(2, '0');
  const day   = String(kampala.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── Map settlement method → daily_summary column ─────────────────────────────
function methodToColumn(method) {
  const m = (method || '').toLowerCase();
  if (m === 'cash')        return 'total_cash';
  if (m === 'card')        return 'total_card';
  if (m === 'momo-mtn'  || m === 'mtn')    return 'total_mtn';
  if (m === 'momo-airtel'|| m === 'airtel') return 'total_airtel';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TODAY'S SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/today', async (req, res) => {
  try {
    const today = kampalaDate();

    let result = await pool.query(
      `SELECT * FROM daily_summary WHERE summary_date = $1`,
      [today]
    );

    let row = result.rows[0];

    if (!row) {
      const insertResult = await pool.query(
        `INSERT INTO daily_summary
           (summary_date, total_gross, total_cash, total_card,
            total_mtn, total_airtel, total_credit, total_mixed,
            total_settled_credits, order_count)
         VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0)
         ON CONFLICT (summary_date) DO NOTHING
         RETURNING *`,
        [today]
      );
      row = insertResult.rows[0] || {};
    }

    const cash    = Number(row.total_cash    || 0);
    const card    = Number(row.total_card    || 0);
    const mtn     = Number(row.total_mtn     || 0);
    const airtel  = Number(row.total_airtel  || 0);
    const settled = Number(row.total_settled_credits || 0);

    const calculatedGross = cash + card + mtn + airtel + settled;

    res.json({
      summary_date:   today,
      total_gross:    calculatedGross,
      total_cash:     cash,
      total_card:     card,
      total_mtn:      mtn,
      total_airtel:   airtel,
      total_credit:   Number(row.total_credit  || 0),
      total_mixed:    Number(row.total_mixed   || 0),
      order_count:    Number(row.order_count   || 0),
      total_settled_credits:          settled,
      credit_settlements_today:       settled,
      pending_credit_requests_amount: Number(row.total_credit || 0),
    });
  } catch (err) {
    console.error('Today summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PENDING CREDITS TOTAL
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending-credits-total', async (req, res) => {
  try {
    const today = kampalaDate();

    const result = await pool.query(`
      SELECT
        COALESCE(SUM(total), 0) AS total_pending,
        COUNT(*)                AS pending_count
      FROM orders
      WHERE UPPER(payment_method) = 'CREDIT'
        AND LOWER(status) NOT IN ('paid', 'closed')
        AND DATE(COALESCE(timestamp, created_at) AT TIME ZONE 'Africa/Nairobi') = $1
    `, [today]);

    res.json({
      total_pending: Number(result.rows[0].total_pending),
      pending_count: Number(result.rows[0].pending_count),
      message: 'Credit requests pending approval (NOT included in gross revenue)',
    });
  } catch (err) {
    console.error('Pending credits error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. RANGE
// ─────────────────────────────────────────────────────────────────────────────
router.get('/range', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'Dates required' });
  try {
    const result = await pool.query(
      `SELECT * FROM daily_summary
       WHERE summary_date BETWEEN $1 AND $2
       ORDER BY summary_date DESC`,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PETTY CASH
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
      message: `Petty ${direction}: UGX ${Number(amount).toLocaleString()} (${description})`,
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
    if (!result.rows.length) return res.status(404).json({ error: 'Petty cash entry not found' });
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
    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Petty cash update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MONTHLY FIXED EXPENSES
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
// 6. SETTLE CREDIT
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/credits/:id/settle', async (req, res) => {
  const { id } = req.params;
  const { amount_paid, method, transaction_id, settled_by } = req.body;

  if (!amount_paid || amount_paid <= 0) {
    return res.status(400).json({ error: 'Valid amount_paid is required' });
  }
  if (!method) {
    return res.status(400).json({ error: 'Payment method is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const creditRes = await client.query(
      `SELECT * FROM credits WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!creditRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Credit not found' });
    }

    const credit           = creditRes.rows[0];
    const currentAmountPaid = Number(credit.amount_paid || 0);
    const totalAmount       = Number(credit.amount      || 0);
    const newAmountPaid     = currentAmountPaid + Number(amount_paid);
    const remainingBalance  = totalAmount - newAmountPaid;

    let newStatus = credit.status;
    if (remainingBalance <= 0) {
      newStatus = 'FullySettled';
    } else if (newAmountPaid > 0) {
      newStatus = 'PartiallySettled';
    }

    await client.query(
      `UPDATE credits
       SET amount_paid   = $1,
           balance       = $2,
           status        = $3,
           settle_method = $4,
           settle_txn    = $5,
           settled_by    = $6,
           paid_at       = CASE
                             WHEN $3 IN ('FullySettled','PartiallySettled')
                             THEN COALESCE(paid_at, NOW())
                             ELSE paid_at
                           END,
           updated_at    = NOW()
       WHERE id = $7`,
      [newAmountPaid, remainingBalance, newStatus, method, transaction_id || null, settled_by, id]
    );

    await client.query(
      `INSERT INTO credit_settlements (credit_id, amount_paid, method, transaction_id, settled_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, amount_paid, method, transaction_id || null, settled_by]
    );

    const today   = kampalaDate();
    const payCol  = methodToColumn(method);
    const paidAmt = Number(amount_paid);

    if (payCol) {
      await client.query(`
        INSERT INTO daily_summary
          (summary_date, total_settled_credits, ${payCol}, total_gross, updated_at)
        VALUES ($1, $2, $2, $2, NOW())
        ON CONFLICT (summary_date) DO UPDATE SET
          total_settled_credits = daily_summary.total_settled_credits + $2,
          ${payCol}             = daily_summary.${payCol}             + $2,
          total_gross           = daily_summary.total_cash
                                + daily_summary.total_card
                                + daily_summary.total_mtn
                                + daily_summary.total_airtel
                                + daily_summary.total_settled_credits + $2,
          updated_at            = NOW()
      `, [today, paidAmt]);
    } else {
      console.warn(`[settle] Unknown method '${method}' — credited to total_settled_credits only`);
      await client.query(`
        INSERT INTO daily_summary
          (summary_date, total_settled_credits, total_gross, updated_at)
        VALUES ($1, $2, $2, NOW())
        ON CONFLICT (summary_date) DO UPDATE SET
          total_settled_credits = daily_summary.total_settled_credits + $2,
          total_gross           = daily_summary.total_gross            + $2,
          updated_at            = NOW()
      `, [today, paidAmt]);
    }

    await client.query('COMMIT');

    await logActivity(pool, {
      type:    'CREDIT_SETTLEMENT',
      actor:   settled_by,
      role:    'CASHIER',
      message: `Credit settlement: UGX ${Number(amount_paid).toLocaleString()} via ${method} for ${credit.client_name}`,
    });

    res.json({
      success: true,
      credit: {
        id:          credit.id,
        amount:      totalAmount,
        amount_paid: newAmountPaid,
        balance:     remainingBalance,
        status:      newStatus,
      },
      message: remainingBalance <= 0
        ? 'Credit fully settled!'
        : `Payment recorded. Remaining balance: UGX ${remainingBalance.toLocaleString()}`,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Credit settlement error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. MONTHLY PROFIT (FIXED – case‑insensitive, no aggressive exclusion)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/monthly-profit', async (req, res) => {
  const month = req.query.month || kampalaDate().substring(0, 7);
  console.log(`🔵 Monthly profit requested for: ${month}`);

  try {
    // ── 1. NEW SALES (CASH, CARD, MOBILE MONEY) from ORDERS only ─────────────
    // Use LOWER() to handle mixed case, and do NOT exclude orders that have a credit record.
    const salesResult = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END), 0) AS cash,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'card' THEN total ELSE 0 END), 0) AS card,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('mtn', 'momo-mtn') THEN total ELSE 0 END), 0) AS mtn,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('airtel', 'momo-airtel') THEN total ELSE 0 END), 0) AS airtel,
        COUNT(*) AS order_count
      FROM orders
      WHERE status IN ('Paid', 'Confirmed', 'Closed', 'Served')
        AND payment_method IS NOT NULL
        AND LOWER(payment_method) != 'credit'
        AND TO_CHAR((created_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1
    `, [month]);

    const newCash = Number(salesResult.rows[0].cash);
    const newCard = Number(salesResult.rows[0].card);
    const newMtn  = Number(salesResult.rows[0].mtn);
    const newAirtel = Number(salesResult.rows[0].airtel);
    const newMobileMoney = newMtn + newAirtel;
    const newSalesTotal  = newCash + newCard + newMobileMoney;
    const orderCount     = Number(salesResult.rows[0].order_count);

    // ── 2. CREDIT SETTLEMENTS (old credits repaid this month) ──────────────
    const settlementsRes = await pool.query(`
      SELECT
        COALESCE(SUM(amount_paid), 0)                                                       AS total_settled,
        COALESCE(SUM(CASE WHEN LOWER(settle_method) = 'cash' THEN amount_paid ELSE 0 END), 0) AS settled_cash,
        COALESCE(SUM(CASE WHEN LOWER(settle_method) = 'card' THEN amount_paid ELSE 0 END), 0) AS settled_card,
        COALESCE(SUM(CASE WHEN LOWER(settle_method) IN ('mtn', 'momo-mtn') THEN amount_paid ELSE 0 END), 0) AS settled_mtn,
        COALESCE(SUM(CASE WHEN LOWER(settle_method) IN ('airtel', 'momo-airtel') THEN amount_paid ELSE 0 END), 0) AS settled_airtel,
        COUNT(*) AS settlement_count
      FROM credits
      WHERE status IN ('FullySettled', 'PartiallySettled')
        AND TO_CHAR((paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1
    `, [month]);

    const settlements = settlementsRes.rows[0];
    const totalSettled = Number(settlements.total_settled);

    // ── 3. EXPENSES ────────────────────────────────────────────────────────
    const pettyRes = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS petty_out
      FROM petty_cash
      WHERE direction = 'OUT'
        AND TO_CHAR(entry_date, 'YYYY-MM') = $1
    `, [month]);

    const expRes = await pool.query(
      `SELECT * FROM monthly_expenses WHERE month = $1`,
      [month]
    );

    const pettyOut   = Number(pettyRes.rows[0].petty_out);
    const fixedTotal = expRes.rows.reduce((s, r) => s + Number(r.amount), 0);

    // ── 4. REVENUE & PROFIT ─────────────────────────────────────────────────
    const totalRevenue = newSalesTotal + totalSettled;
    const totalCosts   = pettyOut + fixedTotal;
    const netProfit    = totalRevenue - totalCosts;
    const marginPct    = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

    res.json({
      month,
      sales: {
        from_paid_orders:          newSalesTotal,
        from_credit_settlements:   totalSettled,
        total_gross:               totalRevenue,
        cash:                      newCash,
        card:                      newCard,
        mobile_money:              newMobileMoney,
        order_count:               orderCount,
        settlement_count:          Number(settlements.settlement_count),
      },
      costs: {
        petty_out:   pettyOut,
        fixed_total: fixedTotal,
        fixed_items: expRes.rows,
        total:       totalCosts,
      },
      net_profit:  netProfit,
      margin_pct:  marginPct,
    });
  } catch (err) {
    console.error('Monthly profit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. STAFF MONTHLY INCOME (unchanged, already correct)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/staff-monthly-income', async (req, res) => {
  const { staffId, staffName, month } = req.query;

  if (!staffId && !staffName) {
    return res.status(400).json({ error: 'Either staffId or staffName is required' });
  }

  const targetMonth = month || kampalaDate().substring(0, 7);

  try {
    let queueTotal = 0, creditTotal = 0;
    let queueBreakdown  = { cash: 0, card: 0, mtn: 0, airtel: 0, transaction_count: 0 };
    let creditBreakdown = { cash: 0, card: 0, mtn: 0, airtel: 0, settlement_count: 0 };
    let staffDetails = null;

    if (staffId) {
      const queuePayments = await pool.query(`
        SELECT
          COALESCE(SUM(amount), 0)                                                       AS total,
          COUNT(*)                                                                        AS transaction_count,
          COALESCE(SUM(CASE WHEN method = 'Cash'       THEN amount ELSE 0 END), 0)       AS cash_amount,
          COALESCE(SUM(CASE WHEN method = 'Card'       THEN amount ELSE 0 END), 0)       AS card_amount,
          COALESCE(SUM(CASE WHEN method = 'Momo-MTN'   THEN amount ELSE 0 END), 0)       AS mtn_amount,
          COALESCE(SUM(CASE WHEN method = 'Momo-Airtel'THEN amount ELSE 0 END), 0)       AS airtel_amount
        FROM cashier_queue
        WHERE status = 'Confirmed'
          AND staff_id = $1
          AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
      `, [staffId, targetMonth]);

      queueTotal     = Number(queuePayments.rows[0].total);
      queueBreakdown = {
        cash:              Number(queuePayments.rows[0].cash_amount),
        card:              Number(queuePayments.rows[0].card_amount),
        mtn:               Number(queuePayments.rows[0].mtn_amount),
        airtel:            Number(queuePayments.rows[0].airtel_amount),
        transaction_count: Number(queuePayments.rows[0].transaction_count),
      };

      const staffInfo = await pool.query(
        `SELECT name, role, daily_order_target, monthly_income_target FROM staff WHERE id = $1`,
        [staffId]
      );
      if (staffInfo.rows.length) staffDetails = staffInfo.rows[0];

      const staffMemberName = staffDetails?.name || '';

      const creditSettlements = await pool.query(`
        SELECT
          COALESCE(SUM(c.amount_paid), 0)                                                        AS total,
          COUNT(*)                                                                                 AS settlement_count,
          COALESCE(SUM(CASE WHEN c.settle_method = 'Cash'       THEN c.amount_paid ELSE 0 END), 0) AS cash_amount,
          COALESCE(SUM(CASE WHEN c.settle_method = 'Card'       THEN c.amount_paid ELSE 0 END), 0) AS card_amount,
          COALESCE(SUM(CASE WHEN c.settle_method = 'Momo-MTN'   THEN c.amount_paid ELSE 0 END), 0) AS mtn_amount,
          COALESCE(SUM(CASE WHEN c.settle_method = 'Momo-Airtel'THEN c.amount_paid ELSE 0 END), 0) AS airtel_amount
        FROM credits c
        LEFT JOIN cashier_queue cq ON c.cashier_queue_id = cq.id
        WHERE c.status IN ('FullySettled', 'PartiallySettled')
          AND TO_CHAR((c.paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
          AND (
            (c.cashier_queue_id IS NOT NULL AND cq.staff_id = $1)
            OR
            (c.cashier_queue_id IS NULL     AND c.waiter_name ILIKE $3)
          )
      `, [staffId, targetMonth, `%${staffMemberName}%`]);

      creditTotal     = Number(creditSettlements.rows[0].total);
      creditBreakdown = {
        cash:             Number(creditSettlements.rows[0].cash_amount),
        card:             Number(creditSettlements.rows[0].card_amount),
        mtn:              Number(creditSettlements.rows[0].mtn_amount),
        airtel:           Number(creditSettlements.rows[0].airtel_amount),
        settlement_count: Number(creditSettlements.rows[0].settlement_count),
      };

    } else if (staffName) {
      const queuePayments = await pool.query(`
        SELECT
          COALESCE(SUM(amount), 0)                                                       AS total,
          COUNT(*)                                                                        AS transaction_count,
          COALESCE(SUM(CASE WHEN method = 'Cash'       THEN amount ELSE 0 END), 0)       AS cash_amount,
          COALESCE(SUM(CASE WHEN method = 'Card'       THEN amount ELSE 0 END), 0)       AS card_amount,
          COALESCE(SUM(CASE WHEN method = 'Momo-MTN'   THEN amount ELSE 0 END), 0)       AS mtn_amount,
          COALESCE(SUM(CASE WHEN method = 'Momo-Airtel'THEN amount ELSE 0 END), 0)       AS airtel_amount
        FROM cashier_queue
        WHERE status = 'Confirmed'
          AND requested_by ILIKE $1
          AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
      `, [`%${staffName}%`, targetMonth]);

      queueTotal     = Number(queuePayments.rows[0].total);
      queueBreakdown = {
        cash:              Number(queuePayments.rows[0].cash_amount),
        card:              Number(queuePayments.rows[0].card_amount),
        mtn:               Number(queuePayments.rows[0].mtn_amount),
        airtel:            Number(queuePayments.rows[0].airtel_amount),
        transaction_count: Number(queuePayments.rows[0].transaction_count),
      };

      const creditSettlements = await pool.query(`
        SELECT
          COALESCE(SUM(amount_paid), 0)                                                        AS total,
          COUNT(*)                                                                               AS settlement_count,
          COALESCE(SUM(CASE WHEN settle_method = 'Cash'       THEN amount_paid ELSE 0 END), 0) AS cash_amount,
          COALESCE(SUM(CASE WHEN settle_method = 'Card'       THEN amount_paid ELSE 0 END), 0) AS card_amount,
          COALESCE(SUM(CASE WHEN settle_method = 'Momo-MTN'   THEN amount_paid ELSE 0 END), 0) AS mtn_amount,
          COALESCE(SUM(CASE WHEN settle_method = 'Momo-Airtel'THEN amount_paid ELSE 0 END), 0) AS airtel_amount
        FROM credits
        WHERE status IN ('FullySettled', 'PartiallySettled')
          AND waiter_name ILIKE $1
          AND TO_CHAR((paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
      `, [`%${staffName}%`, targetMonth]);

      creditTotal     = Number(creditSettlements.rows[0].total);
      creditBreakdown = {
        cash:             Number(creditSettlements.rows[0].cash_amount),
        card:             Number(creditSettlements.rows[0].card_amount),
        mtn:              Number(creditSettlements.rows[0].mtn_amount),
        airtel:           Number(creditSettlements.rows[0].airtel_amount),
        settlement_count: Number(creditSettlements.rows[0].settlement_count),
      };
    }

    const monthlyIncome = queueTotal + creditTotal;

    res.json({
      staff_id:    staffId || null,
      staff_name:  staffName || (staffDetails?.name || null),
      role:        staffDetails?.role || null,
      month:       targetMonth,
      monthly_income: monthlyIncome,
      daily_target:   staffDetails?.daily_order_target || null,
      monthly_target: staffDetails?.monthly_income_target || null,
      progress_percentage: staffDetails?.monthly_income_target
        ? Math.min(Math.round((monthlyIncome / staffDetails.monthly_income_target) * 100), 100)
        : null,
      breakdown: {
        from_cashier_queue: {
          amount:            queueTotal,
          transaction_count: queueBreakdown.transaction_count,
          details: { cash: queueBreakdown.cash, card: queueBreakdown.card, mtn: queueBreakdown.mtn, airtel: queueBreakdown.airtel },
        },
        from_credit_settlements: {
          amount:           creditTotal,
          settlement_count: creditBreakdown.settlement_count,
          details: { cash: creditBreakdown.cash, card: creditBreakdown.card, mtn: creditBreakdown.mtn, airtel: creditBreakdown.airtel },
        },
      },
    });
  } catch (err) {
    console.error('Staff monthly income error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. ALL STAFF MONTHLY INCOME
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all-staff-monthly-income', async (req, res) => {
  const { month } = req.query;
  const targetMonth = month || kampalaDate().substring(0, 7);

  try {
    const staffList = await pool.query(`
      SELECT id, name, role, daily_order_target, monthly_income_target
      FROM staff
      WHERE role IN ('WAITER', 'CASHIER', 'MANAGER', 'SUPERVISOR')
      ORDER BY name
    `);

    const staffPerformance = [];

    for (const staff of staffList.rows) {
      const queuePayments = await pool.query(`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM cashier_queue
        WHERE status = 'Confirmed'
          AND staff_id = $1
          AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
      `, [staff.id, targetMonth]);

      const creditSettlements = await pool.query(`
        SELECT COALESCE(SUM(c.amount_paid), 0) AS total
        FROM credits c
        LEFT JOIN cashier_queue cq ON c.cashier_queue_id = cq.id
        WHERE c.status IN ('FullySettled', 'PartiallySettled')
          AND TO_CHAR((c.paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $2
          AND (
            (c.cashier_queue_id IS NOT NULL AND cq.staff_id = $1)
            OR
            (c.cashier_queue_id IS NULL     AND c.waiter_name ILIKE $3)
          )
      `, [staff.id, targetMonth, `%${staff.name}%`]);

      const queueTotal  = Number(queuePayments.rows[0].total);
      const creditTotal = Number(creditSettlements.rows[0].total);
      const monthlyIncome = queueTotal + creditTotal;

      staffPerformance.push({
        id:                staff.id,
        name:              staff.name,
        role:              staff.role,
        monthly_income:    monthlyIncome,
        monthly_target:    staff.monthly_income_target,
        progress_percentage: staff.monthly_income_target
          ? Math.min(Math.round((monthlyIncome / staff.monthly_income_target) * 100), 100)
          : null,
        breakdown: { from_queue: queueTotal, from_credits: creditTotal },
      });
    }

    staffPerformance.sort((a, b) => b.monthly_income - a.monthly_income);

    res.json({
      month:                targetMonth,
      total_staff:          staffPerformance.length,
      total_company_income: staffPerformance.reduce((sum, s) => sum + s.monthly_income, 0),
      staff_performance:    staffPerformance,
    });
  } catch (err) {
    console.error('All staff monthly income error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. EXPORT PDF REPORT – FULLY FIXED (no event listener, safe footer)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export-pdf', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).send('Month is required');

  try {
    // New sales (case‑insensitive)
    const salesData = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'card' THEN total ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('mtn', 'momo-mtn') THEN total ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('airtel', 'momo-airtel') THEN total ELSE 0 END), 0) AS total_airtel,
        COUNT(*) AS order_count
      FROM orders
      WHERE status IN ('Paid','Confirmed','Closed','Served')
        AND payment_method IS NOT NULL
        AND LOWER(payment_method) != 'credit'
        AND TO_CHAR((created_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1
    `, [month]);

    const creditData = await pool.query(`
      SELECT
        COALESCE(SUM(amount_paid), 0)                                                        AS total_settled,
        COALESCE(SUM(CASE WHEN LOWER(settle_method) = 'cash' THEN amount_paid ELSE 0 END), 0) AS settled_cash,
        COALESCE(SUM(CASE WHEN LOWER(settle_method) = 'card' THEN amount_paid ELSE 0 END), 0) AS settled_card,
        COALESCE(SUM(CASE WHEN LOWER(settle_method) IN ('mtn', 'momo-mtn') THEN amount_paid ELSE 0 END), 0) AS settled_mtn,
        COALESCE(SUM(CASE WHEN LOWER(settle_method) IN ('airtel', 'momo-airtel') THEN amount_paid ELSE 0 END), 0) AS settled_airtel,
        COUNT(*) AS settlement_count
      FROM credits
      WHERE status IN ('FullySettled','PartiallySettled')
        AND TO_CHAR((paid_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1
    `, [month]);

    const creditsLedger = await pool.query(`
      SELECT id, table_name, client_name, client_phone,
             amount, amount_paid, balance, status,
             created_at, approved_by, settled_by, settle_method, pay_by
      FROM credits
      WHERE TO_CHAR((created_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1
      ORDER BY created_at DESC
    `, [month]);

    const pettyData = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS petty_out
      FROM petty_cash
      WHERE direction = 'OUT'
        AND TO_CHAR(entry_date, 'YYYY-MM') = $1
    `, [month]);

    const expenses = await pool.query(
      `SELECT * FROM monthly_expenses WHERE month = $1`,
      [month]
    );

    const sales      = salesData.rows[0];
    const credits    = creditData.rows[0];
    const pettyOut   = Number(pettyData.rows[0].petty_out);
    const fixedTotal = expenses.rows.reduce((s, r) => s + Number(r.amount), 0);

    const totalNewSales = Number(sales.total_cash) + Number(sales.total_card) + Number(sales.total_mtn) + Number(sales.total_airtel);
    const totalSettled  = Number(credits.total_settled);
    const totalRevenue  = totalNewSales + totalSettled;
    const totalExpenses = pettyOut + fixedTotal;
    const netProfit     = totalRevenue - totalExpenses;
    const margin        = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0';

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Kurax_Report_${month}.pdf`);
    doc.pipe(res);

    // Simple footer function (no event listener – call at the end of each page)
    const addFooter = () => {
      doc.fillColor('#999999').fontSize(8).font('Helvetica').text(
        `Generated on ${new Date().toLocaleString()} · Kurax Bistro Financial System`,
        50, doc.page.height - 40,
        { align: 'center' }
      );
    };

    // Cover
    doc.fillColor('#EAB308').fontSize(24).font('Helvetica-Bold').text('KURAX BISTRO', { align: 'center' });
    doc.fillColor('#444444').fontSize(12).font('Helvetica').text('Monthly Financial Oversight Report', { align: 'center' }).moveDown();
    doc.text(`Report Period: ${month}`, { align: 'center' }).moveDown(2);
    addFooter();

    // Executive Summary page
    doc.addPage();
    addFooter();

    doc.rect(50, 50, 500, 200).fill('#f9f9f9').stroke('#eeeeee');
    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('Executive Summary', 70, 65);

    doc.fontSize(10).font('Helvetica-Bold').text('Total Revenue:', 70, 95);
    doc.fillColor('#EAB308').font('Helvetica-Bold').text(`UGX ${totalRevenue.toLocaleString()}`, 280, 95);
    doc.fillColor('#000000').font('Helvetica')
      .text(`  • From New Sales: UGX ${totalNewSales.toLocaleString()}`, 80, 115)
      .text(`  • From Credit Settlements: UGX ${totalSettled.toLocaleString()}`, 80, 130)
      .text('Breakdown of New Sales:', 70, 155)
      .text(`  • Cash: UGX ${Number(sales.total_cash).toLocaleString()}`, 80, 170)
      .text(`  • Card: UGX ${Number(sales.total_card).toLocaleString()}`, 80, 185)
      .text(`  • MTN Mobile Money: UGX ${Number(sales.total_mtn).toLocaleString()}`, 80, 200)
      .text(`  • Airtel Money: UGX ${Number(sales.total_airtel).toLocaleString()}`, 80, 215);

    if (totalSettled > 0) {
      doc.text('Credit Settlements Breakdown:', 70, 240);
      let cy = 255;
      if (Number(credits.settled_cash)   > 0) { doc.text(`  • Cash: UGX ${Number(credits.settled_cash).toLocaleString()}`,   80, cy); cy += 15; }
      if (Number(credits.settled_card)   > 0) { doc.text(`  • Card: UGX ${Number(credits.settled_card).toLocaleString()}`,   80, cy); cy += 15; }
      if (Number(credits.settled_mtn)    > 0) { doc.text(`  • MTN: UGX ${Number(credits.settled_mtn).toLocaleString()}`,     80, cy); cy += 15; }
      if (Number(credits.settled_airtel) > 0) { doc.text(`  • Airtel: UGX ${Number(credits.settled_airtel).toLocaleString()}`, 80, cy); }
    }

    const newY = Math.max(50 + 200 + 20, doc.y + 20);
    doc.rect(50, newY, 500, 120).fill('#f9f9f9').stroke('#eeeeee');
    doc.fillColor('#000000').fontSize(12).font('Helvetica-Bold').text('Expenses & Profit', 70, newY + 15);
    doc.fontSize(10).font('Helvetica-Bold').text('Total Expenses:', 70, newY + 45);
    doc.fillColor('#DC2626').text(`UGX ${totalExpenses.toLocaleString()}`, 280, newY + 45);
    doc.fillColor('#000000').font('Helvetica')
      .text(`  • Petty Cash: UGX ${pettyOut.toLocaleString()}`, 80, newY + 65)
      .text(`  • Fixed Expenses: UGX ${fixedTotal.toLocaleString()}`, 80, newY + 80);
    doc.font('Helvetica-Bold').text('Net Profit:', 70, newY + 110);
    doc.fillColor(netProfit >= 0 ? '#10B981' : '#DC2626')
      .font('Helvetica-Bold').text(`UGX ${netProfit.toLocaleString()}`, 280, newY + 110);
    if (netProfit >= 0) {
      doc.fillColor('#10B981').text(`✓ Profitable month with ${margin}% margin`, 70, newY + 135);
    } else {
      doc.fillColor('#DC2626').text(`⚠ Operating at a loss of ${Math.abs(margin)}%`, 70, newY + 135);
    }

    // Credit Ledger page (if any)
    if (creditsLedger.rows.length > 0) {
      doc.addPage();
      addFooter();
      doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('Credit Ledger', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text(`All credits recorded in ${month}`, { align: 'center' }).moveDown(1);

      const startY = doc.y;
      const colX = { table: 50, client: 120, amount: 220, paid: 290, balance: 360, status: 430, date: 500 };
      doc.font('Helvetica-Bold').fontSize(8);
      Object.entries(colX).forEach(([k, x]) =>
        doc.text(k.charAt(0).toUpperCase() + k.slice(1), x, startY)
      );
      doc.moveDown(0.5);
      doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();

      doc.font('Helvetica').fontSize(8);
      let y = doc.y + 5;
      for (const c of creditsLedger.rows) {
        if (y > 750) { doc.addPage(); addFooter(); y = 50; }
        doc.text(c.table_name  || '—',                              colX.table,   y);
        doc.text(c.client_name || '—',                              colX.client,  y);
        doc.text(`UGX ${Number(c.amount).toLocaleString()}`,        colX.amount,  y);
        doc.text(`UGX ${Number(c.amount_paid).toLocaleString()}`,   colX.paid,    y);
        doc.text(`UGX ${Number(c.balance).toLocaleString()}`,       colX.balance, y);
        doc.text(c.status || 'Unknown',                             colX.status,  y);
        doc.text(c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '', colX.date, y);
        y += 18;
      }
    }

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).send('Error generating report');
  }
});

export default router;