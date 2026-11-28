

import express from 'express';
import pool    from '../db.js';
import logActivity from '../utils/logsActivity.js';
import { updateDailySummary } from '../helpers/summaryHelper.js';
import { buildSalesRevenueBreakdown, createReceivableSettlementJournalEntry, createSalesJournalEntry } from '../helpers/accounting.js';
import notificationService from '../helpers/notificationService.js';
import {
  getOrderItemPaidAmount,
  getOrderItemPayableAmount,
} from '../helpers/complimentaryItems.js';
import {
  applyApprovedCreditToItems,
  applyUnitCreditSettlement,
} from '../helpers/approvedCreditItems.js';

const router = express.Router();

// ── Helper ────────────────────────────────────────────────────────────────────
function kampalaDate() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

async function getCreditItemTarget(queryable, credit) {
  if (!credit.cashier_queue_id) return null;
  const result = await queryable.query(
    'SELECT is_item, item FROM cashier_queue WHERE id = $1',
    [credit.cashier_queue_id]
  );
  const queueItem = result.rows[0];
  if (!queueItem?.is_item || !queueItem.item) return null;

  let item = queueItem.item;
  if (typeof item === 'string') {
    try {
      item = JSON.parse(item);
    } catch (error) {
      console.error(`Could not parse item for credit #${credit.id}:`, error.message);
      return null;
    }
  }
  return item && typeof item === 'object' ? item : null;
}

function matchesCreditItem(item, index, target) {
  if (!target) return true;
  if (target._orderItemIndex !== undefined && Number(target._orderItemIndex) !== index) {
    return false;
  }
  return Boolean(target.name) && item.name === target.name;
}

function isEligibleCreditItem(item) {
  return item._rowPaid !== true &&
    !item.paid_at &&
    item.status !== 'VOIDED' &&
    item.voidProcessed !== true &&
    item.creditRequested !== true;
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATABASE SETUP  (run once to create tables if they don't exist)
// ─────────────────────────────────────────────────────────────────────────────
export async function initCreditTables() {
  await pool.query(`
    -- Main credits table (without shift_cleared)
    CREATE TABLE IF NOT EXISTS credits (
      id              SERIAL PRIMARY KEY,
      order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      cashier_queue_id INTEGER,
      table_name      TEXT,
      label           TEXT,

      -- Client info (entered by waiter)
      client_name     TEXT NOT NULL,
      client_phone    TEXT,
      pay_by          DATE,

      -- Amounts
      amount          NUMERIC(12,2) NOT NULL,
      amount_paid     NUMERIC(12,2) DEFAULT 0,
      balance         NUMERIC(12,2),

      -- Status lifecycle
      status          TEXT NOT NULL DEFAULT 'PendingCashier',

      -- People
      waiter_name     TEXT,
      forwarded_by    TEXT,
      approved_by     TEXT,
      rejected_by     TEXT,

      -- Timestamps
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      forwarded_at    TIMESTAMPTZ,
      approved_at     TIMESTAMPTZ,
      rejected_at     TIMESTAMPTZ,
      paid_at         TIMESTAMPTZ,
      reject_reason   TEXT
    );

    -- Ledger of every settlement payment against a credit
    CREATE TABLE IF NOT EXISTS credit_settlements (
      id              SERIAL PRIMARY KEY,
      credit_id       INTEGER NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
      amount_paid     NUMERIC(12,2) NOT NULL,
      method          TEXT NOT NULL,
      transaction_id  TEXT,
      notes           TEXT,
      settled_by      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION update_credit_balance()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE credits
      SET balance = amount - amount_paid
      WHERE id = NEW.id OR id = OLD.id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/credits - Get all credits (no shift_cleared filter)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COALESCE(c.amount - c.amount_paid, c.amount) AS balance,
        COALESCE(
          NULLIF(BTRIM(cq.requested_by), ''),
          NULLIF(BTRIM(c.waiter_name), ''),
          NULLIF(BTRIM(o.staff_name), '')
        ) AS owner_name,
        COALESCE(cq.staff_id, o.staff_id) AS owner_staff_id,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             cs.id,
              'amount_paid',    cs.amount_paid,
              'method',         cs.method,
              'transaction_id', cs.transaction_id,
              'notes',          cs.notes,
              'settled_by',     cs.settled_by,
              'created_at',     cs.created_at,
              'business_date',  cs.business_date
            ) ORDER BY cs.created_at DESC
          ) FILTER (WHERE cs.id IS NOT NULL),
          '[]'
        ) AS settlements
      FROM credits c
      LEFT JOIN credit_settlements cs ON cs.credit_id = c.id
      LEFT JOIN cashier_queue cq ON cq.id = c.cashier_queue_id
      LEFT JOIN orders o ON o.id = c.order_id
      GROUP BY c.id, cq.requested_by, cq.staff_id, o.staff_name, o.staff_id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Credits fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/credits/pending-cashier
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending-cashier', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM credits
      WHERE status = 'PendingCashier'
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/credits/pending-manager
// ─────────────────────────────────────────────────────────────────────────────
router.get('/pending-manager', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM credits
      WHERE status IN ('PendingManager', 'PendingManagerApproval')
      ORDER BY forwarded_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/credits/ledger
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ledger', async (req, res) => {
  try {
    const { date } = req.query;
    const filterDate = date || kampalaDate();

    const result = await pool.query(`
      SELECT
        c.*,
        COALESCE(c.amount - c.amount_paid, c.amount) AS balance,
        CASE
          WHEN c.amount_paid >= c.amount THEN 'FullySettled'
          WHEN c.amount_paid > 0          THEN 'PartiallySettled'
          ELSE 'Unsettled'
        END AS settlement_status,
        COALESCE(
          json_agg(
            json_build_object(
              'id',             cs.id,
              'amount_paid',    cs.amount_paid,
              'method',         cs.method,
              'transaction_id', cs.transaction_id,
              'notes',          cs.notes,
              'settled_by',     cs.settled_by,
              'created_at',     cs.created_at
            ) ORDER BY cs.created_at DESC
          ) FILTER (WHERE cs.id IS NOT NULL),
          '[]'
        ) AS settlements
      FROM credits c
      LEFT JOIN credit_settlements cs ON cs.credit_id = c.id
      WHERE c.status IN ('Approved', 'PartiallySettled', 'FullySettled')
      GROUP BY c.id
      ORDER BY
        CASE
          WHEN c.status = 'Approved' AND c.amount_paid = 0 THEN 0
          WHEN c.amount_paid > 0 AND c.amount_paid < c.amount THEN 1
          ELSE 2
        END,
        c.approved_at DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Ledger fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/credits/lookup
// ─────────────────────────────────────────────────────────────────────────────
router.get('/lookup', async (req, res) => {
  const { order_id, table_name } = req.query;
  if (!order_id && !table_name) {
    return res.status(400).json({ error: 'order_id or table_name required' });
  }
  try {
    const result = await pool.query(`
      SELECT * FROM credits
      WHERE status = 'PendingCashier'
        AND (
          ($1::int IS NOT NULL AND order_id = $1::int)
          OR
          ($2::text IS NOT NULL AND UPPER(table_name) = UPPER($2::text))
        )
      ORDER BY created_at DESC
      LIMIT 1
    `, [order_id ? Number(order_id) : null, table_name || null]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'No pending credit found for this order' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Credit lookup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/credits - CREATE CREDIT
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const {
    order_id,
    cashier_queue_id,
    item: requestedItem,
    is_item: isItemCredit = false,
    table_name,
    label,
    amount,
    client_name,
    client_phone,
    pay_by,
    waiter_name,
  } = req.body;

  if (!client_name || !amount) {
    return res.status(400).json({ error: 'client_name and amount are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO credits
        (order_id, cashier_queue_id, table_name, label, amount, amount_paid, balance,
         client_name, client_phone, pay_by, waiter_name, status, created_at)
      VALUES ($1,$2,$3,$4,$5,0,$5,$6,$7,$8,$9,'PendingCashier',NOW())
      RETURNING *
    `, [
      order_id   || null,
      cashier_queue_id || null,
      table_name || 'WALK-IN',
      label      || `Credit – ${table_name}`,
      Number(amount),
      client_name.trim(),
      client_phone?.trim() || null,
      pay_by     || null,
      waiter_name|| 'Waiter',
    ]);

    if (order_id) {
      await pool.query(
        `UPDATE orders SET status='Credit', payment_method='Credit' WHERE id=$1`,
        [order_id]
      ).catch(() => {});

      const credit = result.rows[0];
      const creditItemTarget = await getCreditItemTarget(pool, credit) ||
        (isItemCredit && requestedItem ? requestedItem : null);
      const orderRes = await pool.query(
        `SELECT items FROM orders WHERE id = $1`,
        [order_id]
      );
      
      if (orderRes.rows.length > 0) {
        let items = orderRes.rows[0].items;
        if (typeof items === 'string') {
          items = JSON.parse(items);
        }
        
        if (Array.isArray(items)) {
          const updatedItems = items.map((item, index) =>
            isEligibleCreditItem(item) && matchesCreditItem(item, index, creditItemTarget)
              ? { ...item, creditRequested: true, payment_method: 'Credit' }
              : item
          );
          
          await pool.query(
            `UPDATE orders SET items = $1 WHERE id = $2`,
            [JSON.stringify(updatedItems), order_id]
          );
        }
      }
    }

    if (cashier_queue_id) {
      await pool.query(`
        UPDATE cashier_queue 
        SET method = 'Credit', 
            status = 'Pending',
            requested_by = $1
        WHERE id = $2
      `, [waiter_name || 'Waiter', cashier_queue_id]).catch(() => {});
    }

    await logActivity(pool, {
      type:    'CREDIT_CREATED',
      actor:   waiter_name || 'Waiter',
      role:    'WAITER',
      message: `Credit request for ${client_name} at ${table_name} – UGX ${Number(amount).toLocaleString()}`,
      meta:    { credit_id: result.rows[0].id, order_id, amount, cashier_queue_id },
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create credit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/credits/forward-by-table
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/forward-by-table', async (req, res) => {
  const { table_name, forwarded_by } = req.body || {};
  if (!table_name) {
    return res.status(400).json({ error: 'table_name is required' });
  }
  try {
    const result = await pool.query(`
      UPDATE credits
      SET status       = 'PendingManagerApproval',
          forwarded_by = $1,
          forwarded_at = NOW()
      WHERE UPPER(table_name) = UPPER($2)
        AND status = 'PendingCashier'
      RETURNING *
    `, [forwarded_by || 'Cashier', table_name]);

    if (!result.rows.length) {
      return res.status(404).json({
        error: `No pending credit found for table "${table_name}".`
      });
    }

    await logActivity(pool, {
      type:    'CREDIT_FORWARDED',
      actor:   forwarded_by || 'Cashier',
      role:    'CASHIER',
      message: `Forwarded credit for table ${table_name} to manager`,
      meta:    { credit_id: result.rows[0].id, table_name },
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Forward-by-table error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/credits/:id/forward
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/forward', async (req, res) => {
  const { id } = req.params;
  const { forwarded_by } = req.body;
  const forwardedBy = forwarded_by || 'Cashier';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE credits
      SET status       = 'PendingManagerApproval',
          forwarded_by = $1,
          forwarded_at = NOW()
      WHERE id = $2 AND status = 'PendingCashier'
      RETURNING *
    `, [forwardedBy, id]);

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Credit not found or already forwarded' });
    }
    const credit = result.rows[0];

    if (credit.cashier_queue_id) {
      const queueResult = await client.query(`
        UPDATE cashier_queue
        SET status = 'PendingManagerApproval', confirmed_by = $1
        WHERE id = $2 AND method = 'Credit' AND status = 'Pending'
        RETURNING id
      `, [forwardedBy, credit.cashier_queue_id]);
      if (!queueResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'The linked cashier request is no longer pending manager approval.'
        });
      }
    }

    await client.query('COMMIT');
    await logActivity(pool, {
      type:    'CREDIT_FORWARDED',
      actor:   forwardedBy,
      role:    'CASHIER',
      message: `Forwarded credit #${id} to manager for approval`,
      meta:    { credit_id: id, cashier_queue_id: credit.cashier_queue_id },
    });

    const managerNotification = await notificationService.sendToRoles(['MANAGER'], {
      type: 'CREDIT_MANAGER_APPROVAL_REQUEST',
      title: 'Credit request needs approval',
      body: `${credit.client_name || 'Client'} has a credit request for ${credit.table_name || 'a table'} (UGX ${Number(credit.amount).toLocaleString()}).`,
      referenceId: credit.cashier_queue_id || credit.id,
      referenceType: credit.cashier_queue_id ? 'cashier_queue' : 'credit',
      link: '/staff/manager',
    });
    console.log(
      `[CREDIT MANAGER APPROVAL] Credit ID: ${credit.id}; ` +
      `manager notifications sent: ${managerNotification.sent || 0}, ` +
      `failed: ${managerNotification.failed || 0}` +
      `${managerNotification.noRecipients ? ', no registered Manager devices' : ''}`
    );

    res.json(credit);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Forward credit error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/credits/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  try {
    const result = await pool.query(`
      UPDATE credits
      SET status      = 'Approved',
          approved_by = $1,
          approved_at = NOW()
      WHERE id = $2 AND status IN ('PendingManager', 'PendingManagerApproval')
      RETURNING *
    `, [approved_by || 'Manager', id]);

    let credit = result.rows[0];
    if (!credit) {
      const existing = await pool.query(
        `SELECT * FROM credits WHERE id = $1 AND status = 'Approved'`,
        [id]
      );
      credit = existing.rows[0];
      if (!credit) return res.status(404).json({ error: 'Credit not found or not pending manager' });
    }

    let saleItems = [];
    if (credit.order_id) {
      const orderRes = await pool.query('SELECT items FROM public.orders WHERE id = $1', [credit.order_id]);
      const orderItems = orderRes.rows[0]?.items;
      if (Array.isArray(orderItems)) saleItems = orderItems;
      else if (typeof orderItems === 'string') {
        try {
          const parsed = JSON.parse(orderItems);
          if (Array.isArray(parsed)) saleItems = parsed;
        } catch (error) {
          console.error(`Could not parse items for approved credit #${credit.id}:`, error.message);
        }
      }
    }
    await createSalesJournalEntry({
      amount: credit.amount,
      paymentMethod: 'Credit',
      revenueBreakdown: buildSalesRevenueBreakdown(saleItems, credit.amount),
      description: `Approved credit sale · ${credit.client_name || credit.table_name || credit.id}`,
      sourceTransaction: `credit:${credit.id}`,
      postedBy: approved_by || 'Manager',
      entryDate: req.businessDate,
    });
    if (credit.cashier_queue_id) {
      await pool.query(
        `UPDATE cashier_queue
         SET status = 'Approved', confirmed_by = $1, confirmed_at = NOW(), business_date = $2::date
         WHERE id = $3 AND status IN ('Pending', 'PendingManagerApproval')`,
        [approved_by || 'Manager', req.businessDate, credit.cashier_queue_id]
      );
    }
    // Mark items in the order as credit requested
    if (credit.order_id) {
      const creditItemTarget = await getCreditItemTarget(pool, credit);
      const orderRes = await pool.query(
        `SELECT items, status FROM orders WHERE id = $1`,
        [credit.order_id]
      );
      
      if (orderRes.rows.length > 0) {
        let items = orderRes.rows[0].items;
        if (typeof items === 'string') {
          items = JSON.parse(items);
        }
        
        if (Array.isArray(items)) {
          const updatedItems = applyApprovedCreditToItems(items, {
            targetItem: creditItemTarget,
            markAllUnpaid: Boolean(credit.cashier_queue_id && !creditItemTarget),
          });
          
          await pool.query(
            `UPDATE orders SET items = $1, sent_to_cashier = false, updated_at = NOW() WHERE id = $2`,
            [JSON.stringify(updatedItems.items), credit.order_id]
          );
        }
      }
    }

    await logActivity(pool, {
      type:    'CREDIT_APPROVED',
      actor:   approved_by || 'Manager',
      role:    'MANAGER',
      message: `Approved credit #${id} for ${credit.client_name}`,
      meta:    { credit_id: id, amount: credit.amount },
    });
    if (result.rows.length) {
      const cashierNotification = await notificationService.sendToRoles(['CASHIER'], {
        type: 'CREDIT_APPROVED',
        title: 'Credit request approved',
        body: `${credit.client_name || 'Client'}'s credit for ${credit.table_name || 'the table'} (UGX ${Number(credit.amount).toLocaleString()}) was approved by ${approved_by || 'Manager'}.`,
        referenceId: credit.cashier_queue_id || credit.id,
        referenceType: credit.cashier_queue_id ? 'cashier_queue' : 'credit',
        link: '/cashier',
      });
      console.log(
        `[CREDIT APPROVED NOTIFICATION] Credit ID: ${id}; cashier notifications sent: ` +
        `${cashierNotification.sent || 0}, failed: ${cashierNotification.failed || 0}`
      );
    }

    res.json(credit);
  } catch (err) {
    console.error('Approve credit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/credits/:id/reject
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { rejected_by, reason } = req.body;

  try {
    const result = await pool.query(`
      UPDATE credits
      SET status        = 'Rejected',
          rejected_by   = $1,
          rejected_at   = NOW(),
          reject_reason = $2
      WHERE id = $3 AND status IN ('PendingManager', 'PendingManagerApproval')
      RETURNING *
    `, [rejected_by || 'Manager', reason || 'Rejected by manager', id]);

    if (!result.rows.length)
      return res.status(404).json({ error: 'Credit not found or not pending' });

    await logActivity(pool, {
      type:    'CREDIT_REJECTED',
      actor:   rejected_by || 'Manager',
      role:    'MANAGER',
      message: `Rejected credit #${id}: ${reason}`,
      meta:    { credit_id: id, reason },
    });
    const credit = result.rows[0];
    const cashierNotification = await notificationService.sendToRoles(['CASHIER'], {
      type: 'CREDIT_REJECTED',
      title: 'Credit request rejected',
      body: `${credit.client_name || 'Client'}'s credit for ${credit.table_name || 'the table'} (UGX ${Number(credit.amount).toLocaleString()}) was rejected by ${rejected_by || 'Manager'}${reason ? `: ${reason}` : '.'}`,
      referenceId: credit.cashier_queue_id || credit.id,
      referenceType: credit.cashier_queue_id ? 'cashier_queue' : 'credit',
      link: '/cashier',
    });
    console.log(
      `[CREDIT REJECTED NOTIFICATION] Credit ID: ${id}; cashier notifications sent: ` +
      `${cashierNotification.sent || 0}, failed: ${cashierNotification.failed || 0}`
    );

    res.json(credit);
  } catch (err) {
    console.error('Reject credit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/credits/:id/settle - FULLY FIXED
//  - Only marks credit-requested items as paid
//  - Does NOT insert into cashier_queue (prevents double-counting)
//  - Handles partial settlements correctly
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/settle', async (req, res) => {
  const { id } = req.params;
  const { amount_paid, method, transaction_id, notes, settled_by } = req.body;

  const payment = Number(amount_paid);
  if (!Number.isFinite(payment) || payment <= 0)
    return res.status(400).json({ error: 'amount_paid must be a positive number' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the credit row
    const creditRes = await client.query(
      `SELECT * FROM credits WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!creditRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Credit not found' });
    }
    const credit = creditRes.rows[0];

    if (!['Approved', 'PartiallySettled', 'Rejected'].includes(credit.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot settle a credit with status: ${credit.status}`
      });
    }

    const prevPaid    = Number(credit.amount_paid) || 0;
    const totalAmount = Number(credit.amount);
    if (payment > totalAmount - prevPaid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Settlement amount exceeds the outstanding credit balance' });
    }
    const newPaid     = Math.min(prevPaid + payment, totalAmount);
    const newBalance  = totalAmount - newPaid;
    const newStatus   = newBalance <= 0 ? 'FullySettled' : 'PartiallySettled';

    // 1. Insert settlement ledger entry
    const settlementRes = await client.query(`
      INSERT INTO credit_settlements
        (credit_id, amount_paid, method, transaction_id, notes, settled_by, created_at, business_date)
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7::date)
      RETURNING *
    `, [id, payment, method || 'Cash', transaction_id || null, notes || null, settled_by || 'Cashier', req.businessDate]);

    await createReceivableSettlementJournalEntry({
      amount: payment,
      paymentMethod: method || 'Cash',
      sourceTransaction: `credit_settlement:${settlementRes.rows[0].id}`,
      postedBy: settled_by || 'Cashier',
      entryDate: req.businessDate,
      queryable: client,
    });

    // 2. Update the credit record
    await client.query(`
      UPDATE credits
      SET amount_paid = $1,
          balance     = $2,
          status      = $3,
          paid_at     = NOW()
      WHERE id = $4
    `, [newPaid, newBalance, newStatus, id]);

    // 3. Update orders status and individual items
    if (credit.order_id) {
      // Record credit settlement in the authoritative daily_summary table.
      await updateDailySummary({ amount: payment, method, orderCount: 0, date: req.businessDate });
      
      // Update individual items - ONLY mark credit-requested items as paid
      const creditItemTarget = await getCreditItemTarget(client, credit);
      const orderRes = await client.query(
        `SELECT items FROM orders WHERE id = $1 FOR UPDATE`,
        [credit.order_id]
      );
      
      if (orderRes.rows.length > 0) {
        let items = orderRes.rows[0].items;
        if (typeof items === 'string') {
          items = JSON.parse(items);
        }
        
        if (Array.isArray(items)) {
          let updatedCreditItemCount = 0;
          const unitTargetIndex = creditItemTarget?._unitIndex !== undefined
            && creditItemTarget?._unitIndex !== null
            ? Number(creditItemTarget._unitIndex)
            : null;
          const updatedItems = items.map((item, index) => {
            if (unitTargetIndex !== null && matchesCreditItem(item, index, creditItemTarget)) {
              const settlement = applyUnitCreditSettlement(item, unitTargetIndex, {
                amountPaid: newPaid,
                balance: newBalance,
                status: newStatus,
                method,
              });
              if (settlement.changed) updatedCreditItemCount += 1;
              return settlement.item;
            }
            // Only update items that were requested as credit
            if (item.creditRequested === true && matchesCreditItem(item, index, creditItemTarget)) {
              updatedCreditItemCount += 1;
              if (newStatus === 'FullySettled') {
                // Full settlement - mark as fully paid
                return {
                  ...item,
                  _rowPaid: true,
                  payment_method: method || "Cash",
                  paid_at: new Date().toISOString(),
                  is_partially_paid: false,
                  creditRequested: false,
                  creditRejected: false,
                };
              } else {
                // Partial settlement - mark as partially paid
                return {
                  ...item,
                  _rowPaid: false,
                  is_partially_paid: true,
                  partial_payment_method: method || "Cash",
                  partial_paid_at: new Date().toISOString(),
                  partial_amount_paid: newPaid,
                  remaining_balance: Math.max(getOrderItemPayableAmount(item) - newPaid, 0)
                };
              }
            }
            // Leave non-credit items as they are
            return item;
          });

          if (creditItemTarget && updatedCreditItemCount === 0) {
            throw new Error(`Credit item for credit #${credit.id} was not found on order #${credit.order_id}.`);
          }
          const payableItems = updatedItems.filter(item =>
            item.status !== 'VOIDED' &&
            item.voidProcessed !== true &&
            getOrderItemPayableAmount(item) > 0
          );
          const allItemsSettled = payableItems.length > 0 && payableItems.every(item => {
            if (Array.isArray(item.unitStates)) {
              const activeUnits = item.unitStates.filter(state => state?.voidProcessed !== true);
              return activeUnits.length === 0 || activeUnits.every(state => state?.paid === true);
            }
            return item._rowPaid === true || Boolean(item.paid_at) || item.status === 'Paid';
          });
          await client.query(
            `UPDATE orders
             SET items = $1,
                 status = CASE WHEN $2 THEN 'Paid' ELSE status END,
                 payment_method = CASE WHEN $2 THEN $3 ELSE payment_method END,
                 paid_at = CASE WHEN $2 THEN COALESCE(paid_at, NOW()) ELSE paid_at END
             WHERE id = $4`,
            [JSON.stringify(updatedItems), allItemsSettled, method || "Cash", credit.order_id]
          );
        }
      }
    }

    await client.query('COMMIT');

    await logActivity(pool, {
      type:    'CREDIT_SETTLED',
      actor:   settled_by || 'Cashier',
      role:    'CASHIER',
      message: `Settlement of UGX ${payment.toLocaleString()} (${method}) for ${credit.client_name}. Balance: UGX ${newBalance.toLocaleString()}`,
      meta:    { credit_id: id, payment, method, new_status: newStatus },
    });

    res.json({
      credit_id:      Number(id),
      settlement:     settlementRes.rows[0],
      amount_paid:    newPaid,
      balance:        newBalance,
      status:         newStatus,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Settle credit error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;