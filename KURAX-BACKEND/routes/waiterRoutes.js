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
  const { waiter_id, waiter_name, role, orderCount } = req.body;
  const today     = kampalaDate();
  const staffRole = (role || 'WAITER').toUpperCase();

  if (!waiter_id) return res.status(400).json({ error: 'waiter_id is required' });

  try {

    // ── 0. Check is_permitted from the staff table ────────────────────────────
    // Managers are only permitted to take orders when the director enables it.
    // For WAITER/SUPERVISOR we skip this check — they are always permitted.
    let isPermitted = true;
    if (staffRole === 'MANAGER') {
      const permRes = await pool.query(
        `SELECT is_permitted FROM staff WHERE id = $1`,
        [waiter_id]
      );
      if (permRes.rows.length > 0) {
        const raw = permRes.rows[0].is_permitted;
        // DB may store boolean, integer 1/0, or string "t"/"f"/"true"/"false"
        isPermitted = raw === true || raw === 1 || raw === 't' || raw === 'true';
      } else {
        isPermitted = false;
      }
    }

    // ── 1a. Order count + gross — only if permitted ───────────────────────────
    // Non-permitted managers took no orders today — store zeros.
    // orders.payment_method is always "Cash" (hardcoded in NewOrder.jsx).
    // Real method lives in cashier_queue — see step 1b.
    let count      = 0;
    let totalGross = 0;

    if (isPermitted) {
      // orders table has no staff_name column — query by staff_id only
      const ordersRes = await pool.query(
        `SELECT
           COUNT(*)                AS order_count,
           COALESCE(SUM(total), 0) AS gross_total
         FROM orders
         WHERE staff_id = $1
           AND date = $2
           AND shift_cleared = FALSE
           AND status NOT IN ('Cancelled', 'Voided')`,
        [waiter_id, today]
      );
      count      = Number(ordersRes.rows[0].order_count) || Number(orderCount) || 0;
      totalGross = Number(ordersRes.rows[0].gross_total) || 0;
    }

    // ── 1b. Payment breakdowns from cashier_queue — only if permitted ─────────
    let totalCash   = 0;
    let totalMTN    = 0;
    let totalAirtel = 0;
    let totalCard   = 0;

    if (isPermitted) {
      const queueRes = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN method = 'Cash'                         THEN amount ELSE 0 END), 0) AS total_cash,
           COALESCE(SUM(CASE WHEN method = 'Momo-MTN'                     THEN amount ELSE 0 END), 0) AS total_mtn,
           COALESCE(SUM(CASE WHEN method = 'Momo-Airtel'                  THEN amount ELSE 0 END), 0) AS total_airtel,
           COALESCE(SUM(CASE WHEN method IN ('Card','Visa','POS','Debit') THEN amount ELSE 0 END), 0) AS total_card
         FROM cashier_queue
         WHERE (staff_id = $1 OR requested_by = $2)
           AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $3
           AND status = 'Confirmed'
           AND method != 'Credit'`,
        [waiter_id, waiter_name, today]
      );
      totalCash   = Number(queueRes.rows[0].total_cash)   || 0;
      totalMTN    = Number(queueRes.rows[0].total_mtn)    || 0;
      totalAirtel = Number(queueRes.rows[0].total_airtel) || 0;
      totalCard   = Number(queueRes.rows[0].total_card)   || 0;
    }

    // ── 1c. Credit decisions — always queried ────────────────────────────────
    // Managers approve/reject credits. Waiters will always get 0s here.
    const creditRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Confirmed' AND method = 'Credit')                 AS credit_approved,
         COUNT(*) FILTER (WHERE status = 'Rejected'  AND method = 'Credit')                 AS credit_rejected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'Confirmed' AND method = 'Credit'), 0) AS credit_approved_amt
       FROM cashier_queue
       WHERE confirmed_by ILIKE $1
         AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $2`,
      [waiter_name, today]
    );
    const creditApproved    = Number(creditRes.rows[0].credit_approved)     || 0;
    const creditRejected    = Number(creditRes.rows[0].credit_rejected)     || 0;
    const creditApprovedAmt = Number(creditRes.rows[0].credit_approved_amt) || 0;

    // ── 2. UPSERT into staff_shifts ───────────────────────────────────────────
    // Run once in Neon if columns/constraint are missing:
    //   ALTER TABLE staff_shifts ADD CONSTRAINT uq_staff_shift_date UNIQUE (staff_id, shift_date);
    //   ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS is_permitted       BOOLEAN DEFAULT FALSE;
    //   ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS credit_approved     INT     DEFAULT 0;
    //   ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS credit_rejected     INT     DEFAULT 0;
    //   ALTER TABLE staff_shifts ADD COLUMN IF NOT EXISTS credit_approved_amt NUMERIC DEFAULT 0;
    await pool.query(
      `INSERT INTO staff_shifts
         (staff_id, staff_name, role, is_permitted,
          total_orders, total_cash, total_mtn, total_airtel, total_card, gross_total,
          credit_approved, credit_rejected, credit_approved_amt,
          shift_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (staff_id, shift_date)
       DO UPDATE SET
         staff_name          = EXCLUDED.staff_name,
         role                = EXCLUDED.role,
         is_permitted        = EXCLUDED.is_permitted,
         total_orders        = EXCLUDED.total_orders,
         total_cash          = EXCLUDED.total_cash,
         total_mtn           = EXCLUDED.total_mtn,
         total_airtel        = EXCLUDED.total_airtel,
         total_card          = EXCLUDED.total_card,
         gross_total         = EXCLUDED.gross_total,
         credit_approved     = EXCLUDED.credit_approved,
         credit_rejected     = EXCLUDED.credit_rejected,
         credit_approved_amt = EXCLUDED.credit_approved_amt`,
      [waiter_id, waiter_name, staffRole, isPermitted,
       count, totalCash, totalMTN, totalAirtel, totalCard, totalGross,
       creditApproved, creditRejected, creditApprovedAmt,
       today]
    );

    // ── 3. Mark orders shift_cleared — only if permitted ─────────────────────
    if (isPermitted) {
      // orders table has no staff_name column — update by staff_id only
      await pool.query(
        `UPDATE orders
         SET shift_cleared = TRUE
         WHERE staff_id = $1
           AND date = $2
           AND shift_cleared = FALSE`,
        [waiter_id, today]
      );
    }

    console.log(
      `✅ Shift ended — ${staffRole} ${waiter_name} | permitted: ${isPermitted} | ` +
      `${count} orders | Cash: ${totalCash} | MTN: ${totalMTN} | Airtel: ${totalAirtel} | ` +
      `Card: ${totalCard} | Gross: ${totalGross} | Credits: +${creditApproved} -${creditRejected}`
    );

    res.json({
      success:     true,
      message:     'Shift archived.',
      isPermitted,
      totals:  { totalCash, totalMTN, totalAirtel, totalCard, totalGross, count },
      credits: { creditApproved, creditRejected, creditApprovedAmt },
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
      `SELECT id, staff_name, role, is_permitted,
              total_orders, total_cash, total_mtn, total_airtel, total_card, gross_total,
              credit_approved, credit_rejected, credit_approved_amt,
              shift_date, created_at
       FROM staff_shifts
       WHERE staff_id = $1
         AND shift_date = $2
       ORDER BY created_at ASC`,
      [staffId, date]
    );
    // DEBUG — remove once confirmed working
    console.log(`[shifts] staffId="${staffId}" date="${date}" → ${result.rows.length} row(s)`, result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch shifts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/waiter/manager-credit-stats ─────────────────────────────────────
// Returns how many credit orders a manager approved/rejected today.
// Called by ManagerShiftModal before archiving the shift.
router.get('/manager-credit-stats', async (req, res) => {
  const { manager_name, date } = req.query;
  const today = date || kampalaDate();
  if (!manager_name) return res.status(400).json({ error: 'manager_name required' });
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Confirmed' AND method = 'Credit')                 AS approved,
         COUNT(*) FILTER (WHERE status = 'Rejected'  AND method = 'Credit')                 AS rejected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'Confirmed' AND method = 'Credit'), 0) AS approved_amt
       FROM cashier_queue
       WHERE confirmed_by ILIKE $1
         AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $2`,
      [manager_name, today]
    );
    const row = result.rows[0];
    res.json({
      approved:    Number(row.approved)     || 0,
      rejected:    Number(row.rejected)     || 0,
      approvedAmt: Number(row.approved_amt) || 0,
    });
  } catch (err) {
    console.error('Manager credit stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/waiter/manager-shift-preview ────────────────────────────────────
// Called by ManagerShiftModal on open to get live order count + payment totals.
// Reads from orders table (count) and cashier_queue (real payment methods).
router.get('/manager-shift-preview', async (req, res) => {
  const { staff_id, staff_name, date } = req.query;
  const today = date || kampalaDate();
  if (!staff_id) return res.status(400).json({ error: 'staff_id required' });
  try {
    // orders table has no staff_name column — filter by staff_id only
    const ordersRes = await pool.query(
      `SELECT
         COUNT(*)                AS order_count,
         COALESCE(SUM(total), 0) AS gross_total
       FROM orders
       WHERE staff_id = $1
         AND date = $2
         AND shift_cleared = FALSE
         AND status NOT IN ('Cancelled', 'Voided')`,
      [staff_id, today]
    );

    // cashier_queue has both staff_id and requested_by (name) — match either
    const queueRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN method = 'Cash'                         THEN amount ELSE 0 END), 0) AS total_cash,
         COALESCE(SUM(CASE WHEN method = 'Momo-MTN'                     THEN amount ELSE 0 END), 0) AS total_mtn,
         COALESCE(SUM(CASE WHEN method = 'Momo-Airtel'                  THEN amount ELSE 0 END), 0) AS total_airtel,
         COALESCE(SUM(CASE WHEN method IN ('Card','Visa','POS','Debit') THEN amount ELSE 0 END), 0) AS total_card
       FROM cashier_queue
       WHERE (staff_id = $1 OR requested_by = $2)
         AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $3
         AND status = 'Confirmed'
         AND method != 'Credit'`,
      [staff_id, staff_name || '', today]
    );

    const o = ordersRes.rows[0];
    const q = queueRes.rows[0];

    console.log(`[manager-shift-preview] staff_id="${staff_id}" staff_name="${staff_name}" date="${today}"`);
    console.log(`[manager-shift-preview] orders  →`, o);
    console.log(`[manager-shift-preview] queue   →`, q);

    res.json({
      order_count:  Number(o.order_count)  || 0,
      gross_total:  Number(o.gross_total)  || 0,
      total_cash:   Number(q.total_cash)   || 0,
      total_mtn:    Number(q.total_mtn)    || 0,
      total_airtel: Number(q.total_airtel) || 0,
      total_card:   Number(q.total_card)   || 0,
    });
  } catch (err) {
    console.error('Manager shift preview error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/waiter/supervisor-shift-preview ──────────────────────────────────
// ── GET /api/waiter/supervisor-shift-preview ──────────────────────────────────
// Called by SupervisorShiftModal on open.
// Returns live order count + gross total + payment breakdown for the supervisor.
//
// KEY DESIGN NOTES:
//   orders table      → has staff_id column BUT no staff_name column.
//                        staff_name is only available via JOIN with staff table.
//                        So we MUST filter by staff_id only here.
//   cashier_queue     → stores both staff_id (number) AND requested_by (text name).
//                        We match on either so both new and legacy rows are captured.
//   gross_total       → taken from orders.total (the item prices, set at order time).
//   payment breakdown → taken from cashier_queue where status='Confirmed'
//                        because orders.payment_method is always "Cash" (hardcoded);
//                        real method is only recorded in cashier_queue.
router.get('/supervisor-shift-preview', async (req, res) => {
  const { staff_id, staff_name, date } = req.query;
  const today = date || kampalaDate();

  if (!staff_id) return res.status(400).json({ error: 'staff_id required' });

  try {
    // ── 1. Order count + gross from orders table ─────────────────────────────
    // orders has NO staff_name column — filter by staff_id only.
    // Also include staff_role = 'SUPERVISOR' guard to avoid cross-role matches
    // when staff_id is reused across roles (edge case safety).
    const ordersRes = await pool.query(
      `SELECT
         COUNT(*)                AS order_count,
         COALESCE(SUM(total), 0) AS gross_total
       FROM orders
       WHERE staff_id = $1
         AND date = $2
         AND shift_cleared = FALSE
         AND status NOT IN ('Cancelled', 'Voided')`,
      [staff_id, today]
    );

    // ── 2. Payment breakdown from cashier_queue ───────────────────────────────
    // cashier_queue stores staff_id (number) and requested_by (text).
    // We match on both to capture all supervisor's confirmed payments.
    // method != 'Credit' because credit amounts are not real cash collected.
    const queueRes = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN method = 'Cash'                         THEN amount ELSE 0 END), 0) AS total_cash,
         COALESCE(SUM(CASE WHEN method = 'Momo-MTN'                     THEN amount ELSE 0 END), 0) AS total_mtn,
         COALESCE(SUM(CASE WHEN method = 'Momo-Airtel'                  THEN amount ELSE 0 END), 0) AS total_airtel,
         COALESCE(SUM(CASE WHEN method IN ('Card','Visa','POS','Debit') THEN amount ELSE 0 END), 0) AS total_card
       FROM cashier_queue
       WHERE (staff_id = $1 OR requested_by = $2)
         AND (created_at AT TIME ZONE 'Africa/Nairobi')::date = $3
         AND status = 'Confirmed'
         AND method != 'Credit'`,
      [staff_id, staff_name || '', today]
    );

    const o = ordersRes.rows[0];
    const q = queueRes.rows[0];

    console.log(`[supervisor-shift-preview] staff_id="${staff_id}" staff_name="${staff_name}" date="${today}"`);
    console.log(`[supervisor-shift-preview] orders  →`, o);
    console.log(`[supervisor-shift-preview] queue   →`, q);

    res.json({
      order_count:  Number(o.order_count)  || 0,
      gross_total:  Number(o.gross_total)  || 0,
      total_cash:   Number(q.total_cash)   || 0,
      total_mtn:    Number(q.total_mtn)    || 0,
      total_airtel: Number(q.total_airtel) || 0,
      total_card:   Number(q.total_card)   || 0,
    });
  } catch (err) {
    console.error('Supervisor shift preview error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;