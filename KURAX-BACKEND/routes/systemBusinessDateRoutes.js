import express from 'express';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { getSystemBusinessContext, setSystemBusinessDate } from '../helpers/systemBusinessDate.js';

const router = express.Router();

async function authenticateDateManager(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'Sign in to change the business date.' });

  let session;
  try {
    session = readSessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }

  if (session.scope !== 'restaurant' || !session.id) {
    return res.status(401).json({ error: 'A valid staff session is required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, role, is_active FROM public.staff WHERE id = $1',
      [session.id]
    );
    const actor = result.rows[0];
    const actorRole = String(actor?.role || '').trim().toUpperCase();
    const sessionRole = String(session.role || '').trim().toUpperCase();
    if (!actor || actor.is_active === false || actorRole !== sessionRole) {
      return res.status(401).json({ error: 'Staff account is inactive or has changed.' });
    }
    if (!['ACCOUNTANT', 'DIRECTOR'].includes(actorRole)) {
      return res.status(403).json({ error: 'Only an accountant or director can change the system business date.' });
    }
    req.dateManager = actor;
    return next();
  } catch (error) {
    console.error('Business-date authorization failed:', error.message);
    return res.status(500).json({ error: 'Could not verify access to system configuration.' });
  }
}

router.get('/', async (req, res) => {
  try {
    return res.json(await getSystemBusinessContext());
  } catch (error) {
    console.error('System business-date read failed:', error.message);
    return res.status(500).json({ error: 'Could not load the system business date.' });
  }
});

router.put('/', authenticateDateManager, async (req, res) => {
  const date = req.body?.business_date ?? req.body?.businessDate;
  if (typeof date !== 'string') {
    return res.status(400).json({ error: 'A business_date value is required.' });
  }
  try {
    const context = await setSystemBusinessDate(date, req.dateManager.name);
    return res.json(context);
  } catch (error) {
    console.error('System business-date update failed:', error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Could not update the system business date.' });
  }
});

router.delete('/', authenticateDateManager, async (req, res) => {
  try {
    return res.json(await setSystemBusinessDate(null, req.dateManager.name));
  } catch (error) {
    console.error('System business-date reset failed:', error.message);
    return res.status(500).json({ error: 'Could not return the system to the live business date.' });
  }
});

export default router;
