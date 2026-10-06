import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import pool from '../db.js';

let messaging;

export function normalizeDeviceRegistration(payload = {}, currentUser = null) {
  const installationId = String(
    payload.installationId ?? payload.installation_id ?? payload.installationID ?? ''
  ).trim();
  const fcmToken = String(
    payload.fcmToken ?? payload.fcm_token ?? payload.token ?? ''
  ).trim();
  const platform = String(payload.platform || 'web').trim().toLowerCase();
  const browser = String(payload.browser || payload.userAgent || 'unknown').slice(0, 80);
  const permissionStatus = String(payload.permissionStatus || payload.permission_status || 'default').trim().toLowerCase();
  const notificationsEnabled = payload.notificationsEnabled !== false && payload.notifications_enabled !== false;
  const currentScope = String(currentUser?.scope || payload.userScope || payload.user_scope || 'restaurant').trim().toLowerCase();
  const currentUserId = Number(currentUser?.id ?? payload.userId ?? payload.user_id ?? 0);

  if (!installationId || !fcmToken) {
    throw new Error('A valid installation ID and FCM token are required.');
  }
  if (!['web', 'android', 'ios'].includes(platform)) {
    throw new Error('Unsupported notification platform.');
  }
  if (!Number.isInteger(currentUserId) || currentUserId < 1) {
    throw new Error('Authenticated user information is required to register notifications.');
  }
  if (!['default', 'granted', 'denied'].includes(permissionStatus)) {
    throw new Error('Notification permission status is invalid.');
  }

  return {
    installation_id: installationId,
    fcm_token: fcmToken,
    platform,
    browser,
    is_pwa: Boolean(payload.isPwa ?? payload.is_pwa ?? false),
    permission_status: permissionStatus,
    notifications_enabled: Boolean(notificationsEnabled),
    user_scope: currentScope,
    user_id: currentUserId,
    user_agent: String(payload.userAgent || '').slice(0, 1000),
    active: true,
  };
}

export function buildNotificationPayload({
  type,
  title,
  body,
  userId,
  userScope,
  department,
  referenceId,
  referenceType,
  link,
  createdAt = new Date().toISOString(),
}) {
  return {
    type: String(type || 'STAFF_ALERT').slice(0, 80),
    title: String(title || 'Kurax staff alert').slice(0, 120),
    body: String(body || 'A staff update needs your attention.').slice(0, 240),
    recipientUserId: Number(userId || 0),
    recipientScope: String(userScope || 'restaurant').slice(0, 40),
    department: String(department || '').slice(0, 80),
    referenceId: String(referenceId || ''),
    referenceType: String(referenceType || '').slice(0, 80),
    link: String(link || '/'),
    createdAt: String(createdAt),
  };
}

function getAdminMessaging() {
  if (messaging) return messaging;
  if (!getApps().length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credential = serviceAccountJson
      ? cert(JSON.parse(serviceAccountJson))
      : applicationDefault();
    initializeApp({
      credential,
      ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {}),
    });
  }
  messaging = getMessaging();
  return messaging;
}

function normalizeEvent(event, recipient, userScope) {
  const payload = buildNotificationPayload({
    type: event.type,
    title: event.title,
    body: event.body,
    userId: recipient,
    userScope,
    department: event.department,
    referenceId: event.referenceId,
    referenceType: event.referenceType,
    link: event.link,
    createdAt: event.createdAt,
  });
  return {
    type: payload.type,
    title: payload.title,
    body: payload.body,
    recipient: `${userScope}:${recipient}`,
    recipientUserId: String(payload.recipientUserId),
    recipientScope: payload.recipientScope,
    department: payload.department,
    referenceId: payload.referenceId,
    referenceType: payload.referenceType,
    link: payload.link,
    createdAt: payload.createdAt,
  };
}

async function sendTokens(tokens, data) {
  if (!tokens.length) return { sent: 0 };
  let client;
  try {
    client = getAdminMessaging();
  } catch (error) {
    console.warn('FCM is not configured; staff notification was not sent:', error.message);
    return { sent: 0, unavailable: true };
  }

  let sent = 0;
  for (let start = 0; start < tokens.length; start += 500) {
    const batch = tokens.slice(start, start + 500);
    try {
      const result = await client.sendEachForMulticast({ tokens: batch, data });
      sent += result.successCount;
      const invalidTokens = result.responses.flatMap((response, index) => (
        response.success ? [] : response.error?.code === 'messaging/registration-token-not-registered'
          || response.error?.code === 'messaging/invalid-registration-token'
          ? [batch[index]]
          : []
      ));
      if (invalidTokens.length) {
        await pool.query(
          `UPDATE public.notification_devices
           SET active = false, is_active = false, updated_at = NOW(), last_seen_at = NOW()
           WHERE fcm_token = ANY($1::text[])`,
          [invalidTokens]
        );
      }
    } catch (error) {
      console.error('FCM notification batch failed:', error.message);
    }
  }
  return { sent };
}

const notificationService = {
  async registerDeviceForUser(currentUser, payload) {
    const normalized = normalizeDeviceRegistration(payload, currentUser);

    const result = await pool.query(
      `INSERT INTO public.notification_devices (
         user_scope, user_id, installation_id, firebase_installation_id, fcm_token, platform, browser,
         user_agent, is_pwa, permission_status, notifications_enabled, active, is_active, last_seen_at, updated_at, created_at
       ) VALUES (
         $1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, true, true, NOW(), NOW(), NOW()
       )
      ON CONFLICT (installation_id) WHERE installation_id IS NOT NULL DO UPDATE SET
         user_scope = EXCLUDED.user_scope,
         user_id = EXCLUDED.user_id,
         firebase_installation_id = EXCLUDED.installation_id,
         fcm_token = EXCLUDED.fcm_token,
         platform = EXCLUDED.platform,
         browser = EXCLUDED.browser,
         user_agent = EXCLUDED.user_agent,
         is_pwa = EXCLUDED.is_pwa,
         permission_status = EXCLUDED.permission_status,
         notifications_enabled = EXCLUDED.notifications_enabled,
         active = true,
         is_active = true,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING id, installation_id, user_scope, user_id, platform, browser, is_pwa, permission_status, notifications_enabled, active, is_active, last_seen_at` ,
      [
        normalized.user_scope,
        normalized.user_id,
        normalized.installation_id,
        normalized.fcm_token,
        normalized.platform,
        normalized.browser,
        normalized.user_agent,
        normalized.is_pwa,
        normalized.permission_status,
        normalized.notifications_enabled,
      ]
    );

    return result.rows[0];
  },

  async unregisterDeviceForUser(currentUser, installationId) {
    const userScope = currentUser?.scope || 'restaurant';
    const userId = Number(currentUser?.id);
    if (!installationId || !Number.isInteger(userId) || userId < 1) return { deleted: 0 };

    const result = await pool.query(
      `UPDATE public.notification_devices
       SET active = false, is_active = false, notifications_enabled = false, updated_at = NOW(), last_seen_at = NOW()
       WHERE user_scope = $1 AND user_id = $2 AND installation_id = $3
       RETURNING id`,
      [userScope, userId, String(installationId)]
    );
    return { deleted: result.rowCount || 0 };
  },

  async getUserPreferences(currentUser) {
    const rows = await pool.query(
      `SELECT installation_id, browser, platform, is_pwa, permission_status, notifications_enabled, active, is_active, last_seen_at
       FROM public.notification_devices
       WHERE user_scope = $1 AND user_id = $2
       ORDER BY last_seen_at DESC`,
      [currentUser.scope, currentUser.id]
    );
    return rows.rows;
  },

  async setUserPreferences(currentUser, preferences = {}) {
    const notificationsEnabled = preferences.notificationsEnabled ?? preferences.notifications_enabled ?? true;
    const permissionStatus = String(preferences.permissionStatus || preferences.permission_status || 'default').toLowerCase();

    const rows = await pool.query(
      `UPDATE public.notification_devices
       SET notifications_enabled = $3,
           permission_status = $4,
           active = CASE WHEN $3 = true THEN true ELSE active END,
           updated_at = NOW()
       WHERE user_scope = $1 AND user_id = $2
       RETURNING id, installation_id, notifications_enabled, permission_status` ,
      [currentUser.scope, currentUser.id, Boolean(notificationsEnabled), permissionStatus]
    );

    return rows.rows;
  },

  async sendToUser(userId, event, userScope = 'restaurant') {
    try {
      const result = await pool.query(
        `SELECT fcm_token FROM public.notification_devices
         WHERE user_scope = $1 AND user_id = $2 AND active = true AND is_active = true AND notifications_enabled = true`,
        [userScope, Number(userId)]
      );
      return sendTokens(
        result.rows.map((row) => row.fcm_token),
        normalizeEvent(event, userId, userScope)
      );
    } catch (error) {
      console.error('Could not load staff notification devices:', error.message);
      return { sent: 0, error: true };
    }
  },

  async sendToUsers(userIds, event, userScope = 'restaurant') {
    const ids = [...new Set((userIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
    if (!ids.length) return { sent: 0 };

    try {
      const result = await pool.query(
        `SELECT user_id, fcm_token FROM public.notification_devices
         WHERE user_scope = $1 AND user_id = ANY($2::int[]) AND active = true AND is_active = true AND notifications_enabled = true`,
        [userScope, ids]
      );

      const byUser = new Map();
      for (const row of result.rows) {
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
        byUser.get(row.user_id).push(row.fcm_token);
      }

      const payloads = [...byUser.entries()].map(([userId, tokens]) => sendTokens(tokens, normalizeEvent(event, userId, userScope)));
      const results = await Promise.all(payloads);
      return { sent: results.reduce((total, result) => total + (result.sent || 0), 0) };
    } catch (error) {
      console.error('Could not load batch notification devices:', error.message);
      return { sent: 0, error: true };
    }
  },

  async sendToRoles(roles, event, userScope = 'restaurant') {
    const table = userScope === 'shisha' ? 'public.shisha_staff' : 'public.staff';
    try {
      const result = await pool.query(
        `SELECT DISTINCT d.user_id, d.user_scope, d.fcm_token
         FROM public.notification_devices d
         JOIN ${table} s ON s.id = d.user_id
         WHERE d.user_scope = $1 AND d.active = true AND d.is_active = true AND d.notifications_enabled = true AND s.is_active = true
           AND UPPER(s.role) = ANY($2::text[])`,
        [userScope, roles.map((role) => String(role).toUpperCase())]
      );
      const sends = new Map();
      for (const row of result.rows) {
        const data = normalizeEvent(event, row.user_id, row.user_scope);
        const key = JSON.stringify({ type: data.type, title: data.title, body: data.body, recipient: data.recipient, department: data.department, referenceId: data.referenceId, referenceType: data.referenceType, link: data.link, createdAt: data.createdAt });
        if (!sends.has(key)) sends.set(key, { data, tokens: [] });
        sends.get(key).tokens.push(row.fcm_token);
      }
      const results = await Promise.all([...sends.values()].map(({ data, tokens }) => sendTokens(tokens, data)));
      return { sent: results.reduce((total, result) => total + result.sent, 0) };
    } catch (error) {
      console.error('Could not resolve staff notification recipients:', error.message);
      return { sent: 0, error: true };
    }
  },
};

export default notificationService;