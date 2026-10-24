import express from 'express';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { summarizeDepartmentCredits } from '../helpers/departmentCreditSummary.js';
import { syncRoutableStationTickets } from '../helpers/stationOrderTickets.js';
import { hashStaffPin } from '../helpers/staffPin.js';

const router = express.Router();
const MANAGEMENT_ROLES = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'];
const DEPARTMENTS = {
  kitchen: { label: 'Kitchen', station: 'KITCHEN', hodRole: 'KITCHEN_HOD', staffRole: 'CHEF', table: 'kitchen_tickets', assignments: 'chef_assignments', paidItemFilter: "LOWER(COALESCE(item->>'station','kitchen')) NOT IN ('barman','bar','barista','shisha')" },
  bar: { label: 'Bar', station: 'BARMAN', hodRole: 'BAR_HOD', staffRole: 'BARMAN', table: 'barman_tickets', assignments: 'barman_assignments', paidItemFilter: "LOWER(COALESCE(item->>'station','')) IN ('barman','bar')" },
  barista: { label: 'Barista', station: 'BARISTA', hodRole: 'BARISTA_HOD', staffRole: 'BARISTA', table: 'barista_tickets', assignments: 'barista_assignments', paidItemFilter: "LOWER(COALESCE(item->>'station',''))='barista'" },
};

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return fail(res, 401, 'Sign in to access department management.');

  try {
    const session = readSessionToken(token);
    if (session.scope !== 'restaurant' || !session.id) return fail(res, 401, 'Invalid staff session.');
    const result = await pool.query(
      'SELECT id, name, email, role, is_active FROM public.staff WHERE id=$1',
      [session.id]
    );
    const staff = result.rows[0];
    if (!staff || staff.is_active === false || staff.role !== session.role) {
      return fail(res, 401, 'Staff account is inactive or has changed.');
    }
    req.actor = staff;
    return next();
  } catch {
    return fail(res, 401, 'Session expired. Sign in again.');
  }
}

router.use(authenticate);

function departmentFor(value) {
  return DEPARTMENTS[String(value || '').toLowerCase()];
}

async function inventoryReport(station, from, to) {
  const consumptionStationFilter = station === 'KITCHEN'
    ? "UPPER(COALESCE(NULLIF(ic.station,''), NULLIF(ii.station,''), 'KITCHEN')) NOT IN ('BARMAN','BAR','BARISTA','SHISHA')"
    : station === 'BARMAN'
      ? "UPPER(COALESCE(NULLIF(ic.station,''), NULLIF(ii.station,''), '')) IN ('BARMAN','BAR')"
      : "UPPER(COALESCE(NULLIF(ic.station,''), NULLIF(ii.station,''), '')) = 'BARISTA'";
  const wasteStationFilter = station === 'KITCHEN'
    ? "UPPER(COALESCE(NULLIF(it.station,''), NULLIF(ii.station,''), 'KITCHEN')) NOT IN ('BARMAN','BAR','BARISTA','SHISHA')"
    : station === 'BARMAN'
      ? "UPPER(COALESCE(NULLIF(it.station,''), NULLIF(ii.station,''), '')) IN ('BARMAN','BAR')"
      : "UPPER(COALESCE(NULLIF(it.station,''), NULLIF(ii.station,''), '')) = 'BARISTA'";
  const result = await pool.query(
    `WITH department_usage AS (
       SELECT 'CONSUMPTION' AS transaction_type, ii.item_name, ic.unit,
              SUM(ic.quantity) AS quantity, SUM(ic.quantity * ii.unit_cost) AS value
       FROM public.inventory_consumptions ic
       JOIN public.inventory_items ii ON ii.id = ic.item_id
       WHERE ic.business_date BETWEEN $1::date AND $2::date
         AND ${consumptionStationFilter}
         AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
       GROUP BY ii.item_name, ic.unit
       UNION ALL
       SELECT 'WASTE' AS transaction_type, ii.item_name, it.unit,
              SUM(it.quantity) AS quantity, SUM(it.total_value) AS value
       FROM public.inventory_transactions it
       JOIN public.inventory_items ii ON ii.id = it.item_id
       WHERE it.transaction_type = 'WASTE'
         AND it.business_date BETWEEN $1::date AND $2::date
         AND ${wasteStationFilter}
         AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
       GROUP BY ii.item_name, it.unit
     )
     SELECT transaction_type, item_name, unit, SUM(quantity) AS quantity, SUM(value) AS value
     FROM department_usage
     GROUP BY transaction_type, item_name, unit
     ORDER BY item_name, transaction_type`,
    [from, to]
  );
  const consumption = result.rows.filter((row) => row.transaction_type === 'CONSUMPTION');
  const waste = result.rows.filter((row) => row.transaction_type === 'WASTE');
  const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
  return {
    cogs: sum(consumption, 'value'),
    consumption_value: sum(consumption, 'value'),
    consumption_quantity: sum(consumption, 'quantity'),
    waste: sum(waste, 'value'),
    waste_quantity: sum(waste, 'quantity'),
    inventory_usage: consumption.map((row) => ({ item_name: row.item_name, unit: row.unit, quantity: Number(row.quantity || 0), value: Number(row.value || 0) })),
  };
}

async function menuItemReport(department, from, to) {
  const [salesResult, voidedResult] = await Promise.all([pool.query(
    `SELECT item->>'name' AS menu_item,
            COALESCE(SUM(COALESCE(
              NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
              COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
                * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
            )),0) AS sales,
            COALESCE(SUM(COALESCE(NULLIF(item->>'quantity','')::numeric,1)),0) AS quantity
     FROM public.${department.table} t
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
     WHERE t.ticket_date BETWEEN $1::date AND $2::date
       AND COALESCE(item->>'voidProcessed','false') <> 'true'
       AND UPPER(COALESCE(item->>'status','')) <> 'VOIDED'
       AND ${approvedVoidExclusion('t.order_id')}
       AND ${department.paidItemFilter}
     GROUP BY item->>'name'
     ORDER BY sales DESC, menu_item`,
    [from, to]
  ), pool.query(
    `SELECT vr.item_name AS menu_item,
            COALESCE(SUM(COALESCE(vr.original_price,0) * COALESCE(vr.original_quantity,1)),0) AS voided_total,
            COALESCE(SUM(COALESCE(vr.original_quantity,1)),0) AS voided_quantity
     FROM public.void_requests vr
     WHERE vr.status = 'Approved'
       AND (vr.resolved_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
       AND EXISTS (
         SELECT 1
         FROM public.${department.table} t
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
         WHERE t.order_id = vr.order_id
           AND LOWER(BTRIM(COALESCE(item->>'name',''))) = LOWER(BTRIM(vr.item_name))
           AND ${department.paidItemFilter}
       )
     GROUP BY vr.item_name`,
    [from, to]
  )]);
  const rows = new Map();
  for (const row of salesResult.rows) {
    rows.set(row.menu_item, {
      menu_item: row.menu_item,
      sales: Number(row.sales || 0),
      quantity: Number(row.quantity || 0),
      voided_total: 0,
      voided_quantity: 0,
    });
  }
  for (const row of voidedResult.rows) {
    const menuItem = rows.get(row.menu_item) || {
      menu_item: row.menu_item,
      sales: 0,
      quantity: 0,
      voided_total: 0,
      voided_quantity: 0,
    };
    menuItem.voided_total = Number(row.voided_total || 0);
    menuItem.voided_quantity = Number(row.voided_quantity || 0);
    rows.set(row.menu_item, menuItem);
  }
  return [...rows.values()].sort((a, b) => b.sales - a.sales || a.menu_item.localeCompare(b.menu_item));
}

async function departmentVoidedTotals(department, from, to) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(COALESCE(vr.original_price,0) * COALESCE(vr.original_quantity,1)),0) AS voided_total,
            COALESCE(SUM(COALESCE(vr.original_quantity,1)),0) AS voided_quantity
     FROM public.void_requests vr
     WHERE vr.status = 'Approved'
       AND (vr.resolved_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
       AND EXISTS (
         SELECT 1
         FROM public.${department.table} t
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
         WHERE t.order_id = vr.order_id
           AND LOWER(BTRIM(COALESCE(item->>'name',''))) = LOWER(BTRIM(vr.item_name))
           AND ${department.paidItemFilter}
       )`,
    [from, to]
  );
  return {
    voided_total: Number(result.rows[0]?.voided_total || 0),
    voided_quantity: Number(result.rows[0]?.voided_quantity || 0),
  };
}

async function departmentCreditReport(department, from, to) {
  const itemFilter = department.paidItemFilter.replaceAll('item->>', 'credit_items.item->>');
  const result = await pool.query(
    `SELECT DISTINCT c.id, c.amount, c.amount_paid, c.paid, c.status
     FROM public.${department.table} t
     JOIN public.credits c ON c.order_id = t.order_id
     WHERE t.ticket_date BETWEEN $1::date AND $2::date
       AND EXISTS (
         SELECT 1
         FROM jsonb_array_elements(COALESCE(t.items, '[]'::jsonb)) AS credit_items(item)
         WHERE LOWER(TRIM(COALESCE(credit_items.item->>'name', ''))) = LOWER(TRIM(COALESCE(c.label, '')))
           AND ${itemFilter}
       )`,
    [from, to]
  );
  return summarizeDepartmentCredits(result.rows);
}

function departmentPaymentJoin(department) {
  const itemAmount = `COALESCE(
    NULLIF(item->>'line_total','')::numeric,
    NULLIF(item->>'lineTotal','')::numeric,
    COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
      * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
  )`;
  const hasCredit = `EXISTS (
    SELECT 1 FROM public.credits credit
    WHERE credit.order_id = o.id
      AND LOWER(TRIM(COALESCE(credit.label,''))) = LOWER(TRIM(COALESCE(item->>'name','')))
  )`;
  const creditPaid = `COALESCE((
    SELECT SUM(credit.amount_paid) FROM public.credits credit
    WHERE credit.order_id = o.id
      AND LOWER(TRIM(COALESCE(credit.label,''))) = LOWER(TRIM(COALESCE(item->>'name','')))
  ),0)`;

  return `LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(CASE
      WHEN ${hasCredit} THEN LEAST(${itemAmount}, ${creditPaid})
      WHEN item->>'_rowPaid'='true' THEN ${itemAmount}
      ELSE LEAST(${itemAmount}, COALESCE(NULLIF(item->>'partial_amount_paid','')::numeric,0))
    END),0) AS collected_amount
    FROM jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) AS source_items(item)
    WHERE (item->>'_rowPaid'='true' OR item->>'is_partially_paid'='true'
      OR item->>'creditRequested'='true' OR ${hasCredit})
      AND COALESCE(item->>'voidProcessed','false') <> 'true'
      AND UPPER(COALESCE(item->>'status','')) <> 'VOIDED'
      AND ${approvedVoidExclusion('o.id')}
      AND ${department.paidItemFilter}
  ) paid ON true`;
}

function approvedVoidExclusion(orderId) {
  return `NOT EXISTS (
    SELECT 1 FROM public.void_requests vr
    WHERE vr.order_id = ${orderId}
      AND UPPER(COALESCE(vr.status,'')) = 'APPROVED'
      AND LOWER(BTRIM(COALESCE(vr.item_name,''))) = LOWER(BTRIM(COALESCE(item->>'name','')))
      AND COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric,0)
        = COALESCE(vr.original_price,0)
      AND COALESCE(NULLIF(item->>'quantity','')::numeric,1) = COALESCE(vr.original_quantity,1)
  )`;
}

function requireDepartmentHod(req, res, next) {
  const department = departmentFor(req.params.department);
  if (!department) return fail(res, 404, 'Department not found.');
  if (req.actor.role !== department.hodRole) return fail(res, 403, 'Department HOD access is required.');
  req.department = department;
  return next();
}

function requireDepartmentDirector(req, res, next) {
  const department = departmentFor(req.params.department);
  if (!department) return fail(res, 404, 'Department not found.');
  if (req.actor.role !== 'DIRECTOR') return fail(res, 403, 'Director access is required to manage department accounts.');
  req.department = department;
  return next();
}

function dateRange(req, res) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
  const from = req.query.from || today;
  const to = req.query.to || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    fail(res, 400, 'Provide a valid date range.');
    return null;
  }
  return { from, to };
}

router.get('/:department/staff', requireDepartmentHod, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at FROM public.staff
       WHERE role=$1 ORDER BY name`,
      [req.department.staffRole]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Department staff list error:', error.message);
    return fail(res, 500, 'Could not load department staff.');
  }
});

router.get('/:department/tickets', requireDepartmentHod, async (req, res) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
  const date = req.query.date || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return fail(res, 400, 'Provide a valid ticket date.');
  }

  try {
    await syncRoutableStationTickets(pool, req.params.department);
    await pool.query(
      `INSERT INTO public.restaurant_production_work
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
                WHEN item.value->>'voidProcessed' = 'true' OR UPPER(COALESCE(item.value->>'status', '')) = 'VOIDED' THEN 'Voided'
                ELSE 'Unclaimed'
              END
       FROM public.${req.department.table} ticket
       JOIN public.orders order_row ON order_row.id=ticket.order_id
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ticket.items, '[]'::jsonb))
         WITH ORDINALITY AS item(value, ordinality)
       ON CONFLICT (station, ticket_id, item_index) DO NOTHING`,
      [req.params.department]
    );
    const result = await pool.query(
      `SELECT t.*,
              COALESCE(
                array_agg(DISTINCT a.assigned_to ORDER BY a.assigned_to)
                  FILTER (WHERE a.assigned_to IS NOT NULL AND BTRIM(a.assigned_to) <> ''),
                ARRAY[]::text[]
              ) AS workers
       FROM public.${req.department.table} t
       LEFT JOIN public.${req.department.assignments} a ON a.ticket_id = t.id
       WHERE t.ticket_date = $1::date
         AND COALESCE(t.cleared_by_kitchen, false) = false
         AND t.cleared_at IS NULL
       GROUP BY t.id
       ORDER BY t.created_at ASC`,
      [date]
    );
    if (!result.rows.length) return res.json([]);
    const production = await pool.query(
      `SELECT work.id AS work_id, work.ticket_id, work.item_index, work.item_name, work.status,
              work.staff_id, COALESCE(staff.name, work.staff_name) AS staff_name,
              work.claimed_at, work.started_at, work.completed_at, work.ready_at,
              work.notification_status, work.notified_at
       FROM public.restaurant_production_work work
       LEFT JOIN public.staff staff ON staff.id=work.staff_id
       WHERE work.station=$1 AND work.ticket_id=ANY($2::integer[])`,
      [req.params.department, result.rows.map((ticket) => ticket.id)]
    );
    const workByTicket = new Map();
    for (const work of production.rows) {
      const items = workByTicket.get(work.ticket_id) || new Map();
      items.set(Number(work.item_index), work);
      workByTicket.set(work.ticket_id, items);
    }
    const tickets = result.rows.map((ticket) => {
      const sourceItems = Array.isArray(ticket.items) ? ticket.items : [];
      const ticketWork = workByTicket.get(ticket.id);
      const workers = [...new Set(
        [...(ticketWork?.values() || [])].map((work) => work.staff_name).filter(Boolean)
      )].sort();
      return {
        ...ticket,
        workers,
        items: sourceItems.map((item, index) => {
          const itemIndex = Number(item?._orderItemIndex ?? index);
          const work = ticketWork?.get(itemIndex);
          return {
            ...item,
            assignedTo: work?.staff_name || null,
            assigned_to: work?.staff_name || null,
            production_work_id: work?.work_id || null,
            production_status: work?.status || 'Unclaimed',
            production_staff_id: work?.staff_id || null,
            production_staff_name: work?.staff_name || null,
            production_claimed_at: work?.claimed_at || null,
            production_started_at: work?.started_at || null,
            production_completed_at: work?.completed_at || null,
            production_ready_at: work?.ready_at || null,
            production_notification_status: work?.notification_status || 'Pending',
            production_notified_at: work?.notified_at || null,
          };
        }),
      };
    });
    return res.json(tickets);
  } catch (error) {
    console.error('Department tickets error:', error.message);
    return fail(res, 500, 'Could not load department tickets and worker assignments.');
  }
});

router.get('/:department/assignment-queue', requireDepartmentHod, async (req, res) => {
  return fail(res, 410, 'Station tickets are routed automatically; workers claim individual items with their PIN.');
});

router.post('/:department/orders/:orderId/assign', requireDepartmentHod, async (req, res) => {
  return fail(res, 410, 'Manual staff assignments are retired. Staff members claim station items with their PIN.');
});

router.get('/:department/workers', async (req, res) => {
  const department = departmentFor(req.params.department);
  if (!department) return fail(res, 404, 'Department not found.');
  if (![department.hodRole, department.staffRole, ...MANAGEMENT_ROLES].includes(req.actor.role)) {
    return fail(res, 403, 'Department staff access is required.');
  }
  try {
    const result = await pool.query(
      `SELECT id, name, role FROM public.staff WHERE role=$1 AND is_active=true ORDER BY name`,
      [department.staffRole]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Department worker list error:', error.message);
    return fail(res, 500, 'Could not load department staff.');
  }
});

router.post('/:department/staff', requireDepartmentDirector, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const pin = String(req.body.pin || '').trim();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4,8}$/.test(pin)) {
    return fail(res, 400, 'Name, valid email, and a 4-8 digit PIN are required.');
  }
  try {
    const { salt, hash } = await hashStaffPin(pin);
    const result = await pool.query(
      `INSERT INTO public.staff
         (name, email, pin, pin_salt, pin_hash, role, is_active, is_permitted, monthly_income_target, daily_order_target)
       VALUES ($1, $2, NULL, $3, $4, $5, true, false, 0, 0)
       RETURNING id, name, email, role, is_active, created_at`,
      [name, email, salt, hash, req.department.staffRole]
    );
    return res.status(201).json({ staff: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'That email already has a staff account.');
    console.error('Create department staff error:', error.message);
    return fail(res, 500, 'Could not create the department account.');
  }
});

router.patch('/:department/staff/:id', requireDepartmentDirector, async (req, res) => {
  const staffId = Number(req.params.id);
  if (!Number.isInteger(staffId) || staffId <= 0) return fail(res, 400, 'A valid department staff account is required.');

  const updates = [];
  const values = [];
  const body = req.body || {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = String(body.name || '').trim();
    if (!name) return fail(res, 400, 'Staff name is required.');
    values.push(name);
    updates.push(`name=$${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'email')) {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Provide a valid staff email address.');
    values.push(email);
    updates.push(`email=$${values.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'pin') && String(body.pin || '').trim()) {
    const pin = String(body.pin).trim();
    if (!/^\d{4,8}$/.test(pin)) return fail(res, 400, 'PIN must contain 4-8 digits.');
    const { salt, hash } = await hashStaffPin(pin);
    values.push(salt);
    updates.push(`pin_salt=$${values.length}`);
    values.push(hash);
    updates.push(`pin_hash=$${values.length}`);
    updates.push('pin=NULL');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
    if (typeof body.is_active !== 'boolean') return fail(res, 400, 'Account status must be active or inactive.');
    values.push(body.is_active);
    updates.push(`is_active=$${values.length}`);
  }
  if (!updates.length) return fail(res, 400, 'Provide account details or status to update.');

  values.push(staffId, req.department.staffRole);
  try {
    const result = await pool.query(
      `UPDATE public.staff SET ${updates.join(', ')}, updated_at=NOW()
       WHERE id=$${values.length - 1} AND role=$${values.length}
       RETURNING id, name, email, role, is_active`,
      values
    );
    return result.rows[0] ? res.json(result.rows[0]) : fail(res, 404, 'Department staff member not found.');
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'That email already has a staff account.');
    console.error('Update department staff error:', error.message);
    return fail(res, 500, 'Could not update the department account.');
  }
});

router.get('/reports/consolidated', async (req, res) => {
  if (!MANAGEMENT_ROLES.includes(req.actor.role)) return fail(res, 403, 'Management reporting access is required.');
  const range = dateRange(req, res);
  if (!range) return undefined;
  const summaryOnly = req.query.summary_only === 'true';
  try {
    const reports = await Promise.all(Object.entries(DEPARTMENTS).map(async ([key, department]) => {
      const [result, performance, menuItems, inventory, creditSummary, voidedTotals] = await Promise.all([
        pool.query(
        `SELECT COUNT(*)::int AS total_orders, COALESCE(SUM(sales.sales_amount),0) AS total_sales,
          COALESCE(SUM(LEAST(sales.sales_amount, paid.collected_amount)),0) AS amount_collected,
          COALESCE(SUM(GREATEST(sales.sales_amount - LEAST(sales.sales_amount, paid.collected_amount),0)),0) AS outstanding_balance
         FROM public.${department.table} t LEFT JOIN public.orders o ON o.id=t.order_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(COALESCE(
             NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
             COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
               * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
           )),0) AS sales_amount
           FROM jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
           WHERE COALESCE(item->>'voidProcessed','false') <> 'true'
             AND UPPER(COALESCE(item->>'status','')) <> 'VOIDED'
             AND ${approvedVoidExclusion('t.order_id')}
             AND ${department.paidItemFilter}
         ) sales ON true
         ${departmentPaymentJoin(department)}
         WHERE t.ticket_date BETWEEN $1::date AND $2::date`,
        [range.from, range.to]
        ),
        pool.query(
          `SELECT COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to','')) AS staff_name,
            COUNT(*)::int AS items_assigned,
            COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(t.status,''))) IN ('ready','served','paid','closed'))::int AS completed_items,
            COALESCE(SUM(COALESCE(
              NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
              COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
                * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
            )),0) AS total_sales
           FROM public.${department.table} t
           CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
           WHERE t.ticket_date BETWEEN $1::date AND $2::date
             AND COALESCE(item->>'voidProcessed','false') <> 'true'
             AND UPPER(COALESCE(item->>'status','')) <> 'VOIDED'
             AND ${approvedVoidExclusion('t.order_id')}
             AND COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to','')) IS NOT NULL
             AND ${department.paidItemFilter}
           GROUP BY COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to',''))
           ORDER BY total_sales DESC, 1`,
          [range.from, range.to]
        ),
        summaryOnly ? Promise.resolve([]) : menuItemReport(department, range.from, range.to),
        summaryOnly
          ? Promise.resolve({})
          : inventoryReport(department.station, range.from, range.to),
        departmentCreditReport(department, range.from, range.to),
        departmentVoidedTotals(department, range.from, range.to),
      ]);
      const summary = result.rows[0];
      const inventoryData = inventory;
      return {
        department: key,
        label: department.label,
        ...summary,
        total_sales: Number(summary.total_sales || 0),
        ...inventoryData,
        ...creditSummary,
        ...voidedTotals,
        gross_profit: summaryOnly ? null : Number(summary.total_sales || 0) - inventoryData.cogs,
        menu_items: menuItems,
        staff_performance: performance.rows.map(person => ({ ...person, worker_role: department.staffRole })),
      };
    }));
    const [shisha, shishaPerformance] = summaryOnly
      ? [
          { rows: [{ total_orders: 0, total_sales: 0, amount_collected: 0, outstanding_balance: 0 }] },
          { rows: [] },
        ]
      : await Promise.all([
          pool.query(
            `SELECT COUNT(*)::int AS total_orders, COALESCE(SUM(total_amount),0) AS total_sales,
              COALESCE(SUM(amount_paid),0) AS amount_collected, COALESCE(SUM(outstanding_amount),0) AS outstanding_balance
             FROM public.shisha_orders
             WHERE created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
               AND created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')`,
            [range.from, range.to]
          ),
          pool.query(
            `SELECT s.name AS staff_name,
              CASE WHEN s.role='SHISHA_CHEF' THEN 'MIXER' ELSE 'SHISHA_WAITER' END AS worker_role,
              COUNT(o.id)::int AS items_assigned,
              COUNT(o.id) FILTER (WHERE o.order_status IN ('READY','SERVED','FULLY_PAID','PARTIALLY_PAID'))::int AS completed_items,
              COALESCE(SUM(o.total_amount),0) AS total_sales
             FROM public.shisha_staff s
             LEFT JOIN public.shisha_orders o ON
               ((s.role='SHISHA_WAITER' AND o.shisha_waiter_id=s.id) OR
                (s.role='SHISHA_CHEF' AND o.assigned_chef_id=s.id))
               AND o.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
               AND o.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
             WHERE s.role IN ('SHISHA_WAITER','SHISHA_CHEF')
             GROUP BY s.id, s.name ORDER BY items_assigned DESC, s.name`,
            [range.from, range.to]
          ),
        ]);
    const totals = reports.reduce((total, row) => ({
      total_orders: total.total_orders + Number(row.total_orders || 0),
      total_sales: total.total_sales + Number(row.total_sales || 0),
      voided_total: total.voided_total + Number(row.voided_total || 0),
      voided_quantity: total.voided_quantity + Number(row.voided_quantity || 0),
      cogs: total.cogs + Number(row.cogs || 0),
      gross_profit: total.gross_profit + Number(row.gross_profit || 0),
      consumption_value: total.consumption_value + Number(row.consumption_value || 0),
      waste: total.waste + Number(row.waste || 0),
      amount_collected: total.amount_collected + Number(row.amount_collected || 0),
      outstanding_balance: total.outstanding_balance + Number(row.outstanding_balance || 0),
      partially_paid_credit_count: total.partially_paid_credit_count + Number(row.partially_paid_credit_count || 0),
      partially_paid_credit_amount: total.partially_paid_credit_amount + Number(row.partially_paid_credit_amount || 0),
      partially_paid_credit_balance: total.partially_paid_credit_balance + Number(row.partially_paid_credit_balance || 0),
      settled_credit_count: total.settled_credit_count + Number(row.settled_credit_count || 0),
      settled_credit_amount: total.settled_credit_amount + Number(row.settled_credit_amount || 0),
      outstanding_credit_count: total.outstanding_credit_count + Number(row.outstanding_credit_count || 0),
      outstanding_credit_balance: total.outstanding_credit_balance + Number(row.outstanding_credit_balance || 0),
    }), { total_orders: 0, total_sales: 0, voided_total: 0, voided_quantity: 0, cogs: 0, gross_profit: 0, consumption_value: 0, waste: 0, amount_collected: 0, outstanding_balance: 0, partially_paid_credit_count: 0, partially_paid_credit_amount: 0, partially_paid_credit_balance: 0, settled_credit_count: 0, settled_credit_amount: 0, outstanding_credit_count: 0, outstanding_credit_balance: 0 });
    const response = {
      ...range,
      departments: reports,
      main_departments: reports,
      summary_only: summaryOnly,
    };
    if (!summaryOnly) {
      response.main_totals = totals;
      response.shisha_subsystem = { ...shisha.rows[0], staff_performance: shishaPerformance.rows };
    }
    return res.json(response);
  } catch (error) {
    console.error('Consolidated department report error:', error.message);
    return fail(res, 500, 'Could not load consolidated department reports.');
  }
});

router.get('/:department/reports', async (req, res) => {
  const department = departmentFor(req.params.department);
  if (!department) return fail(res, 404, 'Department not found.');
  if (req.actor.role !== department.hodRole && !MANAGEMENT_ROLES.includes(req.actor.role)) {
    return fail(res, 403, 'Department reporting access is required.');
  }
  const range = dateRange(req, res);
  if (!range) return undefined;

  try {
    const [summary, performance, menuItems, inventory, creditSummary, voidedTotals] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total_orders,
          COALESCE(SUM(sales.sales_amount),0) AS total_sales,
          COALESCE(SUM(LEAST(sales.sales_amount, paid.collected_amount)),0) AS amount_collected,
          COALESCE(SUM(GREATEST(sales.sales_amount - LEAST(sales.sales_amount, paid.collected_amount),0)),0) AS outstanding_balance,
          COUNT(*) FILTER (WHERE t.status='Pending')::int AS pending_orders,
          COUNT(*) FILTER (WHERE t.status='Preparing')::int AS preparing_orders,
          COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(t.status,''))) IN ('ready','served','paid','closed'))::int AS completed_orders
         FROM public.${department.table} t
         LEFT JOIN public.orders o ON o.id=t.order_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(COALESCE(
             NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
             COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
               * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
           )),0) AS sales_amount
           FROM jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
           WHERE COALESCE(item->>'voidProcessed','false') <> 'true'
             AND UPPER(COALESCE(item->>'status','')) <> 'VOIDED'
             AND ${approvedVoidExclusion('t.order_id')}
             AND ${department.paidItemFilter}
         ) sales ON true
         ${departmentPaymentJoin(department)}
         WHERE t.ticket_date BETWEEN $1::date AND $2::date`,
        [range.from, range.to]
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to','')) AS staff_name,
          COUNT(*)::int AS items_assigned,
          COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(t.status,''))) IN ('ready','served','paid','closed'))::int AS completed_items,
          COALESCE(SUM(COALESCE(
            NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
            COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
              * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
          )),0) AS total_sales
         FROM public.${department.table} t
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
         WHERE t.ticket_date BETWEEN $1::date AND $2::date
           AND COALESCE(item->>'voidProcessed','false') <> 'true'
           AND UPPER(COALESCE(item->>'status','')) <> 'VOIDED'
           AND ${approvedVoidExclusion('t.order_id')}
           AND COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to','')) IS NOT NULL
           AND ${department.paidItemFilter}
         GROUP BY COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to',''))
         ORDER BY total_sales DESC, 1`,
        [range.from, range.to]
      ),
      menuItemReport(department, range.from, range.to),
      inventoryReport(department.station, range.from, range.to),
      departmentCreditReport(department, range.from, range.to),
      departmentVoidedTotals(department, range.from, range.to),
    ]);
    const departmentSummary = summary.rows[0];
    const inventoryData = inventory;
    return res.json({
      department: req.params.department,
      ...range,
      summary: {
        ...departmentSummary,
        total_sales: Number(departmentSummary.total_sales || 0),
        ...inventoryData,
        ...creditSummary,
        ...voidedTotals,
        gross_profit: Number(departmentSummary.total_sales || 0) - inventoryData.cogs,
      },
      menu_items: menuItems,
      inventory_usage: inventoryData.inventory_usage,
      staff_performance: performance.rows,
    });
  } catch (error) {
    console.error('Department report error:', error.message);
    return fail(res, 500, 'Could not load department reports.');
  }
});

export default router;