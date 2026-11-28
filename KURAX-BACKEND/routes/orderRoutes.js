// routes/orderRoutes.js
import express from 'express';
import pool from '../db.js';
import {
  consumeSoldOrderItems,
  getPreparedVoidQuantity,
  getUnpreparedQuantityRatio,
  reverseConsumedOrderItem,
} from '../helpers/recipeConsumption.js';
import { updateDailySummary } from '../helpers/summaryHelper.js';
import { buildOpenShiftOrderClause } from '../helpers/shiftVisibility.js';
import { buildSalesRevenueBreakdown, createSalesJournalEntry } from '../helpers/accounting.js';
import { createJournalEntry } from '../helpers/accounting.js';
import notificationService from '../helpers/notificationService.js';
import { buildStationOrderNotifications } from '../helpers/stationOrderNotifications.js';
import {
  applyComplimentaryTerms,
  getOrderItemOriginalAmount,
  getOrderItemPaidAmount,
  getOrderItemPayableAmount,
  getOrderItemUnitCount,
  getOrderItemUnitPayableAmount,
  getOrderItemUnitStates,
  getOrderItemWaivedAmount,
  getOrderPayableTotal,
} from '../helpers/complimentaryItems.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import logActivity from '../utils/logsActivity.js';
import { getOrderItemsTotal, snapshotMenuPromotions } from '../helpers/menuPromotions.js';
import { snapshotDrinkServing } from '../helpers/drinkServing.js';
import { getMenuInventoryMatchFields } from '../helpers/menuInventoryMatch.js';
import { getLiveBusinessDate } from '../helpers/businessDateFormat.js';

const router = express.Router();

export async function initComplimentaryTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.complimentary_correction_requests (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      order_item_index INTEGER NOT NULL CHECK (order_item_index >= 0),
      requested_complimentary BOOLEAN NOT NULL,
      requested_waived_amount NUMERIC(12,2) NOT NULL CHECK (requested_waived_amount >= 0),
      reason TEXT,
      previous_item JSONB NOT NULL,
      requested_by INTEGER NOT NULL REFERENCES public.staff(id),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
      reviewed_by INTEGER REFERENCES public.staff(id),
      reviewed_at TIMESTAMPTZ,
      review_note TEXT,
      applied_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS complimentary_correction_one_pending_idx
      ON public.complimentary_correction_requests (order_id, order_item_index)
      WHERE status = 'Pending';
    CREATE INDEX IF NOT EXISTS complimentary_correction_status_date_idx
      ON public.complimentary_correction_requests (status, requested_at DESC);
  `);
}

async function authenticateComplimentaryStaff(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: 'Sign in to update complimentary items.' });

  let session;
  try {
    session = readSessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
  if (session.scope !== 'restaurant' || !session.id) {
    return res.status(401).json({ error: 'Invalid staff session.' });
  }

  const result = await pool.query(
    'SELECT id, name, role, is_active FROM public.staff WHERE id = $1',
    [session.id]
  );
  const actor = result.rows[0];
  if (!actor || actor.is_active === false
    || String(actor.role || '').toUpperCase() !== String(session.role || '').toUpperCase()) {
    return res.status(401).json({ error: 'Staff account is inactive or has changed.' });
  }
  req.complimentaryActor = actor;
  return next();
}

function parseOrderItems(value) {
  const items = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  return Array.isArray(items) ? items : [];
}

function isPostedOrder(order, item) {
  return item._rowPaid === true
    || item._approvedCreditSale === true
    || item.creditApproved === true
    || ['Paid', 'Closed'].includes(String(order.status || ''))
    || order.shift_cleared === true
    || order.day_cleared === true;
}

function canEditComplimentaryOrder(actor, order) {
  const role = String(actor.role || '').toUpperCase();
  return ['MANAGER', 'SUPERVISOR'].includes(role)
    || (role === 'WAITER' && Number(order.staff_id) === Number(actor.id));
}

// ── Kampala date helper ───────────────────────────────────────────────────────
function kampalaDate() {
  return getLiveBusinessDate();
}

function isHistoricalBusinessDate(date) {
  return Boolean(date) && date < kampalaDate();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders - Fetch all orders with parsed items
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const staffId = req.query.staff_id;
    const orderDate = req.query.date;
    if (staffId !== undefined && (!/^\d+$/.test(String(staffId)) || Number(staffId) <= 0)) {
      return res.status(400).json({ error: 'staff_id must be a positive integer.' });
    }
    if (orderDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(orderDate))) {
      return res.status(400).json({ error: 'date must use YYYY-MM-DD format.' });
    }

    const filters = [];
    const values = [];
    if (staffId !== undefined) {
      values.push(Number(staffId));
      filters.push(`o.staff_id = $${values.length}`);
    }
    if (orderDate !== undefined) {
      values.push(orderDate);
      filters.push(`COALESCE(o.business_date, DATE(COALESCE(o.created_at, o.timestamp) AT TIME ZONE 'Africa/Kampala')) = $${values.length}::date`);
    }
    const includeUnsentOrders = staffId === undefined && orderDate === undefined;
    if (includeUnsentOrders) {
      filters.push(`(
        COALESCE(o.sent_to_cashier, false) = false
        OR EXISTS (
          SELECT 1
          FROM public.credits c
          WHERE c.order_id = o.id
            AND c.status <> 'FullySettled'
        )
        OR LOWER(COALESCE(o.status, '')) NOT IN ('paid', 'closed', 'voided', 'cancelled', 'served')
        OR o.id IN (
          SELECT id
          FROM public.orders
          WHERE COALESCE(sent_to_cashier, false) = true
          ORDER BY id DESC
          LIMIT 200
        )
      )`);
    }
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const limitClause = !includeUnsentOrders && (staffId === undefined || orderDate === undefined) ? 'LIMIT 200' : '';
    const result = await pool.query(
            `SELECT o.*, s.name as staff_name, s.role as staff_role_name,
              (SELECT status FROM kitchen_tickets WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS kitchen_ticket_status,
              (SELECT status FROM barman_tickets WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS barman_ticket_status,
              (SELECT status FROM barista_tickets WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS barista_ticket_status
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       ${whereClause}
       ORDER BY o.id DESC 
       ${limitClause}`,
      values
    );

    const productionResult = result.rows.length
      ? await pool.query(
        `SELECT order_id, item_index, station, status, staff_id, staff_name,
                claimed_at, started_at, completed_at, ready_at,
                notification_status, notified_at
         FROM public.restaurant_production_work
         WHERE order_id = ANY($1::integer[]) AND station IN ('kitchen', 'bar', 'barista')`,
        [result.rows.map(order => order.id)]
      )
      : { rows: [] };
    const productionByItem = new Map(
      productionResult.rows.map(work => [`${work.order_id}:${work.item_index}`, work])
    );
    
    const parsedOrders = result.rows.map(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          console.error(`Failed to parse items for order ${order.id}:`, e);
          items = [];
        }
      }
      const parsedItems = Array.isArray(items) ? items.map((item, index) => {
        const station = String(item.station || '').trim().toLowerCase();
        const work = productionByItem.get(`${order.id}:${index}`);
        const ticketStatus = station === 'barista'
          ? order.barista_ticket_status
          : ['barman', 'bar'].includes(station)
            ? order.barman_ticket_status
            : order.kitchen_ticket_status;
        const workIsTerminal = ['Cancelled', 'Voided'].includes(work?.status);
        const itemReady = work?.status === 'Completed'
          || (ticketStatus === 'Ready' && !workIsTerminal);
        return {
          ...item,
          _orderItemIndex: index,
          served: item.served === true || order.status === 'Served',
          production_status: itemReady ? 'Completed' : work?.status || null,
          production_staff_id: work?.staff_id || null,
          production_staff_name: work?.staff_name || null,
          production_claimed_at: work?.claimed_at || null,
          production_started_at: work?.started_at || null,
          production_completed_at: work?.completed_at || null,
          production_ready_at: work?.ready_at || null,
          production_notification_status: work?.notification_status || null,
          production_notified_at: work?.notified_at || null,
          readyForService: itemReady,
        };
      }) : [];
      return { ...order, items: parsedItems };
    });
    
    res.json(parsedOrders);
  } catch (err) {
    console.error('Fetch orders error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/cashier-queue - Fetch orders pending cashier confirmation
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cashier-queue', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         o.id, 
         o.table_name, 
         o.total, 
         o.status, 
         o.items, 
         o.payment_method,
         o.created_at,
         s.name AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled')
         AND COALESCE(o.shift_cleared, false) = FALSE
         AND COALESCE(o.day_cleared, false) = FALSE
         AND (o.payment_method IS NULL OR o.payment_method = '')
       ORDER BY o.created_at DESC`
    );
    
    const parsedOrders = result.rows.map(order => {
      let items = order.items;
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      return { ...order, items };
    });
    
    res.json(parsedOrders);
  } catch (err) {
    console.error('Queue Fetch Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/tables/all - Fetch all tables with active orders
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tables/all', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH active_orders AS (
        SELECT
          o.table_name,
          jsonb_agg(item ORDER BY o.id ASC) AS active_items,
          SUM(o.total)                       AS current_total,
          MIN(o.created_at)                  AS order_start,
          MAX(o.id)                          AS latest_order_id,
          MAX(o.staff_id)                    AS staff_id
        FROM orders o,
             jsonb_array_elements(
               CASE
                 WHEN jsonb_typeof(o.items::jsonb) = 'array' THEN o.items::jsonb
                 ELSE '[]'::jsonb
               END
             ) AS item
        WHERE o.status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled')
          AND o.table_name IS NOT NULL
          AND o.table_name != 'WALK-IN'
          AND COALESCE(o.shift_cleared, false) = FALSE
          AND COALESCE(o.day_cleared, false) = FALSE
          AND (o.payment_method IS NULL OR o.payment_method = '')
        GROUP BY o.table_name
      )
      SELECT
        t.id,
        t.name,
        t.status,
        t.last_order_id,
        COALESCE(ao.current_total, 0)  AS current_total,
        ao.order_start,
        ao.active_items,
        ao.latest_order_id,
        s.name                          AS waiter_name
      FROM tables t
      LEFT JOIN active_orders ao ON UPPER(ao.table_name) = UPPER(t.name)
      LEFT JOIN staff s ON ao.staff_id = s.id
      ORDER BY t.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch tables error:', err.message);
    res.status(500).json({ error: 'Could not retrieve table list' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/cashier-history - Fetch cashier confirmation history
// ─────────────────────────────────────────────────────────────────────────────
router.get('/cashier-history', async (req, res) => {
  const businessDate = String(req.query.date || kampalaDate());
  const parsedBusinessDate = new Date(`${businessDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)
    || !Number.isFinite(parsedBusinessDate.getTime())
    || parsedBusinessDate.toISOString().slice(0, 10) !== businessDate) {
    return res.status(400).json({ error: 'A valid business date is required.' });
  }
  try {
    const result = await pool.query(
      `SELECT
         cq.*,
         cq.credit_name    AS client_name,
         cq.credit_phone   AS client_phone,
         cq.credit_pay_by  AS pay_by
       FROM cashier_queue cq
       WHERE cq.status IN ('Confirmed', 'Rejected')
         AND COALESCE(cq.business_date, (COALESCE(cq.confirmed_at, cq.created_at) AT TIME ZONE 'Africa/Kampala')::date) = $1::date
         AND cq.shift_cleared = FALSE
       ORDER BY cq.confirmed_at DESC NULLS LAST
       LIMIT 500`,
      [businessDate]
    );
    
    const parsedHistory = result.rows.map(history => {
      let item = history.item;
      if (item && typeof item === 'string') {
        try {
          item = JSON.parse(item);
        } catch (e) {
          item = null;
        }
      }
      return { ...history, item };
    });
    
    res.json(parsedHistory);
  } catch (err) {
    console.error('cashier-history failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/credits - Fetch all credits
// ─────────────────────────────────────────────────────────────────────────────
router.get('/credits', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM credits ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Credits fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/void-requests - Fetch pending void requests for accountant
// ─────────────────────────────────────────────────────────────────────────────
router.get('/void-requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, 
              o.table_name, 
              o.staff_name as waiter_name,
              o.items
       FROM void_requests vr
       LEFT JOIN orders o ON vr.order_id = o.id
       WHERE vr.status = 'Pending'
       ORDER BY vr.created_at DESC`
    );
    
    const parsedRequests = result.rows.map(req => {
      let items = req.items;
      if (items && typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (e) {
          items = [];
        }
      }
      
      return { 
        ...req, 
        items,
        chef_name: req.chef_name || 'Not assigned'
      };
    });
    
    res.json(parsedRequests);
  } catch (err) {
    console.error('Fetch void requests error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/void-requests/history - Fetch resolved voids for today
// ─────────────────────────────────────────────────────────────────────────────
router.get('/void-requests/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vr.*, 
              o.table_name, 
              o.staff_name as waiter_name
       FROM void_requests vr
       LEFT JOIN orders o ON vr.order_id = o.id
       WHERE DATE(vr.created_at AT TIME ZONE 'Africa/Nairobi') = CURRENT_DATE
         AND vr.status IN ('Approved', 'Rejected', 'Expired')
       ORDER BY vr.resolved_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch void history error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders - Create new order (FIXED: No default payment_method)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { staffId, staffRole, tableName, items, total, sendToStations = false } = req.body;

  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    if (!token) return res.status(401).json({ error: 'Sign in before placing an order.' });
    let session;
    try {
      session = readSessionToken(token);
    } catch {
      return res.status(401).json({ error: 'Session expired. Sign in again.' });
    }
    if (session.scope !== 'restaurant' || Number(session.id) !== Number(staffId)) {
      return res.status(403).json({ error: 'Your staff session does not match this order.' });
    }
    const staffResult = await pool.query(
      `SELECT id, name, role, is_active, is_permitted
       FROM public.staff WHERE id = $1`,
      [Number(session.id)]
    );
    const actor = staffResult.rows[0];
    if (!actor || actor.is_active === false || actor.role !== session.role) {
      return res.status(401).json({ error: 'Staff account is inactive or has changed.' });
    }
    const actorRole = String(actor.role || '').toUpperCase();
    if (!['WAITER', 'MANAGER', 'SUPERVISOR'].includes(actorRole)
        || String(staffRole || '').toUpperCase() !== actorRole) {
      return res.status(403).json({ error: 'Your account is not permitted to place orders.' });
    }
    if (['MANAGER', 'SUPERVISOR'].includes(actorRole) && actor.is_permitted !== true) {
      return res.status(403).json({ error: 'The Director must grant you permission before you can take orders.' });
    }

    const submittedItems = Array.isArray(items)
      ? items.map((item) => (
        item && typeof item === 'object' && !Array.isArray(item)
          ? { ...item, station_routing_requested: sendToStations === true }
          : item
      ))
      : items;
    const itemNames = Array.isArray(submittedItems)
      ? submittedItems.map((item) => String(item?.name || '').trim().toLowerCase()).filter(Boolean)
      : [];
    const itemIds = Array.isArray(submittedItems)
      ? submittedItems.map((item) => Number(item?.id)).filter((value) => Number.isInteger(value) && value > 0)
      : [];
    const catalogResult = itemNames.length || itemIds.length
      ? await pool.query(
        `SELECT menus.id, menus.name, menus.price, menus.category, menus.station, menus.promotion_enabled, menus.promotion_discount_type,
                promotion_discount_value, promotion_discount_percent,
                promotion_starts_at, promotion_ends_at, menus.bottle_volume_ml, menus.inventory_item_id
         FROM public.menus AS menus
         WHERE menus.id = ANY($1::int[]) OR LOWER(TRIM(menus.name)) = ANY($2::text[])`,
        [itemIds, itemNames]
      )
      : { rows: [] };
    const inventoryResult = catalogResult.rows.length
      ? await pool.query(
        `SELECT id, item_name, current_quantity, is_active
         FROM public.inventory_items
         WHERE is_active IS TRUE`
      )
      : { rows: [] };
    const catalogItems = catalogResult.rows.map((menu) => ({
      ...menu,
      ...getMenuInventoryMatchFields(menu, inventoryResult.rows),
    }));
    const promotedItems = snapshotMenuPromotions(submittedItems, catalogItems);
    const orderItems = promotedItems.map((item) => {
      const catalogItem = catalogItems.find((menu) => (
        (item?.id != null && Number(menu.id) === Number(item.id))
        || (item?.name && String(menu.name).trim().toLowerCase() === String(item.name).trim().toLowerCase())
      ));
      return snapshotDrinkServing(item, catalogItem);
    });
    const invalidServing = orderItems.find((item) => item?._invalidDrinkServing);
    if (invalidServing) {
      return res.status(400).json({ error: invalidServing._invalidDrinkServing });
    }
    const serverTotal = Array.isArray(orderItems) ? getOrderItemsTotal(orderItems) : Number(total);

    // CRITICAL FIX: Do NOT set payment_method by default
    // Payment method should be NULL until cashier confirms payment
    const orderResult = await pool.query(
      `INSERT INTO orders (
         staff_id, staff_role, table_name,
         items, total, payment_method, status, date, created_at, business_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, NOW(), $8::date)
       RETURNING *`,
      [
        actor.id,
        actorRole,
        tableName     || 'WALK-IN',
        JSON.stringify(orderItems),
        Number.isFinite(serverTotal) && serverTotal >= 0 ? serverTotal : total,
        null,  // ← FIXED: No default payment method
        'Pending',   // ← FIXED: Status is Pending, not Served
        req.businessDate,
      ]
    );

    const newOrder = orderResult.rows[0];
    
    let parsedItems = newOrder.items;
    if (typeof parsedItems === 'string') {
      parsedItems = JSON.parse(parsedItems);
    }

    if (tableName && tableName !== 'WALK-IN' && !isHistoricalBusinessDate(req.businessDate)) {
      await pool.query(
        `INSERT INTO tables (name, status, last_order_id, updated_at)
         VALUES ($1, 'Occupied', $2, NOW())
         ON CONFLICT (name)
         DO UPDATE SET
           status     = 'Occupied',
           updated_at = NOW()`,
        [tableName.toUpperCase(), newOrder.id]
      );
    }

    await logActivity(pool, {
      type:    'ORDER_CREATED',
      actor:   `Staff ID: ${staffId}`,
      role:    staffRole,
      message: `New order created for ${tableName}`,
      meta:    { order_id: newOrder.id, total: newOrder.total },
    });

    if (sendToStations === true) {
      for (const notification of buildStationOrderNotifications(newOrder.id, parsedItems)) {
        void notificationService.sendToRoles(notification.roles, notification.event)
          .catch((error) => {
            console.error(`Could not send ${notification.station} order notification:`, error.message);
          });
      }
    }

    res.status(201).json({
      ...newOrder,
      items: parsedItems
    });
  } catch (err) {
    console.error('POST Order Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders/void-item - Waiter requests to void an item (FIXED)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/void-item', async (req, res) => {
  const { order_id, item_name, item_index, unit_index, reason, requested_by } = req.body;
  const itemIndex = item_index != null && Number.isInteger(Number(item_index)) ? Number(item_index) : null;
  const unitIndex = unit_index != null && Number.isInteger(Number(unit_index)) ? Number(unit_index) : null;

  console.log("Received void request:", { order_id, item_name, reason, requested_by });

  if (!order_id || !item_name || !reason) {
    console.log("Missing required fields");
    return res.status(400).json({ error: 'order_id, item_name, and reason are required' });
  }

  let client;
  let transactionOpen = false;
  let clientReleased = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    // Get order details
    const orderRes = await client.query(
      `SELECT o.table_name, o.staff_id, o.items, o.total, COALESCE(s.name, $2) AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.id = $1
       FOR UPDATE OF o`,
      [order_id, requested_by || 'Unknown']
    );

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      console.log("Order not found:", order_id);
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRes.rows[0];
    const tableName = order.table_name;
    const waiterName = order.waiter_name;
    
    let items = [];
    try {
      items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
    } catch (e) {
      console.error("Error parsing items:", e);
      items = [];
    }
    
    const targetItemIndex = itemIndex !== null
      ? (items[itemIndex]?.name === item_name
        && !items[itemIndex].voidRequested && !items[itemIndex].voidProcessed
        ? itemIndex
        : -1)
      : items.findIndex(item => item.name === item_name
        && !item.voidRequested && !item.voidProcessed
        && (unitIndex === null || (
          getOrderItemUnitCount(item) > 1
          && !getOrderItemUnitStates(item)[unitIndex]?.paid
          && !getOrderItemUnitStates(item)[unitIndex]?.paymentRequested
          && !getOrderItemUnitStates(item)[unitIndex]?.creditRequested
          && !getOrderItemUnitStates(item)[unitIndex]?.voidRequested
          && !getOrderItemUnitStates(item)[unitIndex]?.voidProcessed
        )));
    const targetItem = targetItemIndex >= 0 ? items[targetItemIndex] : null;
    
    if (!targetItem) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      console.log("Item not found or already voided:", item_name);
      return res.status(404).json({ error: 'Item not found or already voided' });
    }
    if (unitIndex === null && getOrderItemUnitCount(targetItem) > 1) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'Select the specific unit to void from this quantity item.' });
    }
    if (unitIndex !== null) {
      const state = getOrderItemUnitStates(targetItem)[unitIndex];
      if (getOrderItemUnitCount(targetItem) < 2 || !state
        || state.paid === true || state.paymentRequested === true
        || state.creditRequested === true
        || targetItem._rowPaid === true || Boolean(targetItem.paid_at)
        || targetItem.creditRequested === true
        || String(targetItem.payment_method || '').toUpperCase().includes('CREDIT')
        || state.voidRequested === true || state.voidProcessed === true) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(409).json({ error: 'The selected item unit is no longer available to void.' });
      }
    }
    
    // FIND THE ASSIGNED CHEF FROM KITCHEN_TICKETS
    let chefName = null;
    
    try {
      const productionResult = await pool.query(
        `SELECT COALESCE(staff.name, work.staff_name) AS staff_name
         FROM public.restaurant_production_work work
         LEFT JOIN public.staff staff ON staff.id=work.staff_id
         WHERE work.order_id=$1 AND work.item_index=$2 AND work.staff_id IS NOT NULL
         ORDER BY work.claimed_at DESC
         LIMIT 1`,
        [order_id, targetItemIndex]
      );
      chefName = productionResult.rows[0]?.staff_name || null;
    } catch (err) {
      console.error('Error checking production ownership:', err.message);
    }

    if (!chefName) {
      try {
        const kitchenResult = await pool.query(
          `SELECT staff_name, staff_role, items
           FROM kitchen_tickets
           WHERE order_id = $1
             AND cleared_by_kitchen = false
           ORDER BY created_at DESC
           LIMIT 1`,
          [order_id]
        );

        if (kitchenResult.rows.length > 0) {
          const kitchenTicket = kitchenResult.rows[0];
          let kitchenItems = kitchenTicket.items;
          if (typeof kitchenItems === 'string') {
            try {
              kitchenItems = JSON.parse(kitchenItems);
            } catch {
              kitchenItems = [];
            }
          }

          if (Array.isArray(kitchenItems)) {
            const foundItem = kitchenItems.find(kItem =>
              kItem.name === item_name || kItem.item_name === item_name
            );
            if (foundItem) {
              chefName = foundItem.assignedTo || foundItem.assigned_to || foundItem.chef_name || null;
            }
          }
        }
      } catch (err) {
        console.error('Error checking kitchen tickets:', err.message);
      }
    }
    
    if (!chefName && targetItem.assignedChef) {
      chefName = targetItem.assignedChef;
      console.log(`Found chef from order item: ${chefName}`);
    }
    
    if (!chefName && targetItem.assignedTo) {
      chefName = targetItem.assignedTo;
      console.log(`Found chef from target item assignedTo: ${chefName}`);
    }
    
    const unitCount = getOrderItemUnitCount(targetItem);
    const originalPrice = unitIndex === null
      ? Number(targetItem.price || 0)
      : getOrderItemOriginalAmount(targetItem) / unitCount;
    const originalQuantity = unitIndex === null ? Number(targetItem.quantity || 1) : 1;
    const itemTotal = unitIndex === null
      ? getOrderItemPayableAmount(targetItem)
      : getOrderItemUnitPayableAmount(targetItem, unitIndex);
    const requestItemName = unitIndex === null
      ? item_name
      : `${item_name} · Unit ${unitIndex + 1}`;

    console.log("Inserting void request with:", {
      order_id, item_name, reason, requested_by, tableName, waiterName,
      originalPrice, originalQuantity, itemTotal, chefName
    });

    const voidRes = await client.query(
      `INSERT INTO void_requests
         (order_id, item_name, reason, requested_by,
          table_name, waiter_name, status, created_at,
          original_price, original_quantity, chef_name)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', NOW(), 
               $7, $8, $9)
       RETURNING *`,
      [order_id, requestItemName, reason, requested_by, tableName, waiterName,
       originalPrice, originalQuantity, chefName]
    );

    console.log("Void request inserted, ID:", voidRes.rows[0].id);

    const updatedItems = items.map((item, index) => {
      if (index !== targetItemIndex) return item;
      if (unitIndex !== null) {
        const unitStates = getOrderItemUnitStates(item);
        unitStates[unitIndex] = {
          ...unitStates[unitIndex],
          voidRequested: true,
          voidRequestId: Number(voidRes.rows[0].id),
          voidReason: reason,
          voidRequestedBy: requested_by,
          voidRequestedAt: new Date().toISOString(),
        };
        return { ...item, unitStates };
      }
      return {
        ...item,
        voidRequested: true,
        voidRequestId: Number(voidRes.rows[0].id),
        voidReason: reason,
        voidRequestedBy: requested_by,
        voidRequestedAt: new Date().toISOString(),
        original_price: originalPrice,
        price: originalPrice,
        chefName,
      };
    });

    await client.query(
      `UPDATE orders SET items = $1 WHERE id = $2`,
      [JSON.stringify(updatedItems), order_id]
    );
    await client.query('COMMIT');
    transactionOpen = false;
    client.release();
    clientReleased = true;

    await logActivity(pool, {
      type: 'VOID_REQUESTED',
      actor: requested_by,
      role: 'WAITER',
      message: `Void requested: ${item_name} (UGX ${itemTotal.toLocaleString()}) from Order #${order_id}${chefName ? ` - Chef: ${chefName}` : ' - No chef assigned'}`,
      meta: { reason, order_id, table: tableName, amount: itemTotal, chef_name: chefName }
    });

    const accountantNotification = await notificationService.sendToRoles(['ACCOUNTANT'], {
      type: 'VOID_REQUEST_PENDING',
      title: 'Item void request needs review',
      body: `${item_name} at ${tableName} was submitted for void approval (UGX ${itemTotal.toLocaleString()}).`,
      referenceId: voidRes.rows[0].id,
      referenceType: 'void_request',
      link: '/accountant',
    });
    console.log(
      `[VOID REQUEST NOTIFICATION] Request ID: ${voidRes.rows[0].id}; ` +
      `accountant notifications sent: ${accountantNotification.sent || 0}, ` +
      `failed: ${accountantNotification.failed || 0}` +
      `${accountantNotification.noRecipients ? ', no registered Accountant devices' : ''}`
    );

    res.status(201).json({ 
      success: true, 
      void_request: voidRes.rows[0],
      message: `Void request for ${item_name} sent to accountant`
    });
  } catch (err) {
    if (client && transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Void request rollback failed:', rollbackError.message);
      }
    }
    console.error('Void Request Error:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    if (client && !clientReleased) client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/status - Update order status (FIXED: No revenue impact)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, staff_name, role, void_reason } = req.body;

  const allowed = ['Pending', 'Preparing', 'Ready', 'Delayed', 'Served', 'Closed', 'Voided'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }

  try {
    // Get current order to check if it's already paid or credit
    const currentOrder = await pool.query(
      `SELECT payment_method, status FROM orders WHERE id = $1`,
      [id]
    );
    
    if (currentOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = currentOrder.rows[0];
    
    // CRITICAL FIX: Prevent changing status of paid or credit orders to Served
    if ((order.payment_method === 'Credit' || order.payment_method === 'Paid') && status === 'Served') {
      return res.status(400).json({ 
        error: `Cannot mark ${order.payment_method === 'Credit' ? 'credit' : 'paid'} order as Served` 
      });
    }
    
    // If marking as Served, ensure payment_method is still NULL
    if (status === 'Served') {
      await pool.query(
        `UPDATE orders SET status = $1, void_reason = $2, updated_at = NOW() WHERE id = $3`,
        [status, void_reason || null, id]
      );
    } else {
      const result = await pool.query(
        `UPDATE orders SET status = $1, void_reason = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [status, void_reason || null, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const updatedOrder = result.rows[0];
      
      let items = updatedOrder.items;
      if (typeof items === 'string') {
        items = JSON.parse(items);
      }

      await logActivity(pool, {
        type:    status === 'Voided' ? 'ORDER_VOIDED' : 'STATUS_UPDATE',
        actor:   staff_name || 'System',
        role:    role || 'STAFF',
        message: status === 'Voided'
          ? `Order #${id} was VOIDED. Reason: ${void_reason}`
          : `Order #${id} (${updatedOrder.table_name}) is now ${status}`,
        meta:    { status, order_id: id, reason: void_reason },
      });

      return res.json({
        ...updatedOrder,
        items: items
      });
    }
    
    res.json({ success: true, status });
  } catch (err) {
    console.error('Update Status Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/items/:itemIndex/serve', async (req, res) => {
  const orderId = Number(req.params.id);
  const itemIndex = Number(req.params.itemIndex);
  if (!Number.isInteger(orderId) || !Number.isInteger(itemIndex) || itemIndex < 0) {
    return res.status(400).json({ error: 'A valid order and item index are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      'SELECT id, items, status FROM orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (!orderResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderResult.rows[0];
    const items = Array.isArray(order.items) ? order.items : [];
    const item = items[itemIndex];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found.' });
    }
    if (item.status === 'VOIDED' || item.voidProcessed) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Voided items cannot be served.' });
    }
    if (item.status === 'Paid' || item._rowPaid === true) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Paid items cannot be served.' });
    }
    if (item.served === true) {
      await client.query('ROLLBACK');
      return res.json({ success: true, served: true });
    }

    const station = String(item.station || '').trim().toLowerCase();
    const ticketTable = station === 'barista'
      ? 'barista_tickets'
      : ['barman', 'bar'].includes(station)
        ? 'barman_tickets'
        : 'kitchen_tickets';
    const ticketResult = await client.query(
      `SELECT status, items FROM ${ticketTable} WHERE order_id = $1 ORDER BY id DESC LIMIT 1`,
      [orderId]
    );
    const ticket = ticketResult.rows[0];
    let ticketItems = ticket?.items;
    if (typeof ticketItems === 'string') {
      try { ticketItems = JSON.parse(ticketItems); } catch { ticketItems = []; }
    }
    const itemIsOnTicket = Array.isArray(ticketItems) && ticketItems.some(ticketItem =>
      String(ticketItem.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase()
    );
    if (!ticket || ticket.status !== 'Ready' || !itemIsOnTicket) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This item is not ready to serve yet.' });
    }

    items[itemIndex] = { ...item, served: true, served_at: new Date().toISOString() };
    const activeItems = items.filter(line => line.status !== 'VOIDED' && !line.voidProcessed);
    const allItemsServed = activeItems.length > 0 && activeItems.every(line =>
      line.served === true || line.status === 'Paid' || line._rowPaid === true
    );
    const nextStatus = allItemsServed ? 'Served' : order.status;
    const updatedResult = await client.query(
      'UPDATE orders SET items = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [JSON.stringify(items), nextStatus, orderId]
    );
    await client.query('COMMIT');
    try {
      const consumption = await consumeSoldOrderItems({
        orderId,
        items: updatedResult.rows[0].items,
        businessDate: req.businessDate,
        createdBy: 'Service',
      });
      for (const entry of consumption.filter((record) => !['CONSUMED', 'CONSUMED_COST_REVIEW', 'ALREADY_CONSUMED'].includes(record.status))) {
        console.warn(`Recipe consumption ${entry.status} for served order #${orderId}: ${entry.order_item}`);
      }
    } catch (error) {
      console.error(`Recipe consumption failed for served order #${orderId}:`, error.message);
    }
    return res.json({ success: true, order: updatedResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Serve order item error:', err.message);
    return res.status(500).json({ error: 'Could not mark item served.' });
  } finally {
    client.release();
  }
});

router.patch('/:id/items/:itemIndex/complimentary', authenticateComplimentaryStaff, async (req, res) => {
  const orderId = Number(req.params.id);
  const itemIndex = Number(req.params.itemIndex);
  const { complimentary, reason = '' } = req.body || {};
  const actor = req.complimentaryActor;
  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(itemIndex) || itemIndex < 0) {
    return res.status(400).json({ error: 'A valid order and item index are required.' });
  }
  if (complimentary !== true) {
    return res.status(400).json({ error: 'Submit a complimentary request for cashier review.' });
  }
  if (typeof reason !== 'string' || reason.length > 500) {
    return res.status(400).json({ error: 'The reason must be 500 characters or fewer.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      'SELECT id, staff_id, table_name, status, total, items, shift_cleared, day_cleared FROM public.orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (!canEditComplimentaryOrder(actor, order)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You may only mark your own waiter orders; Managers and Supervisors may mark any open order.' });
    }

    const items = parseOrderItems(order.items);
    const item = items[itemIndex];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order item not found.' });
    }
    if (item.voidProcessed === true || String(item.status || '').toUpperCase() === 'VOIDED'
      || ['Voided', 'Cancelled'].includes(String(order.status || ''))) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Voided or cancelled items cannot be marked complimentary.' });
    }
    if (item.paymentRequested === true) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This item has a pending cashier payment request. Wait for the cashier to resolve it first.' });
    }

    const requestResult = await client.query(
      `INSERT INTO public.complimentary_correction_requests
         (order_id, order_item_index, requested_complimentary, requested_waived_amount,
          reason, previous_item, requested_by)
       VALUES ($1, $2, TRUE, 0, $3, $4, $5)
       RETURNING id, status, requested_at`,
      [orderId, itemIndex, reason.trim() || null, JSON.stringify(item), actor.id]
    );
    items[itemIndex] = { ...item, complimentaryRequestPending: true };
    await client.query(
      'UPDATE public.orders SET items = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(items), orderId]
    );
    await client.query('COMMIT');
    await logActivity(pool, {
      type: 'ORDER_ITEM_COMPLIMENTARY_REQUESTED',
      actor: actor.name,
      role: actor.role,
      message: `Complimentary requested for ${item.name} on Order #${orderId}`,
      meta: {
        order_id: orderId,
        order_item_index: itemIndex,
        correction_id: requestResult.rows[0].id,
        reason: reason.trim() || null,
      },
    });
    try {
      const notification = await notificationService.sendToRoles(['CASHIER'], {
        type: 'COMPLIMENTARY_REQUEST',
        title: 'New complimentary request',
        body: `${actor.name} requested a comp for ${item.name || 'an item'} at ${order.table_name || 'a table'} (Order #${orderId}).`,
        referenceId: requestResult.rows[0].id,
        referenceType: 'complimentary_correction',
        link: '/cashier',
      });
      if (notification.error || notification.failed || notification.noRecipients) {
        console.warn(`Cashier complimentary notification was not fully delivered for request ${requestResult.rows[0].id}:`, notification);
      }
    } catch (notificationError) {
      console.error(`Cashier complimentary notification failed for request ${requestResult.rows[0].id}:`, notificationError.message);
    }
    return res.status(202).json({
      correctionRequest: requestResult.rows[0],
      message: 'Complimentary request sent to the cashier. The cashier will choose the waived amount.',
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A complimentary request is already awaiting cashier review for this item.' });
    }
    console.error('Update complimentary item error:', error);
    return res.status(500).json({ error: 'Could not update the complimentary item.' });
  } finally {
    client.release();
  }
});

router.get('/complimentary-corrections', authenticateComplimentaryStaff, async (req, res) => {
  const role = String(req.complimentaryActor.role || '').toUpperCase();
  if (!['MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'CASHIER'].includes(role)) {
    return res.status(403).json({ error: 'You are not authorized to review complimentary corrections.' });
  }
  try {
    const result = await pool.query(
      `SELECT correction.*, order_row.table_name, order_row.items,
              staff_row.name AS requester_name
       FROM public.complimentary_correction_requests correction
       JOIN public.orders order_row ON order_row.id = correction.order_id
       LEFT JOIN public.staff staff_row ON staff_row.id = correction.requested_by
       WHERE correction.status = 'Pending'
       ORDER BY correction.requested_at ASC`
    );
    return res.json(result.rows.map((request) => {
      const items = parseOrderItems(request.items);
      return {
        ...request,
        item: items[request.order_item_index] || null,
      };
    }));
  } catch (error) {
    console.error('Fetch complimentary corrections error:', error);
    return res.status(500).json({ error: 'Could not fetch complimentary correction requests.' });
  }
});

router.patch('/complimentary-corrections/:requestId', authenticateComplimentaryStaff, async (req, res) => {
  const actor = req.complimentaryActor;
  const role = String(actor.role || '').toUpperCase();
  if (role !== 'CASHIER') {
    return res.status(403).json({ error: 'Only a cashier can apply or reject complimentary requests.' });
  }
  const requestId = Number(req.params.requestId);
  const decision = String(req.body?.decision || '').toLowerCase();
  const reviewNote = String(req.body?.reviewNote || '').trim();
  if (!Number.isInteger(requestId) || requestId <= 0 || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'A valid correction request and approve/reject decision are required.' });
  }
  if (reviewNote.length > 500) return res.status(400).json({ error: 'The review note must be 500 characters or fewer.' });
  const requestedComplimentary = req.body?.complimentary;
  const requestedWaivedAmount = req.body?.waivedAmount;
  if (decision === 'approve' && (typeof requestedComplimentary !== 'boolean'
    || (requestedComplimentary && requestedWaivedAmount === undefined))) {
    return res.status(400).json({ error: 'Choose whether to apply a comp and enter its waived amount.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query(
      `SELECT correction.*, requester.name AS requester_name
       FROM public.complimentary_correction_requests correction
       LEFT JOIN public.staff requester ON requester.id = correction.requested_by
       WHERE correction.id = $1 FOR UPDATE OF correction`,
      [requestId]
    );
    const correction = requestResult.rows[0];
    if (!correction || correction.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending complimentary correction not found.' });
    }
    const orderResult = await client.query(
      `SELECT id, staff_id, table_name, status, total, items, shift_cleared, day_cleared FROM public.orders WHERE id = $1 FOR UPDATE`,
      [correction.order_id]
    );
    if (!orderResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'The correction order no longer exists.' });
    }
    const order = orderResult.rows[0];
    const items = parseOrderItems(order.items);
    const item = items[correction.order_item_index];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The requested order item has since been removed.' });
    }

    if (decision === 'reject') {
      delete item.complimentaryRequestPending;
      await client.query(
        'UPDATE public.orders SET items = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(items), order.id]
      );
      await client.query(
        `UPDATE public.complimentary_correction_requests
         SET status = 'Rejected', reviewed_by = $1, reviewed_at = NOW(), review_note = $2
         WHERE id = $3`,
        [actor.id, reviewNote || null, requestId]
      );
      await client.query('COMMIT');
      await logActivity(pool, {
        type: 'COMPLIMENTARY_CORRECTION_REJECTED',
        actor: actor.name,
        role: actor.role,
        message: `Complimentary correction #${requestId} rejected`,
        meta: { correction_id: requestId, order_id: correction.order_id, review_note: reviewNote || null },
      });
      return res.json({ success: true, status: 'Rejected' });
    }

    if (item.voidProcessed === true || String(item.status || '').toUpperCase() === 'VOIDED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The requested order item has since been voided or removed.' });
    }
    if (item.paymentRequested === true) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Resolve the pending payment request before applying a comp.' });
    }
    const previousPayable = getOrderItemPayableAmount(item);
    const previousPaid = getOrderItemPaidAmount(item);
    const previousWaiver = getOrderItemWaivedAmount(item);
    const complimentary = requestedComplimentary === undefined
      ? correction.requested_complimentary
      : requestedComplimentary;
    delete item.complimentaryRequestPending;
    let updatedItem;
    try {
      updatedItem = applyComplimentaryTerms(item, {
        complimentary,
        waivedAmount: complimentary ? requestedWaivedAmount : 0,
        actorId: actor.id,
        actorName: actor.name,
        reason: correction.reason || '',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: error.message });
    }
    const paymentAmount = Math.max(0, Math.round(
      (getOrderItemPayableAmount(updatedItem) - previousPaid + Number.EPSILON) * 100
    ) / 100);
    const paymentMethod = String(req.body?.paymentMethod || '');
    const allowedPaymentMethods = ['Cash', 'Card', 'Momo-MTN', 'Momo-Airtel'];
    if (paymentAmount > 0 && !allowedPaymentMethods.includes(paymentMethod)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a valid payment method for the remaining item balance.' });
    }
    if (item._rowPaid === true && item.paidAmount === undefined) {
      updatedItem.paidAmount = previousPaid;
    }
    updatedItem.complimentaryApprovedBy = actor.id;
    updatedItem.complimentaryApprovedByName = actor.name;
    updatedItem.complimentaryApprovedAt = new Date().toISOString();
    const postedOrder = isPostedOrder(order, item);
    const waiverChange = Math.round((updatedItem.complimentaryWaivedAmount - previousWaiver) * 100) / 100;
    const revenueItem = {
      ...item,
      complimentary: false,
      payableAmount: getOrderItemOriginalAmount(item),
    };
    if (postedOrder && waiverChange !== 0) {
      const periodResult = await client.query(
        `SELECT period_name, status FROM public.accounting_periods
         WHERE $1::date BETWEEN start_date AND end_date
         ORDER BY start_date DESC LIMIT 1 FOR SHARE`,
        [kampalaDate()]
      );
      if (!periodResult.rows.length || periodResult.rows[0].status !== 'Open') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: periodResult.rows.length
            ? `${periodResult.rows[0].period_name} is closed. An open accounting period is required for this correction.`
            : 'No accounting period is configured for the correction date.',
        });
      }
    }
    if (postedOrder && waiverChange > 0) {
      const revenueLines = buildSalesRevenueBreakdown([revenueItem], waiverChange);
      const remainingReceivable = Math.max(0, previousPayable - previousPaid);
      const receivableCredit = Math.min(waiverChange, remainingReceivable);
      const liabilityCredit = Math.round((waiverChange - receivableCredit) * 100) / 100;
      const journalLines = revenueLines.map((line) => ({
        accountCode: line.accountCode,
        debit: line.amount,
      }));
      if (receivableCredit > 0) journalLines.push({ accountCode: '1101', credit: receivableCredit });
      if (liabilityCredit > 0) journalLines.push({ accountCode: '2101', credit: liabilityCredit });
      await createJournalEntry({
        queryable: client,
        entryDate: kampalaDate(),
        description: `Approved complimentary correction · Order #${order.id} · ${item.name}`,
        sourceTransaction: `complimentary_correction:${requestId}`,
        reference: `COMP-CORR-${requestId}`,
        postedBy: actor.name,
        lines: journalLines,
      });
    } else if (postedOrder && waiverChange < 0) {
      const amount = Math.abs(waiverChange);
      const revenueLines = buildSalesRevenueBreakdown([revenueItem], amount);
      const previousReceivable = Math.max(0, previousPayable - previousPaid);
      const updatedPayable = getOrderItemPayableAmount(updatedItem);
      const updatedReceivable = Math.max(0, updatedPayable - previousPaid);
      const receivableDebit = Math.round((updatedReceivable - previousReceivable) * 100) / 100;
      const previousCredit = Math.max(0, previousPaid - previousPayable);
      const updatedCredit = Math.max(0, previousPaid - updatedPayable);
      const liabilityDebit = Math.round((previousCredit - updatedCredit) * 100) / 100;
      const journalLines = [
        ...(receivableDebit > 0 ? [{ accountCode: '1101', debit: receivableDebit }] : []),
        ...(liabilityDebit > 0 ? [{ accountCode: '2101', debit: liabilityDebit }] : []),
        ...revenueLines.map((line) => ({
        accountCode: line.accountCode,
        credit: line.amount,
        })),
      ];
      await createJournalEntry({
        queryable: client,
        entryDate: kampalaDate(),
        description: `Approved complimentary correction · Order #${order.id} · ${item.name}`,
        sourceTransaction: `complimentary_correction:${requestId}`,
        reference: `COMP-CORR-${requestId}`,
        postedBy: actor.name,
        lines: journalLines,
      });
    }

    let cashierQueueId = null;
    if (paymentAmount > 0) {
      updatedItem.paymentRequested = true;
      const queueItem = {
        ...updatedItem,
        _orderId: order.id,
        _orderItemIndex: correction.order_item_index,
      };
      const queueResult = await client.query(
        `INSERT INTO public.cashier_queue
           (order_ids, table_name, label, method, amount, is_item, item,
            requested_by, staff_id, status, created_at, business_date)
         VALUES ($1::jsonb, $2, $3, $4, $5, true, $6::jsonb, $7, $8, 'Pending', NOW(), $9::date)
         RETURNING id`,
        [
          JSON.stringify([order.id]),
          order.table_name || 'WALK-IN',
          queueItem.name || 'Order item',
          paymentMethod,
          paymentAmount,
          JSON.stringify(queueItem),
          correction.requester_name || 'Staff',
          order.staff_id || correction.requested_by,
          req.businessDate,
        ]
      );
      cashierQueueId = queueResult.rows[0].id;
    }
    items[correction.order_item_index] = updatedItem;
    await client.query(
      `UPDATE public.orders SET items = $1, total = $2, updated_at = NOW() WHERE id = $3`,
      [JSON.stringify(items), postedOrder ? order.total : getOrderPayableTotal(items), order.id]
    );
    await client.query(
      `UPDATE public.complimentary_correction_requests
       SET status = 'Approved', reviewed_by = $1, reviewed_at = NOW(),
           review_note = $2, applied_at = NOW()
       WHERE id = $3`,
      [actor.id, reviewNote || null, requestId]
    );
    await client.query('COMMIT');
    await logActivity(pool, {
      type: 'ORDER_ITEM_COMPLIMENTARY_APPLIED',
      actor: actor.name,
      role: actor.role,
      message: `Complimentary correction #${requestId} approved for Order #${order.id}`,
      meta: {
        correction_id: requestId,
        order_id: order.id,
        order_item_index: correction.order_item_index,
        previous_waived_amount: previousWaiver,
        approved_waived_amount: updatedItem.complimentaryWaivedAmount,
        review_note: reviewNote || null,
      },
    });
    return res.json({ success: true, status: 'Approved', item: updatedItem, cashier_queue_id: cashierQueueId });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Review complimentary correction error:', error);
    return res.status(500).json({ error: 'Could not review the complimentary correction.' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/:id/pay - Mark order as paid (ONLY THIS AFFECTS REVENUE)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { status = 'Paid', payment_method } = req.body;
 
  if (!payment_method) {
    return res.status(400).json({ error: 'payment_method is required' });
  }
 
  try {
    const currentOrder = await pool.query(
      `SELECT status, payment_method, total, table_name, items FROM orders WHERE id = $1`,
      [id]
    );
 
    if (currentOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
 
    const order = currentOrder.rows[0];
 
    if (order.status === 'Paid') {
      return res.status(400).json({ error: 'Order is already paid' });
    }

    const currentItems = parseOrderItems(order.items);
    if (currentItems.some((item) => item.complimentaryRequestPending === true)) {
      return res.status(409).json({
        error: 'A complimentary request is awaiting cashier review. Resolve it before marking this order paid.',
      });
    }
    const hasCollectibleItems = currentItems.some((item) => (
      item.status !== 'VOIDED'
      && item.voidProcessed !== true
      && item._rowPaid !== true
      && item.creditRequested !== true
      && !String(item.payment_method || '').toUpperCase().includes('CREDIT')
      && getOrderItemPayableAmount(item) > 0
    ));
    if (!hasCollectibleItems) {
      return res.status(409).json({ error: 'No unpaid, non-complimentary balance is available to collect.' });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, 
           payment_method = $2, 
           is_paid = true, 
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 
       RETURNING *`,
      [status, payment_method, id]
    );
 
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
 
    const updatedOrder = result.rows[0];
 
    let items = updatedOrder.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (!Array.isArray(items)) items = [];
 
    // ─── FIX: Only stamp _rowPaid and payment_method on items that are
    //         actually being paid right now. Specifically:
    //
    //         - SKIP items that are already marked as credit
    //           (creditRequested: true or payment_method includes CREDIT).
    //           These items have a separate approval flow and must NOT
    //           receive the cash/momo payment_method stamp. If they do,
    //           the frontend's isCreditItem check breaks because it reads
    //           item.payment_method — and "CASH" overwrites "CREDIT".
    //
    //         - SKIP items that are already voided. They should not be
    //           re-stamped with any payment data.
    //
    //         - SKIP items already paid (_rowPaid: true) to avoid
    //           overwriting their original payment method in split-pay flows.
    //
    //         The old code did `items.map(item => ({ ...item, _rowPaid: true,
    //         payment_method: payment_method }))` which stamped ALL items
    //         unconditionally — this was the root cause of the bug.
    const updatedItems = items.map(item => {
      const isVoided  = item.voidProcessed === true || item.status === 'VOIDED';
      const isCredit  = item.creditRequested === true ||
                        (item.payment_method || '').toUpperCase().includes('CREDIT');
      const alreadyPaid = item._rowPaid === true;
      const payableAmount = getOrderItemPayableAmount(item);
 
      // Leave credit, voided, and already-paid items completely untouched
      if (isVoided || isCredit || alreadyPaid || payableAmount <= 0) {
        return item;
      }
 
      // Only stamp cash/momo/card items that are currently unpaid
      return {
        ...item,
        _rowPaid: true,
        paidAmount: payableAmount,
        payment_method: payment_method,
        paid_at: new Date().toISOString(),
      };
    });

    const newlyPaidItems = updatedItems.filter((item, index) =>
      item._rowPaid === true
      && items[index]?._rowPaid !== true
      && item.creditRequested !== true
      && !String(item.payment_method || '').toUpperCase().includes('CREDIT')
      && item.status !== 'VOIDED'
      && item.voidProcessed !== true
    );
 
    await pool.query(
      `UPDATE orders SET items = $1 WHERE id = $2`,
      [JSON.stringify(updatedItems), id]
    );

    try {
      const consumption = await consumeSoldOrderItems({ orderId: id, items: updatedItems, businessDate: req.businessDate, createdBy: 'Cashier' });
      for (const entry of consumption.filter((record) => !['CONSUMED', 'CONSUMED_COST_REVIEW', 'ALREADY_CONSUMED'].includes(record.status))) {
        console.warn(`Recipe consumption ${entry.status} for order #${id}: ${entry.order_item}`);
      }
    } catch (error) {
      console.error(`Recipe consumption failed for paid order #${id}:`, error.message);
    }
 
    // Update table status if no more pending orders
    if (updatedOrder.table_name && updatedOrder.table_name !== 'WALK-IN' && !isHistoricalBusinessDate(req.businessDate)) {
      try {
        const pendingCheck = await pool.query(
          `SELECT COUNT(*) AS cnt FROM orders
           WHERE UPPER(table_name) = UPPER($1)
             AND status NOT IN ('Paid', 'Closed', 'Voided', 'Cancelled')
             AND shift_cleared = FALSE`,
          [updatedOrder.table_name]
        );
        const remaining = parseInt(pendingCheck.rows[0].cnt, 10);
        if (remaining === 0) {
          await pool.query(
            `UPDATE tables
             SET status = 'Available', last_order_id = NULL, updated_at = NOW()
             WHERE UPPER(name) = UPPER($1)`,
            [updatedOrder.table_name]
          ).catch(err => console.warn('Table update skipped:', err.message));
        }
      } catch (err) {
        console.warn('Table release check failed:', err.message);
      }
    }
 
    // Only update daily summary for the non-credit portion being paid now
    const paidNow = newlyPaidItems.reduce(
      (sum, item) => sum + getOrderItemPaidAmount(item),
      0
    );
 
    await updateDailySummary({ amount: paidNow, method: payment_method, date: req.businessDate });
 
    if (paidNow > 0) {
      const cashierEntry = await pool.query(
        `INSERT INTO cashier_queue 
             (order_ids, table_name, label, method, amount, status, requested_by, staff_id, confirmed_by, confirmed_at, created_at, business_date)
           VALUES ($1, $2, $3, $4, $5, 'Confirmed', $6, $7, 'Cashier', NOW(), NOW(), $8::date)
         RETURNING id`,
        [
          JSON.stringify([updatedOrder.id]),
          updatedOrder.table_name || 'WALK-IN',
          `Order #${updatedOrder.id}`,
          payment_method,
          paidNow,
          updatedOrder.staff_name || null,
          updatedOrder.staff_id || null,
          req.businessDate,
        ]
      );
      await createSalesJournalEntry({
        amount: paidNow,
        paymentMethod: payment_method,
        revenueBreakdown: buildSalesRevenueBreakdown(newlyPaidItems, paidNow),
        description: `Order payment · ${updatedOrder.table_name || 'WALK-IN'}`,
        sourceTransaction: `cashier_queue:${cashierEntry.rows[0].id}`,
        postedBy: 'Cashier',
        entryDate: req.businessDate,
      });
    }
 
    await logActivity(pool, {
      type: 'PAYMENT_CONFIRMED',
      actor: 'Cashier',
      role: 'CASHIER',
      message: `Order #${id} (${updatedOrder.table_name}) paid via ${payment_method} - UGX ${paidNow.toLocaleString()}`,
      meta: { order_id: id, amount: paidNow, method: payment_method }
    });
 
    res.json({
      ...updatedOrder,
      items: updatedItems
    });
  } catch (err) {
    console.error('Pay Order Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
 

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/void-requests/:id/approve - Accountant approves void
// ─────────────────────────────────────────────────────────────────────────────
async function notifyWaiterOfVoidDecision(voidRequest, status, decidedBy) {
  try {
    const waiterResult = await pool.query(
      `SELECT s.id
       FROM public.staff s
       WHERE UPPER(s.role) = 'WAITER'
         AND COALESCE(s.is_active, TRUE) = TRUE
         AND (
           s.id = (SELECT staff_id FROM public.orders WHERE id = $1)
           OR LOWER(TRIM(s.name)) = LOWER(TRIM(COALESCE($2, '')))
         )`,
      [voidRequest.order_id, voidRequest.waiter_name || voidRequest.requested_by]
    );
    const waiterIds = waiterResult.rows.map((row) => row.id);
    if (!waiterIds.length) {
      console.warn(`[VOID ${status} NOTIFICATION] No active waiter found for request ${voidRequest.id}.`);
      return;
    }

    const notification = await notificationService.sendToUsers(waiterIds, {
      type: `VOID_${status.toUpperCase()}`,
      title: `Void request ${status.toLowerCase()}`,
      body: `Your request to void ${voidRequest.item_name} at ${voidRequest.table_name || 'the table'} was ${status.toLowerCase()} by ${decidedBy}.`,
      referenceId: voidRequest.id,
      referenceType: 'void_request',
      link: '/staff/waiter',
    });
    console.log(
      `[VOID ${status} NOTIFICATION] Request ID: ${voidRequest.id}; ` +
      `waiter notifications sent: ${notification.sent || 0}, failed: ${notification.failed || 0}`
    );
  } catch (error) {
    console.error(`[VOID ${status} NOTIFICATION] Could not notify requester:`, error.message);
  }
}

router.patch('/void-requests/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;
  const client = await pool.connect();
  let vr;
  let result;
  try {
    await client.query('BEGIN');
    const voidReq = await client.query(
      `SELECT * FROM void_requests WHERE id = $1 AND status = 'Pending' FOR UPDATE`,
      [id]
    );
    
    if (!voidReq.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Void request not found or already processed' });
    }
    
    vr = voidReq.rows[0];
    
    const orderRes = await client.query(
      `SELECT items FROM orders WHERE id = $1 FOR UPDATE`,
      [vr.order_id]
    );
    if (!orderRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order for this void request was not found.' });
    }

    let items = orderRes.rows[0].items;
    if (typeof items === 'string') items = JSON.parse(items);
    if (!Array.isArray(items)) items = [];
    let voidedItemIndex = -1;
    let voidedUnitIndex = null;
    items.forEach((item, index) => {
      if (Array.isArray(item.unitStates)) {
        const unitIndex = item.unitStates.findIndex((state) =>
          Number(state?.voidRequestId) === Number(id) && state?.voidRequested === true);
        if (unitIndex >= 0) {
          voidedItemIndex = index;
          voidedUnitIndex = unitIndex;
        }
      }
      if (voidedItemIndex < 0 && item.name === vr.item_name && !item.voidProcessed) {
        voidedItemIndex = index;
      }
    });
    if (voidedItemIndex < 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The requested order item was already voided or no longer exists.' });
    }
    const preparedResult = await client.query(
      `SELECT COALESCE(MAX(
                CASE WHEN status = 'Completed'
                       OR (started_at IS NOT NULL AND completed_quantity = 0)
                     THEN GREATEST(completed_quantity, quantity)
                     ELSE completed_quantity END
              ), 0)::numeric AS completed_quantity,
              COALESCE(BOOL_OR(status = 'Completed'), false) AS production_completed
       FROM public.restaurant_production_work
       WHERE order_id = $1 AND item_index = $2`,
      [vr.order_id, voidedItemIndex]
    );
    const itemStation = String(items[voidedItemIndex].station || '').trim().toLowerCase();
    const ticketTable = itemStation === 'barista'
      ? 'barista_tickets'
      : ['bar', 'barman'].includes(itemStation)
        ? 'barman_tickets'
        : 'kitchen_tickets';
    const ticketResult = await client.query(
      `SELECT status FROM public.${ticketTable}
       WHERE order_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [vr.order_id]
    );
    const preparedItem = {
      ...items[voidedItemIndex],
      readyForService: items[voidedItemIndex].readyForService === true
        || preparedResult.rows[0]?.production_completed === true
        || ticketResult.rows[0]?.status === 'Ready',
    };
    const voidedItem = items[voidedItemIndex];
    const isUnitRequest = voidedUnitIndex !== null;
    const unitPrepared = isUnitRequest && (
      preparedItem.served === true
      || preparedItem.readyForService === true
      || Number(preparedResult.rows[0]?.completed_quantity || 0) > voidedUnitIndex
    );
    const preparedQuantity = isUnitRequest
      ? (unitPrepared ? 1 : 0)
      : getPreparedVoidQuantity(preparedItem, preparedResult.rows[0]?.completed_quantity);

    let inventoryTreatment = 'NOT_PREPARED';
    if (preparedQuantity > 0) {
      const wasteItem = {
        ...voidedItem,
        ...(isUnitRequest ? {
          quantity: 1,
          _unitIndex: voidedUnitIndex,
          _orderItemIndex: voidedItemIndex,
        } : {}),
        status: isUnitRequest ? voidedItem.status : 'VOIDED',
        voidProcessed: isUnitRequest ? false : true,
        _approvedPreparedVoid: true,
        _wasteQuantity: preparedQuantity,
        _voidRequestId: Number(id),
        _voidWasteReason: { requestId: Number(id), reason: vr.reason, unitIndex: voidedUnitIndex },
      };
      const wasteResult = await consumeSoldOrderItems({
        orderId: vr.order_id,
        items: [wasteItem],
        businessDate: req.businessDate,
        createdBy: approved_by || 'Accountant',
        queryable: client,
        onlyOrderItemIndex: 0,
      });
      const wasteOutcome = wasteResult[0];
      if (!wasteOutcome || !['WASTED', 'WASTED_COST_REVIEW', 'ALREADY_CONSUMED', 'ALREADY_WASTED'].includes(wasteOutcome.status)) {
        const error = new Error(
          `Could not record prepared void as inventory waste${wasteOutcome?.message ? `: ${wasteOutcome.message}` : '.'}`
        );
        error.statusCode = 409;
        throw error;
      }
      if (wasteOutcome.status === 'ALREADY_CONSUMED') {
        const unpreparedRatio = isUnitRequest
          ? 0
          : getUnpreparedQuantityRatio(voidedItem.quantity || 1, preparedQuantity);
        if (unpreparedRatio > 0) {
          await reverseConsumedOrderItem({
            orderId: vr.order_id,
            orderItemIndex: voidedItemIndex,
            businessDate: req.businessDate,
            createdBy: approved_by || 'Accountant',
            queryable: client,
            quantityRatio: unpreparedRatio,
          });
          inventoryTreatment = 'PREPARED_WASTE_RESTOCKED_UNPREPARED';
        } else {
          inventoryTreatment = 'ALREADY_CONSUMED';
        }
      } else {
        inventoryTreatment = wasteOutcome.status;
      }
    } else {
      const reversal = await reverseConsumedOrderItem({
        orderId: vr.order_id,
        orderItemIndex: voidedItemIndex,
        ...(isUnitRequest ? {
          unitIndex: voidedUnitIndex,
          unitCount: getOrderItemUnitCount(voidedItem),
        } : {}),
        businessDate: req.businessDate,
        createdBy: approved_by || 'Accountant',
        queryable: client,
      });
      inventoryTreatment = reversal.status === 'REVERSED' || reversal.status === 'ALREADY_REVERSED'
        ? 'RESTOCKED_UNPREPARED'
        : 'NOT_PREPARED_NO_STOCK_DEDUCTION';
    }

    const updatedItems = items.map((item, index) => {
      if (index !== voidedItemIndex) return item;
      if (isUnitRequest) {
        const unitStates = getOrderItemUnitStates(item);
        unitStates[voidedUnitIndex] = {
          ...unitStates[voidedUnitIndex],
          voidRequested: false,
          voidProcessed: true,
          creditRequested: false,
          creditApproved: false,
          creditRejected: false,
          creditRejectionReason: null,
          voidRequestId: Number(id),
          voidApprovedBy: approved_by || 'Accountant',
          voidApprovedAt: new Date().toISOString(),
          voidReason: vr.reason,
          voidPreparedQuantity: preparedQuantity,
          voidInventoryTreatment: inventoryTreatment,
        };
        const activeUnits = unitStates.filter((state) => state?.voidProcessed !== true);
        const fullyVoided = activeUnits.length === 0;
        return {
          ...item,
          unitStates,
          _rowPaid: activeUnits.length > 0 && activeUnits.every((state) => state?.paid === true),
          paidAmount: getOrderItemPaidAmount({ ...item, unitStates }),
          ...(fullyVoided ? { status: 'VOIDED', voidProcessed: true } : {}),
        };
      }
      return {
        ...item,
        status: 'VOIDED',
        voidProcessed: true,
        voidRequestId: Number(id),
        voidApprovedBy: approved_by || 'Accountant',
        voidApprovedAt: new Date().toISOString(),
        voidReason: vr.reason,
        voidPreparedQuantity: preparedQuantity,
        voidInventoryTreatment: inventoryTreatment,
      };
    });
    const newTotal = getOrderPayableTotal(updatedItems);

    if (!isUnitRequest || getOrderItemUnitStates(updatedItems[voidedItemIndex]).every((state) => state?.voidProcessed === true)) {
    await client.query(
      `WITH voided_work AS (
         UPDATE public.restaurant_production_work
         SET status = 'Voided', completed_quantity = 0, updated_at = NOW()
         WHERE order_id = $1 AND item_index = $2
           AND status NOT IN ('Cancelled', 'Voided')
         RETURNING id
       )
       INSERT INTO public.restaurant_production_events (work_id, event_type, to_status, reason)
       SELECT id, 'VOIDED', 'Voided', $3 FROM voided_work
       ON CONFLICT (work_id) WHERE event_type IN ('VOIDED', 'CANCELLED') DO NOTHING`,
      [vr.order_id, voidedItemIndex, `Approved void request #${id}`]
    );
    }

    await client.query(
      `UPDATE orders SET items = $1, total = $2 WHERE id = $3`,
      [JSON.stringify(updatedItems), newTotal, vr.order_id]
    );
    result = await client.query(
      `UPDATE void_requests 
       SET status = 'Approved', 
           approved_by = $1,
           resolved_by = $1, 
           resolved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approved_by || 'Accountant', id]
    );
    await client.query('COMMIT');
    
    await logActivity(pool, {
      type: 'VOID_APPROVED',
      actor: approved_by || 'Accountant',
      role: 'ACCOUNTANT',
      message: `Approved void request for ${vr.item_name} (Order #${vr.order_id}) - Chef: ${vr.chef_name || 'Unknown'}`,
      meta: {
        void_id: id,
        order_id: vr.order_id,
        item: vr.item_name,
        chef: vr.chef_name,
        inventory_treatment: inventoryTreatment,
        prepared_quantity: preparedQuantity,
      }
    });
    await notifyWaiterOfVoidDecision(vr, 'Approved', approved_by || 'Accountant');
    
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Approve void error:', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/orders/void-requests/:id/reject - Accountant rejects void
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/void-requests/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { rejected_by } = req.body;
  
  try {
    const voidReq = await pool.query(
      `SELECT * FROM void_requests WHERE id = $1 AND status = 'Pending'`,
      [id]
    );
    
    if (!voidReq.rows.length) {
      return res.status(404).json({ error: 'Void request not found or already processed' });
    }
    
    const vr = voidReq.rows[0];
    
    const orderRes = await pool.query(
      `SELECT items FROM orders WHERE id = $1`,
      [vr.order_id]
    );
    
    if (orderRes.rows.length) {
      let items = orderRes.rows[0].items;
      if (typeof items === 'string') {
        items = JSON.parse(items);
      }
      
      const updatedItems = items.map(item => {
        if (Array.isArray(item.unitStates)) {
          let changed = false;
          const unitStates = getOrderItemUnitStates(item).map((state) => {
            if (Number(state?.voidRequestId) !== Number(id) || state?.voidRequested !== true) return state;
            changed = true;
            return {
              ...state,
              voidRequested: false,
              voidRejected: true,
              voidRejectedBy: rejected_by || 'Accountant',
              voidRejectedAt: new Date().toISOString(),
            };
          });
          if (changed) return { ...item, unitStates };
        }
        if (item.name === vr.item_name && item.voidRequested && !item.voidProcessed
          && (item.voidRequestId === undefined || Number(item.voidRequestId) === Number(id))) {
          return {
            ...item,
            voidRequested: false,
            voidRejected: true,
            voidRejectedBy: rejected_by || 'Accountant',
            voidRejectedAt: new Date().toISOString()
          };
        }
        return item;
      });
      
      await pool.query(
        `UPDATE orders SET items = $1 WHERE id = $2`,
        [JSON.stringify(updatedItems), vr.order_id]
      );
    }
    
    const result = await pool.query(
      `UPDATE void_requests 
       SET status = 'Rejected', 
           rejected_by = $1,
           resolved_by = $1, 
           resolved_at = NOW()
       WHERE id = $2 AND status = 'Pending'
       RETURNING *`,
      [rejected_by || 'Accountant', id]
    );
    
    await logActivity(pool, {
      type: 'VOID_REJECTED',
      actor: rejected_by || 'Accountant',
      role: 'ACCOUNTANT',
      message: `Rejected void request for ${vr.item_name} (Order #${vr.order_id})`,
      meta: { void_id: id, order_id: vr.order_id, item: vr.item_name }
    });
    await notifyWaiterOfVoidDecision(vr, 'Rejected', rejected_by || 'Accountant');
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Reject void error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Debug endpoint - Check staff orders
// ─────────────────────────────────────────────────────────────────────────────
router.get('/debug/staff-orders/:staffId', async (req, res) => {
  const { staffId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const allOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, payment_method,
              DATE(timestamp) as order_date, timestamp, shift_cleared
       FROM orders 
       ORDER BY id DESC 
       LIMIT 50`
    );
    
    const staffOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, payment_method,
              DATE(timestamp) as order_date, timestamp, shift_cleared
       FROM orders 
       WHERE staff_id = $1 OR waiter_name ILIKE $2 OR staff_name ILIKE $2
       ORDER BY id DESC`,
      [staffId, `%${req.query.name || ''}%`]
    );
    
    const todayOrders = await pool.query(
      `SELECT id, staff_id, waiter_name, staff_name, table_name, total, status, payment_method,
              DATE(timestamp) as order_date, timestamp, shift_cleared
       FROM orders 
       WHERE (staff_id = $1 OR waiter_name ILIKE $2 OR staff_name ILIKE $2)
         AND DATE(timestamp) = $3
         AND shift_cleared = FALSE
       ORDER BY id DESC`,
      [staffId, `%${req.query.name || ''}%`, today]
    );
    
    res.json({
      debug: {
        staffId: staffId,
        staffName: req.query.name || 'unknown',
        today: today
      },
      allOrdersSample: allOrders.rows.slice(0, 10),
      allOrdersCount: allOrders.rows.length,
      staffOrders: staffOrders.rows,
      staffOrdersCount: staffOrders.rows.length,
      todayOrders: todayOrders.rows,
      todayOrdersCount: todayOrders.rows.length,
      note: "Orders only affect revenue when payment_method is set and status is 'Paid'"
    });
  } catch (err) {
    console.error('Debug error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Debug endpoint - Check void requests
// ─────────────────────────────────────────────────────────────────────────────
router.get('/debug/void-requests', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        item_name,
        chef_name,
        status,
        created_at
      FROM void_requests 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    res.json({
      count: result.rows.length,
      requests: result.rows,
      sample: result.rows[0] || null
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test endpoint
// ─────────────────────────────────────────────────────────────────────────────
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Order routes are working!', 
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /',
      'GET /cashier-queue',
      'GET /tables/all',
      'GET /cashier-history',
      'GET /credits',
      'GET /void-requests',
      'GET /void-requests/history',
      'POST /',
      'POST /void-item',
      'PATCH /:id/status',
      'PATCH /:id/pay',
      'PATCH /void-requests/:id/approve',
      'PATCH /void-requests/:id/reject',
      'GET /debug/void-requests',
      'GET /debug/staff-orders/:staffId'
    ],
    important_note: "✅ Orders only affect revenue when payment_method is set and status is 'Paid' via the /pay endpoint"
  });
});

export default router;