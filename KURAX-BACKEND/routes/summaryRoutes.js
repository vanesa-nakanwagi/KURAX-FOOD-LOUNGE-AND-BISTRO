import express      from 'express';
import pool         from '../db.js';
import logActivity  from '../utils/logsActivity.js';
import PDFDocument  from 'pdfkit';

const router = express.Router();

// ── Kampala date helper ───────────────────────────────────────────────────────
function kampalaDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }))
    .toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DAILY SUMMARY (TODAY) - FIXED to include credit settlements
// ─────────────────────────────────────────────────────────────────────────────
router.get('/today', async (req, res) => {
  try {
    const today = kampalaDate();
    
    // Get cashier_queue confirmed payments (non-credit)
    const queueResult = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN method != 'Credit' THEN amount ELSE 0 END), 0) AS total_gross,
        COALESCE(SUM(CASE WHEN method = 'Cash'        THEN amount ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN method = 'Card'        THEN amount ELSE 0 END), 0) AS total_card,
        COALESCE(SUM(CASE WHEN method = 'Momo-MTN'    THEN amount ELSE 0 END), 0) AS total_mtn,
        COALESCE(SUM(CASE WHEN method = 'Momo-Airtel' THEN amount ELSE 0 END), 0) AS total_airtel,
        COALESCE(SUM(CASE WHEN method = 'Credit'      THEN amount ELSE 0 END), 0) AS total_credit,
        COALESCE(SUM(CASE WHEN method = 'Mixed'       THEN amount ELSE 0 END), 0) AS total_mixed,
        COUNT(*) AS order_count
      FROM cashier_queue
      WHERE status = 'Confirmed'
        AND DATE(confirmed_at AT TIME ZONE 'Africa/Nairobi') = $1
    `, [today]);
    
    // Get credit settlements from credits table for today
    const creditSettlements = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN settle_method = 'Cash' THEN amount_paid ELSE 0 END), 0) AS settled_cash,
        COALESCE(SUM(CASE WHEN settle_method = 'Momo-MTN' THEN amount_paid ELSE 0 END), 0) AS settled_mtn,
        COALESCE(SUM(CASE WHEN settle_method = 'Momo-Airtel' THEN amount_paid ELSE 0 END), 0) AS settled_airtel,
        COALESCE(SUM(CASE WHEN settle_method = 'Card' THEN amount_paid ELSE 0 END), 0) AS settled_card,
        COALESCE(SUM(amount_paid), 0) AS total_settled
      FROM credits 
      WHERE status IN ('FullySettled', 'PartiallySettled')
        AND DATE(paid_at AT TIME ZONE 'Africa/Nairobi') = $1
    `, [today]);
    
    const queue = queueResult.rows[0];
    const settlements = creditSettlements.rows[0];
    
    // Combine queue payments with credit settlements
    res.json({
      summary_date: today,
      total_gross: Number(queue.total_gross) + Number(settlements.total_settled),
      total_cash: Number(queue.total_cash) + Number(settlements.settled_cash),
      total_card: Number(queue.total_card) + Number(settlements.settled_card),
      total_mtn: Number(queue.total_mtn) + Number(settlements.settled_mtn),
      total_airtel: Number(queue.total_airtel) + Number(settlements.settled_airtel),
      total_credit: Number(queue.total_credit),
      total_mixed: Number(queue.total_mixed),
      order_count: Number(queue.order_count),
      credit_settlements_today: Number(settlements.total_settled)
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
// 5. MONTHLY P&L (DIRECTOR AUDIT VIEW) - FIXED to include credit settlements
// ─────────────────────────────────────────────────────────────────────────────
router.get('/monthly-profit', async (req, res) => {
  const month = req.query.month || kampalaDate().substring(0, 7);
  try {
    // Sales Logic - from cashier_queue (non-credit payments)
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
    
    // Credit settlements for the month
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

    // Costs Logic
    const pettyRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS petty_out FROM petty_cash 
       WHERE direction = 'OUT' AND TO_CHAR(entry_date, 'YYYY-MM') = $1`, [month]
    );
    
    const expRes = await pool.query(`SELECT * FROM monthly_expenses WHERE month = $1`, [month]);

    const sales = salesRes.rows[0];
    const settlements = creditSettlements.rows[0];
    const pettyOut = Number(pettyRes.rows[0].petty_out);
    const fixedTotal = expRes.rows.reduce((s, r) => s + Number(r.amount), 0);
    
    // Total revenue = cashier_queue non-credit payments + credit settlements
    const totalRevenue = Number(sales.total_gross) + Number(settlements.total_settled);
    const totalCosts = pettyOut + fixedTotal;
    const netProfit = totalRevenue - totalCosts;

    res.json({
      month,
      sales: { 
        ...sales, 
        total_gross: totalRevenue,
        cashier_gross: Number(sales.total_gross),
        credit_settlements: Number(settlements.total_settled),
        settlement_count: Number(settlements.settlement_count)
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
// 6. DOWNLOAD PDF REPORT (DIRECTOR FEATURE) - FIXED to include credit settlements
// ─────────────────────────────────────────────────────────────────────────────
router.get('/export-pdf', async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).send("Month is required");

  try {
    // 1. Fetch Profit Data with credit settlements
    const profitData = await pool.query(`
      SELECT 
        (SELECT COALESCE(SUM(CASE WHEN method != 'Credit' THEN amount ELSE 0 END), 0) 
         FROM cashier_queue WHERE status='Confirmed' AND TO_CHAR(confirmed_at, 'YYYY-MM')=$1) as cashier_gross,
        (SELECT COALESCE(SUM(amount_paid), 0) 
         FROM credits WHERE status IN ('FullySettled', 'PartiallySettled') 
         AND TO_CHAR(paid_at, 'YYYY-MM')=$1) as credit_settlements,
        (SELECT COALESCE(SUM(amount), 0) 
         FROM petty_cash WHERE direction='OUT' AND TO_CHAR(entry_date, 'YYYY-MM')=$1) as petty
    `, [month]);

    const expenses = await pool.query(`SELECT * FROM monthly_expenses WHERE month = $1`, [month]);
    
    const totalRevenue = Number(profitData.rows[0].cashier_gross) + Number(profitData.rows[0].credit_settlements);
    const totalExpenses = Number(profitData.rows[0].petty) + expenses.rows.reduce((s,r)=>s+Number(r.amount),0);
    const netProfit = totalRevenue - totalExpenses;

    // 2. Setup PDF
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Kurax_Report_${month}.pdf`);
    doc.pipe(res);

    // 3. Styling & Content
    doc.fillColor('#EAB308').fontSize(24).text('KURAX BISTRO', { align: 'center' });
    doc.fillColor('#444444').fontSize(12).text('Monthly Financial Oversight Report', { align: 'center' }).moveDown();
    doc.text(`Report Period: ${month}`, { align: 'center' }).moveDown(2);

    // Summary Box
    doc.rect(50, 150, 500, 130).fill('#f9f9f9').stroke('#eeeeee');
    doc.fillColor('#000000').fontSize(14).text('Executive Summary', 70, 165);
    doc.fontSize(10).text(`Total Revenue: UGX ${totalRevenue.toLocaleString()}`, 70, 190);
    doc.text(`  - Cash/Card/Momo Payments: UGX ${Number(profitData.rows[0].cashier_gross).toLocaleString()}`, 80, 210);
    doc.text(`  - Credit Settlements: UGX ${Number(profitData.rows[0].credit_settlements).toLocaleString()}`, 80, 230);
    doc.text(`Total Expenses: UGX ${totalExpenses.toLocaleString()}`, 70, 255);
    doc.text(`Net Profit: UGX ${netProfit.toLocaleString()}`, 70, 275);

    // Expense Details
    doc.moveDown(5);
    doc.fontSize(14).text('Verified Fixed Expenses', { underline: true }).moveDown();
    
    expenses.rows.forEach((item, index) => {
      doc.fontSize(10).fillColor('#000000').text(`${index + 1}. ${item.category}: UGX ${Number(item.amount).toLocaleString()}`);
      doc.fillColor('#666666').text(`   - Note: ${item.description || 'N/A'} (Recorded by: ${item.entered_by})`).moveDown(0.5);
    });

    if (expenses.rows.length === 0) doc.text("No fixed expenses recorded.");

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating report");
  }
});

// In summaryRoutes.js - Updated PUT endpoint without updated_at
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

export default router;