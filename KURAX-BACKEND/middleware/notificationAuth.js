import pool from '../db.js';
import { readSessionToken } from './sessionTokens.js';

export async function resolveNotificationUser(req) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return null;

  try {
    const session = readSessionToken(token);
    const userId = Number(session.id);
    if (!Number.isInteger(userId) || userId < 1) return null;

    let result;
    if (session.scope === 'restaurant') {
      result = await pool.query(
        'SELECT id, name, role, is_active FROM public.staff WHERE id = $1',
        [userId]
      );
    } else if (session.scope === 'shisha') {
      result = await pool.query(
        'SELECT id, name, role, is_active FROM public.shisha_staff WHERE id = $1',
        [userId]
      );
    } else {
      return null;
    }

    const staff = result.rows[0];
    if (!staff || staff.is_active === false || staff.role !== session.role) return null;

    return {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      scope: session.scope,
    };
  } catch {
    return null;
  }
}

export default async function notificationAuth(req, res, next) {
  const staff = await resolveNotificationUser(req);
  if (!staff) return res.status(401).json({ error: 'Staff sign-in is required.' });
  req.notificationUser = staff;
  return next();
}