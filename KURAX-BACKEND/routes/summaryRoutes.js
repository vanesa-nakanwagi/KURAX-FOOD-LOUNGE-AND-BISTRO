// routes/summaryRoutes.js
import express from 'express';
import pool from '../db.js';
import logActivity  from '../utils/logsActivity.js';

const router = express.Router();

// GET /api/summaries/today
router.get('/today', async (req, res) => {
  try {
    // Use Kampala local date, not UTC
    const result = await pool.query(
      `SELECT * FROM daily_summaries
       WHERE summary_date = (NOW() AT TIME ZONE 'Africa/Kampala')::date`
    );
    res.json(result.rows[0] || {
      summary_date: null,
      total_gross:  0,
      total_cash:   0,
      total_card:   0,
      total_mtn:    0,
      total_airtel: 0,
      total_credit: 0,
      total_mixed:  0,
      order_count:  0,
    });
  } catch (err) {
    console.error('Summary today error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summaries/range?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/range', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to query params required (YYYY-MM-DD)' });
  }
  try {
    const result = await pool.query(
      `SELECT * FROM daily_summaries
       WHERE summary_date BETWEEN $1 AND $2
       ORDER BY summary_date DESC`,
      [from, to]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Summary range error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summaries/monthly?month=YYYY-MM
router.get('/monthly', async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  try {
    const result = await pool.query(
      `SELECT * FROM daily_summaries
       WHERE TO_CHAR(summary_date, 'YYYY-MM') = $1
       ORDER BY summary_date DESC`,
      [month]
    );

    const totals = result.rows.reduce((acc, row) => ({
      total_gross:  acc.total_gross  + Number(row.total_gross),
      total_cash:   acc.total_cash   + Number(row.total_cash),
      total_card:   acc.total_card   + Number(row.total_card),
      total_mtn:    acc.total_mtn    + Number(row.total_mtn),
      total_airtel: acc.total_airtel + Number(row.total_airtel),
      total_credit: acc.total_credit + Number(row.total_credit),
      total_mixed:  acc.total_mixed  + Number(row.total_mixed),
      order_count:  acc.order_count  + Number(row.order_count),
    }), {
      total_gross: 0, total_cash: 0, total_card: 0,
      total_mtn: 0, total_airtel: 0, total_credit: 0,
      total_mixed: 0, order_count: 0,
    });

    res.json({ month, totals, daily: result.rows });
  } catch (err) {
    console.error('Summary monthly error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/summaries/petty-cash
router.post('/petty-cash', async (req, res) => {
  const { amount, direction, description, logged_by, entry_date, category } = req.body;
  if (!amount || !direction || !description || !logged_by) {
    return res.status(400).json({ error: 'amount, direction, description, and logged_by are required' });
  }
  if (!['IN', 'OUT'].includes(direction)) {
    return res.status(400).json({ error: 'direction must be IN or OUT' });
  }
  const _category = category || 'General';
  // Default to today in Kampala time
  const _date = entry_date || (() => {
    const kampala = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return [
      kampala.getUTCFullYear(),
      String(kampala.getUTCMonth() + 1).padStart(2, '0'),
      String(kampala.getUTCDate()).padStart(2, '0'),
    ].join('-');
  })();
  try {
    const result = await pool.query(
      `INSERT INTO petty_cash (entry_date, amount, direction, category, description, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [_date, Number(amount), direction, _category, description, logged_by]
    );
    const entry = result.rows[0];
    const sign = entry.direction === 'OUT' ? '−' : '+';
    await logActivity(pool, 'PETTY',
      `Petty ${entry.direction} · ${entry.category} · ${sign}UGX ${Number(entry.amount).toLocaleString()} — ${entry.description} (${entry.logged_by})`,
      { id: entry.id, direction: entry.direction, amount: entry.amount, category: entry.category }
    );
    res.status(201).json(entry);
  } catch (err) {
    console.error('Petty cash insert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summaries/petty-cash?date=YYYY-MM-DD
router.get('/petty-cash', async (req, res) => {
  // Default to today in Kampala time
  const date = req.query.date || (() => {
    const kampala = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return [
      kampala.getUTCFullYear(),
      String(kampala.getUTCMonth() + 1).padStart(2, '0'),
      String(kampala.getUTCDate()).padStart(2, '0'),
    ].join('-');
  })();
  try {
    const result = await pool.query(
      `SELECT * FROM petty_cash WHERE entry_date = $1 ORDER BY created_at DESC`,
      [date]
    );
    const total_in  = result.rows.filter(r => r.direction === 'IN').reduce((s, r)  => s + Number(r.amount), 0);
    const total_out = result.rows.filter(r => r.direction === 'OUT').reduce((s, r) => s + Number(r.amount), 0);
    res.json({ date, total_in, total_out, net: total_in - total_out, entries: result.rows });
  } catch (err) {
    console.error('Petty cash fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/summaries/petty-cash/:id
router.delete('/petty-cash/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM petty_cash WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Petty cash delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// GET /api/summaries/petty-cash/range?from=YYYY-MM-DD&to=YYYY-MM-DD
// Used by accountant and director ledger views (multi-day).
router.get('/petty-cash/range', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  try {
    const result = await pool.query(
      `SELECT * FROM petty_cash
       WHERE entry_date BETWEEN $1 AND $2
       ORDER BY entry_date DESC, created_at DESC`,
      [from, to]
    );
    const entries   = result.rows;
    const total_in  = entries.filter(r => r.direction === 'IN' ).reduce((s, r) => s + Number(r.amount), 0);
    const total_out = entries.filter(r => r.direction === 'OUT').reduce((s, r) => s + Number(r.amount), 0);
    res.json({ from, to, total_in, total_out, net: total_in - total_out, entries });
  } catch (err) {
    console.error('Petty cash range error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── MONTHLY EXPENSES ─────────────────────────────────────────────────────────

// GET /api/summaries/monthly-expenses?month=YYYY-MM
router.get('/monthly-expenses', async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  try {
    const result = await pool.query(
      `SELECT * FROM monthly_expenses WHERE month = $1 ORDER BY category ASC`,
      [month]
    );
    const total = result.rows.reduce((s, r) => s + Number(r.amount), 0);
    res.json({ month, total, categories: result.rows });
  } catch (err) {
    console.error('Monthly expenses fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/summaries/monthly-expenses
// Upsert one category for the month
// Body: { month, category, amount, description?, entered_by }
router.post('/monthly-expenses', async (req, res) => {
  const { month, category, amount, description, entered_by } = req.body;
  if (!month || !category || amount == null) {
    return res.status(400).json({ error: 'month, category, and amount are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO monthly_expenses (month, category, amount, description, entered_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (month, category)
       DO UPDATE SET amount = $3, description = $4, entered_by = $5, updated_at = NOW()
       RETURNING *`,
      [month, category, Number(amount), description || null, entered_by || 'Director']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Monthly expenses upsert error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/summaries/monthly-expenses/:id
router.delete('/monthly-expenses/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM monthly_expenses WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Monthly expenses delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/summaries/monthly-profit?month=YYYY-MM
// Full P&L: cashier_queue sales + petty cash OUT + monthly fixed expenses
router.get('/monthly-profit', async (req, res) => {
  const month = req.query.month || new Date().toISOString().substring(0, 7);
  try {
    // 1. Confirmed sales for the month
    const salesRes = await pool.query(
      `SELECT
         COALESCE(SUM(amount), 0) AS total_gross,
         COALESCE(SUM(CASE WHEN method = 'Cash'                      THEN amount ELSE 0 END), 0) AS total_cash,
         COALESCE(SUM(CASE WHEN method = 'Card'                      THEN amount ELSE 0 END), 0) AS total_card,
         COALESCE(SUM(CASE WHEN method IN ('Momo-MTN','Momo-Airtel') THEN amount ELSE 0 END), 0) AS total_momo,
         COALESCE(SUM(CASE WHEN method = 'Credit'                    THEN amount ELSE 0 END), 0) AS total_credit,
         COUNT(*) AS order_count
       FROM cashier_queue
       WHERE status = 'Confirmed'
         AND confirmed_at IS NOT NULL
         AND TO_CHAR((confirmed_at AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM') = $1`,
      [month]
    );

    // 2. Petty cash OUT for the month
    const pettyRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS petty_out
       FROM petty_cash
       WHERE direction = 'OUT'
         AND TO_CHAR(entry_date, 'YYYY-MM') = $1`,
      [month]
    );

    // 3. Fixed monthly expenses (rent, wages, stock …)
    const expRes = await pool.query(
      `SELECT * FROM monthly_expenses WHERE month = $1 ORDER BY category ASC`,
      [month]
    );

    const sales      = salesRes.rows[0];
    const pettyOut   = Number(pettyRes.rows[0]?.petty_out || 0);
    const fixedItems = expRes.rows;
    const fixedTotal = fixedItems.reduce((s, r) => s + Number(r.amount), 0);
    const totalCosts = pettyOut + fixedTotal;
    const grossSales = Number(sales.total_gross);
    const netProfit  = grossSales - totalCosts;
    const margin     = grossSales > 0 ? ((netProfit / grossSales) * 100).toFixed(2) : "0.00";

    res.json({
      month,
      sales: {
        total_gross:  grossSales,
        total_cash:   Number(sales.total_cash),
        total_card:   Number(sales.total_card),
        total_momo:   Number(sales.total_momo),
        total_credit: Number(sales.total_credit),
        order_count:  Number(sales.order_count),
      },
      costs: {
        petty_out:   pettyOut,
        fixed_total: fixedTotal,
        fixed_items: fixedItems,
        total:       totalCosts,
      },
      net_profit:  netProfit,
      margin_pct:  margin,
    });
  } catch (err) {
    console.error('Monthly profit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;