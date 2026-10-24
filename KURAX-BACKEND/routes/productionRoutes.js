import express from 'express';
import { createHash } from 'node:crypto';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { hashStaffPin, verifyStaffPin } from '../helpers/staffPin.js';
import { refreshPublicOrderPreparationStatus } from '../helpers/publicOrderWorkflow.js';
import notificationService from '../helpers/notificationService.js';
import { syncRoutableStationTickets } from '../helpers/stationOrderTickets.js';

const router = express.Router();
const STATIONS = {
  kitchen: { table: 'kitchen_tickets', roles: ['CHEF'], oversight: ['KITCHEN_HOD'] },
  bar: { table: 'barman_tickets', roles: ['BARMAN'], oversight: ['BAR_HOD'] },
  barista: { table: 'barista_tickets', roles: ['BARISTA'], oversight: ['BARISTA_HOD'] },
};
const MANAGEMENT_ROLES = ['DIRECTOR', 'MANAGER'];

export async function initProductionTables() {
  await pool.query(`
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pin TEXT;
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pin_salt TEXT;
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pin_hash TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.restaurant_production_work (
      id BIGSERIAL PRIMARY KEY,
      station TEXT NOT NULL CHECK (station IN ('kitchen', 'bar', 'barista')),
      order_id INTEGER NOT NULL,
      ticket_id INTEGER NOT NULL,
      item_index INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_notes TEXT,
      table_name TEXT,
      order_created_at TIMESTAMPTZ,
      quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
      completed_quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (completed_quantity >= 0),
      staff_id INTEGER,
      staff_name TEXT,
      status TEXT NOT NULL DEFAULT 'Unclaimed',
      claimed_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (station, ticket_id, item_index)
    );
    ALTER TABLE public.restaurant_production_work ADD COLUMN IF NOT EXISTS item_notes TEXT;
    ALTER TABLE public.restaurant_production_work ADD COLUMN IF NOT EXISTS table_name TEXT;
    ALTER TABLE public.restaurant_production_work ADD COLUMN IF NOT EXISTS order_created_at TIMESTAMPTZ;
    ALTER TABLE public.restaurant_production_work ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
    ALTER TABLE public.restaurant_production_work ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'Pending';
    ALTER TABLE public.restaurant_production_work ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
    ALTER TABLE public.restaurant_production_work
      DROP CONSTRAINT IF EXISTS restaurant_production_work_order_id_fkey;
    CREATE TABLE IF NOT EXISTS public.restaurant_production_pin_attempts (
      identifier_hash TEXT PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS restaurant_production_work_staff_date_idx
      ON public.restaurant_production_work (staff_id, claimed_at DESC);
    CREATE INDEX IF NOT EXISTS restaurant_production_work_station_status_idx
      ON public.restaurant_production_work (station, status);
    CREATE TABLE IF NOT EXISTS public.restaurant_production_events (
      id BIGSERIAL PRIMARY KEY,
      work_id BIGINT NOT NULL,
      event_type TEXT NOT NULL,
      from_staff_id INTEGER,
      to_staff_id INTEGER,
      actor_id INTEGER,
      from_status TEXT,
      to_status TEXT,
      quantity NUMERIC(12,2),
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.restaurant_production_events
      DROP CONSTRAINT IF EXISTS restaurant_production_events_work_id_fkey;
    CREATE INDEX IF NOT EXISTS restaurant_production_events_work_idx
      ON public.restaurant_production_events (work_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS restaurant_production_terminal_event_idx
      ON public.restaurant_production_events (work_id)
      WHERE event_type IN ('VOIDED', 'CANCELLED');
  `);

  const legacyPins = await pool.query(
    `SELECT id, pin FROM public.staff
     WHERE pin IS NOT NULL AND pin_hash IS NULL`
  );
  for (const staff of legacyPins.rows) {
    const { salt, hash } = await hashStaffPin(staff.pin);
    await pool.query(
      `UPDATE public.staff SET pin_salt = $1, pin_hash = $2, pin = NULL
       WHERE id = $3 AND pin_hash IS NULL`,
      [salt, hash, staff.id]
    );
  }
}

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return fail(res, 401, 'Sign in to access production records.');

  try {
    const session = readSessionToken(token);
    const id = Number(session.id);
    if (session.scope !== 'restaurant' || !Number.isInteger(id) || id < 1) {
      return fail(res, 401, 'A restaurant staff session is required.');
    }
    const result = await pool.query(
      `SELECT id, name, role, is_active FROM public.staff WHERE id = $1`,
      [id]
    );
    const actor = result.rows[0];
    if (!actor || actor.is_active === false || actor.role !== session.role) {
      return fail(res, 401, 'Staff account is inactive or has changed.');
    }
    req.actor = actor;
    return next();
  } catch {
    return fail(res, 401, 'Session expired. Sign in again.');
  }
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function canAccessStation(actor, station, allowManagement = true) {
  const config = STATIONS[station];
  return config && (
    config.roles.includes(actor.role)
    || config.oversight.includes(actor.role)
    || (allowManagement && MANAGEMENT_ROLES.includes(actor.role))
  );
}

async function ensureTicketWork(client, station) {
  const { table } = STATIONS[station];
  await client.query(
    `WITH changed AS (
       INSERT INTO public.restaurant_production_work
         (station, order_id, ticket_id, item_index, item_name, item_notes,
          table_name, order_created_at, quantity, status)
     SELECT $1, ticket.order_id, ticket.id,
            COALESCE(NULLIF(item.value->>'_orderItemIndex', '')::integer, item.ordinality - 1),
            COALESCE(NULLIF(item.value->>'name', ''), 'Unnamed item'),
            NULLIF(COALESCE(item.value->>'note', item.value->>'notes'), ''),
            ticket.table_name, ticket.created_at,
            GREATEST(COALESCE(NULLIF(item.value->>'quantity', '')::numeric, 1), 0.01),
            CASE
              WHEN LOWER(COALESCE(order_row.status, '')) IN ('cancelled', 'voided') THEN 'Cancelled'
              WHEN item.value->>'voidProcessed' = 'true' OR UPPER(COALESCE(item.value->>'status','')) = 'VOIDED'
                THEN 'Voided'
              ELSE 'Unclaimed'
            END
     FROM public.${table} ticket
     JOIN public.orders order_row ON order_row.id=ticket.order_id
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ticket.items, '[]'::jsonb))
       WITH ORDINALITY AS item(value, ordinality)
     ON CONFLICT (station, ticket_id, item_index) DO UPDATE
       SET status = CASE
             WHEN EXCLUDED.status = 'Voided' AND public.restaurant_production_work.status NOT IN ('Cancelled', 'Voided')
               THEN 'Voided'
             WHEN EXCLUDED.status = 'Cancelled' AND public.restaurant_production_work.status NOT IN ('Completed', 'Cancelled', 'Voided')
               THEN 'Cancelled'
             ELSE public.restaurant_production_work.status
           END,
           completed_quantity = CASE
             WHEN EXCLUDED.status = 'Voided' THEN 0
             ELSE public.restaurant_production_work.completed_quantity
           END,
           item_notes = COALESCE(public.restaurant_production_work.item_notes, EXCLUDED.item_notes),
           table_name = COALESCE(public.restaurant_production_work.table_name, EXCLUDED.table_name),
           order_created_at = COALESCE(public.restaurant_production_work.order_created_at, EXCLUDED.order_created_at),
           updated_at = NOW()
       WHERE (EXCLUDED.status = 'Voided' AND public.restaurant_production_work.status NOT IN ('Cancelled', 'Voided'))
           OR (EXCLUDED.status = 'Cancelled' AND public.restaurant_production_work.status NOT IN ('Completed', 'Cancelled', 'Voided'))
           OR public.restaurant_production_work.order_created_at IS NULL
     RETURNING id, status
    )
    INSERT INTO public.restaurant_production_events (work_id, event_type, to_status)
    SELECT id, UPPER(status), status FROM changed
    WHERE status IN ('Voided', 'Cancelled')
    ON CONFLICT (work_id) WHERE event_type IN ('VOIDED', 'CANCELLED') DO NOTHING`,
    [station]
  );
}

router.get('/:station/queue', authenticate, async (req, res) => {
  const station = String(req.params.station || '').toLowerCase();
  if (!STATIONS[station]) return fail(res, 404, 'Unknown production station.');
  if (!canAccessStation(req.actor, station)) return fail(res, 403, 'You are not authorized for this station.');
  const view = String(req.query.view || 'mine').toLowerCase();
  if (!['mine', 'available'].includes(view)) return fail(res, 400, 'Choose a valid production queue view.');
  const isStationWorker = STATIONS[station].roles.includes(req.actor.role);
  if (view === 'available') {
    return fail(res, 403, 'Unclaimed station work is available through the HOD queue.');
  }

  try {
    await syncRoutableStationTickets(pool, station);
    await ensureTicketWork(pool, station);
    const { table } = STATIONS[station];
    const result = await pool.query(
      `SELECT work.id AS work_id, work.station, work.order_id, work.ticket_id,
              work.item_index, work.item_name, work.quantity, work.completed_quantity,
              work.staff_id, COALESCE(staff.name, work.staff_name) AS staff_name, work.status, work.claimed_at,
              work.started_at, work.completed_at, ticket.table_name, ticket.created_at AS order_created_at,
              ticket.status AS ticket_status,
              (SELECT COUNT(*)::int
               FROM public.restaurant_production_work remaining
               WHERE remaining.station=work.station AND remaining.ticket_id=work.ticket_id
                 AND remaining.status NOT IN ('Completed', 'Cancelled', 'Voided')) AS remaining_items,
              item.value AS item_details
       FROM public.restaurant_production_work work
       JOIN public.${table} ticket ON ticket.id = work.ticket_id
       LEFT JOIN public.staff staff ON staff.id = work.staff_id
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ticket.items, '[]'::jsonb))
         WITH ORDINALITY AS item(value, ordinality)
       WHERE work.station = $1
         AND COALESCE(NULLIF(item.value->>'_orderItemIndex', '')::integer, item.ordinality - 1) = work.item_index
         AND COALESCE(ticket.cleared_at, NULL) IS NULL
         AND work.status NOT IN ('Cancelled', 'Voided')
         AND ($2 = 'available'
              AND work.status = 'Unclaimed' AND work.staff_id IS NULL
              OR $2 = 'mine' AND ($3::boolean = false OR work.status <> 'Completed')
                 AND ($3::boolean = false OR work.staff_id = $4))
       ORDER BY ticket.created_at, work.item_index`,
      [station, view, isStationWorker, req.actor.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Production queue error:', err.message);
    res.status(500).json({ error: 'Could not load production queue.' });
  }
});

router.use(authenticate);

router.post('/work/:workId/claim', async (req, res) => {
  const workId = Number(req.params.workId);
  const pin = String(req.body?.pin || '').trim();
  if (!Number.isInteger(workId) || workId < 1 || !/^\d{4,8}$/.test(pin)) {
    return fail(res, 400, 'Enter your 4-8 digit staff PIN to claim this item.');
  }

  const station = String(req.body?.station || '').toLowerCase();
  const stationConfig = STATIONS[station];
  const isStationOversight = stationConfig?.oversight.includes(req.actor.role);
  const isManagement = MANAGEMENT_ROLES.includes(req.actor.role);
  if (!stationConfig || (!isStationOversight && !isManagement)) {
    return fail(res, 403, 'Only station oversight may claim items through the HOD queue.');
  }
  const identifierHash = createHash('sha256')
    .update(`restaurant-production-pin:${req.actor.id}`)
    .digest('hex');

  try {
    const attempt = await pool.query(
      'SELECT locked_until > NOW() AS locked FROM public.restaurant_production_pin_attempts WHERE identifier_hash=$1',
      [identifierHash]
    );
    if (attempt.rows[0]?.locked) {
      return fail(res, 429, 'Too many invalid PIN attempts. Try again later.');
    }
    const staffResult = await pool.query(
      `SELECT id, name, pin_salt, pin_hash FROM public.staff
       WHERE is_active=true AND role=ANY($1::text[])`,
      [stationConfig.roles]
    );
    const matches = [];
    for (const staff of staffResult.rows) {
      if (await verifyStaffPin(pin, staff.pin_salt, staff.pin_hash)) matches.push(staff);
    }
    if (matches.length !== 1) {
      await pool.query(
        `INSERT INTO public.restaurant_production_pin_attempts
           (identifier_hash, failures, locked_until)
         VALUES ($1, 1, NULL)
         ON CONFLICT (identifier_hash) DO UPDATE
         SET failures=CASE
               WHEN public.restaurant_production_pin_attempts.locked_until <= NOW() THEN 1
               ELSE public.restaurant_production_pin_attempts.failures + 1
             END,
             locked_until=CASE
               WHEN public.restaurant_production_pin_attempts.locked_until <= NOW() THEN NULL
               WHEN public.restaurant_production_pin_attempts.failures + 1 >= 10 THEN NOW() + INTERVAL '15 minutes'
               ELSE public.restaurant_production_pin_attempts.locked_until
             END,
             updated_at=NOW()`,
        [identifierHash]
      );
      return fail(res, 401, 'The staff PIN is incorrect.');
    }
    await pool.query(
      'DELETE FROM public.restaurant_production_pin_attempts WHERE identifier_hash=$1',
      [identifierHash]
    );
    const claimant = matches[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT * FROM public.restaurant_production_work WHERE id=$1 AND station=$2 FOR UPDATE',
        [workId, station]
      );
      const work = result.rows[0];
      if (!work) {
        await client.query('ROLLBACK');
        return fail(res, 404, 'Production item not found.');
      }
      if (work.status !== 'Unclaimed' || work.staff_id) {
        await client.query('ROLLBACK');
        return fail(res, 409, 'Another staff member has already claimed this item.');
      }
      const claimed = await client.query(
        `UPDATE public.restaurant_production_work
         SET staff_id=$1, staff_name=$2, status='Claimed', claimed_at=NOW(), updated_at=NOW()
         WHERE id=$3 RETURNING *`,
        [claimant.id, claimant.name, workId]
      );
      await client.query(
        `INSERT INTO public.restaurant_production_events
           (work_id, event_type, to_staff_id, actor_id, from_status, to_status)
         VALUES ($1, 'CLAIMED', $2, $3, 'Unclaimed', 'Claimed')`,
        [workId, claimant.id, req.actor.id]
      );
      await client.query('COMMIT');
      return res.json(claimed.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Production claim error:', err.message);
    return res.status(500).json({ error: 'Could not claim production item.' });
  }
});

router.patch('/work/:workId/status', async (req, res) => {
  const workId = Number(req.params.workId);
  const status = String(req.body?.status || '');
  const completedQuantity = req.body?.completed_quantity;
  if (!Number.isInteger(workId) || workId < 1 || !['Preparing', 'Completed'].includes(status)) {
    return fail(res, 400, 'A valid work item and preparation status are required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locatorResult = await client.query(
      'SELECT station, ticket_id FROM public.restaurant_production_work WHERE id=$1',
      [workId]
    );
    const locator = locatorResult.rows[0];
    if (!locator || !STATIONS[locator.station]) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Production item not found.');
    }
    const ticketTable = STATIONS[locator.station].table;
    await client.query(
      `SELECT id FROM public.${ticketTable} WHERE id=$1 FOR UPDATE`,
      [locator.ticket_id]
    );
    const result = await client.query(
      `SELECT * FROM public.restaurant_production_work WHERE id=$1 FOR UPDATE`,
      [workId]
    );
    const work = result.rows[0];
    if (!work) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Production item not found.');
    }
    if (!canAccessStation(req.actor, work.station)) {
      await client.query('ROLLBACK');
      return fail(res, 403, 'You are not authorized for this station.');
    }
    const isOversight = [...STATIONS[work.station].oversight, ...MANAGEMENT_ROLES].includes(req.actor.role);
    if (!isOversight) {
      await client.query('ROLLBACK');
      return fail(res, 403, 'Only station oversight or authorized management may update this item.');
    }
    if (['Cancelled', 'Voided'].includes(work.status)) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'Cancelled or voided work cannot be completed.');
    }
    if (work.status === 'Completed' && status !== 'Completed') {
      await client.query('ROLLBACK');
      return fail(res, 409, 'Completed work cannot return to preparation.');
    }
    const quantity = completedQuantity === undefined
      ? Number(work.quantity)
      : Number(completedQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0
        || quantity < Number(work.completed_quantity)
        || quantity > Number(work.quantity)) {
      await client.query('ROLLBACK');
      return fail(res, 400, 'completed_quantity must be greater than zero, cannot decrease, and cannot exceed the item quantity.');
    }
    const nextStatus = status === 'Completed' && quantity < Number(work.quantity)
      ? 'Preparing'
      : status;
    if (work.status === nextStatus && (status !== 'Completed' || Number(work.completed_quantity) === quantity)) {
      await client.query('ROLLBACK');
      return res.json(work);
    }
    const updated = await client.query(
      `UPDATE public.restaurant_production_work
       SET status=$1, completed_quantity=CASE WHEN $2='Completed' THEN $3 ELSE completed_quantity END,
           started_at=CASE WHEN $2 IN ('Preparing', 'Completed') THEN COALESCE(started_at, NOW()) ELSE started_at END,
           completed_at=CASE WHEN $1='Completed' THEN NOW() ELSE completed_at END,
           ready_at=CASE WHEN $1='Completed' THEN COALESCE(ready_at, NOW()) ELSE ready_at END,
           updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [nextStatus, status, quantity, workId]
    );
    let becameReady = null;
    await client.query(
      `INSERT INTO public.restaurant_production_events
         (work_id, event_type, actor_id, from_status, to_status, quantity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [workId, status === 'Preparing' ? 'STARTED' : quantity < Number(work.quantity) ? 'PARTIAL_COMPLETION' : 'COMPLETED',
        req.actor.id, work.status, nextStatus, status === 'Completed' ? quantity : null]
    );
    if (nextStatus === 'Preparing') {
      await client.query(
        `UPDATE public.${ticketTable} SET status='Preparing', updated_at=NOW()
         WHERE id=$1 AND status='Pending'`,
        [work.ticket_id]
      );
    } else if (nextStatus === 'Completed') {
      const remaining = await client.query(
        `SELECT COUNT(*)::int AS remaining
         FROM public.restaurant_production_work
         WHERE station=$1 AND ticket_id=$2
           AND status NOT IN ('Completed', 'Cancelled', 'Voided')`,
        [work.station, work.ticket_id]
      );
      if (Number(remaining.rows[0].remaining) === 0) {
        const readyResult = await client.query(
          `UPDATE public.${ticketTable}
           SET status='Ready', ready_at=COALESCE(ready_at,NOW()), updated_at=NOW()
           WHERE id=$1 AND status IN ('Pending', 'Preparing')
           RETURNING order_id`,
          [work.ticket_id]
        );
        becameReady = readyResult.rows[0] || null;
      }
    }
    await refreshPublicOrderPreparationStatus(work.order_id, client);
    await client.query('COMMIT');
    if (status === 'Preparing' && work.staff_id) {
      try {
        const orderResult = await pool.query(
          'SELECT staff_id, table_name FROM public.orders WHERE id=$1',
          [work.order_id]
        );
        const waiterId = orderResult.rows[0]?.staff_id;
        if (waiterId) {
          const stationName = work.station === 'bar' ? 'Bar' : work.station === 'barista' ? 'Barista' : 'Kitchen';
          void notificationService.sendToUser(waiterId, {
            type: 'PRODUCTION_STARTED',
            title: `${stationName} Started Preparation`,
            body: `${req.actor.name} started ${work.item_name} for Order #${work.order_id}${orderResult.rows[0]?.table_name ? ` · Table ${orderResult.rows[0].table_name}` : ''}.`,
            department: stationName,
            referenceId: work.order_id,
            link: `/staff/waiter?order=${work.order_id}`,
          }).catch((notificationError) => {
            console.error('Production start notification failed:', notificationError.message);
          });
        }
      } catch (notificationError) {
        console.error('Production start notification lookup failed:', notificationError.message);
      }
    }
    res.json({ ...updated.rows[0], ticket_ready: Boolean(becameReady) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Production status update error:', err.message);
    res.status(500).json({ error: 'Could not update production status.' });
  } finally {
    client.release();
  }
});

router.post('/work/:workId/notify', async (req, res) => {
  const workId = Number(req.params.workId);
  const resend = req.body?.resend === true;
  if (!Number.isInteger(workId) || workId < 1) {
    return fail(res, 400, 'A valid production item is required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT * FROM public.restaurant_production_work WHERE id=$1 FOR UPDATE',
      [workId]
    );
    const work = result.rows[0];
    if (!work || !STATIONS[work.station]) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Production item not found.');
    }
    if (!canAccessStation(req.actor, work.station)) {
      await client.query('ROLLBACK');
      return fail(res, 403, 'You are not authorized for this station.');
    }
    const isOversight = [...STATIONS[work.station].oversight, ...MANAGEMENT_ROLES].includes(req.actor.role);
    if (!isOversight) {
      await client.query('ROLLBACK');
      return fail(res, 403, 'Only station oversight or authorized management may notify the sender.');
    }
    if (work.status !== 'Completed' || !work.ready_at) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This item must be ready before its sender can be notified.');
    }
    if (work.notification_status === 'Sending'
        && Date.now() - new Date(work.updated_at).getTime() < 120000) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'A notification for this item is already in progress.');
    }
    if (work.notified_at && !resend) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'The sender has already been notified about this item.');
    }
    if (resend && !isOversight) {
      await client.query('ROLLBACK');
      return fail(res, 403, 'Only station oversight or management may resend a notification.');
    }

    const orderResult = await client.query(
      `SELECT order_row.id, order_row.staff_id, order_row.table_name,
              COALESCE(NULLIF(order_row.public_order_ref, ''), 'Order #' || order_row.id::text) AS order_reference,
              COALESCE(NULLIF(order_row.staff_name, ''), sender.name, 'Staff') AS sender_name
       FROM public.orders order_row
       LEFT JOIN public.staff sender ON sender.id=order_row.staff_id
       WHERE order_row.id=$1`,
      [work.order_id]
    );
    const order = orderResult.rows[0];
    if (!order?.staff_id) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'The original order sender could not be identified.');
    }

    await client.query(
      `UPDATE public.restaurant_production_work
       SET notification_status='Sending', updated_at=NOW()
       WHERE id=$1`,
      [workId]
    );
    await client.query('COMMIT');

    const stationName = work.station === 'bar'
      ? 'Bar'
      : work.station === 'barista' ? 'Barista' : 'Kitchen';
    const notification = await notificationService.sendToUser(order.staff_id, {
      type: 'ORDER_ITEM_READY',
      title: `${stationName} item ready`,
      body: `${order.order_reference} · Table ${order.table_name || 'Walk-in'} · ${work.item_name} × ${work.quantity} is ready to serve.`,
      department: stationName,
      referenceId: work.order_id,
      referenceType: 'ORDER',
      link: `/staff/waiter?order=${work.order_id}`,
    });
    if (notification.error) {
      await pool.query(
        `UPDATE public.restaurant_production_work
         SET notification_status='Failed', updated_at=NOW()
         WHERE id=$1 AND notification_status='Sending'`,
        [workId]
      );
      return fail(res, 503, 'The sender notification could not be delivered. Please retry.');
    }

    const notified = await pool.query(
      `UPDATE public.restaurant_production_work
       SET notification_status='Sent', notified_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND notification_status='Sending'
       RETURNING id AS work_id, ready_at, notification_status, notified_at`,
      [workId]
    );
    await pool.query(
      `INSERT INTO public.restaurant_production_events
         (work_id, event_type, actor_id, from_status, to_status)
       VALUES ($1, 'NOTIFIED', $2, 'Ready', 'Notified')`,
      [workId, req.actor.id]
    );
    return res.json({ ...notified.rows[0], sender_name: order.sender_name, delivery: notification.sent ? 'push' : 'panel' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Production sender notification error:', err.message);
    return res.status(500).json({ error: 'Could not notify the original sender.' });
  } finally {
    client.release();
  }
});

router.post('/work/:workId/reassign', async (req, res) => {
  return fail(res, 410, 'Manual assignments are retired. Staff claim each station item with their PIN.');
});

router.get('/history', async (req, res) => {
  const from = req.query.from;
  const to = req.query.to;
  if (!validDate(from) || !validDate(to) || from > to) {
    return fail(res, 400, 'Valid from and to dates are required.');
  }
  const canViewTeam = [...MANAGEMENT_ROLES, 'ACCOUNTANT', 'KITCHEN_HOD', 'BAR_HOD', 'BARISTA_HOD'].includes(req.actor.role);
  const requestedId = Number(req.query.staff_id);
  const staffId = canViewTeam
    ? (Number.isInteger(requestedId) && requestedId > 0 ? requestedId : null)
    : req.actor.id;
  const oversightStations = {
    KITCHEN_HOD: 'kitchen',
    BAR_HOD: 'bar',
    BARISTA_HOD: 'barista',
  };
  const station = req.query.station
    ? String(req.query.station).toLowerCase()
    : oversightStations[req.actor.role] || null;
  if (station && !STATIONS[station]) return fail(res, 400, 'Unknown production station.');
  if (station && !canAccessStation(req.actor, station)
      && !(req.actor.role === 'ACCOUNTANT' && canViewTeam)) {
    return fail(res, 403, 'You are not authorized for this station.');
  }

  try {
    const result = await pool.query(
      `SELECT work.id AS work_id, work.station, work.order_id, work.ticket_id, work.item_index,
              work.item_name, work.quantity, work.completed_quantity, work.status,
              work.claimed_at, work.started_at, work.completed_at, work.staff_id,
              COALESCE(staff.name, work.staff_name) AS staff_name,
              COALESCE(ticket.table_name, work.table_name) AS table_name,
              COALESCE(ticket.created_at, work.order_created_at, work.created_at) AS order_created_at,
              work.item_notes
       FROM public.restaurant_production_work work
       LEFT JOIN public.staff staff ON staff.id=work.staff_id
       LEFT JOIN public.kitchen_tickets ticket ON work.station='kitchen' AND ticket.id=work.ticket_id
       LEFT JOIN public.barman_tickets bar_ticket ON work.station='bar' AND bar_ticket.id=work.ticket_id
       LEFT JOIN public.barista_tickets barista_ticket ON work.station='barista' AND barista_ticket.id=work.ticket_id
       WHERE ($1::integer IS NULL OR work.staff_id=$1)
         AND (work.claimed_at AT TIME ZONE 'Africa/Kampala') >= $2::date
         AND (work.claimed_at AT TIME ZONE 'Africa/Kampala') < ($3::date + INTERVAL '1 day')
         AND ($4::text IS NULL OR work.station=$4)
       ORDER BY work.claimed_at DESC`,
      [staffId, from, to, station]
    );
    res.json({
      staff_id: staffId,
      records: result.rows,
      totals: {
        items_claimed: result.rows.length,
        items_started: result.rows.filter((item) => item.started_at).length,
        items_completed: result.rows.filter((item) => item.status === 'Completed').length,
        orders_handled: new Set(result.rows.map((item) => item.order_id)).size,
        orders_completed: new Set(result.rows.filter((item) => item.status === 'Completed').map((item) => item.order_id)).size,
        quantity_claimed: result.rows.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        quantity_completed: result.rows.reduce((sum, item) =>
          sum + (['Cancelled', 'Voided'].includes(item.status) ? 0 : Number(item.completed_quantity || 0)), 0),
      },
    });
  } catch (err) {
    console.error('Production history error:', err.message);
    res.status(500).json({ error: 'Could not load production history.' });
  }
});

export default router;
