import test from 'node:test';
import assert from 'node:assert/strict';

import { getSmtpSettings, sendAccountPinEmail } from '../helpers/smtp.js';

const env = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'sender@example.test',
  SMTP_PASS: 'test-password',
  SMTP_FROM: 'Kurax Food Lounge',
  FRONTEND_URL: 'https://kurax.example.test/',
};

test('SMTP settings use STARTTLS-compatible defaults and a sender display name', () => {
  assert.deepEqual(getSmtpSettings(env), {
    host: 'smtp.example.test',
    port: 587,
    secure: false,
    auth: { user: 'sender@example.test', pass: 'test-password' },
    from: '"Kurax Food Lounge" <sender@example.test>',
  });
  assert.equal(getSmtpSettings({ ...env, SMTP_PORT: '465' }).secure, true);
});

test('PIN email identifies the account type, links to its login, and safely escapes user content', async () => {
  const messages = [];
  const transporter = { sendMail: async message => messages.push(message) };

  await sendAccountPinEmail({
    name: '<Staff Member>',
    email: 'staff@example.test',
    role: 'SHISHA_WAITER',
    pin: '1234',
    department: 'Shisha',
  }, { env, transporter });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'staff@example.test');
  assert.equal(messages[0].from, '"Kurax Food Lounge" <sender@example.test>');
  assert.match(messages[0].subject, /Shisha/);
  assert.match(messages[0].text, /PIN: 1234/);
  assert.match(messages[0].html, /&lt;Staff Member&gt;/);
  assert.match(messages[0].html, /https:\/\/kurax\.example\.test\/shisha/);
});

test('PIN email fails explicitly when SMTP credentials are missing', async () => {
  await assert.rejects(
    sendAccountPinEmail({
      name: 'Staff Member',
      email: 'staff@example.test',
      role: 'WAITER',
      pin: '1234',
    }, { env: {} }),
    { code: 'SMTP_CONFIG_MISSING' }
  );
});

test('PIN email reports delivery failures instead of silently succeeding', async () => {
  await assert.rejects(
    sendAccountPinEmail({
      name: 'Staff Member',
      email: 'staff@example.test',
      role: 'WAITER',
      pin: '1234',
    }, {
      env,
      transporter: { sendMail: async () => { throw new Error('Connection refused'); } },
    }),
    { code: 'SMTP_SEND_FAILED' }
  );
});
