import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PIN_ENCRYPTION_KEY_PATTERN = /^[a-f\d]{64}$/i;

function parseKey(value) {
  if (!PIN_ENCRYPTION_KEY_PATTERN.test(String(value || ''))) {
    throw new Error('Shisha PIN encryption key must be a 32-byte hexadecimal key.');
  }
  return Buffer.from(value, 'hex');
}

export function isValidShishaPinEncryptionKey(value = process.env.SHISHA_PIN_ENCRYPTION_KEY) {
  return PIN_ENCRYPTION_KEY_PATTERN.test(String(value || ''));
}

export function encryptShishaPin(pin, keyValue = process.env.SHISHA_PIN_ENCRYPTION_KEY) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', parseKey(keyValue), iv);
  const ciphertext = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptShishaPin(value, keyValue = process.env.SHISHA_PIN_ENCRYPTION_KEY) {
  const [version, ivHex, tagHex, ciphertextHex, extra] = String(value || '').split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !ciphertextHex || extra !== undefined) {
    throw new Error('Stored Shisha PIN has an invalid encrypted format.');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  if (iv.length !== 12 || tag.length !== 16 || !/^(?:[a-f\d]{2})+$/i.test(ciphertextHex)) {
    throw new Error('Stored Shisha PIN has invalid encrypted data.');
  }
  const decipher = createDecipheriv('aes-256-gcm', parseKey(keyValue), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
