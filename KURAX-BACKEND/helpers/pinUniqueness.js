import { createHmac } from 'node:crypto';
import { verifyStaffPin } from './staffPin.js';

function pinConflict() {
  return Object.assign(
    new Error('That PIN is already assigned to another account. Choose a different PIN.'),
    { statusCode: 409, code: 'PIN_ALREADY_IN_USE' }
  );
}

export async function assertPinIsAvailable(queryable, pin, {
  excludeStaffId = null,
  excludeShishaStaffId = null,
  lockSecret = process.env.PIN_UNIQUENESS_SECRET || process.env.JWT_SECRET,
} = {}) {
  const candidate = String(pin || '');
  if (!/^\d{4,8}$/.test(candidate)) {
    throw Object.assign(new Error('PIN must contain 4-8 digits.'), { statusCode: 400 });
  }
  if (!lockSecret) {
    throw Object.assign(new Error('Configure PIN_UNIQUENESS_SECRET or JWT_SECRET before assigning PINs.'), {
      statusCode: 503,
      code: 'PIN_UNIQUENESS_CONFIG_MISSING',
    });
  }

  const lockKey = createHmac('sha256', lockSecret).update(candidate).digest('hex');
  await queryable.query(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [`account-pin:${lockKey}`]
  );

  const [staffResult, shishaResult] = await Promise.all([
    queryable.query(
      `SELECT id, pin, pin_salt, pin_hash
       FROM public.staff
       WHERE ($1::integer IS NULL OR id <> $1)`,
      [excludeStaffId == null ? null : Number(excludeStaffId)]
    ),
    queryable.query(
      `SELECT id, pin_salt, pin_hash
       FROM public.shisha_staff
       WHERE ($1::integer IS NULL OR id <> $1)`,
      [excludeShishaStaffId == null ? null : Number(excludeShishaStaffId)]
    ),
  ]);

  for (const staff of staffResult.rows) {
    if (staff.pin != null && String(staff.pin) === candidate) throw pinConflict();
    if (await verifyStaffPin(candidate, staff.pin_salt, staff.pin_hash)) throw pinConflict();
  }
  for (const staff of shishaResult.rows) {
    if (await verifyStaffPin(candidate, staff.pin_salt, staff.pin_hash)) throw pinConflict();
  }
}
