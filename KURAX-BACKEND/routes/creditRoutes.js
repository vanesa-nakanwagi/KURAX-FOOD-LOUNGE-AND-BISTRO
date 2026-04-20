// ═══════════════════════════════════════════════════════════════════════════
//  CREDIT FLOW ROUTES  –  mount at /api/credits
//
//  Full lifecycle:
//   Waiter → POST /api/credits          (creates credit request, status=PendingCashier)
//   Cashier → PATCH /:id/forward        (forwards to manager, status=PendingManager)
//   Manager → PATCH /:id/approve        (approves, status=Approved)
//   Manager → PATCH /:id/reject         (rejects, status=Rejected)
//   Cashier → PATCH /:id/settle         (partial/full settlement, recorded in ledger)
//   GET /                               (all credits – cashier ledger)
//   GET /pending-cashier                (credits waiting for cashier action)
//   GET /pending-manager                (credits waiting for manager approval)
//   GET /ledger                         (settled + partial credits with totals)
// ═══════════════════════════════════════════════════════════════════════════

import express from 'express';
import pool    from '../db.js';
import logActivity from '../utils/logsActivity.js';

const router = express.Router();

// ── Helper ────────────────────────────────────────────────────────────────────
function kampalaDate() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
//  DATABASE SETUP  (run once to create tables if they don't exist)
// ─────────────────────────────────────────────────────────────────────────────
export async function initCreditTables() {
  await pool.query(`
    -- Main credits table
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
      reject_reason   TEXT,

      -- Shift control
      shift_cleared   BOOLEAN DEFAULT FALSE
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
//  GET /api/credits
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COALESCE(c.amount - c.amount_paid, c.amount) AS balance,
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
      WHERE c.shift_cleared = FALSE
      GROUP BY c.id
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
        AND shift_cleared = FALSE
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
      WHERE status = 'PendingManager'
        AND shift_cleared = FALSE
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
        AND c.shift_cleared = FALSE
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
        AND shift_cleared = FALSE
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
      
      // Mark items in the order as credit requested
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
          const updatedItems = items.map(item => ({
            ...item,
            creditRequested: true,
            payment_method: 'Credit'
          }));
          
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
      SET status       = 'PendingManager',
          forwarded_by = $1,
          forwarded_at = NOW()
      WHERE UPPER(table_name) = UPPER($2)
        AND status = 'PendingCashier'
        AND shift_cleared = FALSE
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

  try {
    const result = await pool.query(`
      UPDATE credits
      SET status       = 'PendingManager',
          forwarded_by = $1,
          forwarded_at = NOW()
      WHERE id = $2 AND status = 'PendingCashier'
      RETURNING *
    `, [forwarded_by || 'Cashier', id]);

    if (!result.rows.length)
      return res.status(404).json({ error: 'Credit not found or already forwarded' });

    await logActivity(pool, {
      type:    'CREDIT_FORWARDED',
      actor:   forwarded_by || 'Cashier',
      role:    'CASHIER',
      message: `Forwarded credit #${id} to manager for approval`,
      meta:    { credit_id: id },
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Forward credit error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/credits/:id/approve - FIXED (marks items as credit requested)
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
      WHERE id = $2 AND status = 'PendingManager'
      RETURNING *
    `, [approved_by || 'Manager', id]);

    if (!result.rows.length)
      return res.status(404).json({ error: 'Credit not found or not pending manager' });

    const credit = result.rows[0];

    // Mark items in the order as credit requested
    if (credit.order_id) {
      const orderRes = await pool.query(
        `SELECT items FROM orders WHERE id = $1`,
        [credit.order_id]
      );
      
      if (orderRes.rows.length > 0) {
        let items = orderRes.rows[0].items;
        if (typeof items === 'string') {
          items = JSON.parse(items);
        }
        
        if (Array.isArray(items)) {
          const updatedItems = items.map(item => ({
            ...item,
            creditRequested: true,
            payment_method: 'Credit'
          }));
          
          await pool.query(
            `UPDATE orders SET items = $1 WHERE id = $2`,
            [JSON.stringify(updatedItems), credit.order_id]
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

    res.json(result.rows[0]);
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
      WHERE id = $3 AND status = 'PendingManager'
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

    res.json(result.rows[0]);
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
  if (!payment || payment <= 0)
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

    if (!['Approved', 'PartiallySettled'].includes(credit.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cannot settle a credit with status: ${credit.status}`
      });
    }

    const prevPaid    = Number(credit.amount_paid) || 0;
    const totalAmount = Number(credit.amount);
    const newPaid     = Math.min(prevPaid + payment, totalAmount);
    const newBalance  = totalAmount - newPaid;
    const newStatus   = newBalance <= 0 ? 'FullySettled' : 'PartiallySettled';

    // 1. Insert settlement ledger entry
    const settlementRes = await client.query(`
      INSERT INTO credit_settlements
        (credit_id, amount_paid, method, transaction_id, notes, settled_by, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
      RETURNING *
    `, [id, payment, method || 'Cash', transaction_id || null, notes || null, settled_by || 'Cashier']);

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
      // Update order status
      await client.query(`
        UPDATE orders
        SET status = $1,
            payment_method = $2,
            paid_at = NOW()
        WHERE id = $3
      `, [newStatus === 'FullySettled' ? 'Paid' : 'Credit', method || "Cash", credit.order_id]);
      
      // Update individual items - ONLY mark credit-requested items as paid
      const orderRes = await client.query(
        `SELECT items FROM orders WHERE id = $1`,
        [credit.order_id]
      );
      
      if (orderRes.rows.length > 0) {
        let items = orderRes.rows[0].items;
        if (typeof items === 'string') {
          items = JSON.parse(items);
        }
        
        if (Array.isArray(items)) {
          const updatedItems = items.map(item => {
            // Only update items that were requested as credit
            if (item.creditRequested === true) {
              if (newStatus === 'FullySettled') {
                // Full settlement - mark as fully paid
                return {
                  ...item,
                  _rowPaid: true,
                  payment_method: method || "Cash",
                  paid_at: new Date().toISOString(),
                  is_partially_paid: false
                };
              } else {
                // Partial settlement - mark as partially paid
                return {
                  ...item,
                  _rowPaid: false,
                  is_partially_paid: true,
                  partial_payment_method: method || "Cash",
                  partial_paid_at: new Date().toISOString(),
                  partial_amount_paid: payment,
                  remaining_balance: item.price * (item.quantity || 1) - payment
                };
              }
            }
            // Leave non-credit items as they are
            return item;
          });
          
          await client.query(
            `UPDATE orders SET items = $1 WHERE id = $2`,
            [JSON.stringify(updatedItems), credit.order_id]
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