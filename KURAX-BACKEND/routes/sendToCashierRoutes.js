import express from "express";
import pool from "../db.js";
import { updateDailySummary } from '../helpers/summaryHelper.js';
import { consumeSoldOrderItems } from '../helpers/recipeConsumption.js';
import { createSalesJournalEntry, resolveRevenueAccountCode } from '../helpers/accounting.js';
import { getOrderItemPayableAmount } from '../helpers/complimentaryItems.js';
import logActivity from '../utils/logsActivity.js';
import requireCashier from '../middleware/cashierAuth.js';

const router = express.Router();

// ─── HELPER: derive order status from its items array ────────────────────────
function deriveOrderStatus(items, fallback = 'Pending') {
  if (!Array.isArray(items) || items.length === 0) return fallback;

  let paidCount    = 0;
  let creditCount  = 0;
  let pendingCount = 0;
  let voidedCount  = 0;

  items.forEach(item => {
    const isVoided  = item.voidProcessed === true || item.status === 'VOIDED';
    const isCredit  = item.creditRequested === true ||
                      (item.payment_method || '').toUpperCase().includes('CREDIT');
    const isPaid    = !isCredit && item._rowPaid === true;

    if (isVoided)       voidedCount++;
    else if (isPaid)    paidCount++;
    else if (isCredit)  creditCount++;
    else                pendingCount++;
  });

  const activeCount = items.length - voidedCount;
  if (activeCount === 0)                                          return 'Voided';
  if (paidCount === activeCount)                                  return 'Paid';
  if (paidCount > 0 && (creditCount > 0 || pendingCount > 0))   return 'Partially Paid';
  if (creditCount > 0 && paidCount === 0)                        return 'Credit';
  return 'Pending';
}

// ─── HELPER: get table_name from order_ids ───────────────────────────────────
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

// ─── HELPER: get waiter name from order_ids ──────────────────────────────────
async function getStaffNameFromOrderIds(orderIds, fallback = null) {
  if (!orderIds || orderIds.length === 0) return fallback;
  try {
    const result = await pool.query(
      `SELECT staff_name FROM orders WHERE id = $1 LIMIT 1`,
      [orderIds[0]]
    );
    return result.rows[0]?.staff_name || fallback || null;
  } catch (err) {
    console.error("Error fetching staff_name:", err.message);
    return fallback || null;
  }
}

// ─── HELPER: parse order_ids from various shapes ─────────────────────────────
function parseOrderIds(order_ids) {
  if (!Array.isArray(order_ids)) {
    if (typeof order_ids === 'number' || typeof order_ids === 'string') {
      return [parseInt(order_ids)];
    }
    if (typeof order_ids === 'object' && order_ids !== null) {
      return Object.values(order_ids).map(id => parseInt(id));
    }
    return [];
  }
  return order_ids.map(id => parseInt(id));
}

async function getSaleRevenueBreakdown(orderIds, { item, isItem, amount }) {
  const itemTotals = new Map();
  const addItem = (orderItem) => {
    if (!orderItem || orderItem.voidProcessed === true || orderItem.status === 'VOIDED'
      || orderItem._rowPaid === true || orderItem.creditRequested === true
      || String(orderItem.payment_method || '').toUpperCase().includes('CREDIT')) return;
    const station = String(orderItem.station || 'kitchen').trim().toLowerCase();
    const department = ['kitchen', 'food', 'bar', 'barman', 'barista', 'other'].includes(station)
      ? station
      : 'other';
    const accountCode = resolveRevenueAccountCode(department);
    const itemAmount = getOrderItemPayableAmount(orderItem);
    if (itemAmount > 0) itemTotals.set(accountCode, (itemTotals.get(accountCode) || 0) + itemAmount);
  };

  if (isItem && item) {
    addItem(item);
  } else if (orderIds.length) {
    const result = await pool.query(
      'SELECT items FROM public.orders WHERE id = ANY($1::int[])',
      [orderIds]
    );
    for (const row of result.rows) {
      let items = row.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      if (Array.isArray(items)) items.forEach(addItem);
    }
  }

  const total = Number(amount);
  const sourceTotal = [...itemTotals.values()].reduce((sum, value) => sum + value, 0);
  if (!itemTotals.size || sourceTotal <= 0) return [{ accountCode: '4001', amount: total }];

  const entries = [...itemTotals.entries()];
  let allocated = 0;
  return entries.map(([accountCode, value], index) => {
    const allocatedAmount = index === entries.length - 1
      ? Math.round((total - allocated) * 100) / 100
      : Math.round((total * value / sourceTotal) * 100) / 100;
    allocated += allocatedAmount;
    return { accountCode, amount: allocatedAmount };
  }).filter((line) => line.amount > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cashier-ops/send-to-cashier
// ─────────────────────────────────────────────────────────────────────────────
router.post("/send-to-cashier", async (req, res) => {
  let {
    order_ids, table_name, label, method, amount,
    is_item = false, item, items, credit_info, requested_by, staff_id,
    split_payments,
    is_split = false
  } = req.body;

  console.log("🔵 SEND-TO-CASHIER Request:", { method, amount, is_item, order_ids, table_name, requested_by });

  // ── Handle split payments ─────────────────────────────────────────────────
  if (split_payments && Array.isArray(split_payments) && split_payments.length > 0) {
    try {
      const formattedOrderIds = parseOrderIds(order_ids);

      if (!table_name && formattedOrderIds.length > 0) {
        table_name = await getTableNameFromOrderIds(formattedOrderIds);
      }
      if (!table_name) table_name = "WALK-IN";

      let waiterName = null;
      if (formattedOrderIds.length) {
        waiterName = await getStaffNameFromOrderIds(formattedOrderIds, requested_by || null);
      }
      if (!waiterName) waiterName = requested_by || null;

      for (const payment of split_payments) {
        const paymentMethod  = payment.method.toLowerCase();
        const paymentAmount  = payment.amount;
        const transactionId  = payment.transaction_id || null;
        const client = await pool.connect();
        let splitOrderId;
        try {
          await client.query('BEGIN');
          const orderResult = await client.query(
            `INSERT INTO orders
               (original_order_ids, table_name, payment_method, total, status,
                staff_name, staff_id, payment_confirmed, paid_at, transaction_id, is_archived, created_at)
             VALUES ($1::jsonb, $2, $3, $4, 'Paid', $5, $6, true, NOW(), $7, false, NOW())
             RETURNING id`,
            [JSON.stringify(formattedOrderIds), table_name, paymentMethod, paymentAmount, waiterName, staff_id || null, transactionId]
          );
          splitOrderId = orderResult.rows[0].id;
          const revenueBreakdown = await getSaleRevenueBreakdown(formattedOrderIds, {
            item: null,
            isItem: false,
            amount: paymentAmount,
          });
          await createSalesJournalEntry({
            amount: paymentAmount,
            paymentMethod: payment.method,
            revenueBreakdown,
            description: `Cashier split sale · ${table_name}`,
            sourceTransaction: `cashier_split:${splitOrderId}`,
            postedBy: requested_by || 'Cashier',
            queryable: client,
          });
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }
        console.log(`✅ SPLIT: Created PAID order #${splitOrderId} for UGX ${paymentAmount} via ${paymentMethod} (waiter: ${waiterName})`);
        await updateDailySummary({ amount: paymentAmount, method: paymentMethod });
      }

      if (formattedOrderIds.length) {
        for (const orderId of formattedOrderIds) {
          const source = await pool.query(`SELECT items FROM public.orders WHERE id = $1`, [orderId]);
          if (!source.rows[0]) continue;
          const orderItems = Array.isArray(source.rows[0].items) ? source.rows[0].items : JSON.parse(source.rows[0].items || '[]');
          const paidItems = orderItems.map((item) => {
            const isCredit = item.creditRequested === true || String(item.payment_method || '').toUpperCase().includes('CREDIT');
            const payableAmount = getOrderItemPayableAmount(item);
            return !isCredit && payableAmount > 0 && item._rowPaid !== true && item.status !== 'VOIDED' && item.voidProcessed !== true
              ? { ...item, _rowPaid: true, paidAmount: payableAmount }
              : item;
          });
          try {
            await consumeSoldOrderItems({ orderId, items: paidItems, createdBy: requested_by || 'Cashier' });
          } catch (error) {
            console.error(`Recipe consumption failed for split-paid order #${orderId}:`, error.message);
          }
        }
        await pool.query(
          `UPDATE orders SET sent_to_cashier = true, is_archived = true WHERE id = ANY($1::int[])`,
          [formattedOrderIds]
        );
      }

      return res.json({
        success: true,
        split: true,
        message: `${split_payments.length} payment records created`
      });
    } catch (err) {
      console.error("split payment failed:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Single payment ────────────────────────────────────────────────────────
  if (!method || amount === undefined || amount === null) {
    return res.status(400).json({ error: "method and amount are required" });
  }

  const formattedOrderIds = parseOrderIds(order_ids);

  if (!table_name && formattedOrderIds.length > 0) {
    table_name = await getTableNameFromOrderIds(formattedOrderIds);
  }
  if (!table_name) table_name = "WALK-IN";

  try {
    if (formattedOrderIds.length) {
      const sourceResult = await pool.query(
        'SELECT id, items FROM public.orders WHERE id = ANY($1::int[])',
        [formattedOrderIds]
      );
      const sourceOrders = sourceResult.rows.map((row) => ({
        ...row,
        items: Array.isArray(row.items) ? row.items : JSON.parse(row.items || '[]'),
      }));
      const selectedItems = sourceOrders.flatMap((order) => order.items.map((orderItem, index) => ({
        orderId: order.id,
        index,
        item: orderItem,
      })));
      const containsComplimentary = selectedItems.some(({ item: orderItem }) =>
        orderItem.complimentary === true || Number(orderItem.complimentaryWaivedAmount || 0) > 0
      );

      if (containsComplimentary) {
        let chargeableItems = selectedItems.filter(({ item: orderItem }) =>
          orderItem.status !== 'VOIDED'
          && orderItem.voidProcessed !== true
          && orderItem._rowPaid !== true
          && orderItem.paymentRequested !== true
          && orderItem.creditRequested !== true
          && !String(orderItem.payment_method || '').toUpperCase().includes('CREDIT')
        );
        if (is_item) {
          chargeableItems = chargeableItems.filter(({ orderId, index, item: orderItem }) =>
            item?._orderItemIndex !== undefined
              ? index === Number(item._orderItemIndex) && (item?._orderId === undefined || orderId === Number(item._orderId))
              : orderItem.name === item?.name
          );
          if (chargeableItems.length !== 1) {
            return res.status(409).json({ error: 'The selected item is no longer payable or could not be identified uniquely.' });
          }
        }
        amount = chargeableItems.reduce(
          (total, entry) => total + getOrderItemPayableAmount(entry.item),
          0
        );
        if (Number(amount) <= 0) {
          return res.status(409).json({ error: 'No unpaid, non-complimentary balance is available to send to the cashier.' });
        }
      }
    }

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

    if (formattedOrderIds.length) {
      await pool.query(
        `UPDATE orders SET sent_to_cashier = true WHERE id = ANY($1::int[])`,
        [formattedOrderIds]
      );
    }

    // When method is Credit, create a row in credits table
    if (method === 'Credit' && credit_info?.name) {
      try {
        const selectedOrderId = is_item && item?._orderId !== undefined
          ? Number(item._orderId)
          : null;
        const creditOrderId = selectedOrderId && formattedOrderIds.includes(selectedOrderId)
          ? selectedOrderId
          : formattedOrderIds?.[0] || null;
        await pool.query(
          `INSERT INTO credits
             (order_id, table_name, label, amount, amount_paid, balance,
              client_name, client_phone, pay_by, waiter_name, status, cashier_queue_id, created_at)
           VALUES ($1, $2, $3, $4, 0, $4, $5, $6, $7, $8, 'PendingCashier', $9, NOW())`,
          [
            creditOrderId,
            table_name,
            label || `Credit – ${table_name}`,
            Number(amount),
            credit_info.name.trim(),
            credit_info.phone?.trim() || null,
            credit_info.pay_by?.trim()  || null,
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cashier-ops/cashier-queue/:id/confirm
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/cashier-queue/:id/confirm", requireCashier, async (req, res) => {
  const { id } = req.params;
  const { transaction_id, split_payments } = req.body || {};
  const confirmed_by = req.cashier.name;
  const transactionId = String(transaction_id || '').trim();

  console.log(`🔵 CONFIRMING payment for queue item #${id} by ${confirmed_by || 'Cashier'}`);

  try {
    const qRes = await pool.query(`SELECT * FROM cashier_queue WHERE id = $1`, [id]);
    if (!qRes.rows.length) return res.status(404).json({ error: "Queue item not found" });
    const q = qRes.rows[0];

    console.log(`📋 Queue item: method=${q.method}, amount=${q.amount}, is_item=${q.is_item}, requested_by=${q.requested_by}`);

    if (q.method === "Credit") {
      return res.status(400).json({
        error: "Credit payments require manager approval — use Request Approval instead"
      });
    }

    if (q.status === 'Confirmed') {
      return res.json({ success: true, message: "Already confirmed" });
    }

    if (q.method === "Momo-MTN" || q.method === "Momo-Airtel") {
      if (!/^[A-Za-z0-9-]{4,100}$/.test(transactionId)) {
        return res.status(400).json({ error: "Enter a valid transaction ID for Momo payments" });
      }
    }

    const revenueBreakdown = await getSaleRevenueBreakdown(parseOrderIds(q.order_ids || []), {
      item: q.item,
      isItem: q.is_item,
      amount: q.amount,
    });
    await createSalesJournalEntry({
      amount: q.amount,
      paymentMethod: q.method,
      revenueBreakdown,
      description: `Cashier sale · ${q.table_name || 'WALK-IN'}`,
      sourceTransaction: `cashier_queue:${id}`,
      postedBy: confirmed_by || 'Cashier',
    });

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Confirmed', confirmed_by = $1, confirmed_at = NOW(), transaction_id = $2
       WHERE id = $3`,
      [confirmed_by || "Cashier", transactionId || null, id]
    );

    const paymentMethod = q.method.toLowerCase();

    let waiterName = null;
    if (q.order_ids && q.order_ids.length) {
      waiterName = await getStaffNameFromOrderIds(q.order_ids, q.requested_by || null);
    }
    if (!waiterName) waiterName = q.requested_by || null;

    console.log(`👤 Waiter name resolved: "${waiterName}" for new paid order`);

    // ── 1. Create a new order for the confirmed payment amount ───────────────
    const newOrderRes = await pool.query(
      `INSERT INTO orders
         (table_name, payment_method, total, status, is_paid, payment_confirmed,
          staff_name, staff_id, original_order_ids, transaction_id,
          paid_at, created_at, updated_at, sent_to_cashier, is_archived)
       VALUES ($1, $2, $3, 'Paid', true, true, $4, $5, $6::jsonb, $7,
               NOW(), NOW(), NOW(), false, false)
       RETURNING id`,
      [q.table_name, paymentMethod, q.amount, waiterName, q.staff_id || null, JSON.stringify(q.order_ids || []), transactionId || null]
    );
    const newOrderId = newOrderRes.rows[0].id;
    console.log(`✅ Created paid order #${newOrderId} for UGX ${q.amount} via ${paymentMethod}, staff_name="${waiterName}"`);

    // ── 2. Stamp _rowPaid on confirmed items in original orders ─────────────
    // MUST happen before the archive check so the check sees up-to-date items.
    if (q.order_ids && q.order_ids.length) {
      for (const orderId of q.order_ids) {
        const orderRes = await pool.query(
          `SELECT items FROM orders WHERE id = $1`,
          [orderId]
        );
        if (!orderRes.rows.length) continue;

        let items = orderRes.rows[0].items;
        if (typeof items === 'string') items = JSON.parse(items);
        if (!Array.isArray(items)) continue;

        let updated = false;
        const updatedItems = items.map((item, itemIndex) => {
          let newItem = { ...item };

          if (q.is_item && q.item?.name && item.name === q.item.name
            && (q.item._orderItemIndex === undefined || q.item._orderItemIndex === itemIndex)) {
            // Single-item payment: only stamp the matching item
            if (item._rowPaid !== true && getOrderItemPayableAmount(item) > 0) {
              updated = true;
              newItem._rowPaid          = true;
              newItem.paidAmount        = getOrderItemPayableAmount(item);
              newItem.paid_at           = new Date().toISOString();
              newItem.payment_confirmed = true;
              newItem.payment_method    = paymentMethod;
              newItem.transaction_id   = transactionId || null;
            }
            if (item.paymentRequested === true) {
              updated = true;
              newItem.paymentRequested = false;
            }
          } else if (!q.is_item) {
            // Whole-order payment: stamp every non-credit, non-voided, unpaid item
            if (
              item._rowPaid !== true &&
              getOrderItemPayableAmount(item) > 0 &&
              !item.creditRequested &&
              item.status !== 'VOIDED' &&
              !(item.payment_method || '').toUpperCase().includes('CREDIT')
            ) {
              updated = true;
              newItem._rowPaid          = true;
              newItem.paidAmount        = getOrderItemPayableAmount(item);
              newItem.paid_at           = new Date().toISOString();
              newItem.payment_confirmed = true;
              newItem.payment_method    = paymentMethod;
              newItem.transaction_id   = transactionId || null;
            }
            if (item.paymentRequested === true) {
              updated = true;
              newItem.paymentRequested = false;
            }
          } else if (item.paymentRequested === true) {
            updated = true;
            newItem.paymentRequested = false;
          }

          return newItem;
        });

        if (updated) {
          await pool.query(
            `UPDATE orders SET items = $1, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(updatedItems), orderId]
          );
          console.log(`✅ Updated original order #${orderId}: _rowPaid=true stamped`);
        }
        try {
          const consumption = await consumeSoldOrderItems({ orderId, items: updatedItems, createdBy: confirmed_by || 'Cashier' });
          for (const entry of consumption.filter((record) => !['CONSUMED', 'CONSUMED_COST_REVIEW', 'ALREADY_CONSUMED'].includes(record.status))) {
            console.warn(`Recipe consumption ${entry.status} for order #${orderId}: ${entry.order_item}`);
          }
        } catch (error) {
          console.error(`Recipe consumption failed for confirmed order #${orderId}:`, error.message);
        }
      }
    }

    // ── 3. Archive original orders where all non-credit items are now paid ───
    // Runs AFTER Step 2 so items reflect the just-confirmed payments.
    // This is what prevents the original order from leaking into the PDF.
    if (q.order_ids && q.order_ids.length) {
      for (const orderId of q.order_ids) {
        const checkRes = await pool.query(
          `SELECT items FROM orders WHERE id = $1`,
          [orderId]
        );
        if (!checkRes.rows.length) continue;

        let items = checkRes.rows[0].items;
        if (typeof items === 'string') items = JSON.parse(items);
        if (!Array.isArray(items)) continue;

        // Any item that is not voided, not credit, and not yet paid = still outstanding
        const activeUnpaid = items.filter(item =>
          item.status !== 'VOIDED' &&
          item.voidProcessed !== true &&
          item._rowPaid !== true &&
          item.creditRequested !== true &&
          !(item.payment_method || '').toUpperCase().includes('CREDIT')
        );

        if (activeUnpaid.length === 0) {
          // Nothing left to pay — archive the original order so it won't
          // appear in reports or the PDF (the new paid order records the sale).
          await pool.query(
            `UPDATE orders
             SET is_archived = true, sent_to_cashier = true, updated_at = NOW()
             WHERE id = $1 AND is_archived = false`,
            [orderId]
          );
          console.log(`✅ Original order #${orderId} archived — all items settled`);
        } else {
          // Some items still pending (e.g. credit not yet approved) —
          // just mark sent_to_cashier without archiving.
          await pool.query(
            `UPDATE orders SET sent_to_cashier = true, updated_at = NOW() WHERE id = $1`,
            [orderId]
          );
          console.log(`ℹ️  Original order #${orderId} kept alive — ${activeUnpaid.length} item(s) still pending`);
        }
      }
    }

    await updateDailySummary({ amount: q.amount, method: paymentMethod, orderCount: 0 });

    await logActivity(pool, 'SALE',
      `${q.table_name || 'Table'} — UGX ${Number(q.amount).toLocaleString()} ${q.method} confirmed by ${confirmed_by || 'Cashier'}`,
      { queue_id: id, method: q.method, amount: q.amount, new_order_id: newOrderId }
    );

    res.json({ success: true, new_order_id: newOrderId });
  } catch (err) {
    console.error("cashier confirm failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cashier-ops/cashier-queue
// ─────────────────────────────────────────────────────────────────────────────
router.get("/cashier-queue", requireCashier, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cq.*,
              (p.id IS NOT NULL) AS is_public_order,
              p.customer_name,
              p.customer_email,
              p.mobile_money_number,
              p.payment_provider,
              p.delivery_type,
              p.city,
              p.location_desc,
              p.items AS order_items,
              p.status AS public_payment_status,
              p.preparation_status,
              p.reject_reason AS public_reject_reason
       FROM public.cashier_queue cq
       LEFT JOIN public.public_payment_requests p ON p.cashier_queue_id = cq.id
       WHERE (
          cq.status IN ('Pending', 'PendingManagerApproval')
          AND (p.id IS NULL OR p.preparation_status IN ('NotSent', 'Ready'))
       ) OR p.status = 'Rejected'
       ORDER BY cq.created_at ASC
       LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("cashier-queue fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cashier-ops/tables - Read-only table and payment history for cashiers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tables", requireCashier, async (req, res) => {
  try {
    const eligibleStaff = `(
      LOWER(REPLACE(COALESCE(o.staff_role, ''), ' ', '')) IN ('waiter', 'manager', 'supervisor')
      OR LOWER(REPLACE(COALESCE(s.role, ''), ' ', '')) IN ('waiter', 'manager', 'supervisor')
    )`;
    const [ordersResult, tablesResult, creditsResult] = await Promise.all([
      pool.query(
        `SELECT o.id, o.table_name, o.staff_id,
                COALESCE(NULLIF(o.staff_name, ''), s.name) AS staff_name,
                COALESCE(NULLIF(o.staff_role, ''), s.role) AS staff_role,
                o.items, o.total, o.status, o.payment_method, o.is_paid,
                o.created_at, o.timestamp, o.is_archived, o.shift_cleared, o.day_cleared
         FROM public.orders o
         LEFT JOIN public.staff s ON s.id = o.staff_id
         WHERE o.table_name IS NOT NULL
           AND UPPER(TRIM(o.table_name)) <> 'WALK-IN'
           AND ${eligibleStaff}
         ORDER BY COALESCE(o.created_at, o.timestamp) DESC, o.id DESC`
      ),
      pool.query(
        `SELECT id, name, status, last_order_id
         FROM public.tables
         ORDER BY name ASC`
      ),
      pool.query(
        `SELECT DISTINCT c.*
         FROM public.credits c
         JOIN public.orders o
           ON (c.order_id = o.id OR (
             c.order_id IS NULL
             AND UPPER(TRIM(c.table_name)) = UPPER(TRIM(o.table_name))
           ))
         LEFT JOIN public.staff s ON s.id = o.staff_id
         WHERE c.table_name IS NOT NULL
           AND UPPER(TRIM(c.table_name)) <> 'WALK-IN'
           AND ${eligibleStaff}
         ORDER BY c.created_at DESC`
      ),
    ]);

    const orders = ordersResult.rows.map(order => {
      let items = order.items;
      if (typeof items === "string") {
        try {
          items = JSON.parse(items);
        } catch (error) {
          console.error(`Failed to parse table history items for order ${order.id}:`, error);
          items = [];
        }
      }
      return { ...order, items: Array.isArray(items) ? items : [] };
    });

    res.json({
      tables: tablesResult.rows,
      orders,
      credits: creditsResult.rows,
    });
  } catch (err) {
    console.error("Cashier table history fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch table history" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cashier-ops/cashier-queue/:id/request-approval
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/cashier-queue/:id/request-approval", requireCashier, async (req, res) => {
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
    if (!tableName && q.order_ids?.length > 0) {
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
      `UPDATE cashier_queue SET status = 'PendingManagerApproval', confirmed_by = $1 WHERE id = $2`,
      [requested_by || "Cashier", id]
    );

    await pool.query(
      `UPDATE credits SET status = 'PendingManagerApproval'
       WHERE UPPER(table_name) = UPPER($1) AND status = 'PendingCashier'`,
      [tableName]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("request-approval failed:", err);
    res.status(500).json({ error: "Failed to request approval" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cashier-ops/cashier-queue/cancel-pending
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/cashier-queue/cancel-pending", async (req, res) => {
  const { table_name, order_ids = [], item_name, canceled_by } = req.body || {};
  const ids = parseOrderIds(order_ids);

  try {
    let base = `SELECT * FROM cashier_queue
      WHERE status IN ('Pending', 'PendingManagerApproval')`;
    const params = [];

    if (table_name) {
      params.push(String(table_name).trim());
      base += ` AND table_name = $${params.length}`;
    }

    if (ids.length) {
      params.push(ids);
      base += ` AND order_ids::jsonb @> $${params.length}::jsonb`;
    }

    base += ` ORDER BY created_at DESC LIMIT 1`;

    const qRes = await pool.query(base, params);
    if (!qRes.rows.length) {
      return res.json({ success: true, cancelled: false, message: "No pending request found" });
    }

    const q = qRes.rows[0];
    const pendingIds = parseOrderIds(q.order_ids || []);

    if (q.method === "Credit") {
      await pool.query(
        `UPDATE credits
         SET status = 'PendingCashier', reject_reason = NULL, updated_at = NOW()
         WHERE cashier_queue_id = $1
           AND status IN ('PendingCashier', 'PendingManagerApproval')`,
        [q.id]
      );
    }

    if (pendingIds.length > 0) {
      for (const orderId of pendingIds) {
        const orderRes = await pool.query(`SELECT items FROM orders WHERE id = $1`, [orderId]);
        if (!orderRes.rows.length) continue;

        let items = orderRes.rows[0].items;
        if (typeof items === "string") items = JSON.parse(items);
        if (!Array.isArray(items)) continue;

        const updatedItems = items.map(item => {
          const matchesItemName = item_name && item.name && String(item.name).trim().toLowerCase() === String(item_name).trim().toLowerCase();
          if (q.is_item && item_name && matchesItemName) {
            return {
              ...item,
              paymentRequested: false,
              creditRequested: false,
            };
          }

          if (!q.is_item || !item_name) {
            return {
              ...item,
              paymentRequested: false,
              creditRequested: false,
            };
          }

          return item;
        });

        await pool.query(
          `UPDATE orders SET items = $1, sent_to_cashier = false, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedItems), orderId]
        );
      }
    }

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Cancelled', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [canceled_by || "Waiter", q.id]
    );

    res.json({ success: true, cancelled: true, queue_id: q.id });
  } catch (err) {
    console.error("cancel pending request failed:", err);
    res.status(500).json({ error: "Failed to cancel pending cashier request" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cashier-ops/cashier-queue/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/cashier-queue/:id/reject", requireCashier, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  try {
    const qRes = await pool.query(
      `SELECT order_ids, table_name FROM cashier_queue WHERE id = $1`,
      [id]
    );
    if (!qRes.rows.length) return res.status(404).json({ error: "Queue item not found" });
    const q = qRes.rows[0];

      if (q.method === "Credit") {
        return res.status(403).json({
          error: "Cashiers cannot reject credit requests. Forward to the manager for approval or rejection."
        });
      }

    const ids = q.order_ids || [];

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Rejected', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [reason || "Rejected by cashier", id]
    );

    if (ids.length > 0) {
      for (const orderId of ids) {
        const orderRes = await pool.query(
          `SELECT items FROM orders WHERE id = $1`,
          [orderId]
        );
        if (orderRes.rows.length) {
          let items = orderRes.rows[0].items;
          if (typeof items === 'string') items = JSON.parse(items);
          if (Array.isArray(items)) {
            const updatedItems = items.map(item => {
              if (item.paymentRequested === true) {
                return { ...item, paymentRequested: false };
              }
              return item;
            });
            await pool.query(
              `UPDATE orders SET items = $1, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify(updatedItems), orderId]
            );
          }
        }
      }
      await pool.query(
        `UPDATE orders SET sent_to_cashier = false, status = 'Served'
         WHERE id = ANY($1::int[]) AND status NOT IN ('Paid','Credit')`,
        [ids]
      );
    }

    if (q.table_name) {
      try {
        await pool.query(
          `UPDATE credits SET status = 'Rejected', reject_reason = $1
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cashier-ops/credit-approvals
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cashier-ops/credit-approvals/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
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
    if (!tableName && q.order_ids?.length > 0) {
      const orderRes = await pool.query(
        `SELECT table_name FROM orders WHERE id = $1`,
        [q.order_ids[0]]
      );
      tableName = orderRes.rows[0]?.table_name || null;
    }
    if (!tableName) {
      return res.status(400).json({ error: "Cannot approve credit: table_name is missing." });
    }

    const creditRecord = await pool.query(
      'SELECT id FROM public.credits WHERE cashier_queue_id = $1 ORDER BY id LIMIT 1',
      [id]
    );
    const creditId = creditRecord.rows[0]?.id;
    const creditRevenue = await getSaleRevenueBreakdown(parseOrderIds(q.order_ids || []), {
      item: q.item,
      isItem: q.is_item,
      amount: q.amount,
    });
    await createSalesJournalEntry({
      amount: q.amount,
      paymentMethod: 'Credit',
      revenueBreakdown: creditRevenue,
      description: `Approved credit sale · ${q.credit_name || tableName}`,
      sourceTransaction: creditId ? `credit:${creditId}` : `credit_queue:${id}`,
      postedBy: approved_by || 'Manager',
    });

    await pool.query(
      `UPDATE cashier_queue
       SET status = 'Approved', confirmed_by = $1, confirmed_at = NOW()
       WHERE id = $2`,
      [approved_by || "Manager", id]
    );

    const creditUpdateRes = await pool.query(
      `UPDATE credits
       SET status = 'Approved', approved_by = $1, approved_at = NOW()
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
      const creditItemName = (q.item?.name || q.label || '').trim().toLowerCase();
      for (const orderId of q.order_ids) {
        const orderRes = await pool.query(
          `SELECT items, status FROM orders WHERE id = $1`,
          [orderId]
        );
        if (!orderRes.rows.length) continue;

        let items = orderRes.rows[0].items;
        if (typeof items === 'string') items = JSON.parse(items);
        if (!Array.isArray(items)) continue;

        let creditItemFound = false;
        const updatedItems = items.map(item => {
          const nameMatch = creditItemName
            ? item.name?.trim().toLowerCase() === creditItemName
            : item.creditRequested === true;
          if (nameMatch && !item._rowPaid) {
            creditItemFound = true;
            return {
              ...item,
              creditRequested:   true,
              payment_method:    'Credit',
              _rowPaid:          false,
              payment_confirmed: false,
            };
          }
          return item;
        });

        if (!creditItemFound) {
          console.warn(`⚠️  Credit item "${creditItemName}" not found in order #${orderId} — skipping item update`);
        }

        const newStatus = deriveOrderStatus(updatedItems, orderRes.rows[0].status);
        await pool.query(
          `UPDATE orders
           SET items = $1,
               status = $2,
               sent_to_cashier = false,
               updated_at = NOW()
           WHERE id = $3`,
          [JSON.stringify(updatedItems), newStatus, orderId]
        );
        try {
          const approvedCreditItems = updatedItems.map((item) =>
            item.creditRequested === true || String(item.payment_method || '').toUpperCase().includes('CREDIT')
              ? { ...item, _approvedCreditSale: true }
              : item
          );
          await consumeSoldOrderItems({ orderId, items: approvedCreditItems, createdBy: approved_by || 'Manager' });
        } catch (error) {
          console.error(`Recipe consumption failed for approved credit order #${orderId}:`, error.message);
        }
        console.log(`✅ Order #${orderId} updated. Credit item stamped. Status: ${newStatus}`);
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cashier-ops/cashier-history
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cashier-ops/credits
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cashier-ops/staff/credit-settlements
// ─────────────────────────────────────────────────────────────────────────────
router.get("/staff/credit-settlements", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         cs.amount_paid,
         cs.method       AS settle_method,
         cs.created_at   AS settled_at,
         c.waiter_name,
         c.table_name,
         c.client_name,
         c.id            AS credit_id
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cashier-ops/credits/:id/settle
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/credits/:id/settle", async (req, res) => {
  const { id } = req.params;
  const { settled_by, method, transaction_id, notes, amount_paid } = req.body || {};

  const paymentMethod = (method && method.trim()) ? method.trim() : "Cash";
  console.log(`🔵 Settling credit #${id} with method: ${paymentMethod}, amount: ${amount_paid}`);

  try {
    const cRes = await pool.query(`SELECT * FROM credits WHERE id = $1`, [id]);
    if (!cRes.rows.length) return res.status(404).json({ error: "Credit not found" });
    const credit = cRes.rows[0];

    const paid_amount   = Number(amount_paid) || 0;
    const credit_total  = Number(credit.amount);
    const already_paid  = Number(credit.amount_paid || 0);
    const total_paid    = already_paid + paid_amount;
    const is_full       = total_paid >= credit_total;

    // Insert settlement record
    await pool.query(
      `INSERT INTO credit_settlements 
         (credit_id, amount_paid, method, transaction_id, notes, settled_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, paid_amount, paymentMethod, transaction_id || null, notes || null, settled_by]
    );

    // Update credit record
    const newStatus = is_full ? 'FullySettled' : 'PartiallySettled';
    await pool.query(
      `UPDATE credits
       SET paid = $1,
           paid_at = CASE WHEN $1 THEN NOW() ELSE paid_at END,
           settle_method = $2,
           settle_txn = $3,
           amount_paid = $4,
           balance = $5,
           status = $6,
           updated_at = NOW()
       WHERE id = $7`,
      [is_full, paymentMethod, transaction_id || null, total_paid, credit_total - total_paid, newStatus, id]
    );

    // Update linked order item — mark paid but keep payment_method = 'Credit'
    if (credit.order_id) {
      const orderRes = await pool.query(
        `SELECT items, payment_method FROM orders WHERE id = $1`,
        [credit.order_id]
      );
      if (orderRes.rows.length > 0) {
        let items = orderRes.rows[0].items;
        if (typeof items === 'string') items = JSON.parse(items);
        if (Array.isArray(items)) {
          let updated = false;
          const creditItemName = (credit.label || "").toLowerCase();
          const updatedItems = items.map(item => {
            if ((creditItemName && item.name?.toLowerCase() === creditItemName) || item.creditRequested === true) {
              if (item._rowPaid !== true) {
                updated = true;
                return {
                  ...item,
                  _rowPaid:        true,
                  paid_at:         new Date().toISOString(),
                  creditRequested: false,
                };
              }
            }
            return item;
          });
          if (updated) {
            await pool.query(
              `UPDATE orders SET items = $1, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify(updatedItems), credit.order_id]
            );
            console.log(`✅ Updated order #${credit.order_id}: credit item marked paid (payment_method unchanged)`);
          }
        }
      }
    }

    // Archive the linked order once fully settled
    if (is_full && credit.order_id) {
      await pool.query(
        `UPDATE orders 
         SET sent_to_cashier = true, is_archived = true, updated_at = NOW()
         WHERE id = $1 AND is_archived = false`,
        [credit.order_id]
      );
      console.log(`✅ Order #${credit.order_id} archived after full credit settlement.`);
    }

    await updateDailySummary({ 
      amount: paid_amount, 
      method: paymentMethod,
      is_credit_settlement: true
    });

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