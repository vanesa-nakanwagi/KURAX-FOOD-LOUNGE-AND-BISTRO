import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import pool from '../db.js';
import { createSessionToken, readSessionToken } from '../middleware/sessionTokens.js';

const router = express.Router();
const scrypt = promisify(scryptCallback);
const SHISHA_ROLES = ['SHISHA_HOD', 'SHISHA_WAITER', 'SHISHA_CHEF'];
const REPORT_ROLES = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'];
const PAYMENT_METHODS = ['MTN_MOBILE_MONEY', 'AIRTEL_MONEY', 'CARD', 'CASH', 'CREDIT'];
const uploadDirectory = path.join(process.cwd(), 'uploads', 'shisha');
fs.mkdirSync(uploadDirectory, { recursive: true });
const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, callback) => callback(null, `${Date.now()}-${randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

export async function initShishaTables() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS public.shisha_staff (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('SHISHA_HOD', 'SHISHA_WAITER', 'SHISHA_CHEF')),
      pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_packages (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
      image_url TEXT, is_available BOOLEAN NOT NULL DEFAULT true, published BOOLEAN NOT NULL DEFAULT false,
      visibility TEXT NOT NULL DEFAULT 'INTERNAL' CHECK (visibility = 'INTERNAL'),
      public_visible BOOLEAN NOT NULL DEFAULT false CHECK (public_visible = false),
      created_by INTEGER REFERENCES public.shisha_staff(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_orders (
      id SERIAL PRIMARY KEY, department TEXT NOT NULL DEFAULT 'SHISHA' CHECK (department = 'SHISHA'),
      shisha_waiter_id INTEGER NOT NULL REFERENCES public.shisha_staff(id), table_id TEXT NOT NULL,
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0, order_status TEXT NOT NULL DEFAULT 'PENDING',
      assigned_chef_id INTEGER REFERENCES public.shisha_staff(id), payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0, outstanding_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_order_items (
      id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES public.shisha_orders(id) ON DELETE CASCADE,
      shisha_package_id INTEGER REFERENCES public.shisha_packages(id) ON DELETE SET NULL,
      package_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), line_total NUMERIC(12,2) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_order_status_history (
      id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES public.shisha_orders(id) ON DELETE CASCADE,
      from_status TEXT, to_status TEXT NOT NULL, action TEXT NOT NULL, actor_id INTEGER NOT NULL,
      actor_name TEXT NOT NULL, actor_role TEXT NOT NULL, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_payment_requests (
      id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES public.shisha_orders(id) ON DELETE CASCADE,
      requested_by INTEGER NOT NULL REFERENCES public.shisha_staff(id), payment_method TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0), status TEXT NOT NULL DEFAULT 'PENDING',
      transaction_id TEXT, notes TEXT, confirmed_by INTEGER, confirmed_by_name TEXT, confirmed_by_role TEXT,
      confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_payments (
      id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES public.shisha_orders(id) ON DELETE CASCADE,
      payment_request_id INTEGER REFERENCES public.shisha_payment_requests(id), payment_method TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0), transaction_id TEXT, notes TEXT,
      confirmed_by INTEGER NOT NULL, confirmed_by_name TEXT NOT NULL, confirmed_by_role TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'CONFIRMED', confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS shisha_orders_waiter_idx ON public.shisha_orders(shisha_waiter_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS shisha_orders_chef_idx ON public.shisha_orders(assigned_chef_id, order_status)`,
    `CREATE INDEX IF NOT EXISTS shisha_orders_created_idx ON public.shisha_orders(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS shisha_payment_requests_status_idx ON public.shisha_payment_requests(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS shisha_payments_order_idx ON public.shisha_payments(order_id, confirmed_at DESC)`,
  ];

  for (const statement of statements) await pool.query(statement);

  if (process.env.SHISHA_ADMIN_EMAIL && process.env.SHISHA_ADMIN_PIN) {
    const salt = randomBytes(16).toString('hex');
    const hash = (await scrypt(String(process.env.SHISHA_ADMIN_PIN), salt, 64)).toString('hex');
    await pool.query(
      `INSERT INTO public.shisha_staff (name, email, role, pin_salt, pin_hash)
       VALUES ($1, $2, 'SHISHA_HOD', $3, $4) ON CONFLICT (email) DO NOTHING`,
      [process.env.SHISHA_ADMIN_NAME || 'Shisha HOD', process.env.SHISHA_ADMIN_EMAIL.toLowerCase(), salt, hash]
    );
  }
}

function fail(res, status, message) {
  return res.status(status).json({ error: message });
}

function requireRoles(...roles) {
  return (req, res, next) => roles.includes(req.actor.role) ? next() : fail(res, 403, 'You are not authorized for this Shisha action.');
}

function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  return scrypt(String(pin), salt, 64).then(hash => ({ salt, hash: hash.toString('hex') }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function emailShishaPin({ name, email, role, pin }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return false;
  const safeName = escapeHtml(name);
  const safeRole = role.replaceAll('_', ' ');
  await mailer.sendMail({
    from: `"Kurax Lounge & Bistro" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Kurax Shisha Department login',
    text: `Hello ${name}, your Shisha Department login is ${email}. Your PIN is ${pin}. Sign in at ${process.env.FRONTEND_URL || 'http://localhost:5173'}/shisha.`,
    html: `<p>Hello ${safeName},</p><p>Your Shisha Department account is ready.</p><p>Email: <strong>${escapeHtml(email)}</strong><br>Role: <strong>${escapeHtml(safeRole)}</strong><br>PIN: <strong>${escapeHtml(pin)}</strong></p><p>Sign in at <a href="${escapeHtml(process.env.FRONTEND_URL || 'http://localhost:5173')}/shisha">Kurax Shisha</a>.</p><p>Please keep your PIN private.</p>`,
  });
  return true;
}

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return fail(res, 401, 'Sign in to access the Shisha department.');

  try {
    const session = readSessionToken(token);
    if (session.scope === 'shisha') {
      const result = await pool.query(
        'SELECT id, name, email, role FROM public.shisha_staff WHERE id = $1 AND is_active = true',
        [session.id]
      );
      const staff = result.rows[0];
      if (!staff || staff.role !== session.role) return fail(res, 401, 'Shisha account is inactive or has changed.');
      req.actor = { ...staff, scope: 'shisha' };
    } else if (session.scope === 'restaurant') {
      const result = await pool.query('SELECT id, name, role FROM public.staff WHERE id = $1 AND is_active = true', [session.id]);
      const staff = result.rows[0];
      if (!staff || staff.role !== session.role || !REPORT_ROLES.includes(staff.role)) {
        return fail(res, 403, 'Management reporting access is required.');
      }
      req.actor = { ...staff, scope: 'restaurant' };
    } else {
      return fail(res, 401, 'Invalid session.');
    }
    return next();
  } catch {
    return fail(res, 401, 'Session expired. Sign in again.');
  }
}

function actorIsShisha(req) {
  return req.actor.scope === 'shisha';
}

function orderReference(id) {
  return `SH-${String(id).padStart(4, '0')}`;
}

function normalizeMethod(method) {
  const normalized = String(method || '').trim().toUpperCase().replace(/[ -]+/g, '_');
  const aliases = { MTN: 'MTN_MOBILE_MONEY', AIRTEL: 'AIRTEL_MONEY', MOMO_MTN: 'MTN_MOBILE_MONEY', MOMO_AIRTEL: 'AIRTEL_MONEY' };
  return aliases[normalized] || normalized;
}

async function recordHistory(client, order, nextStatus, action, actor, notes = null) {
  await client.query(
    `INSERT INTO public.shisha_order_status_history
      (order_id, from_status, to_status, action, actor_id, actor_name, actor_role, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [order.id, order.order_status, nextStatus, action, actor.id, actor.name, actor.role, notes]
  );
  await client.query(
    'UPDATE public.shisha_orders SET order_status = $1, updated_at = NOW() WHERE id = $2',
    [nextStatus, order.id]
  );
}

async function loadOrder(id, client = pool) {
  const result = await client.query(
    `SELECT o.*, w.name AS waiter_name, c.name AS chef_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'package_id', i.shisha_package_id, 'name', i.package_name,
        'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total
      ) ORDER BY i.id) FROM public.shisha_order_items i WHERE i.order_id = o.id), '[]'::jsonb) AS items
     FROM public.shisha_orders o
     JOIN public.shisha_staff w ON w.id = o.shisha_waiter_id
     LEFT JOIN public.shisha_staff c ON c.id = o.assigned_chef_id
     WHERE o.id = $1`,
    [id]
  );
  return result.rows[0];
}

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const pin = String(req.body.pin || '').trim();
  if (!email || !pin) return fail(res, 400, 'Email and PIN are required.');
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, pin_salt, pin_hash FROM public.shisha_staff WHERE email = $1 AND is_active = true',
      [email]
    );
    const staff = result.rows[0];
    if (!staff) return fail(res, 401, 'Invalid Shisha credentials.');
    const actual = await scrypt(pin, staff.pin_salt, 64);
    const expected = Buffer.from(staff.pin_hash, 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return fail(res, 401, 'Invalid Shisha credentials.');
    const user = { id: staff.id, name: staff.name, email: staff.email, role: staff.role };
    return res.json({ user, token: createSessionToken({ ...user, scope: 'shisha' }) });
  } catch (error) {
    console.error('Shisha login error:', error.message);
    return fail(res, 500, 'Could not sign in to Shisha.');
  }
});

router.use(authenticate);

router.get('/me', (req, res) => res.json({ user: req.actor }));

router.get('/packages', requireRoles('SHISHA_HOD', 'SHISHA_WAITER'), async (req, res) => {
  try {
    const query = req.actor.role === 'SHISHA_HOD'
      ? 'SELECT * FROM public.shisha_packages ORDER BY created_at DESC'
      : 'SELECT * FROM public.shisha_packages WHERE published = true AND is_available = true AND public_visible = false ORDER BY name';
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (error) {
    console.error('Shisha packages error:', error.message);
    return fail(res, 500, 'Could not load Shisha packages.');
  }
});

router.post('/packages', requireRoles('SHISHA_HOD'), upload.single('image'), async (req, res) => {
  const { name, description, price } = req.body;
  const amount = Number(price);
  if (!String(name || '').trim() || !Number.isFinite(amount) || amount < 0) return fail(res, 400, 'A package name and valid price are required.');
  const imageUrl = req.file ? `/uploads/shisha/${req.file.filename}` : (req.body.image_url || null);
  try {
    const result = await pool.query(
      `INSERT INTO public.shisha_packages (name, description, price, image_url, is_available, published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [String(name).trim(), description || null, amount, imageUrl, req.body.is_available !== 'false', req.body.published === 'true', req.actor.id]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create Shisha package error:', error.message);
    return fail(res, 500, 'Could not create the package.');
  }
});

router.put('/packages/:id', requireRoles('SHISHA_HOD'), upload.single('image'), async (req, res) => {
  const amount = Number(req.body.price);
  if (!String(req.body.name || '').trim() || !Number.isFinite(amount) || amount < 0) return fail(res, 400, 'A package name and valid price are required.');
  const imageUrl = req.file ? `/uploads/shisha/${req.file.filename}` : (req.body.image_url || null);
  try {
    const result = await pool.query(
      `UPDATE public.shisha_packages SET name=$1, description=$2, price=$3, image_url=$4,
        is_available=$5, published=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [String(req.body.name).trim(), req.body.description || null, amount, imageUrl,
        req.body.is_available === 'true', req.body.published === 'true', req.params.id]
    );
    if (!result.rows[0]) return fail(res, 404, 'Package not found.');
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Update Shisha package error:', error.message);
    return fail(res, 500, 'Could not update the package.');
  }
});

router.delete('/packages/:id', requireRoles('SHISHA_HOD'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE public.shisha_packages SET is_available=false, published=false, updated_at=NOW()
       WHERE id=$1 RETURNING id`, [req.params.id]
    );
    return result.rows[0] ? res.json({ success: true }) : fail(res, 404, 'Package not found.');
  } catch (error) {
    console.error('Archive Shisha package error:', error.message);
    return fail(res, 500, 'Could not archive the package.');
  }
});

router.get('/staff', requireRoles('SHISHA_HOD'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at FROM public.shisha_staff
       ORDER BY CASE role WHEN 'SHISHA_HOD' THEN 1 WHEN 'SHISHA_WAITER' THEN 2 ELSE 3 END, name`
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Shisha staff list error:', error.message);
    return fail(res, 500, 'Could not load Shisha staff.');
  }
});

router.post('/staff', async (req, res) => {
  const role = String(req.body.role || '').toUpperCase();
  const isHodBootstrap = req.actor.scope === 'restaurant' && req.actor.role === 'DIRECTOR' && role === 'SHISHA_HOD';
  const isHodManagedAccount = actorIsShisha(req) && req.actor.role === 'SHISHA_HOD' && ['SHISHA_WAITER', 'SHISHA_CHEF'].includes(role);
  if (!isHodBootstrap && !isHodManagedAccount) return fail(res, 403, 'Only a Director can establish the first HOD; the HOD manages waiter and mixer accounts.');
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const pin = String(req.body.pin || '').trim();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4,8}$/.test(pin)) {
    return fail(res, 400, 'Name, valid email, and a 4-8 digit PIN are required.');
  }
  try {
    const { salt, hash } = await hashPin(pin);
    const result = await pool.query(
      `INSERT INTO public.shisha_staff (name, email, role, pin_salt, pin_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, is_active, created_at`,
      [name, email, role, salt, hash]
    );
    let emailSent = false;
    try {
      emailSent = await emailShishaPin({ name, email, role, pin });
    } catch (emailError) {
      console.error('Shisha PIN email failed:', emailError.message);
    }
    return res.status(201).json({ staff: result.rows[0], emailSent });
  } catch (error) {
    if (error.code === '23505') return fail(res, 409, 'That email already has a Shisha account.');
    console.error('Create Shisha staff error:', error.message);
    return fail(res, 500, 'Could not create the Shisha account.');
  }
});

router.patch('/staff/:id', requireRoles('SHISHA_HOD'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE public.shisha_staff SET is_active=$1, updated_at=NOW()
       WHERE id=$2 AND role <> 'SHISHA_HOD'
       RETURNING id, name, email, role, is_active`,
      [req.body.is_active === true, req.params.id]
    );
    return result.rows[0] ? res.json(result.rows[0]) : fail(res, 404, 'Waiter or mixer account not found.');
  } catch (error) {
    console.error('Update Shisha staff error:', error.message);
    return fail(res, 500, 'Could not update the account.');
  }
});

router.get('/orders', requireRoles(...SHISHA_ROLES), async (req, res) => {
  try {
    const conditions = [];
    const values = [];
    if (req.actor.role === 'SHISHA_WAITER') {
      values.push(req.actor.id);
      conditions.push(`o.shisha_waiter_id=$${values.length}`);
    } else if (req.actor.role === 'SHISHA_CHEF') {
      values.push(req.actor.id);
      conditions.push(`o.assigned_chef_id=$${values.length}`);
    }
    if (req.query.status) {
      values.push(String(req.query.status).toUpperCase());
      conditions.push(`o.order_status=$${values.length}`);
    }
    const result = await pool.query(
      `SELECT o.*, w.name AS waiter_name, c.name AS chef_name,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'package_id', i.shisha_package_id, 'name', i.package_name,
          'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total
        ) ORDER BY i.id) FROM public.shisha_order_items i WHERE i.order_id=o.id), '[]'::jsonb) AS items
       FROM public.shisha_orders o JOIN public.shisha_staff w ON w.id=o.shisha_waiter_id
       LEFT JOIN public.shisha_staff c ON c.id=o.assigned_chef_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY o.created_at DESC LIMIT 250`,
      values
    );
    return res.json(result.rows.map(order => ({ ...order, reference: orderReference(order.id) })));
  } catch (error) {
    console.error('Shisha orders error:', error.message);
    return fail(res, 500, 'Could not load Shisha orders.');
  }
});

router.post('/orders', requireRoles('SHISHA_WAITER'), async (req, res) => {
  const tableId = String(req.body.table_id || '').trim();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!tableId || !items.length || items.some(item => !Number.isInteger(Number(item.package_id)) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
    return fail(res, 400, 'Select a table and at least one package with a valid quantity.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestedIds = [...new Set(items.map(item => Number(item.package_id)))];
    const packageResult = await client.query(
      `SELECT id, name, price FROM public.shisha_packages
       WHERE id=ANY($1::int[]) AND published=true AND is_available=true AND public_visible=false`,
      [requestedIds]
    );
    if (packageResult.rows.length !== requestedIds.length) {
      await client.query('ROLLBACK');
      return fail(res, 400, 'One or more packages are unavailable. Refresh the package list.');
    }
    const packages = new Map(packageResult.rows.map(item => [item.id, item]));
    const orderItems = items.map(item => {
      const product = packages.get(Number(item.package_id));
      const quantity = Number(item.quantity);
      return { product, quantity, lineTotal: Number(product.price) * quantity };
    });
    const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const orderResult = await client.query(
      `INSERT INTO public.shisha_orders (shisha_waiter_id, table_id, total_amount, outstanding_amount, notes)
       VALUES ($1, $2, $3, $3, $4) RETURNING *`,
      [req.actor.id, tableId, total, String(req.body.notes || '').trim() || null]
    );
    const order = orderResult.rows[0];
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO public.shisha_order_items (order_id, shisha_package_id, package_name, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.product.id, item.product.name, item.quantity, item.product.price, item.lineTotal]
      );
    }
    await recordHistory(client, order, 'PENDING', 'ORDER_CREATED', req.actor, order.notes);
    await client.query('COMMIT');
    return res.status(201).json({ ...(await loadOrder(order.id)), reference: orderReference(order.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create Shisha order error:', error.message);
    return fail(res, 500, 'Could not submit the Shisha order.');
  } finally {
    client.release();
  }
});

router.post('/orders/:id/assign', requireRoles('SHISHA_HOD'), async (req, res) => {
  const chefId = Number(req.body.chef_id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const chef = await client.query("SELECT id FROM public.shisha_staff WHERE id=$1 AND role='SHISHA_CHEF' AND is_active=true", [chefId]);
    const orderResult = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = orderResult.rows[0];
    if (!chef.rows[0] || !order || !['PENDING', 'ASSIGNED'].includes(order.order_status)) {
      await client.query('ROLLBACK');
      return fail(res, 400, 'Choose an active Shisha mixer and an unassigned order.');
    }
    await client.query('UPDATE public.shisha_orders SET assigned_chef_id=$1, updated_at=NOW() WHERE id=$2', [chefId, order.id]);
    await recordHistory(client, order, 'ASSIGNED', 'CHEF_ASSIGNED', req.actor, `Assigned mixer ${chefId}`);
    await client.query('COMMIT');
    return res.json({ ...(await loadOrder(order.id)), reference: orderReference(order.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Assign Shisha order error:', error.message);
    return fail(res, 500, 'Could not assign the Shisha order.');
  } finally {
    client.release();
  }
});

router.post('/orders/:id/prepare', requireRoles('SHISHA_CHEF'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = result.rows[0];
    if (!order || order.assigned_chef_id !== req.actor.id || order.order_status !== 'ASSIGNED') {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This order is not assigned to you or is not awaiting preparation.');
    }
    await recordHistory(client, order, 'PREPARING', 'PREPARATION_STARTED', req.actor);
    await client.query('COMMIT');
    return res.json({ ...(await loadOrder(order.id)), reference: orderReference(order.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start Shisha preparation error:', error.message);
    return fail(res, 500, 'Could not start preparation.');
  } finally {
    client.release();
  }
});

router.post('/orders/:id/ready', requireRoles('SHISHA_CHEF'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = result.rows[0];
    if (!order || order.assigned_chef_id !== req.actor.id || order.order_status !== 'PREPARING') {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This order is not being prepared by you.');
    }
    await recordHistory(client, order, 'READY', 'ORDER_READY', req.actor);
    await client.query('COMMIT');
    return res.json({ ...(await loadOrder(order.id)), reference: orderReference(order.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Complete Shisha preparation error:', error.message);
    return fail(res, 500, 'Could not mark the order ready.');
  } finally {
    client.release();
  }
});

router.post('/orders/:id/serve', requireRoles('SHISHA_WAITER'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = result.rows[0];
    if (!order || order.shisha_waiter_id !== req.actor.id || order.order_status !== 'READY') {
      await client.query('ROLLBACK');
      return fail(res, 409, 'Only the original waiter can serve an order marked ready.');
    }
    await recordHistory(client, order, 'SERVED', 'ORDER_SERVED', req.actor);
    await client.query('COMMIT');
    return res.json({ ...(await loadOrder(order.id)), reference: orderReference(order.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Serve Shisha order error:', error.message);
    return fail(res, 500, 'Could not mark the order served.');
  } finally {
    client.release();
  }
});

router.post('/orders/:id/payment-request', requireRoles('SHISHA_WAITER'), async (req, res) => {
  const method = normalizeMethod(req.body.payment_method);
  if (!PAYMENT_METHODS.includes(method)) return fail(res, 400, 'Select a supported payment method.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = result.rows[0];
    if (!order || order.shisha_waiter_id !== req.actor.id || !['SERVED', 'PARTIALLY_PAID', 'OUTSTANDING'].includes(order.order_status)) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'Only your served order can be sent for payment.');
    }
    const amount = Number(order.outstanding_amount);
    if (amount <= 0) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This order has no outstanding balance.');
    }
    const requestStatus = method === 'CREDIT' ? 'OUTSTANDING' : 'PENDING';
    await client.query(
      `INSERT INTO public.shisha_payment_requests (order_id, requested_by, payment_method, amount, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [order.id, req.actor.id, method, amount, requestStatus, req.body.notes || null]
    );
    const nextPaymentStatus = method === 'CREDIT'
      ? 'OUTSTANDING'
      : Number(order.amount_paid) > 0 ? 'PARTIALLY_PAID' : 'PENDING';
    await client.query('UPDATE public.shisha_orders SET payment_status=$1, updated_at=NOW() WHERE id=$2', [nextPaymentStatus, order.id]);
    await recordHistory(client, order, method === 'CREDIT' ? 'OUTSTANDING' : 'PAYMENT_PENDING', 'PAYMENT_REQUESTED', req.actor, method);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, status: requestStatus, outstanding_amount: amount });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Shisha payment request error:', error.message);
    return fail(res, 500, 'Could not send the payment request.');
  } finally {
    client.release();
  }
});

router.get('/payments', requireRoles('SHISHA_HOD'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, o.table_id, o.total_amount, o.amount_paid, o.outstanding_amount,
        o.order_status, w.name AS waiter_name, o.id AS shisha_order_id,
        CASE WHEN o.outstanding_amount <= 0 THEN 'CONFIRMED' ELSE r.status END AS status
       FROM public.shisha_payment_requests r
       JOIN public.shisha_orders o ON o.id=r.order_id
       JOIN public.shisha_staff w ON w.id=r.requested_by
       ORDER BY CASE r.status WHEN 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 250`
    );
    return res.json(result.rows.map(row => ({ ...row, reference: orderReference(row.shisha_order_id) })));
  } catch (error) {
    console.error('Shisha payment requests error:', error.message);
    return fail(res, 500, 'Could not load payment requests.');
  }
});

async function recordPayment(client, order, details, actor, requestId = null) {
  const method = normalizeMethod(details.payment_method || details.method);
  const amount = Number(details.amount);
  if (!PAYMENT_METHODS.includes(method) || method === 'CREDIT' || !Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Enter a valid payment method and positive amount.'), { status: 400 });
  }
  if (amount > Number(order.outstanding_amount) + 0.00001) {
    throw Object.assign(new Error('Payment cannot exceed the outstanding balance.'), { status: 400 });
  }
  const transactionId = String(details.transaction_id || '').trim() || null;
  if (['MTN_MOBILE_MONEY', 'AIRTEL_MONEY', 'CARD'].includes(method) && !transactionId) {
    throw Object.assign(new Error('Transaction/reference ID is required for mobile money and card.'), { status: 400 });
  }
  const payment = await client.query(
    `INSERT INTO public.shisha_payments
      (order_id, payment_request_id, payment_method, amount, transaction_id, notes,
       confirmed_by, confirmed_by_name, confirmed_by_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [order.id, requestId, method, amount, transactionId, details.notes || null, actor.id, actor.name, actor.role]
  );
  const paidResult = await client.query('SELECT COALESCE(SUM(amount),0) AS total FROM public.shisha_payments WHERE order_id=$1', [order.id]);
  const amountPaid = Number(paidResult.rows[0].total);
  const outstanding = Math.max(0, Number(order.total_amount) - amountPaid);
  const paymentStatus = outstanding <= 0 ? 'FULLY_PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'OUTSTANDING';
  await client.query(
    'UPDATE public.shisha_orders SET amount_paid=$1, outstanding_amount=$2, payment_status=$3, updated_at=NOW() WHERE id=$4',
    [amountPaid, outstanding, paymentStatus, order.id]
  );
  await recordHistory(client, order, paymentStatus, 'PAYMENT_CONFIRMED', actor, `${method}: ${amount}${transactionId ? ` (${transactionId})` : ''}`);
  return { payment: payment.rows[0], amount_paid: amountPaid, outstanding_amount: outstanding, payment_status: paymentStatus };
}

router.post('/payments/:id/confirm', requireRoles('SHISHA_HOD'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query('SELECT * FROM public.shisha_payment_requests WHERE id=$1 FOR UPDATE', [req.params.id]);
    const paymentRequest = requestResult.rows[0];
    if (!paymentRequest || paymentRequest.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This payment request is not awaiting confirmation.');
    }
    const orderResult = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [paymentRequest.order_id]);
    const order = orderResult.rows[0];
    const amount = req.body.amount === undefined ? Number(paymentRequest.amount) : Number(req.body.amount);
    const result = await recordPayment(client, order, {
      payment_method: paymentRequest.payment_method,
      amount,
      transaction_id: req.body.transaction_id,
      notes: req.body.notes,
    }, req.actor, paymentRequest.id);
    await client.query(
      `UPDATE public.shisha_payment_requests SET status='CONFIRMED', transaction_id=$1, notes=$2,
       confirmed_by=$3, confirmed_by_name=$4, confirmed_by_role=$5, confirmed_at=NOW() WHERE id=$6`,
      [req.body.transaction_id || null, req.body.notes || null, req.actor.id, req.actor.name, req.actor.role, paymentRequest.id]
    );
    await client.query('COMMIT');
    return res.json(result);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) return fail(res, error.status, error.message);
    console.error('Confirm Shisha payment error:', error.message);
    return fail(res, 500, 'Could not confirm the payment.');
  } finally {
    client.release();
  }
});

router.post('/orders/:id/payments', requireRoles('SHISHA_HOD'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = result.rows[0];
    if (!order || Number(order.outstanding_amount) <= 0) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'Order not found or already fully settled.');
    }
    const payment = await recordPayment(client, order, req.body, req.actor);
    await client.query('COMMIT');
    return res.status(201).json(payment);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.status) return fail(res, error.status, error.message);
    console.error('Record Shisha settlement error:', error.message);
    return fail(res, 500, 'Could not record the Shisha payment.');
  } finally {
    client.release();
  }
});

router.get('/orders/:id/history', requireRoles(...SHISHA_ROLES), async (req, res) => {
  try {
    const orderResult = await pool.query('SELECT shisha_waiter_id, assigned_chef_id FROM public.shisha_orders WHERE id=$1', [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) return fail(res, 404, 'Order not found.');
    if (req.actor.role === 'SHISHA_WAITER' && order.shisha_waiter_id !== req.actor.id) return fail(res, 403, 'This order belongs to another waiter.');
    if (req.actor.role === 'SHISHA_CHEF' && order.assigned_chef_id !== req.actor.id) return fail(res, 403, 'This order is not assigned to you.');
    const result = await pool.query('SELECT * FROM public.shisha_order_status_history WHERE order_id=$1 ORDER BY created_at', [req.params.id]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Shisha order history error:', error.message);
    return fail(res, 500, 'Could not load order history.');
  }
});

router.get('/reports', async (req, res) => {
  const canView = (actorIsShisha(req) && req.actor.role === 'SHISHA_HOD') ||
    (req.actor.scope === 'restaurant' && REPORT_ROLES.includes(req.actor.role));
  if (!canView) return fail(res, 403, 'Shisha financial reports are restricted to the HOD and management.');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
  const from = req.query.from || today;
  const to = req.query.to || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return fail(res, 400, 'Provide a valid date range.');
  }
  try {
    const [summary, waiters, methods] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total_orders, COALESCE(SUM(total_amount),0) AS total_sales,
          COALESCE(SUM(amount_paid),0) AS amount_collected,
          COALESCE(SUM(outstanding_amount),0) AS total_outstanding,
          COUNT(*) FILTER (WHERE payment_status='PARTIALLY_PAID')::int AS partially_paid_orders,
          COALESCE(SUM(amount_paid) FILTER (WHERE payment_status='PARTIALLY_PAID'),0) AS partially_paid_amount,
          COUNT(*) FILTER (WHERE payment_status='FULLY_PAID')::int AS fully_settled_orders,
          COUNT(*) FILTER (WHERE outstanding_amount > 0)::int AS outstanding_orders
         FROM public.shisha_orders
         WHERE created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')`, [from, to]
      ),
      pool.query(
        `SELECT w.id AS waiter_id, w.name AS waiter_name, COUNT(o.id)::int AS total_orders,
          COALESCE(SUM(o.total_amount),0) AS total_sales, COALESCE(SUM(o.amount_paid),0) AS amount_collected,
          COALESCE(SUM(o.outstanding_amount),0) AS outstanding
         FROM public.shisha_orders o JOIN public.shisha_staff w ON w.id=o.shisha_waiter_id
         WHERE o.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND o.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
         GROUP BY w.id, w.name ORDER BY total_sales DESC`, [from, to]
      ),
      pool.query(
        `SELECT payment_method, COALESCE(SUM(amount),0) AS amount, COUNT(*)::int AS payment_count
         FROM public.shisha_payments
         WHERE confirmed_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND confirmed_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
         GROUP BY payment_method ORDER BY amount DESC`, [from, to]
      ),
    ]);
    return res.json({ from, to, summary: summary.rows[0], by_waiter: waiters.rows, by_payment_method: methods.rows });
  } catch (error) {
    console.error('Shisha financial report error:', error.message);
    return fail(res, 500, 'Could not load Shisha reports.');
  }
});

export default router;