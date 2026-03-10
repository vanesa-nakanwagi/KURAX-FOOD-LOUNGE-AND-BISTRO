// routes/sendToCashierRoute.js
// Register in server.js:
//   import sendToCashierRoute from "./routes/sendToCashierRoute.js";
//   app.use("/api/orders", sendToCashierRoute);

import express from "express";
import pool from "../db.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/send-to-cashier
// ─────────────────────────────────────────────────────────────────────────────
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
          status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Pending',NOW())
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/cashier-queue
// Returns Pending rows (including PendingManagerApproval so cashier can track
// credit requests they've forwarded to the manager).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/cashier-queue", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cashier_queue
       WHERE status IN ('Pending','PendingManagerApproval')
       ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("cashier-queue fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/cashier-queue/:id/request-approval
//
// Cashier clicks "Request Approval" on a Credit row.
// Transitions: Pending → PendingManagerApproval
// The row stays visible in the cashier queue (read-only) so they can see
// it was forwarded. The manager sees it via GET /credit-approvals.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/cashier-queue/:id/request-approval", async (req, res) => {
  const { id }           = req.params;
  const { requested_by } = req.body; // cashier name for the audit trail

  try {
    const qRes = await pool.query(
      `SELECT * FROM cashier_queue WHERE id = $1`, [id]
    );
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
       SET status = 'PendingManagerApproval',
           confirmed_by = $1        -- reusing column as "forwarded_by" for audit
       WHERE id = $2`,
      [requested_by || "Cashier", id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("request-approval failed:", err);
    res.status(500).json({ error: "Failed to request approval" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/cashier-queue/:id/confirm
//
// Only for Cash / Card / Momo rows. Credit rows now go through
// request-approval → credit-approvals/:id/approve instead.
// ─────────────────────────────────────────────────────────────────────────────
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
      // Release lock so waiter can pay next item
      if (q.order_ids?.length) {
        await pool.query(
          `UPDATE orders SET sent_to_cashier = false WHERE id = ANY($1::int[])`,
          [q.order_ids]
        );
      }

      // If no more Pending rows for this table → mark all orders Paid
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
        }
      }

    } else {
      // Full-table payment
      if (q.order_ids?.length) {
        await pool.query(
          `UPDATE orders
           SET status = 'Paid', payment_method = $1, paid_at = NOW(),
               sent_to_cashier = false, transaction_id = $2
           WHERE id = ANY($3::int[])`,
          [q.method, transaction_id || null, q.order_ids]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("cashier confirm failed:", err);
    res.status(500).json({ error: "Failed to confirm payment" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/cashier-queue/:id/reject
// Cashier rejects a non-credit payment → order → back to Served
// ─────────────────────────────────────────────────────────────────────────────
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

    res.json({ success: true });
  } catch (err) {
    console.error("cashier reject failed:", err);
    res.status(500).json({ error: "Failed to reject" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/credit-approvals
//
// Manager polls this to see credit requests awaiting approval.
// Returns PendingManagerApproval rows with full client info.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/credit-approvals", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cashier_queue
       WHERE status = 'PendingManagerApproval'
       ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("credit-approvals fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch credit approvals" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/credit-approvals/:id/approve
//
// Manager approves → inserts into credits ledger → order status = 'Credit'.
// The cashier_queue row is marked Confirmed (so it appears in cashier history).
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/credit-approvals/:id/approve", async (req, res) => {
  const { id }          = req.params;
  const { approved_by } = req.body;

  try {
    const qRes = await pool.query(
      `SELECT * FROM cashier_queue WHERE id = $1`, [id]
    );
    if (!qRes.rows.length) return res.status(404).json({ error: "Approval request not found" });
    const q = qRes.rows[0];

    if (q.status !== "PendingManagerApproval") {
      return res.status(400).json({ error: `Cannot approve — current status: ${q.status}` });
    }

    // 1. Mark queue row as Confirmed (shows in cashier history as Credit)
    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Confirmed', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [approved_by || "Manager", id]
    );

    // 2. Insert into credits ledger — this is the running debt record
    await pool.query(
      `INSERT INTO credits
         (order_ids, table_name, amount, client_name, client_phone, pay_by,
          approved_by, created_at)
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

    // 3. Mark source orders as Credit (not Paid yet — client will pay later)
    if (q.order_ids?.length) {
      await pool.query(
        `UPDATE orders
         SET status = 'Credit', payment_method = 'Credit', sent_to_cashier = false
         WHERE id = ANY($1::int[])`,
        [q.order_ids]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("credit approve failed:", err);
    res.status(500).json({ error: "Failed to approve credit" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/credit-approvals/:id/reject
//
// Manager rejects credit request → order back to 'Served' → waiter retries.
// The cashier_queue row is deleted so it disappears from both queues.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/credit-approvals/:id/reject", async (req, res) => {
  const { id }       = req.params;
  const { reason, rejected_by } = req.body;

  try {
    const qRes = await pool.query(
      `SELECT * FROM cashier_queue WHERE id = $1`, [id]
    );
    if (!qRes.rows.length) return res.status(404).json({ error: "Approval request not found" });
    const q = qRes.rows[0];

    // 1. Mark queue row as Rejected (stays in history for audit)
    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Rejected', confirmed_by = $2, confirmed_at = NOW()
       WHERE id = $1`,
      [id, `${rejected_by || "Manager"}: ${reason || "Credit rejected"}`]
    );

    // 2. Restore order to Served so waiter can collect payment another way
    if (q.order_ids?.length) {
      await pool.query(
        `UPDATE orders
         SET status = 'Served', sent_to_cashier = false
         WHERE id = ANY($1::int[]) AND status NOT IN ('Paid')`,
        [q.order_ids]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("credit reject failed:", err);
    res.status(500).json({ error: "Failed to reject credit" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/cashier-history
// ─────────────────────────────────────────────────────────────────────────────
router.get("/cashier-history", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cashier_queue
       WHERE status IN ('Confirmed','Rejected')
         AND created_at >= (CURRENT_DATE AT TIME ZONE 'Africa/Kampala') AT TIME ZONE 'UTC'
       ORDER BY confirmed_at DESC NULLS LAST
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("cashier-history failed:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/credits
// Full credits ledger — used by cashier, manager, accountant, director.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/credits/:id/settle
//
// Cashier OR manager settles a credit when the client returns to pay.
// Records: method, transaction_id, notes, amount_paid, settled_by.
// Supports partial payment — if amount_paid < credit.amount, credit stays open
// with remaining balance; otherwise marked fully paid.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/credits/:id/settle", async (req, res) => {
  const { id } = req.params;
  const {
    settled_by,
    settle_method,      // Cash | Card | Momo-MTN | Momo-Airtel
    settle_transaction, // transaction ID / reference (optional)
    settle_notes,       // free-text notes
    amount_paid,        // actual amount client paid (may be partial)
  } = req.body;

  try {
    const cRes = await pool.query(
      `SELECT * FROM credits WHERE id = $1`, [id]
    );
    if (!cRes.rows.length) return res.status(404).json({ error: "Credit not found" });
    const credit = cRes.rows[0];

    const paid_amount  = Number(amount_paid) || Number(credit.amount);
    const is_full      = paid_amount >= Number(credit.amount);

    await pool.query(
      `UPDATE credits
       SET paid             = $1,
           paid_at          = NOW(),
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
        paid_amount,
        id,
      ]
    );

    // Only mark orders Paid when fully settled
    if (is_full && credit.order_ids?.length) {
      await pool.query(
        `UPDATE orders
         SET status = 'Paid', payment_method = $1, paid_at = NOW()
         WHERE id = ANY($2::int[])`,
        [settle_method || "Cash", credit.order_ids]
      );
    }

    res.json({ success: true, fully_settled: is_full });
  } catch (err) {
    console.error("settle credit failed:", err);
    res.status(500).json({ error: "Failed to settle credit" });
  }
});

export default router;