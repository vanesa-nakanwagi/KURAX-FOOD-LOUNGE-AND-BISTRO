// routes/orderRoutes.js
import express from 'express';
import pool from '../db.js';
import { consumeSoldOrderItems, reverseConsumedOrderItem } from '../helpers/recipeConsumption.js';
import { updateDailySummary } from '../helpers/summaryHelper.js';
import { buildOpenShiftOrderClause } from '../helpers/shiftVisibility.js';
import { buildSalesRevenueBreakdown, createSalesJournalEntry } from '../helpers/accounting.js';
import { createJournalEntry } from '../helpers/accounting.js';
import {
  applyComplimentaryTerms,
  getOrderItemOriginalAmount,
  getOrderItemPaidAmount,
  getOrderItemPayableAmount,
  getOrderItemWaivedAmount,
  getOrderPayableTotal,
} from '../helpers/complimentaryItems.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import logActivity from '../utils/logsActivity.js';

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
  if (!actor || actor.is_active === false || actor.role !== session.role) {
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
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })
  ).toISOString().split('T')[0];
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
      filters.push(`DATE(COALESCE(o.created_at, o.timestamp) AT TIME ZONE 'Africa/Kampala') = $${values.length}::date`);
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
        return {
          ...item,
          _orderItemIndex: index,
          served: item.served === true || order.status === 'Served',
          production_status: work?.status || (ticketStatus === 'Ready' ? 'Completed' : null),
          production_staff_id: work?.staff_id || null,
          production_staff_name: work?.staff_name || null,
          production_claimed_at: work?.claimed_at || null,
          production_started_at: work?.started_at || null,
          production_completed_at: work?.completed_at || null,
          production_ready_at: work?.ready_at || null,
          production_notification_status: work?.notification_status || null,
          production_notified_at: work?.notified_at || null,
          readyForService: work ? work.status === 'Completed' : ticketStatus === 'Ready',
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
         AND (COALESCE(cq.confirmed_at, cq.created_at) AT TIME ZONE 'Africa/Kampala')::date = $1::date
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
    const orderItems = Array.isArray(items)
      ? items.map((item) => (
        item && typeof item === 'object' && !Array.isArray(item)
          ? { ...item, station_routing_requested: sendToStations === true }
          : item
      ))
      : items;

    // CRITICAL FIX: Do NOT set payment_method by default
    // Payment method should be NULL until cashier confirms payment
    const orderResult = await pool.query(
      `INSERT INTO orders (
         staff_id, staff_role, table_name,
         items, total, payment_method, status, date, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, NOW())
       RETURNING *`,
      [
        staffId       || 1,
        staffRole     || 'WAITER',
        tableName     || 'WALK-IN',
        JSON.stringify(orderItems),
        total,
        null,  // ← FIXED: No default payment method
        'Pending',   // ← FIXED: Status is Pending, not Served
      ]
    );

    const newOrder = orderResult.rows[0];
    
    let parsedItems = newOrder.items;
    if (typeof parsedItems === 'string') {
      parsedItems = JSON.parse(parsedItems);
    }

    if (tableName && tableName !== 'WALK-IN') {
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
      meta:    { order_id: newOrder.id, total },
    });

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
  const { order_id, item_name, reason, requested_by } = req.body;

  console.log("Received void request:", { order_id, item_name, reason, requested_by });

  if (!order_id || !item_name || !reason) {
    console.log("Missing required fields");
    return res.status(400).json({ error: 'order_id, item_name, and reason are required' });
  }

  try {
    // Get order details
    const orderRes = await pool.query(
      `SELECT o.table_name, o.staff_id, o.items, o.total, COALESCE(s.name, $2) AS waiter_name
       FROM orders o
       LEFT JOIN staff s ON o.staff_id = s.id
       WHERE o.id = $1`,
      [order_id, requested_by || 'Unknown']
    );

    if (orderRes.rows.length === 0) {
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
    
    const targetItemIndex = items.findIndex(item =>
      item.name === item_name && !item.voidRequested && !item.voidProcessed);
    const targetItem = targetItemIndex >= 0 ? items[targetItemIndex] : null;
    
    if (!targetItem) {
      console.log("Item not found or already voided:", item_name);
      return res.status(404).json({ error: 'Item not found or already voided' });
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
    
    const originalPrice = Number(targetItem.price || 0);
    const originalQuantity = Number(targetItem.quantity || 1);
    const itemTotal = originalPrice * originalQuantity;

    console.log("Inserting void request with:", {
      order_id, item_name, reason, requested_by, tableName, waiterName,
      originalPrice, originalQuantity, itemTotal, chefName
    });

    const voidRes = await pool.query(
      `INSERT INTO void_requests
         (order_id, item_name, reason, requested_by,
          table_name, waiter_name, status, created_at,
          original_price, original_quantity, chef_name)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', NOW(), 
               $7, $8, $9)
       RETURNING *`,
      [order_id, item_name, reason, requested_by, tableName, waiterName, 
       originalPrice, originalQuantity, chefName]
    );

    console.log("Void request inserted, ID:", voidRes.rows[0].id);

    let found = false;
    const updatedItems = items.map(item => {
      if (!found && item.name === item_name && !item.voidRequested && !item.voidProcessed) {
        found = true; 
        return { 
          ...item, 
          voidRequested: true, 
          voidReason: reason, 
          voidRequestedBy: requested_by,
          voidRequestedAt: new Date().toISOString(),
          original_price: originalPrice,
          price: originalPrice,
          chefName: chefName
        };
      }
      return item;
    });

    await pool.query(
      `UPDATE orders SET items = $1 WHERE id = $2`,
      [JSON.stringify(updatedItems), order_id]
    );

    await logActivity(pool, {
      type: 'VOID_REQUESTED',
      actor: requested_by,
      role: 'WAITER',
      message: `Void requested: ${item_name} (UGX ${itemTotal.toLocaleString()}) from Order #${order_id}${chefName ? ` - Chef: ${chefName}` : ' - No chef assigned'}`,
      meta: { reason, order_id, table: tableName, amount: itemTotal, chef_name: chefName }
    });

    res.status(201).json({ 
      success: true, 
      void_request: voidRes.rows[0],
      message: `Void request for ${item_name} sent to accountant`
    });
  } catch (err) {
    console.error('Void Request Error:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
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
  const { complimentary, waivedAmount, reason = '' } = req.body || {};
  const actor = req.complimentaryActor;
  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(itemIndex) || itemIndex < 0) {
    return res.status(400).json({ error: 'A valid order and item index are required.' });
  }
  if (typeof complimentary !== 'boolean' || (complimentary && waivedAmount === undefined)) {
    return res.status(400).json({ error: 'Choose whether the item is complimentary and provide its waived amount.' });
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

    let updatedItem;
    try {
      updatedItem = applyComplimentaryTerms(item, {
        complimentary,
        waivedAmount: complimentary ? waivedAmount : 0,
        actorId: actor.id,
        actorName: actor.name,
        reason,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: error.message });
    }

    if (isPostedOrder(order, item)) {
      const requestResult = await client.query(
        `INSERT INTO public.complimentary_correction_requests
           (order_id, order_item_index, requested_complimentary, requested_waived_amount,
            reason, previous_item, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, status, requested_at`,
        [orderId, itemIndex, updatedItem.complimentary, updatedItem.complimentaryWaivedAmount,
          reason.trim() || null, JSON.stringify(item), actor.id]
      );
      await client.query('COMMIT');
      await logActivity(pool, {
        type: 'COMPLIMENTARY_CORRECTION_REQUESTED',
        actor: actor.name,
        role: actor.role,
        message: `Complimentary correction requested for ${item.name} on Order #${orderId}`,
        meta: { order_id: orderId, order_item_index: itemIndex, correction_id: requestResult.rows[0].id, reason: reason.trim() || null },
      });
      return res.status(202).json({
        correctionRequest: requestResult.rows[0],
        message: 'This order item has already been finalized. A Manager, Director, or Accountant must approve the correction.',
      });
    }

    items[itemIndex] = updatedItem;
    const total = getOrderPayableTotal(items);
    const updatedOrder = await client.query(
      `UPDATE public.orders SET items = $1, total = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, table_name, total, items`,
      [JSON.stringify(items), total, orderId]
    );
    await client.query('COMMIT');
    if (updatedItem.complimentary && updatedItem.served === true) {
      try {
        const consumption = await consumeSoldOrderItems({
          orderId,
          items,
          createdBy: actor.name,
        });
        for (const entry of consumption.filter((record) => !['CONSUMED', 'CONSUMED_COST_REVIEW', 'ALREADY_CONSUMED'].includes(record.status))) {
          console.warn(`Recipe consumption ${entry.status} for complimentary item on order #${orderId}: ${entry.order_item}`);
        }
      } catch (error) {
        console.error(`Recipe consumption failed for complimentary order #${orderId}:`, error.message);
      }
    }
    await logActivity(pool, {
      type: 'ORDER_ITEM_COMPLIMENTARY_UPDATED',
      actor: actor.name,
      role: actor.role,
      message: `${updatedItem.complimentary ? 'Marked' : 'Unmarked'} ${item.name} as complimentary on Order #${orderId}`,
      meta: {
        order_id: orderId,
        order_item_index: itemIndex,
        original_amount: updatedItem.originalLineAmount,
        waived_amount: updatedItem.complimentaryWaivedAmount,
        payable_amount: updatedItem.payableAmount,
        reason: updatedItem.complimentaryReason || null,
      },
    });
    return res.json({ ...updatedOrder.rows[0], items, message: 'Complimentary status updated.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A complimentary correction is already awaiting approval for this item.' });
    }
    console.error('Update complimentary item error:', error);
    return res.status(500).json({ error: 'Could not update the complimentary item.' });
  } finally {
    client.release();
  }
});

router.get('/complimentary-corrections', authenticateComplimentaryStaff, async (req, res) => {
  const role = String(req.complimentaryActor.role || '').toUpperCase();
  if (!['MANAGER', 'DIRECTOR', 'ACCOUNTANT'].includes(role)) {
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
  if (!['MANAGER', 'DIRECTOR', 'ACCOUNTANT'].includes(role)) {
    return res.status(403).json({ error: 'You are not authorized to review complimentary corrections.' });
  }
  const requestId = Number(req.params.requestId);
  const decision = String(req.body?.decision || '').toLowerCase();
  const reviewNote = String(req.body?.reviewNote || '').trim();
  if (!Number.isInteger(requestId) || requestId <= 0 || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'A valid correction request and approve/reject decision are required.' });
  }
  if (reviewNote.length > 500) return res.status(400).json({ error: 'The review note must be 500 characters or fewer.' });

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
    if (Number(correction.requested_by) === Number(actor.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'A different Manager, Director, or Accountant must review your correction request.' });
    }
    const orderResult = await client.query(
      `SELECT id, status, total, items FROM public.orders WHERE id = $1 FOR UPDATE`,
      [correction.order_id]
    );
    if (!orderResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'The correction order no longer exists.' });
    }

    if (decision === 'reject') {
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

    const order = orderResult.rows[0];
    const items = parseOrderItems(order.items);
    const item = items[correction.order_item_index];
    if (!item || item.voidProcessed === true || String(item.status || '').toUpperCase() === 'VOIDED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The requested order item has since been voided or removed.' });
    }
    const previousPayable = getOrderItemPayableAmount(item);
    const previousPaid = getOrderItemPaidAmount(item);
    const previousWaiver = getOrderItemWaivedAmount(item);
    const updatedItem = applyComplimentaryTerms(item, {
      complimentary: correction.requested_complimentary,
      waivedAmount: correction.requested_waived_amount,
      actorId: correction.requested_by,
      actorName: correction.requester_name,
      reason: correction.reason || '',
    });
    if (item._rowPaid === true && item.paidAmount === undefined) {
      updatedItem.paidAmount = previousPaid;
    }
    updatedItem.complimentaryApprovedBy = actor.id;
    updatedItem.complimentaryApprovedByName = actor.name;
    updatedItem.complimentaryApprovedAt = new Date().toISOString();
    const waiverChange = Math.round((updatedItem.complimentaryWaivedAmount - previousWaiver) * 100) / 100;
    const revenueItem = {
      ...item,
      complimentary: false,
      payableAmount: getOrderItemOriginalAmount(item),
    };
    if (waiverChange !== 0) {
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
    if (waiverChange > 0) {
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
    } else if (waiverChange < 0) {
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

    items[correction.order_item_index] = updatedItem;
    await client.query(
      `UPDATE public.orders SET items = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(items), order.id]
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
      type: 'COMPLIMENTARY_CORRECTION_APPROVED',
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
    return res.json({ success: true, status: 'Approved', item: updatedItem });
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
      const consumption = await consumeSoldOrderItems({ orderId: id, items: updatedItems, createdBy: 'Cashier' });
      for (const entry of consumption.filter((record) => !['CONSUMED', 'CONSUMED_COST_REVIEW', 'ALREADY_CONSUMED'].includes(record.status))) {
        console.warn(`Recipe consumption ${entry.status} for order #${id}: ${entry.order_item}`);
      }
    } catch (error) {
      console.error(`Recipe consumption failed for paid order #${id}:`, error.message);
    }
 
    // Update table status if no more pending orders
    if (updatedOrder.table_name && updatedOrder.table_name !== 'WALK-IN') {
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
 
    await updateDailySummary({ amount: paidNow, method: payment_method });
 
    if (paidNow > 0) {
      const cashierEntry = await pool.query(
        `INSERT INTO cashier_queue 
             (order_ids, table_name, label, method, amount, status, requested_by, staff_id, confirmed_by, confirmed_at, created_at)
           VALUES ($1, $2, $3, $4, $5, 'Confirmed', $6, $7, 'Cashier', NOW(), NOW())
         RETURNING id`,
        [
          JSON.stringify([updatedOrder.id]),
          updatedOrder.table_name || 'WALK-IN',
          `Order #${updatedOrder.id}`,
          payment_method,
          paidNow,
          updatedOrder.staff_name || null,
          updatedOrder.staff_id || null,
        ]
      );
      await createSalesJournalEntry({
        amount: paidNow,
        paymentMethod: payment_method,
        revenueBreakdown: buildSalesRevenueBreakdown(newlyPaidItems, paidNow),
        description: `Order payment · ${updatedOrder.table_name || 'WALK-IN'}`,
        sourceTransaction: `cashier_queue:${cashierEntry.rows[0].id}`,
        postedBy: 'Cashier',
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
    const voidedItemIndex = items.findIndex((item) => item.name === vr.item_name && !item.voidProcessed);
    if (voidedItemIndex < 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The requested order item was already voided or no longer exists.' });
    }
    const updatedItems = items.map((item, index) => index === voidedItemIndex ? {
      ...item,
      status: 'VOIDED',
      voidProcessed: true,
      voidApprovedBy: approved_by || 'Accountant',
      voidApprovedAt: new Date().toISOString(),
      voidReason: vr.reason,
    } : item);
    const newTotal = getOrderPayableTotal(updatedItems);

    await client.query(
      `UPDATE orders SET items = $1, total = $2 WHERE id = $3`,
      [JSON.stringify(updatedItems), newTotal, vr.order_id]
    );
    const inventoryReversal = await reverseConsumedOrderItem({
      queryable: client,
      orderId: vr.order_id,
      orderItemIndex: voidedItemIndex,
      createdBy: approved_by || 'Accountant',
    });
    
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
      meta: { void_id: id, order_id: vr.order_id, item: vr.item_name, chef: vr.chef_name, inventory_reversal: inventoryReversal.status }
    });
    
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Approve void error:', err.message);
    res.status(500).json({ error: err.message });
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
        if (item.name === vr.item_name && item.voidRequested && !item.voidProcessed) {
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