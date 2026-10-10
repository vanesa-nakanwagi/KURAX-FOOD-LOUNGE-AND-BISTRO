import express from 'express';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { summarizeDepartmentCredits } from '../helpers/departmentCreditSummary.js';

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

function itemBelongsToDepartment(item, departmentKey) {
  const station = String(item.station || '').trim().toLowerCase();
  if (departmentKey === 'kitchen') return !['barman', 'barista', 'shisha'].includes(station);
  if (departmentKey === 'bar') return station === 'barman';
  if (departmentKey === 'barista') return station === 'barista';
  return false;
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
  const result = await pool.query(
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
       AND ${department.paidItemFilter}
     GROUP BY item->>'name'
     ORDER BY sales DESC, menu_item`,
    [from, to]
  );
  return result.rows.map((row) => ({ ...row, sales: Number(row.sales || 0), quantity: Number(row.quantity || 0) }));
}

async function departmentCreditReport(department, from, to) {
  const itemFilter = department.paidItemFilter.replaceAll('item->>', 'credit_items.item->>');
  const result = await pool.query(
    `SELECT DISTINCT c.id, c.amount, c.amount_paid
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
      AND ${department.paidItemFilter}
  ) paid ON true`;
}

function parseOrderItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

function itemTotal(item) {
  return (Number(item.price || item.unit_price) || 0) * (Number(item.quantity) || 1);
}

function requireDepartmentHod(req, res, next) {
  const department = departmentFor(req.params.department);
  if (!department) return fail(res, 404, 'Department not found.');
  if (req.actor.role !== department.hodRole) return fail(res, 403, 'Department HOD access is required.');
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

router.get('/:department/assignment-queue', requireDepartmentHod, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, table_name, staff_name, items, status, created_at
       FROM public.orders
       WHERE status NOT IN ('Paid','Closed','Voided','Cancelled')
         AND COALESCE(day_cleared, false) = false
         AND COALESCE(shift_cleared, false) = false
       ORDER BY created_at DESC
       LIMIT 200`
    );
    const queue = result.rows.flatMap(order => {
      const items = parseOrderItems(order.items);
      const unassignedItems = items
        .map((item, itemIndex) => ({ ...item, _orderItemIndex: itemIndex }))
        .filter(item => itemBelongsToDepartment(item, req.params.department))
        .filter(item => !item.assignedTo && !item.assigned_to && item.served !== true &&
          item.status !== 'Paid' && item.status !== 'VOIDED' && !item.voidProcessed);
      if (!unassignedItems.length) return [];
      return [{ ...order, items: unassignedItems }];
    });
    return res.json(queue);
  } catch (error) {
    console.error('Department assignment queue error:', error.message);
    return fail(res, 500, 'Could not load orders waiting for assignment.');
  }
});

router.post('/:department/orders/:orderId/assign', requireDepartmentHod, async (req, res) => {
  const staffId = Number(req.body.staff_id);
  if (!Number.isInteger(staffId) || staffId <= 0) return fail(res, 400, 'Select an active department worker.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const staffResult = await client.query(
      'SELECT id, name FROM public.staff WHERE id=$1 AND role=$2 AND is_active=true',
      [staffId, req.department.staffRole]
    );
    const assignee = staffResult.rows[0];
    if (!assignee) {
      await client.query('ROLLBACK');
      return fail(res, 400, 'That worker is not active in this department.');
    }

    const orderResult = await client.query(
      `SELECT id, table_name, staff_name, staff_role, items, status
       FROM public.orders
       WHERE id=$1 AND status NOT IN ('Paid','Closed','Voided','Cancelled')
         AND COALESCE(day_cleared, false)=false AND COALESCE(shift_cleared, false)=false
       FOR UPDATE`,
      [req.params.orderId]
    );
    const order = orderResult.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Active order not found.');
    }

    const items = parseOrderItems(order.items);
    const assignedAt = new Date().toISOString();
    const assignedIndexes = [];
    const updatedItems = items.map((item, index) => {
      const available = itemBelongsToDepartment(item, req.params.department) &&
        !item.assignedTo && !item.assigned_to && item.served !== true &&
        item.status !== 'Paid' && item.status !== 'VOIDED' && !item.voidProcessed;
      if (!available) return item;
      assignedIndexes.push(index);
      return { ...item, assignedTo: assignee.name, assignedAt, assignedByHod: req.actor.name };
    });
    if (!assignedIndexes.length) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This order has no unassigned items for this department.');
    }

    const ticketItems = updatedItems.filter(item => itemBelongsToDepartment(item, req.params.department));
    const total = ticketItems.reduce((sum, item) => sum + itemTotal(item), 0);
    const ticketResult = await client.query(
      `INSERT INTO public.${req.department.table}
         (order_id, table_name, staff_name, staff_role, items, total, status, ticket_date)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending', (NOW() AT TIME ZONE 'Africa/Kampala')::date)
       ON CONFLICT (order_id) DO UPDATE SET
         items=EXCLUDED.items, total=EXCLUDED.total, status='Pending', updated_at=NOW()
       RETURNING *`,
      [order.id, order.table_name, order.staff_name || 'Staff', order.staff_role || 'WAITER', JSON.stringify(ticketItems), total]
    );
    const ticket = ticketResult.rows[0];

    for (const index of assignedIndexes) {
      await client.query(
        `INSERT INTO public.${req.department.assignments}
           (order_id, ticket_id, item_name, assigned_to, assigned_by, assigned_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, ticket.id, updatedItems[index].name, assignee.name, req.actor.name, assignedAt]
      );
    }
    await client.query(
      'UPDATE public.orders SET items=$1, updated_at=NOW() WHERE id=$2',
      [JSON.stringify(updatedItems), order.id]
    );
    await client.query('COMMIT');
    return res.status(201).json({ ticket, assigned_to: assignee.name });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Department HOD assignment error:', error.message);
    return fail(res, 500, 'Could not assign this order to a department worker.');
  } finally {
    client.release();
  }
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

router.post('/:department/staff', requireDepartmentHod, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const pin = String(req.body.pin || '').trim();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4,8}$/.test(pin)) {
    return fail(res, 400, 'Name, valid email, and a 4-8 digit PIN are required.');
  }
  try {
    const result = await pool.query(
      `INSERT INTO public.staff (name, email, pin, role, is_active, is_permitted, monthly_income_target, daily_order_target)
       VALUES ($1, $2, $3, $4, true, false, 0, 0)
       RETURNING id, name, email, role, is_active, created_at`,
      [name, email, pin, req.department.staffRole]
    );
    return res.status(201).json({ staff: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'That email already has a staff account.');
    console.error('Create department staff error:', error.message);
    return fail(res, 500, 'Could not create the department account.');
  }
});

router.patch('/:department/staff/:id', requireDepartmentHod, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE public.staff SET is_active=$1, updated_at=NOW()
       WHERE id=$2 AND role=$3 RETURNING id, name, email, role, is_active`,
      [req.body.is_active === true, req.params.id, req.department.staffRole]
    );
    return result.rows[0] ? res.json(result.rows[0]) : fail(res, 404, 'Department staff member not found.');
  } catch (error) {
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
      const [result, performance, menuItems, inventory, creditSummary] = await Promise.all([
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
           WHERE ${department.paidItemFilter}
         ) sales ON true
         ${departmentPaymentJoin(department)}
         WHERE t.ticket_date BETWEEN $1::date AND $2::date`,
        [range.from, range.to]
        ),
        pool.query(
          `SELECT COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to','')) AS staff_name,
            COUNT(*)::int AS items_assigned,
            COUNT(*) FILTER (WHERE t.status IN ('Ready','Served','Paid'))::int AS completed_items,
            COALESCE(SUM(COALESCE(
              NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
              COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
                * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
            )),0) AS total_sales
           FROM public.${department.table} t
           CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
           WHERE t.ticket_date BETWEEN $1::date AND $2::date
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
    }), { total_orders: 0, total_sales: 0, cogs: 0, gross_profit: 0, consumption_value: 0, waste: 0, amount_collected: 0, outstanding_balance: 0, partially_paid_credit_count: 0, partially_paid_credit_amount: 0, partially_paid_credit_balance: 0, settled_credit_count: 0, settled_credit_amount: 0, outstanding_credit_count: 0, outstanding_credit_balance: 0 });
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
    const [summary, performance, menuItems, inventory, creditSummary] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total_orders,
          COALESCE(SUM(sales.sales_amount),0) AS total_sales,
          COALESCE(SUM(LEAST(sales.sales_amount, paid.collected_amount)),0) AS amount_collected,
          COALESCE(SUM(GREATEST(sales.sales_amount - LEAST(sales.sales_amount, paid.collected_amount),0)),0) AS outstanding_balance,
          COUNT(*) FILTER (WHERE t.status='Pending')::int AS pending_orders,
          COUNT(*) FILTER (WHERE t.status='Preparing')::int AS preparing_orders,
          COUNT(*) FILTER (WHERE t.status IN ('Ready','Served','Paid'))::int AS completed_orders
         FROM public.${department.table} t
         LEFT JOIN public.orders o ON o.id=t.order_id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(COALESCE(
             NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
             COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
               * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
           )),0) AS sales_amount
           FROM jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
           WHERE ${department.paidItemFilter}
         ) sales ON true
         ${departmentPaymentJoin(department)}
         WHERE t.ticket_date BETWEEN $1::date AND $2::date`,
        [range.from, range.to]
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to','')) AS staff_name,
          COUNT(*)::int AS items_assigned,
          COUNT(*) FILTER (WHERE t.status IN ('Ready','Served','Paid'))::int AS completed_items,
          COALESCE(SUM(COALESCE(
            NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
            COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
              * COALESCE(NULLIF(item->>'quantity','')::numeric,1)
          )),0) AS total_sales
         FROM public.${department.table} t
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.items,'[]'::jsonb)) AS ticket_items(item)
         WHERE t.ticket_date BETWEEN $1::date AND $2::date
           AND COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to','')) IS NOT NULL
           AND ${department.paidItemFilter}
         GROUP BY COALESCE(NULLIF(item->>'assignedTo',''), NULLIF(item->>'assigned_to',''))
         ORDER BY total_sales DESC, 1`,
        [range.from, range.to]
      ),
      menuItemReport(department, range.from, range.to),
      inventoryReport(department.station, range.from, range.to),
      departmentCreditReport(department, range.from, range.to),
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