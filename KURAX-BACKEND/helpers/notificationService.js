import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import pool from '../db.js';

let messaging;

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
  const createdAt = event.createdAt || new Date().toISOString();
  return Object.fromEntries(Object.entries({
    type: String(event.type || 'STAFF_ALERT').slice(0, 80),
    title: String(event.title || 'Kurax staff alert').slice(0, 120),
    body: String(event.body || 'A staff update needs your attention.').slice(0, 240),
    recipient: `${userScope}:${recipient}`,
    department: String(event.department || '').slice(0, 80),
    referenceId: String(event.referenceId || ''),
    link: String(event.link || '/'),
    createdAt: String(createdAt),
  }).map(([key, value]) => [key, String(value)]));
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
           SET is_active = false, updated_at = NOW()
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
  async sendToUser(userId, event, userScope = 'restaurant') {
    try {
      const result = await pool.query(
        `SELECT fcm_token FROM public.notification_devices
         WHERE user_scope = $1 AND user_id = $2 AND is_active = true`,
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

  async sendToRoles(roles, event, userScope = 'restaurant') {
    const table = userScope === 'shisha' ? 'public.shisha_staff' : 'public.staff';
    try {
      const result = await pool.query(
        `SELECT DISTINCT d.user_id, d.user_scope, d.fcm_token
         FROM public.notification_devices d
         JOIN ${table} s ON s.id = d.user_id
         WHERE d.user_scope = $1 AND d.is_active = true AND s.is_active = true
           AND UPPER(s.role) = ANY($2::text[])`,
        [userScope, roles.map((role) => String(role).toUpperCase())]
      );
      const sends = new Map();
      for (const row of result.rows) {
        const data = normalizeEvent(event, row.user_id, row.user_scope);
        const key = JSON.stringify(data);
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