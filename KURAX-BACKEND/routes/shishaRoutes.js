import express from 'express';
import multer from 'multer';
import {
  randomBytes, scrypt as scryptCallback, timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import pool from '../db.js';
import { createSessionToken, readSessionToken } from '../middleware/sessionTokens.js';
import notificationService from '../helpers/notificationService.js';
import {
  encryptShishaPin, isValidShishaPinEncryptionKey,
} from '../helpers/shishaPinEncryption.js';
import { assertPinIsAvailable } from '../helpers/pinUniqueness.js';
import { sendAccountPinEmail } from '../helpers/smtp.js';

const router = express.Router();
const scrypt = promisify(scryptCallback);
const SHISHA_ROLES = ['SHISHA_HOD', 'SHISHA_WAITER', 'SHISHA_CHEF'];
const REPORT_ROLES = ['DIRECTOR', 'MANAGER', 'ACCOUNTANT'];
const SHISHA_REPORT_ROLES = [...REPORT_ROLES, 'SUPERVISOR'];
const PAYMENT_METHODS = ['MTN_MOBILE_MONEY', 'AIRTEL_MONEY', 'CARD', 'CASH', 'CREDIT'];
const uploadDirectory = path.join(process.cwd(), 'uploads', 'shisha');
fs.mkdirSync(uploadDirectory, { recursive: true });

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
      pin_salt TEXT NOT NULL, pin_hash TEXT NOT NULL, pin_encrypted TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'ALTER TABLE public.shisha_staff ADD COLUMN IF NOT EXISTS pin_encrypted TEXT',
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
      notes TEXT, day_cleared BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'ALTER TABLE public.shisha_orders ADD COLUMN IF NOT EXISTS day_cleared BOOLEAN NOT NULL DEFAULT false',
    `UPDATE public.shisha_orders o
     SET day_cleared = true
     WHERE o.day_cleared = false
       AND EXISTS (
         SELECT 1 FROM public.daily_summary ds
         WHERE ds.summary_date = (o.created_at AT TIME ZONE 'Africa/Kampala')::date
           AND ds.day_closed = true
       )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_order_items (
      id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES public.shisha_orders(id) ON DELETE CASCADE,
      shisha_package_id INTEGER REFERENCES public.shisha_packages(id) ON DELETE SET NULL,
      package_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), line_total NUMERIC(12,2) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_production_work (
      id BIGSERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL UNIQUE,
      item_name TEXT NOT NULL,
      table_id TEXT,
      order_notes TEXT,
      unit_price NUMERIC(12,2),
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
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE public.shisha_production_work ADD COLUMN IF NOT EXISTS table_id TEXT`,
    `ALTER TABLE public.shisha_production_work ADD COLUMN IF NOT EXISTS order_notes TEXT`,
    `ALTER TABLE public.shisha_production_work ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2)`,
    `ALTER TABLE public.shisha_production_work ADD COLUMN IF NOT EXISTS order_created_at TIMESTAMPTZ`,
    `ALTER TABLE public.shisha_production_work ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ`,
    `ALTER TABLE public.shisha_production_work ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'Pending'`,
    `ALTER TABLE public.shisha_production_work ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ`,
    `UPDATE public.shisha_production_work
     SET ready_at=completed_at
     WHERE status='Completed' AND ready_at IS NULL`,
    `ALTER TABLE public.shisha_production_work DROP CONSTRAINT IF EXISTS shisha_production_work_order_id_fkey`,
    `ALTER TABLE public.shisha_production_work DROP CONSTRAINT IF EXISTS shisha_production_work_order_item_id_fkey`,
    `CREATE TABLE IF NOT EXISTS public.shisha_production_events (
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
    )`,
    `ALTER TABLE public.shisha_production_events DROP CONSTRAINT IF EXISTS shisha_production_events_work_id_fkey`,
    `CREATE TABLE IF NOT EXISTS public.shisha_production_pin_attempts (
      staff_id INTEGER PRIMARY KEY,
      failures INTEGER NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS public.shisha_void_requests (
      id SERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES public.shisha_orders(id) ON DELETE CASCADE,
      order_item_id INTEGER NOT NULL REFERENCES public.shisha_order_items(id) ON DELETE CASCADE,
      requested_by INTEGER NOT NULL REFERENCES public.shisha_staff(id),
      quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
      amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0), reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
      resolved_by INTEGER REFERENCES public.shisha_staff(id), resolved_by_name TEXT, resolved_by_role TEXT,
      resolution_note TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ
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
      transaction_id TEXT, notes TEXT, client_name TEXT, client_phone TEXT, expected_payment_date DATE,
      confirmed_by INTEGER, confirmed_by_name TEXT, confirmed_by_role TEXT,
      confirmed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    'ALTER TABLE public.shisha_payment_requests ADD COLUMN IF NOT EXISTS client_name TEXT',
    'ALTER TABLE public.shisha_payment_requests ADD COLUMN IF NOT EXISTS client_phone TEXT',
    'ALTER TABLE public.shisha_payment_requests ADD COLUMN IF NOT EXISTS expected_payment_date DATE',
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
    `CREATE INDEX IF NOT EXISTS shisha_production_work_staff_idx ON public.shisha_production_work(staff_id, claimed_at DESC)`,
    `CREATE INDEX IF NOT EXISTS shisha_production_work_order_idx ON public.shisha_production_work(order_id, status)`,
    `CREATE INDEX IF NOT EXISTS shisha_void_requests_status_idx ON public.shisha_void_requests(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS shisha_void_requests_order_idx ON public.shisha_void_requests(order_id, status)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS shisha_void_requests_pending_item_idx
      ON public.shisha_void_requests(order_item_id) WHERE status = 'PENDING'`,
    `CREATE INDEX IF NOT EXISTS shisha_payment_requests_status_idx ON public.shisha_payment_requests(status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS shisha_payments_order_idx ON public.shisha_payments(order_id, confirmed_at DESC)`,
  ];

  for (const statement of statements) await pool.query(statement);

  if (process.env.SHISHA_ADMIN_EMAIL && process.env.SHISHA_ADMIN_PIN) {
    const pin = String(process.env.SHISHA_ADMIN_PIN);
    const email = process.env.SHISHA_ADMIN_EMAIL.trim().toLowerCase();
    const client = await pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const existing = await client.query(
        'SELECT id FROM public.shisha_staff WHERE lower(email) = $1',
        [email]
      );
      if (!existing.rows.length) {
        await assertPinIsAvailable(client, pin);
        const salt = randomBytes(16).toString('hex');
        const hash = (await scrypt(pin, salt, 64)).toString('hex');
        const encryptedPin = isValidShishaPinEncryptionKey()
          ? encryptShishaPin(pin)
          : null;
        await client.query(
          `INSERT INTO public.shisha_staff (name, email, role, pin_salt, pin_hash, pin_encrypted)
           VALUES ($1, $2, 'SHISHA_HOD', $3, $4, $5)`,
          [process.env.SHISHA_ADMIN_NAME || 'Shisha HOD', email, salt, hash, encryptedPin]
        );
      }
      await client.query('COMMIT');
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Shisha HOD bootstrap rollback error:', rollbackError.message);
        }
      }
      throw error;
    } finally {
      client.release();
    }
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

async function verifyPin(pin, salt, hash) {
  const expected = Buffer.from(String(hash || ''), 'hex');
  if (expected.length !== 64 || !salt) return false;
  const actual = await scrypt(String(pin), salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(expected, actual);
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
      const supervisorReportAccess = staff?.role === 'SUPERVISOR' && req.path === '/reports';
      if (!staff || staff.role !== session.role || (!REPORT_ROLES.includes(staff.role) && !supervisorReportAccess)) {
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

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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

async function syncShishaProductionWork(queryable) {
  await queryable.query(
    `INSERT INTO public.shisha_production_work
       (order_id, order_item_id, item_name, table_id, order_notes, unit_price,
        order_created_at, quantity)
     SELECT item.order_id, item.id, item.package_name, order_row.table_id,
            order_row.notes, item.unit_price, order_row.created_at, item.quantity
     FROM public.shisha_order_items item
     JOIN public.shisha_orders order_row ON order_row.id=item.order_id
     ON CONFLICT (order_item_id) DO UPDATE
       SET table_id=COALESCE(public.shisha_production_work.table_id, EXCLUDED.table_id),
           order_notes=COALESCE(public.shisha_production_work.order_notes, EXCLUDED.order_notes),
           unit_price=COALESCE(public.shisha_production_work.unit_price, EXCLUDED.unit_price),
           order_created_at=COALESCE(public.shisha_production_work.order_created_at, EXCLUDED.order_created_at)
       WHERE public.shisha_production_work.unit_price IS NULL
          OR public.shisha_production_work.order_created_at IS NULL`
  );
}

async function loadOrder(id, client = pool) {
  const result = await client.query(
    `SELECT o.*, w.name AS waiter_name, c.name AS chef_name,
      EXISTS (
        SELECT 1 FROM public.shisha_payment_requests r
        WHERE r.order_id=o.id AND r.payment_method='CREDIT' AND r.status='OUTSTANDING'
      ) AS has_credit_request,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'production_work_id', pw.id, 'package_id', i.shisha_package_id, 'name', i.package_name,
        'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total,
        'production_status', pw.status, 'production_staff_id', pw.staff_id,
        'production_staff_name', pw.staff_name, 'claimed_at', pw.claimed_at,
        'started_at', pw.started_at, 'completed_at', pw.completed_at,
        'ready_at', pw.ready_at, 'notification_status', pw.notification_status,
        'notified_at', pw.notified_at,
        'completed_quantity', pw.completed_quantity,
        'approved_void_quantity', COALESCE((SELECT SUM(v.quantity) FROM public.shisha_void_requests v
          WHERE v.order_item_id=i.id AND v.status='APPROVED'),0),
        'pending_void_quantity', COALESCE((SELECT SUM(v.quantity) FROM public.shisha_void_requests v
          WHERE v.order_item_id=i.id AND v.status='PENDING'),0)
      ) ORDER BY i.id) FROM public.shisha_order_items i
        LEFT JOIN public.shisha_production_work pw ON pw.order_item_id=i.id
        WHERE i.order_id = o.id), '[]'::jsonb) AS items
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

router.get('/staff/:id/pin', requireRoles('SHISHA_HOD'), async (req, res) => {
  return fail(res, 410, 'PIN retrieval is disabled. Reset the account PIN instead.');
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
  if (!isValidShishaPinEncryptionKey()) {
    return fail(res, 503, 'PIN encryption is not configured. Set SHISHA_PIN_ENCRYPTION_KEY on the backend.');
  }
  let client;
  let transactionStarted = false;
  try {
    const encryptedPin = encryptShishaPin(pin);
    const { salt, hash } = await hashPin(pin);
    client = await pool.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    await assertPinIsAvailable(client, pin);
    const result = await client.query(
      `INSERT INTO public.shisha_staff (name, email, role, pin_salt, pin_hash, pin_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, is_active, created_at`,
      [name, email, role, salt, hash, encryptedPin]
    );

    const staff = result.rows[0];
    await sendAccountPinEmail({ name, email, role, pin, department: 'Shisha' });
    await client.query('COMMIT');
    transactionStarted = false;
    return res.status(201).json({
      staff,
      emailSent: true,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Shisha account creation rollback error:', rollbackError.message);
      }
    }
    if (error.code === '23505') return fail(res, 409, 'That email already has a Shisha account.');
    if (error.code === 'PIN_ALREADY_IN_USE' || error.code === 'PIN_UNIQUENESS_CONFIG_MISSING') {
      return fail(res, error.statusCode || 409, error.message);
    }
    if (error.code === 'SMTP_CONFIG_MISSING' || error.code === 'SMTP_SEND_FAILED') {
      console.error('Shisha PIN email failed:', error.cause?.message || error.message);
      return fail(res, error.code === 'SMTP_CONFIG_MISSING' ? 503 : 502, 'Could not deliver the PIN email. The account was not created; check the backend SMTP settings and try again.');
    }
    console.error('Create Shisha staff error:', error.message);
    return fail(res, 500, 'Could not create the Shisha account.');
  } finally {
    client?.release();
  }
});

router.patch('/staff/:id', requireRoles('SHISHA_HOD'), async (req, res) => {
  const hasPinUpdate = Object.prototype.hasOwnProperty.call(req.body, 'pin');
  if (hasPinUpdate) {
    const staffId = Number(req.params.id);
    if (!Number.isInteger(staffId) || staffId <= 0) return fail(res, 400, 'A valid Shisha account is required.');
    const pin = String(req.body.pin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) return fail(res, 400, 'A 4-8 digit PIN is required.');
    if (!isValidShishaPinEncryptionKey()) {
      return fail(res, 503, 'PIN encryption is not configured. Set SHISHA_PIN_ENCRYPTION_KEY on the backend.');
    }
    let client;
    let transactionStarted = false;
    try {
      const encryptedPin = encryptShishaPin(pin);
      const { salt, hash } = await hashPin(pin);
      client = await pool.connect();
      await client.query('BEGIN');
      transactionStarted = true;
      await assertPinIsAvailable(client, pin, { excludeShishaStaffId: staffId });
      const result = await client.query(
        `UPDATE public.shisha_staff SET pin_salt=$1, pin_hash=$2, pin_encrypted=$3, updated_at=NOW()
         WHERE id=$4 AND role <> 'SHISHA_HOD'
         RETURNING id, name, email, role, is_active`,
        [salt, hash, encryptedPin, staffId]
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        transactionStarted = false;
        return fail(res, 404, 'Waiter or mixer account not found.');
      }
      await client.query('COMMIT');
      transactionStarted = false;
      return res.json(result.rows[0]);
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Shisha PIN update rollback error:', rollbackError.message);
        }
      }
      if (error.code === 'PIN_ALREADY_IN_USE' || error.code === 'PIN_UNIQUENESS_CONFIG_MISSING') {
        return fail(res, error.statusCode || 409, error.message);
      }
      console.error('Update Shisha staff PIN error:', error.message);
      return fail(res, 500, 'Could not update the account PIN.');
    } finally {
      client?.release();
    }
  }

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
    await syncShishaProductionWork(pool);
    const conditions = [];
    const values = [];
    if (req.actor.role === 'SHISHA_WAITER') {
      values.push(req.actor.id);
      conditions.push(`o.shisha_waiter_id=$${values.length}`);
    }
    if (req.actor.role === 'SHISHA_CHEF') {
      values.push(req.actor.id);
      conditions.push(`(o.assigned_chef_id=$${values.length} OR (o.assigned_chef_id IS NULL AND o.order_status='PENDING'))`);
      conditions.push(`o.order_status IN ('PENDING', 'ASSIGNED', 'PREPARING')`);
    }
    if (req.query.status) {
      values.push(String(req.query.status).toUpperCase());
      conditions.push(`o.order_status=$${values.length}`);
    }
    const result = await pool.query(
      `SELECT o.*, w.name AS waiter_name, c.name AS chef_name,
        EXISTS (
          SELECT 1 FROM public.shisha_payment_requests r
          WHERE r.order_id=o.id AND r.payment_method='CREDIT' AND r.status='OUTSTANDING'
        ) AS has_credit_request,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'production_work_id', pw.id, 'package_id', i.shisha_package_id, 'name', i.package_name,
          'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total,
          'production_status', pw.status, 'production_staff_id', pw.staff_id,
          'production_staff_name', pw.staff_name, 'claimed_at', pw.claimed_at,
          'started_at', pw.started_at, 'completed_at', pw.completed_at,
          'ready_at', pw.ready_at, 'notification_status', pw.notification_status,
          'notified_at', pw.notified_at,
          'completed_quantity', pw.completed_quantity,
          'approved_void_quantity', COALESCE((SELECT SUM(v.quantity) FROM public.shisha_void_requests v
            WHERE v.order_item_id=i.id AND v.status='APPROVED'),0),
          'pending_void_quantity', COALESCE((SELECT SUM(v.quantity) FROM public.shisha_void_requests v
            WHERE v.order_item_id=i.id AND v.status='PENDING'),0)
        ) ORDER BY i.id) FROM public.shisha_order_items i
          LEFT JOIN public.shisha_production_work pw ON pw.order_item_id=i.id
          WHERE i.order_id=o.id), '[]'::jsonb) AS items
       FROM public.shisha_orders o JOIN public.shisha_staff w ON w.id=o.shisha_waiter_id
       LEFT JOIN public.shisha_staff c ON c.id=o.assigned_chef_id
       WHERE COALESCE(o.day_cleared, false) = false
         ${conditions.length ? `AND ${conditions.join(' AND ')}` : ''} ORDER BY o.created_at DESC LIMIT 250`,
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
    await syncShishaProductionWork(client);
    await recordHistory(client, order, 'PENDING', 'ORDER_CREATED', req.actor, order.notes);
    await client.query('COMMIT');
    void notificationService.sendToRoles(['SHISHA_HOD', 'SHISHA_CHEF'], {
      type: 'SHISHA_ORDER',
      title: 'New Shisha Order',
      body: `Shisha order ${orderReference(order.id)} requires attention.`,
      department: 'Shisha',
      referenceId: order.id,
      referenceType: 'SHISHA_ORDER',
      link: `/shisha/mixer?order=${order.id}`,
    }, 'shisha');
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
  const reason = String(req.body.reason || '').trim();
  if (!reason || reason.length > 500) return fail(res, 400, 'A reason of 1-500 characters is required.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const chef = await client.query("SELECT id FROM public.shisha_staff WHERE id=$1 AND role='SHISHA_CHEF' AND is_active=true", [chefId]);
    const orderResult = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = orderResult.rows[0];
    const isInitialAssignment = Boolean(order && !order.assigned_chef_id);
    if (!chef.rows[0] || !order
      || (!isInitialAssignment && chefId === Number(order.assigned_chef_id))
      || !['PENDING', 'ASSIGNED', 'PREPARING'].includes(order.order_status)) {
      await client.query('ROLLBACK');
      return fail(res, 400, 'Choose an active mixer for an unassigned or active Shisha order.');
    }
    await syncShishaProductionWork(client);
    if (isInitialAssignment) {
      const availableWork = await client.query(
        `SELECT id, staff_id, status FROM public.shisha_production_work
         WHERE order_id=$1 AND status NOT IN ('Completed', 'Cancelled', 'Voided')
         FOR UPDATE`,
        [order.id]
      );
      if (!availableWork.rows.length) {
        await client.query('ROLLBACK');
        return fail(res, 409, 'This Shisha order has no active production items to assign.');
      }
      if (availableWork.rows.some(work => work.staff_id || work.status !== 'Unclaimed')) {
        await client.query('ROLLBACK');
        return fail(res, 409, 'This Shisha order already has production work assigned.');
      }
      await client.query(
        `INSERT INTO public.shisha_production_events
           (work_id, event_type, to_staff_id, actor_id, from_status, to_status)
         SELECT id, 'ASSIGNED', $2, $3, status, 'Claimed'
         FROM public.shisha_production_work
         WHERE order_id=$1 AND status NOT IN ('Completed', 'Cancelled', 'Voided')`,
        [order.id, chefId, req.actor.id]
      );
      await client.query(
        `UPDATE public.shisha_production_work
         SET staff_id=$2, staff_name=(SELECT name FROM public.shisha_staff WHERE id=$2),
             status='Claimed', claimed_at=NOW(), updated_at=NOW()
         WHERE order_id=$1 AND status NOT IN ('Completed', 'Cancelled', 'Voided')`,
        [order.id, chefId]
      );
      await client.query(
        `UPDATE public.shisha_orders
         SET assigned_chef_id=$1, order_status='ASSIGNED', updated_at=NOW()
         WHERE id=$2`,
        [chefId, order.id]
      );
      await recordHistory(client, order, 'ASSIGNED', 'CHEF_ASSIGNED', req.actor, reason);
      await client.query('COMMIT');
      void notificationService.sendToUser(chefId, {
        type: 'SHISHA_ORDER_ASSIGNED',
        title: 'Shisha Order Assigned',
        body: `Shisha order ${orderReference(order.id)} is assigned to you.`,
        department: 'Shisha',
        referenceId: order.id,
        link: `/shisha?order=${order.id}`,
      }, 'shisha').catch(notificationError => {
        console.error('Shisha assignment notification failed:', notificationError.message);
      });
      return res.json({ ...(await loadOrder(order.id)), reference: orderReference(order.id) });
    }
    const claimedWork = await client.query(
      `SELECT id FROM public.shisha_production_work
       WHERE order_id=$1 AND staff_id=$2
         AND status IN ('Preparing', 'Claimed')
       LIMIT 1 FOR UPDATE`,
      [order.id, order.assigned_chef_id]
    );
    if (!claimedWork.rows.length) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'Shisha work must be claimed with the mixer PIN before it can be reassigned.');
    }
    await client.query(
      `INSERT INTO public.shisha_production_events
         (work_id, event_type, from_staff_id, to_staff_id, actor_id, from_status, to_status, reason)
       SELECT id, 'REASSIGNED', staff_id, $2, $3, status, status, $4
       FROM public.shisha_production_work
       WHERE order_id=$1 AND staff_id IS DISTINCT FROM $2
         AND status NOT IN ('Completed', 'Cancelled', 'Voided')`,
      [order.id, chefId, req.actor.id, reason]
    );
    await client.query(
      `UPDATE public.shisha_production_work
       SET staff_id=$2, staff_name=(SELECT name FROM public.shisha_staff WHERE id=$2),
           claimed_at=NOW(), started_at=CASE WHEN status='Preparing' THEN NOW() ELSE started_at END,
           updated_at=NOW()
       WHERE order_id=$1 AND staff_id IS DISTINCT FROM $2
         AND status NOT IN ('Completed', 'Cancelled', 'Voided')`,
      [order.id, chefId]
    );
    await client.query('UPDATE public.shisha_orders SET assigned_chef_id=$1, updated_at=NOW() WHERE id=$2', [chefId, order.id]);
    await recordHistory(client, order, order.order_status, 'CHEF_REASSIGNED', req.actor, reason);
    await client.query('COMMIT');
    void notificationService.sendToUser(chefId, {
      type: 'SHISHA_ORDER_ASSIGNED',
      title: 'Shisha Order Assigned',
      body: `Shisha order ${orderReference(order.id)} is assigned to you.`,
      department: 'Shisha',
      referenceId: order.id,
      link: `/shisha?order=${order.id}`,
    }, 'shisha');
    return res.json({ ...(await loadOrder(order.id)), reference: orderReference(order.id) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Assign Shisha order error:', error.message);
    return fail(res, 500, 'Could not assign the Shisha order.');
  } finally {
    client.release();
  }
});

router.post('/production/work/:workId/claim', requireRoles('SHISHA_HOD'), async (req, res) => {
  const workId = Number(req.params.workId);
  const pin = String(req.body?.pin || '').trim();
  if (!Number.isInteger(workId) || workId < 1 || !/^\d{4,8}$/.test(pin)) {
    return fail(res, 400, 'Enter a valid 4-8 digit mixer PIN to claim this item.');
  }

  try {
    const attempt = await pool.query(
      'SELECT locked_until > NOW() AS locked FROM public.shisha_production_pin_attempts WHERE staff_id=$1',
      [req.actor.id]
    );
    if (attempt.rows[0]?.locked) return fail(res, 429, 'Too many invalid PIN attempts. Try again later.');

    const candidates = await pool.query(
      `SELECT id, name, pin_salt, pin_hash FROM public.shisha_staff
       WHERE role='SHISHA_CHEF' AND is_active=true`
    );
    const matches = [];
    for (const person of candidates.rows) {
      if (await verifyPin(pin, person.pin_salt, person.pin_hash)) matches.push(person);
    }
    if (matches.length !== 1) {
      await pool.query(
        `INSERT INTO public.shisha_production_pin_attempts (staff_id, failures, locked_until)
         VALUES ($1, 1, NULL)
         ON CONFLICT (staff_id) DO UPDATE
         SET failures=CASE
               WHEN public.shisha_production_pin_attempts.locked_until <= NOW() THEN 1
               ELSE public.shisha_production_pin_attempts.failures + 1
             END,
             locked_until=CASE
               WHEN public.shisha_production_pin_attempts.locked_until <= NOW() THEN NULL
               WHEN public.shisha_production_pin_attempts.failures + 1 >= 10 THEN NOW() + INTERVAL '15 minutes'
               ELSE public.shisha_production_pin_attempts.locked_until
             END,
             updated_at=NOW()`,
        [req.actor.id]
      );
      return fail(res, 401, 'Invalid mixer PIN.');
    }
    await pool.query('DELETE FROM public.shisha_production_pin_attempts WHERE staff_id=$1', [req.actor.id]);

    const claimant = matches[0];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locator = await client.query(
        'SELECT order_id FROM public.shisha_production_work WHERE id=$1',
        [workId]
      );
      if (!locator.rows[0]) {
        await client.query('ROLLBACK');
        return fail(res, 404, 'Shisha production item not found.');
      }
      await client.query('SELECT id FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [locator.rows[0].order_id]);
      const result = await client.query(
        'SELECT * FROM public.shisha_production_work WHERE id=$1 FOR UPDATE',
        [workId]
      );
      const work = result.rows[0];
      if (!work || work.status !== 'Unclaimed' || work.staff_id) {
        await client.query('ROLLBACK');
        return fail(res, 409, 'This Shisha item has already been claimed.');
      }
      const claimed = await client.query(
        `UPDATE public.shisha_production_work
         SET staff_id=$1, staff_name=$2, status='Claimed', claimed_at=NOW(), updated_at=NOW()
         WHERE id=$3 RETURNING *`,
        [claimant.id, claimant.name, workId]
      );
      await client.query(
        `INSERT INTO public.shisha_production_events
           (work_id, event_type, to_staff_id, actor_id, from_status, to_status)
         VALUES ($1, 'CLAIMED', $2, $3, 'Unclaimed', 'Claimed')`,
        [workId, claimant.id, req.actor.id]
      );
      await client.query('COMMIT');
      return res.json({ ...claimed.rows[0], claimant_id: claimant.id });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Claim Shisha production item error:', error.message);
    return fail(res, 500, 'Could not claim the Shisha item.');
  }
});

router.patch('/production/work/:workId/status', requireRoles('SHISHA_HOD'), async (req, res) => {
  const workId = Number(req.params.workId);
  const status = String(req.body?.status || '');
  if (!Number.isInteger(workId) || workId < 1 || !['Preparing', 'Completed'].includes(status)) {
    return fail(res, 400, 'A valid Shisha item and status are required.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locator = await client.query(
      'SELECT order_id FROM public.shisha_production_work WHERE id=$1',
      [workId]
    );
    if (!locator.rows[0]) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Shisha production item not found.');
    }
    const orderResult = await client.query(
      'SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE',
      [locator.rows[0].order_id]
    );
    const order = orderResult.rows[0];
    const result = await client.query(
      'SELECT * FROM public.shisha_production_work WHERE id=$1 FOR UPDATE',
      [workId]
    );
    const work = result.rows[0];
    if (!order || !work) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Shisha production item not found.');
    }
    if (['Cancelled', 'Voided'].includes(work.status)) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'Cancelled or voided work cannot be prepared.');
    }
    if (work.status === 'Completed' && status === 'Completed') {
      await client.query('COMMIT');
      return res.json(work);
    }
    if ((status === 'Preparing' && work.status !== 'Claimed')
        || (status === 'Completed' && work.status !== 'Preparing')) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'Shisha items must be claimed, prepared, and completed in order.');
    }

    let completedQuantity = Number(work.completed_quantity || 0);
    let nextStatus = status;
    if (status === 'Completed') {
      const voids = await client.query(
        `SELECT COALESCE(SUM(quantity), 0) AS quantity
         FROM public.shisha_void_requests
         WHERE order_item_id=$1 AND status='APPROVED'`,
        [work.order_item_id]
      );
      completedQuantity = Math.max(Number(work.quantity) - Number(voids.rows[0].quantity || 0), 0);
      nextStatus = completedQuantity > 0 ? 'Completed' : 'Voided';
    }
    const updated = await client.query(
      `UPDATE public.shisha_production_work
       SET status=$1,
           completed_quantity=$2,
           started_at=CASE WHEN $3='Preparing' THEN COALESCE(started_at,NOW()) ELSE started_at END,
           completed_at=CASE WHEN $3='Completed' THEN NOW() ELSE completed_at END,
           ready_at=CASE WHEN $1='Completed' THEN COALESCE(ready_at,NOW()) ELSE ready_at END,
           updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [nextStatus, completedQuantity, status, workId]
    );
    await client.query(
      `INSERT INTO public.shisha_production_events
         (work_id, event_type, actor_id, from_status, to_status, quantity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [workId, status === 'Preparing' ? 'STARTED' : nextStatus === 'Voided' ? 'VOIDED' : 'COMPLETED',
        req.actor.id, work.status, nextStatus, status === 'Completed' ? completedQuantity : null]
    );

    const remaining = await client.query(
      `SELECT COUNT(*)::int AS count FROM public.shisha_production_work
       WHERE order_id=$1 AND status NOT IN ('Completed','Cancelled','Voided')`,
      [order.id]
    );
    const nextOrderStatus = Number(remaining.rows[0].count) === 0 ? 'READY' : 'PREPARING';
    if (order.order_status !== nextOrderStatus) {
      await recordHistory(
        client,
        order,
        nextOrderStatus,
        nextOrderStatus === 'READY' ? 'ORDER_READY' : 'PREPARATION_STARTED',
        req.actor
      );
    }
    await client.query('COMMIT');
    return res.json({ ...updated.rows[0], order_status: nextOrderStatus });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Update Shisha production item error:', error.message);
    return fail(res, 500, 'Could not update the Shisha item.');
  } finally {
    client.release();
  }
});

router.post('/production/work/:workId/notify', requireRoles('SHISHA_HOD'), async (req, res) => {
  const workId = Number(req.params.workId);
  if (!Number.isInteger(workId) || workId < 1) return fail(res, 400, 'A valid Shisha item is required.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locator = await client.query(
      'SELECT order_id FROM public.shisha_production_work WHERE id=$1',
      [workId]
    );
    if (!locator.rows[0]) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Shisha production item not found.');
    }
    const orderResult = await client.query(
      'SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE',
      [locator.rows[0].order_id]
    );
    const result = await client.query(
      'SELECT * FROM public.shisha_production_work WHERE id=$1 FOR UPDATE',
      [workId]
    );
    const order = orderResult.rows[0];
    const work = result.rows[0];
    if (!order || !work || work.status !== 'Completed' || !work.ready_at) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This Shisha item must be ready before notification.');
    }
    if (work.notified_at || work.notification_status === 'Sending') {
      await client.query('ROLLBACK');
      return fail(res, 409, 'The Shisha waiter has already been notified about this item.');
    }
    await client.query(
      `UPDATE public.shisha_production_work SET notification_status='Sending', updated_at=NOW()
       WHERE id=$1`,
      [workId]
    );
    await client.query('COMMIT');

    const notification = await notificationService.sendToUser(order.shisha_waiter_id, {
      type: 'SHISHA_ITEM_READY',
      title: 'Shisha item ready',
      body: `${orderReference(order.id)} · Table ${order.table_id} · ${work.item_name} × ${work.quantity} is ready to serve.`,
      department: 'Shisha',
      referenceId: order.id,
      referenceType: 'SHISHA_ORDER',
      link: `/shisha?order=${order.id}`,
    }, 'shisha');
    if (notification.error || !notification.sent) {
      await pool.query(
        `UPDATE public.shisha_production_work
         SET notification_status='Failed', updated_at=NOW()
         WHERE id=$1 AND notification_status='Sending'`,
        [workId]
      );
      const message = notification.noRecipients
        ? 'No Shisha waiter device is registered with notifications enabled. Ask the waiter to enable push notifications, then retry.'
        : 'The Shisha waiter notification could not be delivered. Please retry.';
      return fail(res, 503, message);
    }
    const notified = await pool.query(
      `UPDATE public.shisha_production_work
       SET notification_status='Sent', notified_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND notification_status='Sending'
       RETURNING id AS work_id, ready_at, notification_status, notified_at`,
      [workId]
    );
    await pool.query(
      `INSERT INTO public.shisha_production_events
         (work_id, event_type, actor_id, from_status, to_status)
       VALUES ($1, 'NOTIFIED', $2, 'Ready', 'Notified')`,
      [workId, req.actor.id]
    );
    return res.json(notified.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Notify Shisha waiter error:', error.message);
    return fail(res, 500, 'Could not notify the Shisha waiter.');
  } finally {
    client.release();
  }
});

router.post('/orders/:id/claim', requireRoles('SHISHA_CHEF'), async (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  if (!/^\d{4,8}$/.test(pin)) return fail(res, 400, 'Enter your 4-8 digit Shisha PIN to claim this order.');
  const attempt = await pool.query(
    'SELECT locked_until > NOW() AS locked FROM public.shisha_production_pin_attempts WHERE staff_id=$1',
    [req.actor.id]
  );
  if (attempt.rows[0]?.locked) return fail(res, 429, 'Too many invalid PIN attempts. Try again later.');
  const staffResult = await pool.query(
    'SELECT pin_salt, pin_hash FROM public.shisha_staff WHERE id=$1 AND role=\'SHISHA_CHEF\' AND is_active=true',
    [req.actor.id]
  );
  if (!staffResult.rows[0] || !(await verifyPin(pin, staffResult.rows[0].pin_salt, staffResult.rows[0].pin_hash))) {
    await pool.query(
      `INSERT INTO public.shisha_production_pin_attempts (staff_id, failures, locked_until)
       VALUES ($1, 1, NULL)
       ON CONFLICT (staff_id) DO UPDATE
       SET failures=CASE
             WHEN public.shisha_production_pin_attempts.locked_until <= NOW() THEN 1
             ELSE public.shisha_production_pin_attempts.failures + 1
           END,
           locked_until=CASE
             WHEN public.shisha_production_pin_attempts.locked_until <= NOW() THEN NULL
             WHEN public.shisha_production_pin_attempts.failures + 1 >= 10 THEN NOW() + INTERVAL '15 minutes'
             ELSE public.shisha_production_pin_attempts.locked_until
           END,
           updated_at=NOW()`,
      [req.actor.id]
    );
    return fail(res, 401, 'Invalid Shisha PIN.');
  }
  await pool.query('DELETE FROM public.shisha_production_pin_attempts WHERE staff_id=$1', [req.actor.id]);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE',
      [req.params.id]
    );
    const order = result.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Shisha order not found.');
    }
    const isUnassignedOrder = !order.assigned_chef_id && order.order_status === 'PENDING';
    const isAssignedToMixer = Number(order.assigned_chef_id) === Number(req.actor.id) && order.order_status === 'ASSIGNED';
    if (!isUnassignedOrder && !isAssignedToMixer) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This Shisha order has already been claimed or is no longer available.');
    }

    await syncShishaProductionWork(client);
    const workResult = await client.query(
      `SELECT * FROM public.shisha_production_work
       WHERE order_id=$1 AND status NOT IN ('Completed', 'Cancelled', 'Voided')
       FOR UPDATE`,
      [order.id]
    );
    const workUnavailable = isUnassignedOrder
      ? workResult.rows.some(work => work.staff_id || work.status !== 'Unclaimed')
      : workResult.rows.some(work => Number(work.staff_id) !== Number(req.actor.id) || work.status !== 'Claimed');
    if (!workResult.rows.length || workUnavailable) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'One or more Shisha items are unavailable for this mixer.');
    }

    await client.query(
      `INSERT INTO public.shisha_production_events
         (work_id, event_type, to_staff_id, actor_id, from_status, to_status)
       SELECT id, CASE WHEN status='Unclaimed' THEN 'CLAIMED' ELSE 'STARTED' END,
              $2, $2, status, 'Preparing'
       FROM public.shisha_production_work
       WHERE order_id=$1 AND status NOT IN ('Completed', 'Cancelled', 'Voided')`,
      [order.id, req.actor.id]
    );
    await client.query(
      `UPDATE public.shisha_production_work
       SET staff_id=$2, staff_name=$3, status='Preparing', claimed_at=NOW(), started_at=NOW(), updated_at=NOW()
       WHERE order_id=$1 AND status NOT IN ('Completed', 'Cancelled', 'Voided')`,
      [order.id, req.actor.id, req.actor.name]
    );
    await client.query(
      `UPDATE public.shisha_orders
       SET assigned_chef_id=$1, order_status='PREPARING', updated_at=NOW()
       WHERE id=$2`,
      [req.actor.id, order.id]
    );
    await recordHistory(client, order, 'PREPARING', 'PREPARATION_STARTED', req.actor);
    await client.query('COMMIT');
    return res.json({ ...(await loadOrder(order.id)), reference: orderReference(order.id) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Claim Shisha order error:', error.message);
    return fail(res, 500, 'Could not claim the Shisha order.');
  } finally {
    client.release();
  }
});

router.post('/orders/:id/ready', requireRoles('SHISHA_CHEF'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = orderResult.rows[0];
    if (!order || order.assigned_chef_id !== req.actor.id || !['ASSIGNED', 'PREPARING'].includes(order.order_status)) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This order is not being prepared by you.');
    }
    await syncShishaProductionWork(client);
    const completed = await client.query(
      `UPDATE public.shisha_production_work work
       SET completed_quantity=GREATEST(work.quantity - COALESCE((
             SELECT SUM(void_request.quantity)
             FROM public.shisha_void_requests void_request
             WHERE void_request.order_item_id=work.order_item_id AND void_request.status='APPROVED'
           ),0),0),
           status=CASE WHEN GREATEST(work.quantity - COALESCE((
             SELECT SUM(void_request.quantity)
             FROM public.shisha_void_requests void_request
             WHERE void_request.order_item_id=work.order_item_id AND void_request.status='APPROVED'
           ),0),0)=0 THEN 'Voided' ELSE 'Completed' END,
           completed_at=NOW(), updated_at=NOW()
       WHERE work.order_id=$1 AND work.staff_id=$2
       RETURNING id, status, completed_quantity`,
      [order.id, req.actor.id]
    );
    for (const work of completed.rows) {
      await client.query(
        `INSERT INTO public.shisha_production_events
           (work_id, event_type, actor_id, from_status, to_status, quantity)
         VALUES ($1, $2, $3, 'Preparing', $4, $5)`,
        [work.id, work.status === 'Voided' ? 'VOIDED' : 'COMPLETED',
          req.actor.id, work.status, work.completed_quantity]
      );
    }
    await recordHistory(client, order, 'READY', 'ORDER_READY', req.actor);
    await client.query('COMMIT');
    const notification = await notificationService.sendToUser(order.shisha_waiter_id, {
      type: 'SHISHA_ORDER_READY',
      title: 'Shisha Order Ready',
      body: `Shisha order ${orderReference(order.id)} is ready to serve.`,
      department: 'Shisha',
      referenceId: order.id,
      link: `/shisha?order=${order.id}`,
    }, 'shisha');
    if (!notification.sent) {
      console.warn('Shisha order-ready push was not delivered:', {
        orderId: order.id,
        waiterId: order.shisha_waiter_id,
        failed: notification.failed || 0,
        noRecipients: notification.noRecipients === true,
      });
    }
    return res.json({
      ...(await loadOrder(order.id)),
      reference: orderReference(order.id),
      notification_sent: notification.sent > 0,
    });
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

router.post('/orders/:id/void-requests', requireRoles('SHISHA_WAITER'), async (req, res) => {
  const itemId = Number(req.body.item_id);
  const quantity = Number(req.body.quantity);
  const reason = String(req.body.reason || '').trim();
  if (!Number.isInteger(itemId) || itemId < 1 || !Number.isInteger(quantity) || quantity < 1 || !reason || reason.length > 500) {
    return fail(res, 400, 'Select an item, enter a valid quantity, and provide a reason of at most 500 characters.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    const order = orderResult.rows[0];
    if (!order || order.shisha_waiter_id !== req.actor.id) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Shisha order not found.');
    }
    const itemResult = await client.query(
      'SELECT * FROM public.shisha_order_items WHERE id=$1 AND order_id=$2 FOR UPDATE',
      [itemId, order.id]
    );
    const item = itemResult.rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Shisha order item not found.');
    }
    const usageResult = await client.query(
      `SELECT COALESCE(SUM(quantity) FILTER (WHERE status='APPROVED'),0) AS approved_quantity,
        COALESCE(SUM(quantity) FILTER (WHERE status='PENDING'),0) AS pending_quantity,
        COALESCE((SELECT SUM(amount) FROM public.shisha_void_requests
          WHERE order_id=$2 AND status='PENDING'),0) AS order_pending_amount
       FROM public.shisha_void_requests WHERE order_item_id=$1`,
      [item.id, order.id]
    );
    const usage = usageResult.rows[0];
    const remainingQuantity = Number(item.quantity) - Number(usage.approved_quantity) - Number(usage.pending_quantity);
    const amount = Number((Number(item.unit_price) * quantity).toFixed(2));
    const availableBalance = Number(order.outstanding_amount) - Number(usage.order_pending_amount);
    if (quantity > remainingQuantity || amount > availableBalance + 0.00001 || availableBalance <= 0) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'The requested quantity exceeds the unvoided item quantity or available order balance.');
    }
    const requestResult = await client.query(
      `INSERT INTO public.shisha_void_requests
        (order_id, order_item_id, requested_by, quantity, unit_price, amount, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [order.id, item.id, req.actor.id, quantity, item.unit_price, amount, reason]
    );
    await recordHistory(client, order, order.order_status, 'VOID_REQUESTED', req.actor, `${quantity} × ${item.package_name}: ${reason}`);
    await client.query('COMMIT');
    const notification = await notificationService.sendToRoles(['SHISHA_HOD'], {
      type: 'SHISHA_VOID_REQUEST',
      title: 'Shisha Void Request',
      body: `${req.actor.name} requested a void for ${item.package_name} on ${orderReference(order.id)}.`,
      department: 'Shisha',
      referenceId: requestResult.rows[0].id,
      referenceType: 'SHISHA_VOID_REQUEST',
      link: `/shisha?tab=voids`,
    }, 'shisha');
    if (!notification.sent) {
      console.warn('Shisha void request push was not delivered:', {
        requestId: requestResult.rows[0].id,
        orderId: order.id,
        sent: notification.sent || 0,
        failed: notification.failed || 0,
        noRecipients: notification.noRecipients === true,
        error: notification.error === true,
      });
    }
    return res.status(201).json({
      ...requestResult.rows[0],
      notification_sent: notification.sent > 0,
      notification_no_recipients: notification.noRecipients === true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create Shisha void request error:', error.message);
    return fail(res, 500, 'Could not send the void request.');
  } finally {
    client.release();
  }
});

router.get('/void-requests', requireRoles('SHISHA_HOD'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, i.package_name, i.quantity AS item_quantity, i.unit_price,
        o.table_id, o.total_amount, o.outstanding_amount, o.order_status,
        w.name AS waiter_name, w.id AS waiter_id, r.name AS requested_by_name
       FROM public.shisha_void_requests v
       JOIN public.shisha_order_items i ON i.id=v.order_item_id
       JOIN public.shisha_orders o ON o.id=v.order_id
       JOIN public.shisha_staff w ON w.id=o.shisha_waiter_id
       JOIN public.shisha_staff r ON r.id=v.requested_by
       WHERE v.status='PENDING'
       ORDER BY v.created_at ASC LIMIT 250`
    );
    return res.json(result.rows.map(row => ({ ...row, reference: orderReference(row.order_id) })));
  } catch (error) {
    console.error('Shisha void requests error:', error.message);
    return fail(res, 500, 'Could not load Shisha void requests.');
  }
});

async function resolveVoidRequest(req, res, approve) {
  const note = String(req.body.notes || '').trim().slice(0, 500);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lookup = await client.query('SELECT order_id FROM public.shisha_void_requests WHERE id=$1', [req.params.id]);
    if (!lookup.rows[0]) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Void request not found.');
    }
    const orderResult = await client.query('SELECT * FROM public.shisha_orders WHERE id=$1 FOR UPDATE', [lookup.rows[0].order_id]);
    const order = orderResult.rows[0];
    const requestResult = await client.query('SELECT * FROM public.shisha_void_requests WHERE id=$1 FOR UPDATE', [req.params.id]);
    const voidRequest = requestResult.rows[0];
    if (!voidRequest || voidRequest.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return fail(res, 409, 'This void request has already been resolved.');
    }

    if (approve) {
      const total = Number(order.total_amount);
      const outstanding = Number(order.outstanding_amount);
      const amount = Number(voidRequest.amount);
      if (amount > outstanding + 0.00001 || total - amount < Number(order.amount_paid) - 0.00001) {
        await client.query('ROLLBACK');
        return fail(res, 409, 'The order balance has changed; this void cannot be approved without refunding a payment.');
      }
      const nextTotal = Number(Math.max(0, total - amount).toFixed(2));
      const nextOutstanding = Number(Math.max(0, outstanding - amount).toFixed(2));
      const paymentStatus = nextOutstanding === 0
        ? 'FULLY_PAID'
        : Number(order.amount_paid) > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
      await client.query(
        `UPDATE public.shisha_orders SET total_amount=$1, outstanding_amount=$2, payment_status=$3, updated_at=NOW()
         WHERE id=$4`,
        [nextTotal, nextOutstanding, paymentStatus, order.id]
      );
      await syncShishaProductionWork(client);
      const affectedWork = await client.query(
        `UPDATE public.shisha_production_work work
         SET completed_quantity=GREATEST(work.quantity - COALESCE((
               SELECT SUM(void_request.quantity)
               FROM public.shisha_void_requests void_request
               WHERE void_request.order_item_id=work.order_item_id
                 AND (void_request.id= $2 OR void_request.status='APPROVED')
             ),0),0),
             status=CASE WHEN GREATEST(work.quantity - COALESCE((
               SELECT SUM(void_request.quantity)
               FROM public.shisha_void_requests void_request
               WHERE void_request.order_item_id=work.order_item_id
                 AND (void_request.id= $2 OR void_request.status='APPROVED')
             ),0),0)=0 THEN 'Voided' ELSE work.status END,
             updated_at=NOW()
         WHERE work.order_item_id=$1 AND work.status='Completed'
         RETURNING id, completed_quantity, status`,
        [voidRequest.order_item_id, voidRequest.id]
      );
      for (const work of affectedWork.rows) {
        await client.query(
          `INSERT INTO public.shisha_production_events
             (work_id, event_type, actor_id, from_status, to_status, quantity, reason)
           VALUES ($1, 'VOIDED_QUANTITY', $2, 'Completed', $3, $4, $5)`,
          [work.id, req.actor.id, work.status, work.completed_quantity, voidRequest.reason]
        );
      }
    }

    const status = approve ? 'APPROVED' : 'REJECTED';
    const updated = await client.query(
      `UPDATE public.shisha_void_requests SET status=$1, resolved_by=$2, resolved_by_name=$3,
        resolved_by_role=$4, resolution_note=$5, resolved_at=NOW() WHERE id=$6 RETURNING *`,
      [status, req.actor.id, req.actor.name, req.actor.role, note || null, voidRequest.id]
    );
    await recordHistory(
      client,
      order,
      order.order_status,
      approve ? 'VOID_APPROVED' : 'VOID_REJECTED',
      req.actor,
      `${voidRequest.quantity} × ${voidRequest.amount}; ${voidRequest.reason}${note ? `; ${note}` : ''}`
    );
    await client.query('COMMIT');

    const notification = await notificationService.sendToUser(order.shisha_waiter_id, {
      type: approve ? 'SHISHA_VOID_APPROVED' : 'SHISHA_VOID_REJECTED',
      title: approve ? 'Shisha Void Approved' : 'Shisha Void Rejected',
      body: `${orderReference(order.id)}: ${voidRequest.quantity} × ${voidRequest.amount} was ${status.toLowerCase()}.`,
      department: 'Shisha',
      referenceId: voidRequest.id,
      referenceType: 'SHISHA_VOID_REQUEST',
      link: `/shisha?order=${order.id}`,
    }, 'shisha');
    if (!notification.sent) {
      console.warn('Shisha void resolution push was not delivered:', {
        requestId: voidRequest.id,
        waiterId: order.shisha_waiter_id,
        sent: notification.sent || 0,
        failed: notification.failed || 0,
        noRecipients: notification.noRecipients === true,
        error: notification.error === true,
      });
    }
    return res.json({
      ...updated.rows[0],
      notification_sent: notification.sent > 0,
      notification_no_recipients: notification.noRecipients === true,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Resolve Shisha void request error:', error.message);
    return fail(res, 500, 'Could not resolve the void request.');
  } finally {
    client.release();
  }
}

router.post('/void-requests/:id/approve', requireRoles('SHISHA_HOD'), (req, res) => resolveVoidRequest(req, res, true));
router.post('/void-requests/:id/reject', requireRoles('SHISHA_HOD'), (req, res) => resolveVoidRequest(req, res, false));

router.post('/orders/:id/payment-request', requireRoles('SHISHA_WAITER'), async (req, res) => {
  const method = normalizeMethod(req.body.payment_method);
  if (!PAYMENT_METHODS.includes(method)) return fail(res, 400, 'Select a supported payment method.');
  const clientName = String(req.body.client_name || '').trim();
  const clientPhone = String(req.body.client_phone || '').trim();
  const expectedPaymentDate = String(req.body.expected_payment_date || '').trim() || null;
  if (method === 'CREDIT' && (!clientName || clientName.length > 120 || !clientPhone || clientPhone.length > 40)) {
    return fail(res, 400, 'Enter the client full name and phone number for credit.');
  }
  if (method === 'CREDIT' && expectedPaymentDate && !isValidDateOnly(expectedPaymentDate)) {
    return fail(res, 400, 'Enter a valid expected payment date.');
  }
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
    if (method === 'CREDIT') {
      const existingCredit = await client.query(
        `SELECT id FROM public.shisha_payment_requests
         WHERE order_id=$1 AND payment_method='CREDIT' AND status='OUTSTANDING'
         LIMIT 1`,
        [order.id]
      );
      if (existingCredit.rows.length) {
        await client.query('ROLLBACK');
        return fail(res, 409, 'Credit details are already recorded. The Shisha HOD can record full or partial payments from the Payments tab.');
      }
    }
    const requestStatus = method === 'CREDIT' ? 'OUTSTANDING' : 'PENDING';
    const requestResult = await client.query(
      `INSERT INTO public.shisha_payment_requests
         (order_id, requested_by, payment_method, amount, status, notes, client_name, client_phone, expected_payment_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        order.id,
        req.actor.id,
        method,
        amount,
        requestStatus,
        req.body.notes || null,
        method === 'CREDIT' ? clientName : null,
        method === 'CREDIT' ? clientPhone : null,
        method === 'CREDIT' ? expectedPaymentDate : null,
      ]
    );
    const nextPaymentStatus = method === 'CREDIT'
      ? 'OUTSTANDING'
      : Number(order.amount_paid) > 0 ? 'PARTIALLY_PAID' : 'PENDING';
    await client.query('UPDATE public.shisha_orders SET payment_status=$1, updated_at=NOW() WHERE id=$2', [nextPaymentStatus, order.id]);
    await recordHistory(client, order, method === 'CREDIT' ? 'OUTSTANDING' : 'PAYMENT_PENDING', 'PAYMENT_REQUESTED', req.actor, method);
    await client.query('COMMIT');
    const notificationBody = method === 'CREDIT'
      ? `${req.actor.name} recorded UGX ${amount.toLocaleString()} credit for ${clientName} on ${orderReference(order.id)}.`
      : `${req.actor.name} requested ${method} payment of UGX ${amount.toLocaleString()} for ${orderReference(order.id)}.`;
    const notification = await notificationService.sendToRoles(['SHISHA_HOD'], {
      type: 'SHISHA_PAYMENT_REQUEST',
      title: 'Shisha Payment Confirmation',
      body: notificationBody,
      department: 'Shisha',
      referenceId: requestResult.rows[0].id,
      referenceType: 'SHISHA_PAYMENT_REQUEST',
      link: '/shisha?tab=payments',
    }, 'shisha');
    if (!notification.sent) {
      console.warn('Shisha payment request push was not delivered:', {
        requestId: requestResult.rows[0].id,
        orderId: order.id,
        method,
        status: requestStatus,
        sent: notification.sent || 0,
        failed: notification.failed || 0,
        noRecipients: notification.noRecipients === true,
        error: notification.error === true,
      });
    }
    return res.status(201).json({
      success: true,
      status: requestStatus,
      outstanding_amount: amount,
      notification_sent: notification.sent > 0,
      notification_no_recipients: notification.noRecipients === true,
    });
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
    const creditRequest = await client.query(
      `SELECT id FROM public.shisha_payment_requests
       WHERE order_id=$1 AND payment_method='CREDIT' AND status='OUTSTANDING'
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [order.id]
    );
    const paymentResult = await recordPayment(client, order, req.body, req.actor, creditRequest.rows[0]?.id || null);
    if (creditRequest.rows[0] && paymentResult.outstanding_amount <= 0) {
      await client.query(
        `UPDATE public.shisha_payment_requests
         SET status='CONFIRMED', confirmed_by=$1, confirmed_by_name=$2, confirmed_by_role=$3, confirmed_at=NOW()
         WHERE id=$4`,
        [req.actor.id, req.actor.name, req.actor.role, creditRequest.rows[0].id]
      );
    }
    await client.query('COMMIT');
    return res.status(201).json(paymentResult);
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

router.get('/production/history', requireRoles('SHISHA_CHEF', 'SHISHA_HOD', ...SHISHA_REPORT_ROLES), async (req, res) => {
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return fail(res, 400, 'Provide valid from and to dates.');
  }
  const canViewTeam = req.actor.role === 'SHISHA_HOD' || SHISHA_REPORT_ROLES.includes(req.actor.role);
  const requestedStaffId = Number(req.query.staff_id);
  const staffId = !canViewTeam
    ? req.actor.id
    : Number.isInteger(requestedStaffId) && requestedStaffId > 0
      ? requestedStaffId
      : null;
  try {
    await syncShishaProductionWork(pool);
    const result = await pool.query(
      `SELECT work.id AS work_id, work.order_id, work.order_item_id, work.item_name,
              work.quantity, work.completed_quantity, work.status, work.staff_id,
              COALESCE(staff.name, work.staff_name) AS staff_name,
              work.claimed_at, work.started_at, work.completed_at,
             COALESCE(order_row.table_id, work.table_id) AS table_id,
             COALESCE(order_row.notes, work.order_notes) AS notes,
             COALESCE(item.unit_price, work.unit_price) AS unit_price,
             COALESCE(order_row.created_at, work.order_created_at, work.created_at) AS order_created_at
      FROM public.shisha_production_work work
      LEFT JOIN public.shisha_order_items item ON item.id=work.order_item_id
      LEFT JOIN public.shisha_orders order_row ON order_row.id=work.order_id
       LEFT JOIN public.shisha_staff staff ON staff.id=work.staff_id
       WHERE (work.claimed_at AT TIME ZONE 'Africa/Kampala') >= $1::date
         AND (work.claimed_at AT TIME ZONE 'Africa/Kampala') < ($2::date + INTERVAL '1 day')
         AND ($3::integer IS NULL OR work.staff_id=$3)
       ORDER BY work.claimed_at DESC, work.order_id DESC`,
      [from, to, staffId]
    );
    const records = result.rows;
    return res.json({
      staff_id: staffId,
      records,
      totals: {
        items_claimed: records.length,
        items_started: records.filter(item => item.started_at).length,
        items_completed: records.filter(item => item.status === 'Completed' && Number(item.completed_quantity) > 0).length,
        orders_handled: new Set(records.map(item => item.order_id)).size,
        orders_completed: new Set(records.filter(item => item.status === 'Completed' && Number(item.completed_quantity) > 0).map(item => item.order_id)).size,
        quantity_claimed: records.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        quantity_completed: records.reduce((sum, item) =>
          sum + (['Cancelled', 'Voided'].includes(item.status) ? 0 : Number(item.completed_quantity || 0)), 0),
      },
    });
  } catch (error) {
    console.error('Shisha production history error:', error.message);
    return fail(res, 500, 'Could not load Shisha production history.');
  }
});

router.get('/reports', async (req, res) => {
  const canView = (actorIsShisha(req) && req.actor.role === 'SHISHA_HOD') ||
    (req.actor.scope === 'restaurant' && SHISHA_REPORT_ROLES.includes(req.actor.role));
  if (!canView) return fail(res, 403, 'Shisha financial reports are restricted to the HOD and management.');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
  const from = req.query.from || today;
  const to = req.query.to || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return fail(res, 400, 'Provide a valid date range.');
  }
  try {
    const [summary, waiters, methods, mixers, voided, voidedItems, creditPayments] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total_orders, COALESCE(SUM(total_amount),0) AS total_sales,
          (SELECT COALESCE(SUM(p.amount),0) FROM public.shisha_payments p
           WHERE p.confirmed_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
             AND p.confirmed_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
          ) AS amount_collected,
          (SELECT COALESCE(SUM(p.amount),0)
           FROM public.shisha_payments p
           JOIN public.shisha_payment_requests r ON r.id=p.payment_request_id
           WHERE r.payment_method='CREDIT'
             AND p.confirmed_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
             AND p.confirmed_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
          ) AS credit_payments_received,
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
          COALESCE(SUM(o.total_amount),0) AS total_sales,
          (SELECT COALESCE(SUM(p.amount),0)
           FROM public.shisha_orders paid_order
           JOIN public.shisha_payments p ON p.order_id=paid_order.id
           WHERE paid_order.shisha_waiter_id=w.id
             AND p.confirmed_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
             AND p.confirmed_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
          ) AS amount_collected,
          COALESCE(SUM(o.outstanding_amount),0) AS outstanding,
          COALESCE(SUM((SELECT SUM(v.amount) FROM public.shisha_void_requests v
            WHERE v.order_id=o.id AND v.status='APPROVED')),0) AS voided_total
         FROM public.shisha_staff w
         LEFT JOIN public.shisha_orders o ON o.shisha_waiter_id=w.id
           AND o.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND o.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
         WHERE w.role='SHISHA_WAITER'
           AND (o.id IS NOT NULL OR EXISTS (
             SELECT 1 FROM public.shisha_orders paid_order
             JOIN public.shisha_payments p ON p.order_id=paid_order.id
             WHERE paid_order.shisha_waiter_id=w.id
               AND p.confirmed_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
               AND p.confirmed_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
           ))
         GROUP BY w.id, w.name ORDER BY total_sales DESC`, [from, to]
      ),
      pool.query(
        `SELECT payment_method, COALESCE(SUM(amount),0) AS amount, COUNT(*)::int AS payment_count
         FROM public.shisha_payments
         WHERE confirmed_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND confirmed_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
         GROUP BY payment_method ORDER BY amount DESC`, [from, to]
      ),
      pool.query(
        `SELECT c.id AS mixer_id, c.name AS mixer_name, COUNT(o.id)::int AS total_orders,
          COALESCE(SUM(o.total_amount),0) AS total_sales,
          COALESCE(SUM((SELECT SUM(v.amount) FROM public.shisha_void_requests v
            WHERE v.order_id=o.id AND v.status='APPROVED')),0) AS voided_total
         FROM public.shisha_orders o
         JOIN public.shisha_staff c ON c.id=o.assigned_chef_id
         WHERE o.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND o.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
         GROUP BY c.id, c.name ORDER BY total_sales DESC`, [from, to]
      ),
      pool.query(
        `SELECT COALESCE(SUM(v.amount),0) AS voided_total,
          COALESCE(SUM(v.quantity),0)::int AS voided_quantity
         FROM public.shisha_void_requests v
         JOIN public.shisha_orders o ON o.id=v.order_id
         WHERE v.status='APPROVED'
           AND o.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND o.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')`,
        [from, to]
      ),
      pool.query(
        `SELECT i.package_name AS item_name, COALESCE(SUM(v.quantity),0)::int AS quantity,
          COALESCE(SUM(v.amount),0) AS amount
         FROM public.shisha_void_requests v
         JOIN public.shisha_order_items i ON i.id=v.order_item_id
         JOIN public.shisha_orders o ON o.id=v.order_id
         WHERE v.status='APPROVED'
           AND o.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND o.created_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
         GROUP BY i.package_name ORDER BY amount DESC, item_name`,
        [from, to]
      ),
      pool.query(
        `SELECT p.id AS payment_id, p.order_id, o.table_id, w.name AS waiter_name,
          r.client_name, r.client_phone, r.expected_payment_date,
          p.payment_method, p.amount, p.transaction_id, p.notes,
          p.confirmed_by_name, p.confirmed_at
         FROM public.shisha_payments p
         JOIN public.shisha_payment_requests r ON r.id=p.payment_request_id AND r.payment_method='CREDIT'
         JOIN public.shisha_orders o ON o.id=p.order_id
         JOIN public.shisha_staff w ON w.id=o.shisha_waiter_id
         WHERE p.confirmed_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Kampala')
           AND p.confirmed_at < (($2::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Africa/Kampala')
         ORDER BY p.confirmed_at DESC, p.id DESC`,
        [from, to]
      ),
    ]);
    const voidedTotal = Number(voided.rows[0].voided_total || 0);
    const reportSummary = {
      ...summary.rows[0],
      net_sales: Number(summary.rows[0].total_sales || 0),
      gross_sales: Number(summary.rows[0].total_sales || 0) + voidedTotal,
      voided_total: voidedTotal,
      voided_quantity: Number(voided.rows[0].voided_quantity || 0),
    };
    const addGrossSales = row => ({
      ...row,
      net_sales: Number(row.total_sales || 0),
      gross_sales: Number(row.total_sales || 0) + Number(row.voided_total || 0),
    });
    return res.json({
      from,
      to,
      summary: reportSummary,
      by_waiter: waiters.rows.map(addGrossSales),
      by_payment_method: methods.rows,
      credit_payments: creditPayments.rows.map(row => ({ ...row, reference: orderReference(row.order_id) })),
      by_mixer: mixers.rows.map(addGrossSales),
      by_voided_item: voidedItems.rows,
    });
  } catch (error) {
    console.error('Shisha financial report error:', error.message);
    return fail(res, 500, 'Could not load Shisha reports.');
  }
});

export default router;