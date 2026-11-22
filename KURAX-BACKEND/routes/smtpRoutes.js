import express from 'express';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { getSmtpSettings } from '../helpers/smtp.js';

const router = express.Router();

async function authenticateDirector(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : null;
  if (!token) return res.status(401).json({ error: 'Sign in is required.' });

  let session;
  try {
    session = readSessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
  if (session.scope !== 'restaurant') {
    return res.status(401).json({ error: 'A valid restaurant staff session is required.' });
  }
  const result = await pool.query(
    'SELECT id, role, is_active FROM public.staff WHERE id = $1',
    [Number(session.id)]
  );
  const actor = result.rows[0];
  if (!actor || actor.is_active === false || actor.role !== 'DIRECTOR') {
    return res.status(403).json({ error: 'Only the Director may manage SMTP settings.' });
  }
  req.smtpActor = actor;
  return next();
}

router.use(authenticateDirector);

router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from
       FROM public.smtp_settings WHERE id = 1`
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'SMTP settings have not been initialized.' });
    }
    const row = result.rows[0];
    return res.json({
      smtpHost: row.smtp_host,
      smtpPort: row.smtp_port,
      smtpUser: row.smtp_user,
      smtpPassConfigured: Boolean(row.smtp_pass),
      smtpFrom: row.smtp_from,
    });
  } catch (error) {
    console.error('Load SMTP settings error:', error.message);
    return res.status(500).json({ error: 'Could not load SMTP settings.' });
  }
});

router.put('/', async (req, res) => {
  const smtpHost = String(req.body?.smtpHost || '').trim();
  const smtpPort = Number(req.body?.smtpPort);
  const smtpUser = String(req.body?.smtpUser || '').trim();
  const smtpFrom = String(req.body?.smtpFrom || '').replace(/[\r\n]/g, '').trim();
  const smtpPass = String(req.body?.smtpPass || '');

  if (!smtpHost || !smtpUser || !smtpFrom || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    return res.status(400).json({ error: 'Valid SMTP host, port, username, and sender name are required.' });
  }

  try {
    const current = await pool.query(
      'SELECT smtp_pass FROM public.smtp_settings WHERE id = 1'
    );
    const resolvedPass = smtpPass || current.rows[0]?.smtp_pass;
    if (!resolvedPass) {
      return res.status(400).json({ error: 'An SMTP password or app password is required.' });
    }
    getSmtpSettings({
      SMTP_HOST: smtpHost,
      SMTP_PORT: String(smtpPort),
      SMTP_USER: smtpUser,
      SMTP_PASS: resolvedPass,
      SMTP_FROM: smtpFrom,
    });
    await pool.query(`
      INSERT INTO public.smtp_settings
        (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, updated_at)
      VALUES (1, $1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        smtp_host = EXCLUDED.smtp_host,
        smtp_port = EXCLUDED.smtp_port,
        smtp_user = EXCLUDED.smtp_user,
        smtp_pass = EXCLUDED.smtp_pass,
        smtp_from = EXCLUDED.smtp_from,
        updated_at = NOW()
    `, [smtpHost, smtpPort, smtpUser, resolvedPass, smtpFrom]);
    return res.json({ message: 'SMTP settings saved.', smtpPassConfigured: true });
  } catch (error) {
    if (error.code === 'SMTP_CONFIG_MISSING') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update SMTP settings error:', error.message);
    return res.status(500).json({ error: 'Could not save SMTP settings.' });
  }
});

export default router;
