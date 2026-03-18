import express from 'express';
import pool from '../db.js';

const router = express.Router();

// ── Kampala date helper ───────────────────────────────────────────────────────
function kampalaDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' }))
    .toISOString().split('T')[0];
}

// ── PATCH /api/waiter/end-shift ───────────────────────────────────────────────
router.patch('/end-shift', async (req, res) => {
  const { 
    waiter_id, 
    waiter_name, 
    role, 
    total_cash, 
    total_mtn, 
    total_airtel, 
    total_card, 
    gross_total,
    petty_cash_spent,
    orderCount 
  } = req.body;

  const today     = kampalaDate();
  const staffRole = (role || 'WAITER').toUpperCase();

  if (!waiter_id) return res.status(400).json({ error: 'waiter_id is required' });

  try {
    // ── 0. Permission Check (for Managers) ──────────────────────────────────
    let isPermitted = true;
    if (staffRole === 'MANAGER') {
      const permRes = await pool.query(
        `SELECT is_permitted FROM staff WHERE id = $1`,
        [waiter_id]
      );
      if (permRes.rows.length > 0) {
        const raw = permRes.rows[0].is_permitted;
        isPermitted = raw === true || raw === 1 || raw === 't' || raw === 'true';
      } else {
        isPermitted = false;
      }
    }

    // ── 1. Calculate Totals (Priority: Frontend Payload > Database Query) ───
    let finalCount  = Number(orderCount) || 0;
    let finalGross  = Number(gross_total);
    let finalCash   = Number(total_cash);
    let finalMTN    = Number(total_mtn);
    let finalAirtel = Number(total_airtel);
    let finalCard   = Number(total_card);
    let finalPetty  = Number(petty_cash_spent) || 0;

    // Fallback logic for Waiters/Staff who don't pass payload
    if (isNaN(finalGross)) {
      if (isPermitted) {
        const ordersRes = await pool.query(
          `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS gross
           FROM orders WHERE staff_id = $1 AND date = $2 AND shift_cleared = FALSE
           AND status NOT IN ('Cancelled', 'Voided')`,
          [waiter_id, today]
        );
        finalCount = Number(ordersRes.rows[0].count);
        finalGross = Number(ordersRes.rows[0].gross);

        const queueRes = await pool.query(
          `SELECT
             COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) AS total_cash,
             COALESCE(SUM(CASE WHEN method = 'Momo-MTN' THEN amount ELSE 0 END), 0) AS total_mtn,
             COALESCE(SUM(CASE WHEN method = 'Momo-Airtel' THEN amount ELSE 0 END), 0) AS total_airtel,
             COALESCE(SUM(CASE WHEN method IN ('Card','Visa','POS','Debit') THEN amount ELSE 0 END), 0) AS total_card
           FROM cashier_queue
           WHERE (staff_id = $1 OR requested_by = $2)
             AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $3
             AND status = 'Confirmed' AND method != 'Credit' AND shift_cleared = FALSE`,
          [waiter_id, waiter_name, today]
        );
        finalCash   = Number(queueRes.rows[0].total_cash);
        finalMTN    = Number(queueRes.rows[0].total_mtn);
        finalAirtel = Number(queueRes.rows[0].total_airtel);
        finalCard   = Number(queueRes.rows[0].total_card);
      } else {
        finalCount = 0; finalGross = 0; finalCash = 0; finalMTN = 0; finalAirtel = 0; finalCard = 0;
      }
    }

    // ── 1c. Credit decisions ────────────────────────────────────────────────
    const creditRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Confirmed' AND method = 'Credit')                 AS credit_approved,
         COUNT(*) FILTER (WHERE status = 'Rejected'  AND method = 'Credit')                 AS credit_rejected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'Confirmed' AND method = 'Credit'), 0) AS credit_approved_amt
       FROM cashier_queue
       WHERE confirmed_by ILIKE $1
         AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $2
         AND shift_cleared = FALSE`,
      [waiter_name, today]
    );
    const crApp     = Number(creditRes.rows[0].credit_approved) || 0;
    const crRej     = Number(creditRes.rows[0].credit_rejected) || 0;
    const crAppAmt  = Number(creditRes.rows[0].credit_approved_amt) || 0;

    // ── 2. UPSERT into staff_shifts ──────────────────────────────────────────
    await pool.query(
      `INSERT INTO staff_shifts
         (staff_id, staff_name, role, is_permitted,
          total_orders, total_cash, total_mtn, total_airtel, total_card, gross_total, petty_cash,
          credit_approved, credit_rejected, credit_approved_amt, shift_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (staff_id, shift_date)
       DO UPDATE SET
         total_orders        = EXCLUDED.total_orders,
         total_cash          = EXCLUDED.total_cash,
         total_mtn           = EXCLUDED.total_mtn,
         total_airtel        = EXCLUDED.total_airtel,
         total_card          = EXCLUDED.total_card,
         gross_total         = EXCLUDED.gross_total,
         petty_cash          = EXCLUDED.petty_cash,
         credit_approved     = EXCLUDED.credit_approved,
         credit_rejected     = EXCLUDED.credit_rejected,
         credit_approved_amt = EXCLUDED.credit_approved_amt`,
      [waiter_id, waiter_name, staffRole, isPermitted,
       finalCount, finalCash, finalMTN, finalAirtel, finalCard, finalGross, finalPetty,
       crApp, crRej, crAppAmt, today]
    );

    // ── 3. THE CLEARING LOGIC (Archive live data) ───────────────────────────
    // This makes the totals on the dashboard return to 0
    if (isPermitted) {
      // Clear main orders
      await pool.query(
        `UPDATE orders SET shift_cleared = TRUE 
         WHERE staff_id = $1 AND date = $2 AND shift_cleared = FALSE`,
        [waiter_id, today]
      );
      
      // Clear cashier queue and history
      await pool.query(
        `UPDATE cashier_queue SET shift_cleared = TRUE 
         WHERE (staff_id = $1 OR requested_by = $2) 
         AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $3 
         AND shift_cleared = FALSE`,
        [waiter_id, waiter_name, today]
      );
    }

    console.log(`✅ Shift Finalized — ${staffRole} ${waiter_name} | Gross: ${finalGross}`);

    res.json({
      success: true,
      message: 'Shift archived and live totals reset.',
      totals: { finalCash, finalMTN, finalAirtel, finalCard, finalGross, finalPetty }
    });

  } catch (err) {
    console.error('End shift error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/waiter/shifts/:staffId ──────────────────────────────────────────
router.get('/shifts/:staffId', async (req, res) => {
  const { staffId } = req.params;
  const date = req.query.date || kampalaDate();
  try {
    const result = await pool.query(
      `SELECT * FROM staff_shifts WHERE staff_id = $1 AND shift_date = $2`,
      [staffId, date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch shifts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/waiter/manager-credit-stats ─────────────────────────────────────
router.get('/manager-credit-stats', async (req, res) => {
  const { manager_name, date } = req.query;
  const today = date || kampalaDate();
  if (!manager_name) return res.status(400).json({ error: 'manager_name required' });
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Confirmed' AND method = 'Credit') AS approved,
         COUNT(*) FILTER (WHERE status = 'Rejected'  AND method = 'Credit') AS rejected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'Confirmed' AND method = 'Credit'), 0) AS approved_amt
       FROM cashier_queue
       WHERE confirmed_by ILIKE $1 
       AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $2
       AND shift_cleared = FALSE`, // Skip already finalized data
      [manager_name, today]
    );
    const row = result.rows[0];
    res.json({
      approved: Number(row.approved) || 0,
      rejected: Number(row.rejected) || 0,
      approvedAmt: Number(row.approved_amt) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PREVIEW ROUTES (Manager & Supervisor) ────────────────────────────────────
router.get('/manager-shift-preview', async (req, res) => {
  const { staff_id, staff_name, date } = req.query;
  const today = date || kampalaDate();
  if (!staff_id) return res.status(400).json({ error: 'staff_id required' });
  try {
    const ordersRes = await pool.query(
      `SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS gross_total
       FROM orders WHERE staff_id = $1 AND date = $2 AND shift_cleared = FALSE 
       AND status NOT IN ('Cancelled', 'Voided')`,
      [staff_id, today]
    );
    const queueRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) AS total_cash,
         COALESCE(SUM(CASE WHEN method = 'Momo-MTN' THEN amount ELSE 0 END), 0) AS total_mtn,
         COALESCE(SUM(CASE WHEN method = 'Momo-Airtel' THEN amount ELSE 0 END), 0) AS total_airtel,
         COALESCE(SUM(CASE WHEN method IN ('Card','Visa','POS','Debit') THEN amount ELSE 0 END), 0) AS total_card
       FROM cashier_queue
       WHERE (staff_id = $1 OR requested_by = $2) 
       AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $3
       AND status = 'Confirmed' AND method != 'Credit' AND shift_cleared = FALSE`,
      [staff_id, staff_name || '', today]
    );
    res.json({
      order_count: Number(ordersRes.rows[0].order_count) || 0,
      gross_total: Number(ordersRes.rows[0].gross_total) || 0,
      total_cash:  Number(queueRes.rows[0].total_cash)   || 0,
      total_mtn:   Number(queueRes.rows[0].total_mtn)    || 0,
      total_airtel:Number(queueRes.rows[0].total_airtel) || 0,
      total_card:  Number(queueRes.rows[0].total_card)   || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/supervisor-shift-preview', async (req, res) => {
  const { staff_id, staff_name, date } = req.query;
  const today = date || kampalaDate();
  if (!staff_id) return res.status(400).json({ error: 'staff_id required' });
  try {
    const ordersRes = await pool.query(
      `SELECT COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS gross_total
       FROM orders WHERE staff_id = $1 AND date = $2 AND shift_cleared = FALSE 
       AND status NOT IN ('Cancelled', 'Voided')`,
      [staff_id, today]
    );
    const queueRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN method = 'Cash' THEN amount ELSE 0 END), 0) AS total_cash,
         COALESCE(SUM(CASE WHEN method = 'Momo-MTN' THEN amount ELSE 0 END), 0) AS total_mtn,
         COALESCE(SUM(CASE WHEN method = 'Momo-Airtel' THEN amount ELSE 0 END), 0) AS total_airtel,
         COALESCE(SUM(CASE WHEN method IN ('Card','Visa','POS','Debit') THEN amount ELSE 0 END), 0) AS total_card
       FROM cashier_queue
       WHERE (staff_id = $1 OR requested_by = $2) 
       AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $3
       AND status = 'Confirmed' AND method != 'Credit' AND shift_cleared = FALSE`,
      [staff_id, staff_name || '', today]
    );
    res.json({
      order_count: Number(ordersRes.rows[0].order_count) || 0,
      gross_total: Number(ordersRes.rows[0].gross_total) || 0,
      total_cash:  Number(queueRes.rows[0].total_cash)   || 0,
      total_mtn:   Number(queueRes.rows[0].total_mtn)    || 0,
      total_airtel:Number(queueRes.rows[0].total_airtel) || 0,
      total_card:  Number(queueRes.rows[0].total_card)   || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/accountant/finalize-day ────────────────────────────────────────
// This archives the entire lounge's performance for the day
router.post('/finalize-day', async (req, res) => {
  const { final_gross, variance, recorded_by } = req.body;
  const today = kampalaDate();

  try {
    // 1. Create a Master Daily Record for the Director
    await pool.query(
      `INSERT INTO daily_reconciliations 
         (date, total_system_gross, total_variance, finalized_by, status)
       VALUES ($1, $2, $3, $4, 'CLOSED')
       ON CONFLICT (date) DO UPDATE SET
         total_system_gross = EXCLUDED.total_system_gross,
         total_variance     = EXCLUDED.total_variance,
         finalized_by       = EXCLUDED.finalized_by`,
      [today, final_gross, variance, recorded_by]
    );

    // 2. Archive live data so 'Live Audit' and 'Queue' clear
    await pool.query(
      `UPDATE orders SET shift_cleared = TRUE 
       WHERE date = $1 AND shift_cleared = FALSE`,
      [today]
    );

    await pool.query(
      `UPDATE cashier_queue SET shift_cleared = TRUE 
       WHERE (created_at AT TIME ZONE 'Africa/Nairobi')::date = $1 
       AND shift_cleared = FALSE`,
      [today]
    );

    // ── 2.5 NEW: RESET REVENUE SUMMARY TABLE ──────────────────────────────
    // This is what actually clears the cards in your "MY COLLECTIONS" view
    await pool.query(
      `UPDATE daily_summaries 
       SET total_cash = 0, total_mtn = 0, total_airtel = 0, total_card = 0, 
           gross_revenue = 0, order_count = 0, total_credits = 0
       WHERE date = $1`,
      [today]
    );

    console.log(`🏛️ DAY FINALIZED by ${recorded_by} | All summaries reset to 0.`);

    res.json({ 
      success: true, 
      message: 'All lounge accounts finalized and summary cards reset.' 
    });
  } catch (err) {
    console.error('Accountant Finalize Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/accountant/physical-count ───────────────────────────────────────
// Fetches the saved physical counts if the accountant previously saved them
router.get('/physical-count', async (req, res) => {
  const today = kampalaDate();
  try {
    const result = await pool.query(
      `SELECT * FROM physical_counts WHERE date = $1`,
      [today]
    );
    res.json(result.rows[0] || { cash: 0, momo_mtn: 0, momo_airtel: 0, card: 0, notes: '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/physical-count ──────────────────────────────────────
// Saves the intermediate physical count (from the Physical Count tab)
router.post('/physical-count', async (req, res) => {
  const { cash, momo_mtn, momo_airtel, card, notes, submitted_by } = req.body;
  const today = kampalaDate();

  try {
    await pool.query(
      `INSERT INTO physical_counts 
         (date, cash, momo_mtn, momo_airtel, card, notes, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (date) DO UPDATE SET
         cash = EXCLUDED.cash,
         momo_mtn = EXCLUDED.momo_mtn,
         momo_airtel = EXCLUDED.momo_airtel,
         card = EXCLUDED.card,
         notes = EXCLUDED.notes,
         submitted_by = EXCLUDED.submitted_by`,
      [today, cash, momo_mtn, momo_airtel, card, notes, submitted_by]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;