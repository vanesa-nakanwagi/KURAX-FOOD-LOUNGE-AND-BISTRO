import express from 'express';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import {
  applySpecialBillDiscount,
  getDiscountableBillBalance,
  getSpecialDiscountLimit,
  splitDiscountAmount,
  normalizeSpecialDiscountSettings,
} from '../helpers/specialBillDiscounts.js';
import { roundMoney } from '../helpers/menuPromotions.js';
import logActivity from '../utils/logsActivity.js';

const router = express.Router();
const cashierRoles = new Set(['CASHIER']);
const directorRoles = new Set(['DIRECTOR']);
const configRoles = new Set(['CASHIER', 'DIRECTOR']);

function requireDiscountRole(roles) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    if (!token) return res.status(401).json({ error: 'Sign in to manage special discounts.' });

    let session;
    try {
      session = readSessionToken(token);
    } catch (error) {
      if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired. Sign in again.' });
      }
      console.error('Discount session verification failed:', error);
      return res.status(500).json({ error: 'Could not verify staff access.' });
    }
    if (session.scope !== 'restaurant' || !Number.isInteger(Number(session.id))) {
      return res.status(401).json({ error: 'A valid restaurant staff session is required.' });
    }

    try {
      const result = await pool.query(
        'SELECT id, name, role, is_active FROM public.staff WHERE id = $1',
        [Number(session.id)]
      );
      const actor = result.rows[0];
      if (!actor || actor.is_active === false || actor.role !== session.role) {
        return res.status(401).json({ error: 'Staff account is inactive or has changed.' });
      }
      if (!roles.has(String(actor.role || '').toUpperCase())) {
        return res.status(403).json({ error: 'Your role is not authorized for this discount action.' });
      }
      req.discountActor = actor;
      return next();
    } catch (error) {
      console.error('Discount authorization failed:', error);
      return res.status(500).json({ error: 'Could not verify staff access.' });
    }
  };
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('The cashier queue has invalid order links.');
  return parsed;
}

function parseOrderItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('An order has invalid item data.');
  return parsed;
}

function parseDiscountRequest(body = {}, billBalance) {
  const type = String(body.discount_type || (body.amount !== undefined ? 'fixed' : 'percentage')).toLowerCase();
  const value = Number(body.discount_value ?? body.amount);
  if (!['percentage', 'fixed'].includes(type)) {
    return { error: 'Discount type must be percentage or fixed.' };
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { error: 'Enter a positive special discount value.' };
  }
  if (type === 'percentage' && value > 100) {
    return { error: 'A percentage discount cannot exceed 100 percent.' };
  }
  const amount = roundMoney(type === 'percentage' ? billBalance * value / 100 : value);
  if (amount <= 0 || amount > billBalance) {
    return { error: 'The discount must be positive and cannot exceed the unpaid bill balance.' };
  }
  return { discount_type: type, discount_value: value, amount };
}

async function getDiscountSettings(queryable, lock = false) {
  const result = await queryable.query(
    `SELECT max_discount_type, max_discount_value, max_discount_percent,
            updated_by, updated_by_name, updated_at
     FROM public.special_discount_settings WHERE id = 1${lock ? ' FOR SHARE' : ''}`
  );
  const row = result.rows[0] || {
    max_discount_type: 'percentage',
    max_discount_value: 0,
    max_discount_percent: 0,
  };
  const settings = normalizeSpecialDiscountSettings(row);
  return { ...row, ...settings };
}

router.get('/config', requireDiscountRole(configRoles), async (_req, res) => {
  try {
    return res.json(await getDiscountSettings(pool));
  } catch (error) {
    console.error('Special discount configuration fetch failed:', error);
    return res.status(500).json({ error: 'Unable to load special discount settings.' });
  }
});

router.put('/config', requireDiscountRole(directorRoles), async (req, res) => {
  let settings;
  try {
    settings = normalizeSpecialDiscountSettings({
      max_discount_type: req.body?.max_discount_type
        ?? (req.body?.max_discount_amount !== undefined ? 'fixed' : 'percentage'),
      max_discount_value: req.body?.max_discount_value
        ?? req.body?.max_discount_amount
        ?? req.body?.max_discount_percent,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (settings.max_discount_type === 'percentage' && settings.max_discount_value > 100) {
    return res.status(400).json({ error: 'The maximum discount percentage must not exceed 100.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.special_discount_settings
         (id, max_discount_type, max_discount_value, max_discount_percent, updated_by, updated_by_name, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id) DO UPDATE SET
         max_discount_type = EXCLUDED.max_discount_type,
         max_discount_value = EXCLUDED.max_discount_value,
         max_discount_percent = CASE WHEN EXCLUDED.max_discount_type = 'percentage'
           THEN EXCLUDED.max_discount_value ELSE 0 END,
         updated_by = EXCLUDED.updated_by,
         updated_by_name = EXCLUDED.updated_by_name,
         updated_at = NOW()
       RETURNING max_discount_type, max_discount_value, max_discount_percent, updated_by, updated_by_name, updated_at`,
      [
        settings.max_discount_type,
        settings.max_discount_value,
        settings.max_discount_type === 'percentage' ? settings.max_discount_value : 0,
        req.discountActor.id,
        req.discountActor.name,
      ]
    );
    await logActivity(pool, {
      type: 'SPECIAL_DISCOUNT_LIMIT_UPDATED',
      actor: req.discountActor.name,
      role: req.discountActor.role,
      message: `Special bill discount limit set to ${settings.max_discount_value} ${settings.max_discount_type}`,
      meta: { ...settings, updated_by: req.discountActor.id },
    });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Special discount configuration update failed:', error);
    return res.status(500).json({ error: 'Unable to save special discount settings.' });
  }
});

router.post('/cashier-queue/:id', requireDiscountRole(cashierRoles), async (req, res) => {
  const queueId = Number(req.params.id);
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  if (!Number.isInteger(queueId) || queueId <= 0) {
    return res.status(400).json({ error: 'A valid cashier queue item is required.' });
  }
  if (reason.length < 3) {
    return res.status(400).json({ error: 'A reason of at least 3 characters is required.' });
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cashier-queue:${queueId}`]);
    const queueResult = await client.query(
      'SELECT * FROM public.cashier_queue WHERE id = $1 FOR UPDATE',
      [queueId]
    );
    const queue = queueResult.rows[0];
    if (!queue) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ error: 'Cashier queue item not found.' });
    }
    if (queue.status !== 'Pending' || queue.is_item === true || queue.public_order_ref) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'Only a pending, unpaid, whole restaurant bill can receive a special discount.' });
    }
    if (String(queue.method || '').toUpperCase() === 'CREDIT') {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'Special discounts cannot be applied to credit requests.' });
    }

    const ids = [...new Set(parseJsonArray(queue.order_ids)
      .map(Number).filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
    if (!ids.length) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'This queue item is not linked to an eligible restaurant bill.' });
    }
    for (const orderId of ids) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`order:${orderId}`]);
    }
    const ordersResult = await client.query(
      `SELECT id, total, status, items, special_bill_discount_amount
       FROM public.orders WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
      [ids]
    );
    if (ordersResult.rows.length !== ids.length) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'One or more orders in this bill are no longer available.' });
    }

    const [settings,] = await Promise.all([getDiscountSettings(client, true)]);
    const orders = ordersResult.rows.map((order) => ({
      ...order,
      items: parseOrderItems(order.items),
    }));
    if (orders.some((order) => Number(order.special_bill_discount_amount || 0) > 0)) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'A special bill discount has already been applied to this order.' });
    }
    if (orders.some((order) => ['PAID', 'CLOSED', 'VOIDED'].includes(String(order.status || '').toUpperCase()))) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'Settled or voided orders cannot be discounted.' });
    }

    const balances = orders.map((order) => getDiscountableBillBalance(order.items));
    const billBalance = roundMoney(balances.reduce((sum, value) => sum + value, 0));
    const queueAmount = Number(queue.amount || 0);
    const eligibleBalance = roundMoney(Math.min(queueAmount, billBalance));
    const requested = parseDiscountRequest(req.body || {}, eligibleBalance);
    if (requested.error) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(400).json({ error: requested.error });
    }
    const allowed = roundMoney(Math.min(
      getSpecialDiscountLimit(orders.flatMap((order) => order.items), settings),
      eligibleBalance
    ));
    if (requested.amount > allowed) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(400).json({
        error: `Discount exceeds the authorized limit. Maximum for this bill: UGX ${allowed.toLocaleString()}.`,
        maximum_discount: allowed,
        max_discount_type: settings.max_discount_type,
        max_discount_value: settings.max_discount_value,
        max_discount_percent: settings.max_discount_percent,
      });
    }

    const allocations = splitDiscountAmount(requested.amount, balances);
    let unpaidBalanceAfter = 0;
    for (let index = 0; index < orders.length; index += 1) {
      const order = orders[index];
      const allocation = allocations[index];
      if (!allocation) continue;
      const originalBillAmount = roundMoney(Number(order.total || 0));
      const discounted = applySpecialBillDiscount(order.items, allocation, requested);
      const finalPayableAmount = roundMoney(Math.max(0, originalBillAmount - allocation));
      await client.query(
        `UPDATE public.orders
         SET items = $1::jsonb,
             total = $2,
             special_bill_discount_amount = COALESCE(special_bill_discount_amount, 0) + $3,
             updated_at = NOW()
         WHERE id = $4`,
        [JSON.stringify(discounted.items), finalPayableAmount, allocation, order.id]
      );
      await client.query(
        `INSERT INTO public.special_bill_discount_audit
           (order_id, queue_id, discount_type, discount_value, original_bill_amount,
            discount_amount, final_payable_amount, reason, applied_by, applied_by_name,
            max_discount_type, max_discount_value, config_updated_by, config_updated_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          order.id, queueId, requested.discount_type, requested.discount_value,
          originalBillAmount, allocation, finalPayableAmount, reason,
          req.discountActor.id, req.discountActor.name,
          settings.max_discount_type, settings.max_discount_value,
          settings.updated_by, settings.updated_by_name,
        ]
      );
      unpaidBalanceAfter = roundMoney(unpaidBalanceAfter + discounted.balanceAfter);
    }

    const amountDue = roundMoney(queueAmount - requested.amount);
    if (amountDue <= 0) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(400).json({ error: 'The discount must leave a payable balance above zero.' });
    }
    const queueUpdate = await client.query(
      `UPDATE public.cashier_queue SET amount = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'Pending' RETURNING id`,
      [amountDue, queueId]
    );
    if (!queueUpdate.rows.length) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'The cashier payment is no longer pending.' });
    }
    await client.query('COMMIT');
    transactionOpen = false;

    await logActivity(pool, {
      type: 'SPECIAL_BILL_DISCOUNT_APPLIED',
      actor: req.discountActor.name,
      role: req.discountActor.role,
      message: `Special bill discount of UGX ${requested.amount.toLocaleString()} applied to queue #${queueId}`,
      meta: {
        queue_id: queueId,
        order_ids: ids,
        discount_type: requested.discount_type,
        discount_value: requested.discount_value,
        discount_amount: requested.amount,
        reason,
        configured_limit: settings,
      },
    });
    return res.json({
      success: true,
      queue_id: queueId,
      order_ids: ids,
      discount_type: requested.discount_type,
      discount_value: requested.discount_value,
      discount_amount: requested.amount,
      amount_due: amountDue,
      max_discount_type: settings.max_discount_type,
      max_discount_value: settings.max_discount_value,
      max_discount_percent: settings.max_discount_percent,
      unpaid_balance_after: unpaidBalanceAfter,
    });
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Special discount transaction rollback failed:', rollbackError);
      }
    }
    console.error('Special bill discount failed:', error);
    return res.status(500).json({ error: 'Could not apply the special bill discount.' });
  } finally {
    client.release();
  }
});

export { requireDiscountRole };
export default router;
