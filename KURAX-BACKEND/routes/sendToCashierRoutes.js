// routes/sendToCashierRoute.js
// Register in server.js:
//   import sendToCashierRoute from "./routes/sendToCashierRoute.js";
//   app.use("/api/orders", sendToCashierRoute);

import express from "express";
import pool from "../db.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/send-to-cashier
//
// Each call creates ONE independent row in cashier_queue.
// Pilao (Cash, 25000) and Chicken (Card, 45000) from the same table become
// two separate rows — each with their own method + amount — so confirming
// one never overwrites the other's method on the orders row.
// Cashier totals are always read from cashier_queue confirmed rows, never
// from orders.payment_method.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/send-to-cashier", async (req, res) => {
  const {
    order_ids,    // integer[] — DB order row ids this payment covers
    table_name,
    label,        // human-readable display: "Pilao" or "Full Table · T-04"
    method,       // "Cash" | "Card" | "Momo-MTN" | "Momo-Airtel" | "Credit"
    amount,
    is_item  = false,
    item,         // { name, price, quantity } for per-item payments
    credit_info,  // { name, phone, pay_by } for credit payments
    requested_by,
    staff_id,
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
        label        || null,                                    // human label for cashier display
        method,
        Number(amount),
        is_item,
        item?.name   || (is_item ? "Unknown Item" : "Full Table"), // item_name fallback
        requested_by || null,
        staff_id     || null,
        credit_info?.name   || null,
        credit_info?.phone  || null,
        credit_info?.pay_by || null,
      ]
    );

    // Flag the order rows so the waiter card shows "Sent to Cashier"
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
// Returns all Pending rows — cashier polls this every 8 seconds.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/cashier-queue", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM cashier_queue
       WHERE status = 'Pending'
       ORDER BY created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("cashier-queue fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/cashier-queue/:id/confirm
//
// TOTALS DESIGN:
//   Cash/Card/MTN/Airtel totals on the cashier dashboard come from
//   cashier_queue rows (status='Confirmed', confirmed today).
//   Each row has its OWN method column — Pilao=Cash and Chicken=Card are
//   separate rows, so their totals never collide. The orders.payment_method
//   column is only written for full-table payments (is_item=false) and is
//   used for order history only, not for real-time totals.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/cashier-queue/:id/confirm", async (req, res) => {
  const { id }                           = req.params;
  const { confirmed_by, transaction_id } = req.body;

  try {
    // 1. Fetch the queue row
    const qRes = await pool.query(`SELECT * FROM cashier_queue WHERE id = $1`, [id]);
    if (!qRes.rows.length) {
      return res.status(404).json({ error: "Queue item not found" });
    }
    const q = qRes.rows[0];

    // 2. Enforce transaction ID for Momo payments
    if ((q.method === "Momo-MTN" || q.method === "Momo-Airtel") && !transaction_id) {
      return res.status(400).json({ error: "Transaction ID is required for Momo payments" });
    }

    // 3. Mark this queue row as Confirmed — this is what drives cashier totals
    await pool.query(
      `UPDATE cashier_queue
       SET status         = 'Confirmed',
           confirmed_by   = $1,
           confirmed_at   = NOW(),
           transaction_id = $2
       WHERE id = $3`,
      [confirmed_by || "Cashier", transaction_id || null, id]
    );

    // 4. Update source orders
    if (q.method === "Credit") {
      // ── Credit payment ────────────────────────────────────────────────────
      // Record in the credits ledger for the cashier to track.
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
          confirmed_by    || "Cashier",
        ]
      );
      // Mark the order(s) as Credit status
      if (q.order_ids?.length) {
        await pool.query(
          `UPDATE orders
           SET status = 'Credit', payment_method = 'Credit', sent_to_cashier = false
           WHERE id = ANY($1::int[])`,
          [q.order_ids]
        );
      }

    } else if (q.is_item) {
      // ── Per-item payment (Cash / Card / Momo) ─────────────────────────────
      // Step 1: Release the sent_to_cashier lock on this order row so the
      //         waiter can send the next item if needed.
      if (q.order_ids?.length) {
        await pool.query(
          `UPDATE orders SET sent_to_cashier = false WHERE id = ANY($1::int[])`,
          [q.order_ids]
        );
      }

      // Step 2: Check if ALL cashier_queue rows for this table are now settled
      //         (no Pending rows remain). If so, mark every order for this table
      //         as Paid — this is what makes the waiter's totals increment and
      //         removes the card from the Served list.
      if (q.table_name) {
        const pendingCheck = await pool.query(
          `SELECT COUNT(*) AS cnt
           FROM cashier_queue
           WHERE table_name = $1
             AND status = 'Pending'`,
          [q.table_name]
        );
        const stillPending = parseInt(pendingCheck.rows[0].cnt, 10);

        if (stillPending === 0) {
          // All items for this table are confirmed — mark the orders as Paid.
          // Use payment_method = 'Mixed' since different items may have been
          // paid via different methods. Cashier totals still read from
          // cashier_queue rows (each with the correct individual method),
          // so this 'Mixed' label is only for order history display.
          await pool.query(
            `UPDATE orders
             SET status         = 'Paid',
                 payment_method = 'Mixed',
                 paid_at        = NOW(),
                 sent_to_cashier = false
             WHERE table_name = $1
               AND status NOT IN ('Paid', 'Credit', 'Void')`,
            [q.table_name]
          );
        }
      }

    } else {
      // ── Full-table payment (Cash / Card / Momo) ───────────────────────────
      // Safe to write payment_method to the order row since we're paying
      // the whole table in one go with one method.
      if (q.order_ids?.length) {
        await pool.query(
          `UPDATE orders
           SET status          = 'Paid',
               payment_method  = $1,
               paid_at         = NOW(),
               sent_to_cashier = false,
               transaction_id  = $2
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
// Returns the request to the waiter so they can re-send with a different method.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/cashier-queue/:id/reject", async (req, res) => {
  const { id }     = req.params;
  const { reason } = req.body;

  try {
    // Fetch order_ids BEFORE updating — safer order of operations
    const qRes = await pool.query(
      `SELECT order_ids FROM cashier_queue WHERE id = $1`,
      [id]
    );
    const ids = qRes.rows[0]?.order_ids || [];

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Rejected', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [reason || "Rejected by cashier", id]
    );

    // Unset sent_to_cashier so waiter's Pay button re-appears
    if (ids.length) {
      await pool.query(
        `UPDATE orders SET sent_to_cashier = false WHERE id = ANY($1::int[])`,
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
// GET /api/orders/cashier-history
// Returns today's confirmed + rejected rows.
// CRITICAL: uses Africa/Kampala timezone so "today" starts at Kampala midnight,
// not UTC midnight — without this, the first 3 hours of Kampala morning
// would be missing from the cashier's totals.
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
// All credit records for the cashier ledger (settled + unsettled).
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
// Cashier marks a credit as settled when the client returns to pay.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/credits/:id/settle", async (req, res) => {
  const { id }         = req.params;
  const { settled_by } = req.body;

  try {
    const cRes = await pool.query(
      `SELECT order_ids FROM credits WHERE id = $1`,
      [id]
    );
    if (!cRes.rows.length) return res.status(404).json({ error: "Credit not found" });
    const ids = cRes.rows[0].order_ids || [];

    await pool.query(
      `UPDATE credits SET paid = true, paid_at = NOW(), approved_by = $1 WHERE id = $2`,
      [settled_by || "Cashier", id]
    );

    if (ids.length) {
      await pool.query(
        `UPDATE orders SET status = 'Paid', paid_at = NOW() WHERE id = ANY($1::int[])`,
        [ids]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("settle credit failed:", err);
    res.status(500).json({ error: "Failed to settle credit" });
  }
});

// export MUST be at the very bottom — after ALL routes are registered
export default router;