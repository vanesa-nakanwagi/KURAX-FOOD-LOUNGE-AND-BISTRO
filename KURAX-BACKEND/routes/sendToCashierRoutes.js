// routes/sendToCashierRoute.js
import express from "express";
import pool from "../db.js";
import { updateDailySummary } from '../helpers/summaryHelper.js';
import logActivity from '../utils/logsActivity.js'; 

const router = express.Router();

// POST /api/orders/send-to-cashier
router.post("/send-to-cashier", async (req, res) => {
  const {
    order_ids, table_name, label, method, amount,
    is_item = false, item, credit_info, requested_by, staff_id,
  } = req.body;

  if (!method || amount === undefined || amount === null) {
    return res.status(400).json({ error: "method and amount are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO cashier_queue
         (order_ids, table_name, label, method, amount, is_item, item_name,
          requested_by, staff_id, credit_name, credit_phone, credit_pay_by,
          status, created_at, shift_cleared)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pending',NOW(), FALSE)
       RETURNING id`,
      [
        order_ids    || [],
        table_name   || null,
        label        || null,
        method,
        Number(amount),
        is_item,
        item?.name   || (is_item ? "Unknown Item" : "Full Table"),
        requested_by || null,
        staff_id     || null,
        credit_info?.name   || null,
        credit_info?.phone  || null,
        credit_info?.pay_by || null,
      ]
    );

    if (order_ids?.length) {
      await pool.query(
        `UPDATE orders SET sent_to_cashier = true WHERE id = ANY($1::int[])`,
        [order_ids]
      );
    }

    res.json({ success: true, queue_id: result.rows[0].id });
  } catch (err) {
    console.error("send-to-cashier failed:", err);
    res.status(500).json({ error: "Failed to send to cashier" });
  }
});

// GET /api/orders/cashier-queue
router.get("/cashier-queue", async (req, res) => {
  try {
    // UPDATED: Added shift_cleared = FALSE
    const result = await pool.query(
      `SELECT * FROM cashier_queue
       WHERE status IN ('Pending','PendingManagerApproval')
         AND shift_cleared = FALSE
       ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("cashier-queue fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// PATCH /api/orders/cashier-queue/:id/request-approval
router.patch("/cashier-queue/:id/request-approval", async (req, res) => {
  const { id }           = req.params;
  const { requested_by } = req.body;

  try {
    const qRes = await pool.query(`SELECT * FROM cashier_queue WHERE id = $1`, [id]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Queue item not found" });
    const q = qRes.rows[0];

    if (q.method !== "Credit") {
      return res.status(400).json({ error: "Only Credit queue items need manager approval" });
    }
    if (q.status !== "Pending") {
      return res.status(400).json({ error: `Already in status: ${q.status}` });
    }

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'PendingManagerApproval', confirmed_by = $1
       WHERE id = $2`,
      [requested_by || "Cashier", id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("request-approval failed:", err);
    res.status(500).json({ error: "Failed to request approval" });
  }
});

// PATCH /api/orders/cashier-queue/:id/confirm
router.patch("/cashier-queue/:id/confirm", async (req, res) => {
  const { id }                           = req.params;
  const { confirmed_by, transaction_id } = req.body;

  try {
    const qRes = await pool.query(`SELECT * FROM cashier_queue WHERE id = $1`, [id]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Queue item not found" });
    const q = qRes.rows[0];

    if (q.method === "Credit") {
      return res.status(400).json({
        error: "Credit payments require manager approval — use Request Approval instead"
      });
    }
    if ((q.method === "Momo-MTN" || q.method === "Momo-Airtel") && !transaction_id) {
      return res.status(400).json({ error: "Transaction ID is required for Momo payments" });
    }

    await pool.query(
      `UPDATE cashier_queue
       SET status         = 'Confirmed',
           confirmed_by   = $1,
           confirmed_at   = NOW(),
           transaction_id = $2
       WHERE id = $3`,
      [confirmed_by || "Cashier", transaction_id || null, id]
    );

    if (q.is_item) {
      if (q.order_ids?.length) {
        await pool.query(
          `UPDATE orders SET sent_to_cashier = false WHERE id = ANY($1::int[])`,
          [q.order_ids]
        );
        
        await pool.query(
          `UPDATE orders
           SET delivery_status = 'collected', delivered_at = NOW()
           WHERE id = ANY($1::int[])
             AND order_type = 'delivery'`,
          [q.order_ids]
        );
      }

      await updateDailySummary({ amount: q.amount, method: q.method, orderCount: 0 });

      if (q.table_name) {
        const pendingCheck = await pool.query(
          `SELECT COUNT(*) AS cnt FROM cashier_queue
           WHERE table_name = $1 AND status = 'Pending'`,
          [q.table_name]
        );
        if (parseInt(pendingCheck.rows[0].cnt, 10) === 0) {
          await pool.query(
            `UPDATE orders
             SET status = 'Paid', payment_method = 'Mixed', paid_at = NOW(), sent_to_cashier = false
             WHERE table_name = $1 AND status NOT IN ('Paid','Credit','Void')`,
            [q.table_name]
          );
          
          await pool.query(
            `UPDATE orders
             SET delivery_status = 'collected', delivered_at = NOW()
             WHERE table_name = $1
               AND order_type = 'delivery'
               AND delivery_status IS DISTINCT FROM 'collected'`,
            [q.table_name]
          );
        }
      }

    } else {
      if (q.order_ids?.length) {
        await pool.query(
          `UPDATE orders
           SET status = 'Paid', payment_method = $1, paid_at = NOW(),
               sent_to_cashier = false, transaction_id = $2
           WHERE id = ANY($3::int[])`,
          [q.method, transaction_id || null, q.order_ids]
        );
        
        await pool.query(
          `UPDATE orders
           SET delivery_status = 'collected', delivered_at = NOW()
           WHERE id = ANY($1::int[])
             AND order_type = 'delivery'`,
          [q.order_ids]
        );
      }
      await updateDailySummary({ amount: q.amount, method: q.method });
    }

    await logActivity(pool, 'SALE',
      `${q.table_name || 'Table'} — UGX ${Number(q.amount).toLocaleString()} ${q.method} confirmed by ${confirmed_by || 'Cashier'}`,
      { queue_id: id, method: q.method, amount: q.amount }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("cashier confirm failed:", err);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});

// PATCH /api/orders/cashier-queue/:id/reject
router.patch("/cashier-queue/:id/reject", async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  try {
    const qRes = await pool.query(
      `SELECT order_ids FROM cashier_queue WHERE id = $1`, [id]
    );
    const ids = qRes.rows[0]?.order_ids || [];

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Rejected', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [reason || "Rejected by cashier", id]
    );

    if (ids.length) {
      await pool.query(
        `UPDATE orders SET sent_to_cashier = false, status = 'Served'
         WHERE id = ANY($1::int[]) AND status NOT IN ('Paid','Credit')`,
        [ids]
      );
    }

    await logActivity(pool, 'REJECT',
      `Payment rejected — ${reason || 'No reason given'}`,
      { queue_id: id }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("cashier reject failed:", err);
    res.status(500).json({ error: "Failed to reject" });
  }
});

// GET /api/orders/credit-approvals
router.get("/credit-approvals", async (req, res) => {
  try {
    // UPDATED: Added shift_cleared = FALSE
    const result = await pool.query(
      `SELECT * FROM cashier_queue
       WHERE status = 'PendingManagerApproval'
         AND shift_cleared = FALSE
       ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("credit-approvals fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch credit approvals" });
  }
});

// PATCH /api/orders/credit-approvals/:id/approve
router.patch("/credit-approvals/:id/approve", async (req, res) => {
  const { id }          = req.params;
  const { approved_by } = req.body;

  try {
    const qRes = await pool.query(`SELECT * FROM cashier_queue WHERE id = $1`, [id]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Approval request not found" });
    const q = qRes.rows[0];

    if (q.status !== "PendingManagerApproval") {
      return res.status(400).json({ error: `Cannot approve — current status: ${q.status}` });
    }

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Confirmed', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [approved_by || "Manager", id]
    );

    await pool.query(
      `INSERT INTO credits
         (order_ids, table_name, amount, client_name, client_phone, pay_by, approved_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [
        q.order_ids,
        q.table_name,
        q.amount,
        q.credit_name   || null,
        q.credit_phone  || null,
        q.credit_pay_by || null,
        approved_by     || "Manager",
      ]
    );

    if (q.order_ids?.length) {
      await pool.query(
        `UPDATE orders
         SET status = 'Credit', payment_method = 'Credit', sent_to_cashier = false
         WHERE id = ANY($1::int[])`,
        [q.order_ids]
      );
    }

    await updateDailySummary({ amount: q.amount, method: 'Credit' });

    await logActivity(pool, 'CREDIT',
      `Credit approved — ${q.table_name || 'Table'} · ${q.credit_name || 'Client'} · UGX ${Number(q.amount).toLocaleString()} approved by ${approved_by || 'Manager'}`,
      { queue_id: id, amount: q.amount, client: q.credit_name }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("credit approve failed:", err);
    res.status(500).json({ error: "Failed to approve credit" });
  }
});

// PATCH /api/orders/credit-approvals/:id/reject
router.patch("/api/orders/credit-approvals/:id/reject", async (req, res) => {
  const { id }                  = req.params;
  const { reason, rejected_by } = req.body;

  try {
    const qRes = await pool.query(`SELECT * FROM cashier_queue WHERE id = $1`, [id]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Approval request not found" });
    const q = qRes.rows[0];

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Rejected', confirmed_by = $2, confirmed_at = NOW()
       WHERE id = $1`,
      [id, `${rejected_by || "Manager"}: ${reason || "Credit rejected"}`]
    );

    if (q.order_ids?.length) {
      await pool.query(
        `UPDATE orders
         SET status = 'Served', sent_to_cashier = false
         WHERE id = ANY($1::int[]) AND status NOT IN ('Paid')`,
        [q.order_ids]
      );
    }

    await logActivity(pool, 'REJECT',
      `Credit rejected — ${q.table_name || 'Table'} · ${reason || 'No reason'} by ${rejected_by || 'Manager'}`,
      { queue_id: id }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("credit reject failed:", err);
    res.status(500).json({ error: "Failed to reject credit" });
  }
});

// GET /api/orders/cashier-history
router.get("/cashier-history", async (req, res) => {
  try {
    // UPDATED: Added shift_cleared = FALSE
    const result = await pool.query(
      `SELECT cq.*
       FROM cashier_queue cq
       WHERE cq.status IN ('Confirmed', 'Rejected')
         AND cq.created_at::date = CURRENT_DATE
         AND cq.shift_cleared = FALSE
       ORDER BY cq.confirmed_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("cashier-history failed:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// GET /api/orders/credits
router.get("/credits", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM credits ORDER BY paid ASC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("credits fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch credits" });
  }
});

router.patch("/credits/:id/settle", async (req, res) => {
  const { id } = req.params;
  const { settled_by, settle_method, settle_transaction, settle_notes, amount_paid } = req.body;

  try {
    const cRes = await pool.query(`SELECT * FROM credits WHERE id = $1`, [id]);
    if (!cRes.rows.length) return res.status(404).json({ error: "Credit not found" });
    const credit = cRes.rows[0];

    const paid_amount = Number(amount_paid) || 0;
    if (paid_amount <= 0) {
      return res.status(400).json({ error: "amount_paid must be greater than 0" });
    }

    const credit_total  = Number(credit.amount);
    const already_paid  = Number(credit.amount_paid || 0);
    const total_paid    = already_paid + paid_amount;        // cumulative
    const is_full       = total_paid >= credit_total;

    await pool.query(
      `UPDATE credits
       SET paid             = $1,
           paid_at          = CASE WHEN $1 THEN NOW() ELSE paid_at END,
           approved_by      = $2,
           settle_method    = $3,
           settle_txn       = $4,
           settle_notes     = $5,
           amount_paid      = $6
       WHERE id = $7`,
      [
        is_full,
        settled_by         || "Cashier",
        settle_method      || null,
        settle_transaction || null,
        settle_notes       || null,
        total_paid,         // ← cumulative, not just this payment
        id,
      ]
    );

    // ── Always update orders & gross — for BOTH full and partial ──────────
    if (credit.order_ids?.length) {
      await pool.query(
        `UPDATE orders
         SET status         = $1,
             payment_method = $2,
             paid_at        = NOW()
         WHERE id = ANY($3::int[])`,
        [
          is_full ? 'Paid' : 'Credit',  // stays Credit if partial
          settle_method || "Cash",
          credit.order_ids,
        ]
      );
    }

    // ── Insert a new cashier_queue row for this settlement ────────────────
    // This ensures the settlement shows up in /today totals automatically
    // since /today reads from cashier_queue WHERE status = 'Confirmed'
    await pool.query(
      `INSERT INTO cashier_queue
         (order_ids, table_name, label, method, amount,
          is_item, item_name, requested_by, status,
          confirmed_by, confirmed_at, shift_cleared, created_at)
       VALUES ($1, $2, $3, $4, $5, false, 'Credit Settlement',
               $6, 'Confirmed', $7, NOW(), FALSE, NOW())`,
      [
        credit.order_ids || [],
        credit.table_name,
        `Credit Settlement — ${credit.client_name || 'Client'}${is_full ? '' : ' (partial)'}`,
        settle_method || 'Cash',   // ← use the REAL method (Cash/Card/Momo)
        paid_amount,               // ← only THIS payment, not cumulative
        settled_by || 'Cashier',
        settled_by || 'Cashier',
      ]
    );

    await logActivity(pool, 'CREDIT',
      `Credit ${is_full ? 'fully' : 'partially'} settled — ${credit.table_name || 'Table'} · ${credit.client_name || 'Client'} · UGX ${Number(paid_amount).toLocaleString()} via ${settle_method || 'Cash'} by ${settled_by || 'Cashier'}`,
      { credit_id: id, amount: paid_amount, total_paid, method: settle_method, is_full }
    );

    res.json({ success: true, fully_settled: is_full, total_paid });
  } catch (err) {
    console.error("settle credit failed:", err);
    res.status(500).json({ error: "Failed to settle credit" });
  }
});

export default router;