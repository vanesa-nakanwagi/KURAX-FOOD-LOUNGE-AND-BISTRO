import express from 'express';
import pool from '../db.js';
import notificationAuth from '../middleware/notificationAuth.js';
import notificationService, { normalizeDeviceRegistration } from '../helpers/notificationService.js';

const router = express.Router();

router.use(notificationAuth);

router.get('/devices', async (req, res) => {
  try {
    const { id, scope } = req.notificationUser;
    const rows = await pool.query(
      `SELECT id, installation_id, firebase_installation_id, platform, browser, is_pwa, permission_status,
              notifications_enabled, active, is_active, user_agent, last_seen_at, created_at
       FROM public.notification_devices
       WHERE user_scope = $1 AND user_id = $2
       ORDER BY last_seen_at DESC`,
      [scope, id]
    );
    res.json({ devices: rows.rows });
  } catch (error) {
    res.status(500).json({ error: 'Could not load registered devices.' });
  }
});

router.get('/preferences', async (req, res) => {
  try {
    const rows = await notificationService.getUserPreferences(req.notificationUser);
    const notificationsEnabled = rows.some((row) => row.notifications_enabled);
    res.json({ preferences: rows, notificationsEnabled });
  } catch (error) {
    console.error('Notification preference lookup failed:', error.message);
    res.status(500).json({ error: 'Could not load notification preferences.' });
  }
});

router.put('/preferences', async (req, res) => {
  try {
    const enabled = req.body.notificationsEnabled ?? req.body.notifications_enabled ?? true;
    const permissionStatus = String(req.body.permissionStatus || req.body.permission_status || 'default').toLowerCase();
    const rows = await notificationService.setUserPreferences(req.notificationUser, {
      notificationsEnabled: enabled,
      permissionStatus,
    });
    res.json({ success: true, updated: rows.length, notificationsEnabled: enabled, permissionStatus });
  } catch (error) {
    console.error('Notification preference update failed:', error.message);
    res.status(500).json({ error: 'Could not update notification preferences.' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const normalized = normalizeDeviceRegistration(req.body, req.notificationUser);
    const device = await notificationService.registerDeviceForUser(req.notificationUser, normalized);
    if (!device) {
      return res.status(409).json({ error: 'This installation is registered to a different account.' });
    }
    return res.status(201).json({ success: true, device });
  } catch (error) {
    console.error('Staff notification registration failed:', error.message);
    return res.status(400).json({ error: error.message || 'Could not register this device.' });
  }
});

router.post('/devices', async (req, res) => {
  try {
    const normalized = normalizeDeviceRegistration(req.body, req.notificationUser);
    const device = await notificationService.registerDeviceForUser(req.notificationUser, normalized);
    if (!device) {
      return res.status(409).json({ error: 'This installation is registered to a different account.' });
    }
    return res.status(201).json({ success: true, device });
  } catch (error) {
    console.error('Staff notification registration failed:', error.message);
    return res.status(400).json({ error: error.message || 'Could not register this device.' });
  }
});

router.post('/unregister', async (req, res) => {
  try {
    const installationId = String(req.body.installationId || req.body.installation_id || '').trim();
    if (!installationId) return res.status(400).json({ error: 'An installation ID is required to unregister.' });
    const result = await notificationService.unregisterDeviceForUser(req.notificationUser, installationId);
    return result.deleted ? res.json({ success: true, deleted: result.deleted }) : res.status(404).json({ error: 'Registered device not found.' });
  } catch (error) {
    console.error('Staff notification unregister failed:', error.message);
    return res.status(500).json({ error: 'Could not unregister this device.' });
  }
});

router.delete('/devices/:installationId', async (req, res) => {
  try {
    const result = await notificationService.unregisterDeviceForUser(req.notificationUser, req.params.installationId);
    if (!result.deleted) return res.status(404).json({ error: 'Registered device not found.' });
    return res.json({ success: true, deleted: result.deleted });
  } catch (error) {
    console.error('Staff notification unregister failed:', error.message);
    return res.status(500).json({ error: 'Could not unregister this device.' });
  }
});

export default router;