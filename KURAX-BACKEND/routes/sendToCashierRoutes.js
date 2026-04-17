// routes/sendToCashierRoute.js
import express from "express";
import pool from "../db.js";
import { updateDailySummary } from '../helpers/summaryHelper.js';
import logActivity from '../utils/logsActivity.js'; 

const router = express.Router();

// Helper function to get table_name from order_ids if missing
async function getTableNameFromOrderIds(orderIds) {
  if (!orderIds || orderIds.length === 0) return null;
  try {
    const result = await pool.query(
      `SELECT table_name FROM orders WHERE id = $1 LIMIT 1`,
      [orderIds[0]]
    );
    return result.rows[0]?.table_name || null;
  } catch (err) {
    console.error("Error fetching table_name:", err.message);
    return null;
  }
}

// POST /api/cashier-ops/send-to-cashier
router.post("/send-to-cashier", async (req, res) => {
  let {
    order_ids, table_name, label, method, amount,
    is_item = false, item, items, credit_info, requested_by, staff_id,
  } = req.body;

  if (!method || amount === undefined || amount === null) {
    return res.status(400).json({ error: "method and amount are required" });
  }

  let formattedOrderIds = [];
  if (!Array.isArray(order_ids)) {
    if (typeof order_ids === 'number' || typeof order_ids === 'string') {
      formattedOrderIds = [parseInt(order_ids)];
    } else if (typeof order_ids === 'object' && order_ids !== null) {
      formattedOrderIds = Object.values(order_ids).map(id => parseInt(id));
    }
  } else {
    formattedOrderIds = order_ids.map(id => parseInt(id));
  }

  if (!table_name && formattedOrderIds && formattedOrderIds.length > 0) {
    table_name = await getTableNameFromOrderIds(formattedOrderIds);
  }

  if (!table_name) {
    table_name = "WALK-IN";
  }

  try {
    const result = await pool.query(
      `INSERT INTO cashier_queue
         (order_ids, table_name, label, method, amount, is_item, item,
          requested_by, staff_id, credit_name, credit_phone, credit_pay_by,
          status, created_at)
       VALUES ($1::jsonb, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, 'Pending', NOW())
       RETURNING id`,
      [
        JSON.stringify(formattedOrderIds),
        table_name,
        label || null,
        method,
        Number(amount),
        is_item,
        item ? JSON.stringify(item) : null,
        requested_by || null,
        staff_id || null,
        credit_info?.name || null,
        credit_info?.phone || null,
        credit_info?.pay_by || null,
      ]
    );

    if (formattedOrderIds?.length) {
      await pool.query(
        `UPDATE orders SET sent_to_cashier = true WHERE id = ANY($1::int[])`,
        [formattedOrderIds]
      );
    }

    // When method is Credit, also create a row in the credits table
    if (method === 'Credit' && credit_info?.name) {
      try {
        const existingRes = await pool.query(
          `SELECT id FROM credits
           WHERE UPPER(table_name) = UPPER($1)
             AND status IN ('PendingCashier', 'PendingManagerApproval')
             AND shift_cleared = FALSE
           LIMIT 1`,
          [table_name]
        );

        if (existingRes.rows.length) {
          await pool.query(
            `UPDATE credits
             SET order_id     = COALESCE($1, order_id),
                 amount       = $2,
                 client_name  = $3,
                 client_phone = COALESCE($4, client_phone),
                 pay_by       = COALESCE($5, pay_by),
                 waiter_name  = COALESCE($6, waiter_name),
                 label        = $7,
                 updated_at   = NOW()
             WHERE id = $8`,
            [
              formattedOrderIds?.[0] || null,
              Number(amount),
              credit_info.name.trim(),
              credit_info.phone?.trim() || null,
              credit_info.pay_by?.trim() || null,
              requested_by || null,
              label || `Credit – ${table_name}`,
              existingRes.rows[0].id,
            ]
          );
        } else {
          await pool.query(
            `INSERT INTO credits
               (order_id, table_name, label, amount, amount_paid, balance,
                client_name, client_phone, pay_by, waiter_name, status, created_at)
             VALUES ($1, $2, $3, $4, 0, $4, $5, $6, $7, $8, 'PendingCashier', NOW())`,
            [
              formattedOrderIds?.[0] || null,
              table_name,
              label || `Credit – ${table_name}`,
              Number(amount),
              credit_info.name.trim(),
              credit_info.phone?.trim() || null,
              credit_info.pay_by?.trim() || null,
              requested_by || null,
            ]
          );
        }
      } catch (creditErr) {
        console.error('Credit record creation warning:', creditErr.message);
      }
    }

    res.json({ success: true, queue_id: result.rows[0].id });
  } catch (err) {
    console.error("send-to-cashier failed:", err);
    res.status(500).json({ error: "Failed to send to cashier" });
  }
});

// GET /api/cashier-ops/cashier-queue
router.get("/cashier-queue", async (req, res) => {
  try {
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

// PATCH /api/cashier-ops/cashier-queue/:id/request-approval
router.patch("/cashier-queue/:id/request-approval", async (req, res) => {
  const { id } = req.params;
  const { requested_by } = req.body || {};

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

    let tableName = q.table_name;
    if (!tableName && q.order_ids && q.order_ids.length > 0) {
      tableName = await getTableNameFromOrderIds(q.order_ids);
      if (tableName) {
        await pool.query(
          `UPDATE cashier_queue SET table_name = $1 WHERE id = $2`,
          [tableName, id]
        );
      }
    }

    if (!tableName) {
      return res.status(400).json({ 
        error: "table_name is required - cannot determine table for this credit request." 
      });
    }

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'PendingManagerApproval', confirmed_by = $1
       WHERE id = $2`,
      [requested_by || "Cashier", id]
    );

    await pool.query(
      `UPDATE credits
       SET status = 'PendingManagerApproval'
       WHERE UPPER(table_name) = UPPER($1)
         AND status = 'PendingCashier'
         AND shift_cleared = FALSE`,
      [tableName]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("request-approval failed:", err);
    res.status(500).json({ error: "Failed to request approval" });
  }
});

// PATCH /api/cashier-ops/cashier-queue/:id/confirm
router.patch("/cashier-queue/:id/confirm", async (req, res) => {
  const { id } = req.params;
  const { confirmed_by, transaction_id } = req.body || {};

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
       SET status = 'Confirmed',
           confirmed_by = $1,
           confirmed_at = NOW(),
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
           WHERE table_name = $1 AND status = 'Pending' AND shift_cleared = FALSE`,
          [q.table_name]
        );
        if (parseInt(pendingCheck.rows[0].cnt, 10) === 0) {
          await pool.query(
            `UPDATE orders
             SET status = 'Paid', payment_method = 'Mixed', paid_at = NOW(), sent_to_cashier = false
             WHERE table_name = $1 AND status NOT IN ('Paid','Credit','Void') AND shift_cleared = FALSE`,
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

// PATCH /api/cashier-ops/cashier-queue/:id/reject
router.patch("/cashier-queue/:id/reject", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  try {
    const qRes = await pool.query(
      `SELECT order_ids, table_name FROM cashier_queue WHERE id = $1`,
      [id]
    );
    if (!qRes.rows.length) return res.status(404).json({ error: "Queue item not found" });
    const q = qRes.rows[0];
    const ids = q.order_ids || [];

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Rejected', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [reason || "Rejected by cashier", id]
    );

    if (ids && ids.length > 0) {
      await pool.query(
        `UPDATE orders SET sent_to_cashier = false, status = 'Served'
         WHERE id = ANY($1::int[]) AND status NOT IN ('Paid','Credit')`,
        [ids]
      );
    }

    if (q.table_name) {
      try {
        await pool.query(
          `UPDATE credits
           SET status = 'Rejected', reject_reason = $1
           WHERE UPPER(table_name) = UPPER($2) 
             AND status IN ('PendingCashier', 'PendingManagerApproval')
             AND shift_cleared = FALSE`,
          [reason || "Rejected by cashier", q.table_name]
        );
      } catch (e) {
        console.error("Failed to update credit status:", e.message);
      }
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

// GET /api/cashier-ops/credit-approvals
router.get("/credit-approvals", async (req, res) => {
  try {
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

// PATCH /api/cashier-ops/credit-approvals/:id/approve
// OPTION A: Count credit when approved
router.patch("/credit-approvals/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body || {};

  try {
    const qRes = await pool.query(`SELECT * FROM cashier_queue WHERE id = $1`, [id]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Approval request not found" });
    const q = qRes.rows[0];

    if (q.status !== "PendingManagerApproval") {
      return res.status(400).json({ error: `Cannot approve — current status: ${q.status}` });
    }

    let tableName = q.table_name;
    if (!tableName && q.order_ids && q.order_ids.length > 0) {
      const orderRes = await pool.query(
        `SELECT table_name FROM orders WHERE id = $1`,
        [q.order_ids[0]]
      );
      if (orderRes.rows.length > 0 && orderRes.rows[0].table_name) {
        tableName = orderRes.rows[0].table_name;
      }
    }

    if (!tableName) {
      return res.status(400).json({ 
        error: "Cannot approve credit: table_name is missing. Please reject and have the waiter resend the request." 
      });
    }

    // Update cashier_queue status to 'Approved'
    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Approved', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [approved_by || "Manager", id]
    );

    const creditUpdateRes = await pool.query(
      `UPDATE credits
       SET status = 'Approved',
           approved_by = $1,
           approved_at = NOW()
       WHERE UPPER(table_name) = UPPER($2)
         AND status IN ('PendingCashier', 'PendingManagerApproval')
         AND shift_cleared = FALSE
       RETURNING id`,
      [approved_by || "Manager", tableName]
    );

    if (!creditUpdateRes.rows.length) {
      await pool.query(
        `INSERT INTO credits
           (order_id, table_name, label, amount, amount_paid, balance,
            client_name, client_phone, pay_by, approved_by, status, created_at)
         VALUES ($1, $2, $3, $4, 0, $4, $5, $6, $7, $8, 'Approved', NOW())
         ON CONFLICT DO NOTHING`,
        [
          q.order_ids?.[0] || null,
          tableName,
          q.label || `Credit – ${tableName}`,
          Number(q.amount),
          q.credit_name || null,
          q.credit_phone || null,
          q.credit_pay_by || null,
          approved_by || "Manager",
        ]
      );
    }

    if (q.order_ids?.length) {
      await pool.query(
        `UPDATE orders
         SET status = 'Credit', payment_method = 'Credit', sent_to_cashier = false
         WHERE id = ANY($1::int[])`,
        [q.order_ids]
      );
    }

    // ✅ OPTION A: Record the FULL credit amount in daily_summary when approved
    // This ensures gross revenue reflects the total order value immediately
    await updateDailySummary({ 
      amount: q.amount, 
      method: 'Credit', 
      orderCount: 1 
    });

    await logActivity(pool, 'CREDIT',
      `Credit approved — ${tableName} · ${q.credit_name || 'Client'} · UGX ${Number(q.amount).toLocaleString()} by ${approved_by || 'Manager'}`,
      { queue_id: id, amount: q.amount, client: q.credit_name }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error("credit approve failed:", err);
    res.status(500).json({ error: "Failed to approve credit" });
  }
});

// GET /api/cashier-ops/cashier-history - EXCLUDES Credit methods
router.get("/cashier-history", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cq.*
       FROM cashier_queue cq
       WHERE cq.status IN ('Confirmed', 'Rejected')
         AND cq.method != 'Credit'  // ← EXCLUDE Credit methods to prevent double counting
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

// GET /api/cashier-ops/credits - Returns ALL credits without shift_cleared filter
router.get("/credits", async (req, res) => {
  try {
    // Return all credits, not filtered by shift_cleared
    // This allows viewing settled credits even after day finalization
    const result = await pool.query(
      `SELECT * FROM credits 
       ORDER BY 
         CASE status
           WHEN 'PendingCashier' THEN 1
           WHEN 'PendingManagerApproval' THEN 2
           WHEN 'Approved' THEN 3
           WHEN 'PartiallySettled' THEN 4
           WHEN 'FullySettled' THEN 5
           WHEN 'Rejected' THEN 6
           ELSE 7
         END,
         created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("credits fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch credits" });
  }
});

// PATCH /api/cashier-ops/credits/:id/settle
// OPTION A: DO NOT count settlement again (already counted when approved)
router.patch("/credits/:id/settle", async (req, res) => {
  const { id } = req.params;
  const { settled_by, settle_method, settle_transaction, settle_notes, amount_paid } = req.body || {};

  try {
    const cRes = await pool.query(`SELECT * FROM credits WHERE id = $1`, [id]);
    if (!cRes.rows.length) return res.status(404).json({ error: "Credit not found" });
    const credit = cRes.rows[0];

    const paid_amount = Number(amount_paid) || 0;
    const credit_total = Number(credit.amount);
    const already_paid = Number(credit.amount_paid || 0);
    const total_paid = already_paid + paid_amount;
    const is_full = total_paid >= credit_total;

    // Record the settlement in credit_settlements table for tracking
    await pool.query(
      `INSERT INTO credit_settlements 
         (credit_id, amount_paid, method, transaction_id, notes, settled_by, settled_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, paid_amount, settle_method, settle_transaction, settle_notes, settled_by]
    );

    await pool.query(
      `UPDATE credits
       SET paid = $1,
           paid_at = CASE WHEN $1 THEN NOW() ELSE paid_at END,
           settle_method = $2,
           settle_txn = $3,
           settle_notes = $4,
           amount_paid = $5,
           balance = $6,
           status = $7
       WHERE id = $8`,
      [
        is_full,
        settle_method,
        settle_transaction,
        settle_notes,
        total_paid,
        credit_total - total_paid,
        is_full ? 'FullySettled' : 'PartiallySettled',
        id
      ]
    );

    if (credit.order_ids?.length) {
      await pool.query(
        `UPDATE orders
         SET status = $1,
             payment_method = $2,
             paid_at = NOW()
         WHERE id = ANY($3::int[])`,
        [is_full ? 'Paid' : 'Credit', settle_method || "Cash", credit.order_ids]
      );
    }

    // Record in cashier_queue for tracking (but DO NOT update daily_summary again)
    await pool.query(
      `INSERT INTO cashier_queue
         (order_ids, table_name, label, method, amount,
          is_item, requested_by, status, confirmed_by, confirmed_at, created_at)
       VALUES ($1::jsonb, $2, $3, $4, $5, false, $6, 'Confirmed', $7, NOW(), NOW())`,
      [
        JSON.stringify(credit.order_ids || []),
        credit.table_name,
        `Credit Settlement — ${credit.client_name || 'Client'}`,
        settle_method || 'Cash',
        paid_amount,
        settled_by || 'Cashier',
        settled_by || 'Cashier',
      ]
    );

    // ✅ OPTION A: DO NOT update daily_summary for settlements
    // The full amount was already recorded when credit was approved
    // This prevents double counting

    res.json({ 
      success: true, 
      fully_settled: is_full,
      remaining_balance: credit_total - total_paid,
      total_paid: total_paid
    });
  } catch (err) {
    console.error("settle credit failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;