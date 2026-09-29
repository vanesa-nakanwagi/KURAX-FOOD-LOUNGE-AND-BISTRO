import express from 'express';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';

const router = express.Router();
const MANAGEMENT_ROLES = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'];
const DEPARTMENTS = {
  kitchen: { label: 'Kitchen', hodRole: 'KITCHEN_HOD', staffRole: 'CHEF', table: 'kitchen_tickets', assignments: 'chef_assignments', paidItemFilter: "LOWER(COALESCE(item->>'station','kitchen')) NOT IN ('barman','barista')" },
  bar: { label: 'Bar', hodRole: 'BAR_HOD', staffRole: 'BARMAN', table: 'barman_tickets', assignments: 'barman_assignments', paidItemFilter: "LOWER(COALESCE(item->>'station',''))='barman'" },
  barista: { label: 'Barista', hodRole: 'BARISTA_HOD', staffRole: 'BARISTA', table: 'barista_tickets', assignments: 'barista_assignments', paidItemFilter: "LOWER(COALESCE(item->>'station',''))='barista'" },
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
  try {
    const reports = await Promise.all(Object.entries(DEPARTMENTS).map(async ([key, department]) => {
      const [result, performance] = await Promise.all([
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
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(CASE WHEN item->>'_rowPaid'='true' THEN
             COALESCE(NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
               COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
                 * COALESCE(NULLIF(item->>'quantity','')::numeric,1))
             ELSE COALESCE((SELECT SUM(c.amount_paid) FROM public.credits c
               WHERE c.order_id=o.id AND LOWER(COALESCE(c.label,''))=LOWER(COALESCE(item->>'name',''))),
               NULLIF(item->>'partial_amount_paid','')::numeric,0)
           END),0) AS collected_amount
           FROM jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) AS source_items(item)
           WHERE (item->>'_rowPaid'='true' OR item->>'is_partially_paid'='true') AND ${department.paidItemFilter}
         ) paid ON true
         WHERE t.ticket_date BETWEEN $1::date AND $2::date`,
        [range.from, range.to]
        ),
        pool.query(
          `SELECT a.assigned_to AS staff_name, COUNT(*)::int AS items_assigned,
            COUNT(*) FILTER (WHERE t.status IN ('Ready','Served','Paid'))::int AS completed_items
           FROM public.${department.assignments} a JOIN public.${department.table} t ON t.id=a.ticket_id
           WHERE t.ticket_date BETWEEN $1::date AND $2::date
           GROUP BY a.assigned_to ORDER BY items_assigned DESC, staff_name`,
          [range.from, range.to]
        ),
      ]);
      return { department: key, label: department.label, ...result.rows[0], staff_performance: performance.rows };
    }));
    const shisha = await pool.query(
      `SELECT COUNT(*)::int AS total_orders, COALESCE(SUM(total_amount),0) AS total_sales,
        COALESCE(SUM(amount_paid),0) AS amount_collected, COALESCE(SUM(outstanding_amount),0) AS outstanding_balance
       FROM public.shisha_orders
       WHERE created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
         AND created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')`,
      [range.from, range.to]
    );
    const shishaPerformance = await pool.query(
      `SELECT s.name AS staff_name, COUNT(o.id)::int AS items_assigned,
        COUNT(o.id) FILTER (WHERE o.order_status IN ('READY','SERVED','FULLY_PAID','PARTIALLY_PAID'))::int AS completed_items
       FROM public.shisha_staff s
       LEFT JOIN public.shisha_orders o ON
         ((s.role='SHISHA_WAITER' AND o.shisha_waiter_id=s.id) OR
          (s.role='SHISHA_CHEF' AND o.assigned_chef_id=s.id))
         AND o.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
         AND o.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
       WHERE s.role IN ('SHISHA_WAITER','SHISHA_CHEF')
       GROUP BY s.id, s.name ORDER BY items_assigned DESC, s.name`,
      [range.from, range.to]
    );
    reports.push({ department: 'shisha', label: 'Shisha', ...shisha.rows[0], staff_performance: shishaPerformance.rows });
    return res.json({ ...range, departments: reports });
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
    const [summary, performance] = await Promise.all([
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
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(CASE WHEN item->>'_rowPaid'='true' THEN
             COALESCE(NULLIF(item->>'line_total','')::numeric, NULLIF(item->>'lineTotal','')::numeric,
               COALESCE(NULLIF(item->>'price','')::numeric, NULLIF(item->>'unit_price','')::numeric)
                 * COALESCE(NULLIF(item->>'quantity','')::numeric,1))
             ELSE COALESCE((SELECT SUM(c.amount_paid) FROM public.credits c
               WHERE c.order_id=o.id AND LOWER(COALESCE(c.label,''))=LOWER(COALESCE(item->>'name',''))),
               NULLIF(item->>'partial_amount_paid','')::numeric,0)
           END),0) AS collected_amount
           FROM jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) AS source_items(item)
           WHERE (item->>'_rowPaid'='true' OR item->>'is_partially_paid'='true') AND ${department.paidItemFilter}
         ) paid ON true
         WHERE t.ticket_date BETWEEN $1::date AND $2::date`,
        [range.from, range.to]
      ),
      pool.query(
        `SELECT a.assigned_to AS staff_name, COUNT(*)::int AS items_assigned,
          COUNT(*) FILTER (WHERE t.status IN ('Ready','Served','Paid'))::int AS completed_items
         FROM public.${department.assignments} a
         JOIN public.${department.table} t ON t.id=a.ticket_id
         WHERE t.ticket_date BETWEEN $1::date AND $2::date
         GROUP BY a.assigned_to ORDER BY items_assigned DESC, staff_name`,
        [range.from, range.to]
      ),
    ]);
    return res.json({ department: req.params.department, ...range, summary: summary.rows[0], staff_performance: performance.rows });
  } catch (error) {
    console.error('Department report error:', error.message);
    return fail(res, 500, 'Could not load department reports.');
  }
});

export default router;