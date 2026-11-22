import nodemailer from 'nodemailer';
import pool from '../db.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function getSmtpSettings(env = process.env) {
  const host = String(env.SMTP_HOST || '').trim();
  const port = Number(env.SMTP_PORT || 587);
  const user = String(env.SMTP_USER || '').trim();
  const pass = String(env.SMTP_PASS || '');
  const fromName = String(env.SMTP_FROM || 'Kurax Food Lounge & Bistro')
    .replace(/[\r\n]/g, '')
    .trim();

  if (!host || !user || !pass || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(
      new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.'),
      { code: 'SMTP_CONFIG_MISSING' }
    );
  }

  const from = fromName.includes('<')
    ? fromName
    : `"${fromName.replace(/"/g, '\\"')}" <${user}>`;
  return { host, port, secure: port === 465, auth: { user, pass }, from };
}

export async function ensureSmtpSettingsTable(env = process.env) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.smtp_settings (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL,
      smtp_user TEXT NOT NULL,
      smtp_pass TEXT NOT NULL,
      smtp_from TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO public.smtp_settings
      (id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from)
    VALUES (1, $1, $2, $3, $4, $5)
    ON CONFLICT (id) DO NOTHING
  `, [
    String(env.SMTP_HOST || '').trim(),
    Number(env.SMTP_PORT || 587),
    String(env.SMTP_USER || '').trim(),
    String(env.SMTP_PASS || ''),
    String(env.SMTP_FROM || 'Kurax Food Lounge & Bistro').replace(/[\r\n]/g, '').trim(),
  ]);
}

export async function getDatabaseSmtpSettings(env = process.env) {
  const result = await pool.query(
    `SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from
     FROM public.smtp_settings
     WHERE id = 1`
  );
  if (!result.rows[0]) return getSmtpSettings(env);
  return getSmtpSettings({
    SMTP_HOST: result.rows[0].smtp_host,
    SMTP_PORT: result.rows[0].smtp_port,
    SMTP_USER: result.rows[0].smtp_user,
    SMTP_PASS: result.rows[0].smtp_pass,
    SMTP_FROM: result.rows[0].smtp_from,
  });
}

export async function sendAccountPinEmail({
  name,
  email,
  role,
  pin,
  department = 'Kurax staff',
}, { env = process.env, transporter, smtpSettings } = {}) {
  const settings = smtpSettings
    || (env === process.env ? await getDatabaseSmtpSettings(env) : getSmtpSettings(env));
  const mailTransport = transporter || nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.auth,
  });
  const isShisha = department.toLowerCase() === 'shisha';
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeRole = escapeHtml(String(role).replaceAll('_', ' '));
  const safePin = escapeHtml(pin);
  const loginUrl = `${String(env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')}${isShisha ? '/shisha' : '/staff/login'}`;
  const safeLoginUrl = escapeHtml(loginUrl);

  try {
    await mailTransport.sendMail({
      from: settings.from,
      to: email,
      subject: isShisha ? 'Your Kurax Shisha account PIN' : 'Your Kurax staff account PIN',
      text: `Hello ${name}, your ${department} account is ready. Email: ${email}. Role: ${String(role).replaceAll('_', ' ')}. PIN: ${pin}. Sign in at ${loginUrl}. Keep your PIN private.`,
      html: `<p>Hello ${safeName},</p><p>Your ${escapeHtml(department)} account is ready.</p><p>Email: <strong>${safeEmail}</strong><br>Role: <strong>${safeRole}</strong><br>PIN: <strong>${safePin}</strong></p><p>Sign in at <a href="${safeLoginUrl}">${escapeHtml(department)} login</a>.</p><p>Keep your PIN private.</p>`,
    });
  } catch (cause) {
    const error = new Error('The account PIN email could not be delivered.');
    error.code = 'SMTP_SEND_FAILED';
    error.cause = cause;
    throw error;
  }
}
