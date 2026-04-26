// routes/sendToCashierRoute.js - FIXED VERSION

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
    split_payments,
    is_split = false
  } = req.body;

  console.log("🔵 SEND-TO-CASHIER Request:", { method, amount, is_item, order_ids, table_name });

  // Handle split payments
  if (split_payments && Array.isArray(split_payments) && split_payments.length > 0) {
    try {
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

      // Create orders for split payments
      for (const payment of split_payments) {
        const paymentMethod = payment.method.toLowerCase();
        const amount = payment.amount;
        const transactionId = payment.transaction_id || null;
        const creditInfo = payment.creditInfo || null;
        
        // Create individual paid order for each split payment
        const orderResult = await pool.query(
          `INSERT INTO orders 
             (original_order_ids, table_name, payment_method, total, status, paid_at, transaction_id, is_archived, created_at)
           VALUES ($1::jsonb, $2, $3, $4, 'Paid', NOW(), $5, false, NOW())
           RETURNING id`,
          [JSON.stringify(formattedOrderIds), table_name, paymentMethod, amount, transactionId]
        );
        
        console.log(`✅ SPLIT: Created PAID order #${orderResult.rows[0].id} for UGX ${amount} via ${paymentMethod}`);
        
        // Update daily summary
        await updateDailySummary({ amount: amount, method: paymentMethod });
      }

      // Mark original orders as processed
      if (formattedOrderIds?.length) {
        await pool.query(
          `UPDATE orders SET sent_to_cashier = true, is_archived = true WHERE id = ANY($1::int[])`,
          [formattedOrderIds]
        );
      }

      res.json({ 
        success: true, 
        split: true,
        message: `${split_payments.length} payment records created`
      });
      return;
    } catch (err) {
      console.error("split payment failed:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Original single payment logic
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

    const newQueueId = result.rows[0].id;
    console.log(`🔵 Created cashier_queue entry #${newQueueId} for ${method} payment of UGX ${amount}`);

    if (formattedOrderIds?.length) {
      await pool.query(
        `UPDATE orders SET sent_to_cashier = true WHERE id = ANY($1::int[])`,
        [formattedOrderIds]
      );
    }

    // When method is Credit, also create a row in the credits table
    if (method === 'Credit' && credit_info?.name) {
      try {
        await pool.query(
          `INSERT INTO credits
             (order_id, table_name, label, amount, amount_paid, balance,
              client_name, client_phone, pay_by, waiter_name, status, cashier_queue_id, created_at)
           VALUES ($1, $2, $3, $4, 0, $4, $5, $6, $7, $8, 'PendingCashier', $9, NOW())`,
          [
            formattedOrderIds?.[0] || null,
            table_name,
            label || `Credit – ${table_name}`,
            Number(amount),
            credit_info.name.trim(),
            credit_info.phone?.trim() || null,
            credit_info.pay_by?.trim() || null,
            requested_by || null,
            newQueueId,
          ]
        );
        console.log(`✅ Credit record created with cashier_queue_id: ${newQueueId}`);
      } catch (creditErr) {
        console.error('Credit record creation warning:', creditErr.message);
      }
    }

    res.json({ success: true, queue_id: newQueueId });
  } catch (err) {
    console.error("send-to-cashier failed:", err);
    res.status(500).json({ error: "Failed to send to cashier" });
  }
});

// ✅ FIXED: PATCH /api/cashier-ops/cashier-queue/:id/confirm
router.patch("/cashier-queue/:id/confirm", async (req, res) => {
  const { id } = req.params;
  const { confirmed_by, transaction_id, split_payments } = req.body || {};

  console.log(`🔵 CONFIRMING payment for queue item #${id} by ${confirmed_by || 'Cashier'}`);

  try {
    const qRes = await pool.query(`SELECT * FROM cashier_queue WHERE id = $1`, [id]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Queue item not found" });
    const q = qRes.rows[0];

    console.log(`📋 Queue item: method=${q.method}, amount=${q.amount}, is_item=${q.is_item}, order_ids=${q.order_ids}`);

    // Skip if already confirmed
    if (q.status === 'Confirmed') {
      return res.json({ success: true, message: "Already confirmed" });
    }

    // Handle Credit payments
    if (q.method === "Credit") {
      return res.status(400).json({
        error: "Credit payments require manager approval — use Request Approval instead"
      });
    }

    // Validate Momo transaction ID
    if ((q.method === "Momo-MTN" || q.method === "Momo-Airtel") && !transaction_id) {
      return res.status(400).json({ error: "Transaction ID is required for Momo payments" });
    }

    // Update cashier_queue status
    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Confirmed',
           confirmed_by = $1,
           confirmed_at = NOW(),
           transaction_id = $2
       WHERE id = $3`,
      [confirmed_by || "Cashier", transaction_id || null, id]
    );

    const paymentMethod = q.method.toLowerCase();

    if (q.is_item) {
      // ✅ INDIVIDUAL ITEM PAYMENT
      console.log(`🔵 Processing INDIVIDUAL ITEM payment: ${q.amount} via ${paymentMethod}`);
      
      if (q.order_ids?.length && q.item) {
        for (const orderId of q.order_ids) {
          // Get the current order
          const orderRes = await pool.query(
            `SELECT items, table_name, status FROM orders WHERE id = $1`,
            [orderId]
          );
          
          if (orderRes.rows.length > 0) {
            let items = orderRes.rows[0].items;
            if (typeof items === 'string') {
              items = JSON.parse(items);
            }
            
            // Update the specific item to paid
            let found = false;
            const updatedItems = items.map(item => {
              const itemName = item.name?.trim().toLowerCase();
              if (!found && itemName === q.item.name?.trim().toLowerCase() && !item._rowPaid) {
                found = true;
                return {
                  ...item,
                  _rowPaid: true,
                  payment_method: paymentMethod,
                  paid_at: new Date().toISOString()
                };
              }
              return item;
            });
            
            if (found) {
              await pool.query(
                `UPDATE orders SET items = $1, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify(updatedItems), orderId]
              );
              console.log(`✅ Updated item ${q.item.name} in order #${orderId} as paid via ${paymentMethod}`);
            }
            
            // Check if ALL items in this order are now paid
            const allItemsPaid = updatedItems.every(item => item._rowPaid === true || item.status === 'VOIDED');
            
            if (allItemsPaid) {
              // ✅ CRITICAL: Mark the entire order as Paid with correct payment method
              await pool.query(
                `UPDATE orders 
                 SET status = 'Paid', 
                     payment_method = $1,
                     paid_at = NOW(),
                     is_archived = false
                 WHERE id = $2`,
                [paymentMethod, orderId]
              );
              console.log(`✅ Order #${orderId} fully paid, marked as Paid via ${paymentMethod}`);
            }
          }
        }
      }
      
      // Update daily summary
      await updateDailySummary({ amount: q.amount, method: paymentMethod, orderCount: 0 });
      console.log(`✅ Updated daily summary for item payment: ${q.amount} via ${paymentMethod}`);
      
    } else {
      // ✅ FULL TABLE PAYMENT - Mark the existing order as Paid
      console.log(`🔵 Processing FULL TABLE payment: ${q.amount} via ${paymentMethod}`);
      
      if (q.order_ids?.length) {
        for (const orderId of q.order_ids) {
          // Get current order
          const orderRes = await pool.query(
            `SELECT items, table_name FROM orders WHERE id = $1`,
            [orderId]
          );
          
          if (orderRes.rows.length > 0) {
            let items = orderRes.rows[0].items;
            if (typeof items === 'string') {
              items = JSON.parse(items);
            }
            
            // Mark ALL items as paid
            const updatedItems = items.map(item => ({
              ...item,
              _rowPaid: true,
              payment_method: paymentMethod,
              paid_at: new Date().toISOString()
            }));
            
            // ✅ CRITICAL: Update the EXISTING order to Paid with correct payment method
            await pool.query(
              `UPDATE orders 
               SET items = $1,
                   status = 'Paid', 
                   payment_method = $2,
                   paid_at = NOW(),
                   is_archived = false
               WHERE id = $3`,
              [JSON.stringify(updatedItems), paymentMethod, orderId]
            );
            
            console.log(`✅ Order #${orderId} marked as Paid via ${paymentMethod} for UGX ${q.amount}`);
          }
        }
      }
      
      // Update daily summary
      await updateDailySummary({ amount: q.amount, method: paymentMethod });
      console.log(`✅ Updated daily summary for table payment: ${q.amount} via ${paymentMethod}`);
    }

    await logActivity(pool, 'SALE',
      `${q.table_name || 'Table'} — UGX ${Number(q.amount).toLocaleString()} ${q.method} confirmed by ${confirmed_by || 'Cashier'}`,
      { queue_id: id, method: q.method, amount: q.amount }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error("cashier confirm failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cashier-ops/cashier-queue
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

    if (!q.credit_name || !q.credit_phone) {
      return res.status(400).json({ 
        error: "Missing client information. Client name and phone number are required for credit requests." 
      });
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
         AND status = 'PendingCashier'`,
      [tableName]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("request-approval failed:", err);
    res.status(500).json({ error: "Failed to request approval" });
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
             AND status IN ('PendingCashier', 'PendingManagerApproval')`,
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
      `SELECT cq.*, 
              c.client_name, c.client_phone, c.pay_by, c.amount as credit_amount
       FROM cashier_queue cq
       LEFT JOIN credits c ON c.cashier_queue_id = cq.id
       WHERE cq.status = 'PendingManagerApproval'
       ORDER BY cq.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("credit-approvals fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch credit approvals" });
  }
});

// PATCH /api/cashier-ops/credit-approvals/:id/approve
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

    if (!q.credit_name || !q.credit_phone) {
      return res.status(400).json({ 
        error: "Cannot approve credit: missing client information. Please reject and have the waiter resend." 
      });
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
        error: "Cannot approve credit: table_name is missing." 
      });
    }

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Approved', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [approved_by || "Manager", id]
    );

    // Update credits status to Approved
    const creditUpdateRes = await pool.query(
      `UPDATE credits
       SET status = 'Approved',
           approved_by = $1,
           approved_at = NOW()
       WHERE UPPER(table_name) = UPPER($2)
         AND status IN ('PendingCashier', 'PendingManagerApproval')
       RETURNING id`,
      [approved_by || "Manager", tableName]
    );

    if (!creditUpdateRes.rows.length) {
      await pool.query(
        `INSERT INTO credits
           (order_id, table_name, label, amount, amount_paid, balance,
            client_name, client_phone, pay_by, approved_by, status, cashier_queue_id, created_at)
         VALUES ($1, $2, $3, $4, 0, $4, $5, $6, $7, $8, 'Approved', $9, NOW())`,
        [
          q.order_ids?.[0] || null,
          tableName,
          q.label || `Credit – ${tableName}`,
          Number(q.amount),
          q.credit_name || null,
          q.credit_phone || null,
          q.credit_pay_by || null,
          approved_by || "Manager",
          id
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

    await logActivity(pool, 'CREDIT_APPROVED',
      `Credit approved — ${tableName} · ${q.credit_name || 'Client'} · UGX ${Number(q.amount).toLocaleString()} by ${approved_by || 'Manager'}`,
      { queue_id: id, amount: q.amount, client: q.credit_name }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error("credit approve failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cashier-ops/cashier-history
router.get("/cashier-history", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cq.*
       FROM cashier_queue cq
       WHERE cq.status IN ('Confirmed', 'Rejected')
         AND cq.method != 'Credit'
         AND DATE(cq.created_at) = CURRENT_DATE
       ORDER BY cq.confirmed_at DESC NULLS LAST
       LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("cashier-history failed:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// GET /api/cashier-ops/credits
router.get("/credits", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM credits ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("credits fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch credits" });
  }
});

// GET /api/staff/credit-settlements
router.get("/staff/credit-settlements", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         cs.amount_paid,
         cs.method as settle_method,
         cs.created_at as settled_at,
         c.waiter_name,
         c.table_name,
         c.client_name,
         c.id as credit_id
       FROM credit_settlements cs
       JOIN credits c ON cs.credit_id = c.id
       WHERE DATE(cs.created_at) = CURRENT_DATE
       ORDER BY cs.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Staff credit settlements fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch credit settlements" });
  }
});

// PATCH /api/cashier-ops/credits/:id/settle
router.patch("/credits/:id/settle", async (req, res) => {
  const { id } = req.params;
  const { settled_by, method, transaction_id, notes, amount_paid } = req.body || {};

  try {
    const cRes = await pool.query(`SELECT * FROM credits WHERE id = $1`, [id]);
    if (!cRes.rows.length) return res.status(404).json({ error: "Credit not found" });
    const credit = cRes.rows[0];

    const paid_amount = Number(amount_paid) || 0;
    const credit_total = Number(credit.amount);
    const already_paid = Number(credit.amount_paid || 0);
    const total_paid = already_paid + paid_amount;
    const is_full = total_paid >= credit_total;

    // Insert settlement record
    await pool.query(
      `INSERT INTO credit_settlements 
         (credit_id, amount_paid, method, transaction_id, notes, settled_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, paid_amount, method || "Cash", transaction_id || null, notes || null, settled_by]
    );

    // Update credit record
    await pool.query(
      `UPDATE credits
       SET paid = $1,
           paid_at = CASE WHEN $1 THEN NOW() ELSE paid_at END,
           settle_method = $2,
           settle_txn = $3,
           amount_paid = $4,
           balance = $5,
           status = $6
       WHERE id = $7`,
      [
        is_full,
        method || "Cash",
        transaction_id,
        total_paid,
        credit_total - total_paid,
        is_full ? 'FullySettled' : 'PartiallySettled',
        id
      ]
    );

    // ✅ CRITICAL: Update the associated order to Paid with correct payment method
    if (credit.order_id) {
      await pool.query(
        `UPDATE orders
         SET status = 'Paid',
             payment_method = $1,
             paid_at = NOW()
         WHERE id = $2`,
        [method || "Cash", credit.order_id]
      );
    }

    // Update daily summary
    await updateDailySummary({ amount: paid_amount, method: method || "Cash" });

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