import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNotificationPayload,
  normalizeDeviceRegistration,
} from '../helpers/notificationService.js';

test('buildNotificationPayload keeps user-specific notification metadata', () => {
  const payload = buildNotificationPayload({
    type: 'ORDER_READY',
    title: 'Order Ready',
    body: 'Order #1042 is ready',
    userId: 12,
    userScope: 'restaurant',
    department: 'kitchen',
    referenceId: '1042',
    referenceType: 'ORDER',
    link: '/kitchen',
  });

  assert.equal(payload.type, 'ORDER_READY');
  assert.equal(payload.recipientUserId, 12);
  assert.equal(payload.department, 'kitchen');
  assert.equal(payload.link, '/kitchen');
  assert.ok(payload.createdAt);
});

test('normalizeDeviceRegistration rejects invalid user assignment and preserves the current user scope', () => {
  const normalized = normalizeDeviceRegistration({
    installationId: 'abc123',
    fcmToken: 'token-xyz',
    platform: 'web',
    browser: 'Chrome',
    isPwa: false,
    permissionStatus: 'granted',
    notificationsEnabled: true,
    userScope: 'restaurant',
    userId: 7,
  }, { scope: 'restaurant', id: 7 });

  assert.equal(normalized.installation_id, 'abc123');
  assert.equal(normalized.user_id, 7);
  assert.equal(normalized.user_scope, 'restaurant');
  assert.equal(normalized.permission_status, 'granted');
  assert.equal(normalized.notifications_enabled, true);
});

test('normalizeDeviceRegistration accepts already-normalized snake_case values', () => {
  const normalized = normalizeDeviceRegistration({
    installation_id: 'abc123',
    fcm_token: 'token-xyz',
    platform: 'web',
    browser: 'Chrome',
    is_pwa: false,
    permission_status: 'granted',
    notifications_enabled: true,
    user_scope: 'restaurant',
    user_id: 7,
  }, { scope: 'restaurant', id: 7 });

  assert.equal(normalized.installation_id, 'abc123');
  assert.equal(normalized.fcm_token, 'token-xyz');
  assert.equal(normalized.user_id, 7);
  assert.equal(normalized.permission_status, 'granted');
  assert.equal(normalized.notifications_enabled, true);
});
