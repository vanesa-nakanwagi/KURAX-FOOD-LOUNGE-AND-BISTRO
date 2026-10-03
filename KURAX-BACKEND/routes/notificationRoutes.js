import express from 'express';
import pool from '../db.js';
import notificationAuth from '../middleware/notificationAuth.js';

const router = express.Router();
const allowedPlatforms = new Set(['web', 'android', 'ios']);

router.use(notificationAuth);

router.get('/devices', async (req, res) => {
  try {
    const { id, scope } = req.notificationUser;
    const result = await pool.query(
      `SELECT id, firebase_installation_id, platform, user_agent, is_active, last_seen_at, created_at
       FROM public.notification_devices
       WHERE user_scope = $1 AND user_id = $2
       ORDER BY last_seen_at DESC`,
      [scope, id]
    );
    res.json({ devices: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Could not load registered devices.' });
  }
});

router.post('/devices', async (req, res) => {
  const installationId = String(req.body.installationId || '').trim();
  const fcmToken = String(req.body.fcmToken || '').trim();
  const platform = String(req.body.platform || '').trim().toLowerCase();
  const userAgent = String(req.body.userAgent || '').slice(0, 1000);
  if (!installationId || installationId.length > 255 || !fcmToken || fcmToken.length > 4096 || !allowedPlatforms.has(platform)) {
    return res.status(400).json({ error: 'A valid installation ID, FCM token, and platform are required.' });
  }

  const { id, scope } = req.notificationUser;
  try {
    const result = await pool.query(
      `INSERT INTO public.notification_devices
         (user_scope, user_id, firebase_installation_id, fcm_token, platform, user_agent, is_active, last_seen_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
       ON CONFLICT (firebase_installation_id) DO UPDATE SET
         user_scope = EXCLUDED.user_scope,
         user_id = EXCLUDED.user_id,
         fcm_token = EXCLUDED.fcm_token,
         platform = EXCLUDED.platform,
         user_agent = EXCLUDED.user_agent,
         is_active = true,
         last_seen_at = NOW(),
         updated_at = NOW()
       WHERE notification_devices.user_scope = EXCLUDED.user_scope
           AND (notification_devices.user_id = EXCLUDED.user_id OR notification_devices.is_active = false)
       RETURNING id, platform, is_active, last_seen_at`,
      [scope, id, installationId, fcmToken, platform, userAgent || null]
    );
    if (!result.rows.length) {
      return res.status(409).json({ error: 'This installation is registered to a different staff account.' });
    }
    return res.status(201).json({ device: result.rows[0] });
  } catch (error) {
    console.error('Staff notification registration failed:', error.message);
    return res.status(500).json({ error: 'Could not register this device.' });
  }
});

router.delete('/devices/:installationId', async (req, res) => {
  try {
    const { id, scope } = req.notificationUser;
    const result = await pool.query(
      `UPDATE public.notification_devices
       SET is_active = false, updated_at = NOW()
       WHERE user_scope = $1 AND user_id = $2 AND firebase_installation_id = $3
       RETURNING id`,
      [scope, id, req.params.installationId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Registered device not found.' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Could not unregister this device.' });
  }
});

export default router;