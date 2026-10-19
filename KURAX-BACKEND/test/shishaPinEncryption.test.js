import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptShishaPin, encryptShishaPin, isValidShishaPinEncryptionKey,
} from '../helpers/shishaPinEncryption.js';

const key = 'a'.repeat(64);

test('Shisha PIN encryption round-trips and uses a fresh nonce', () => {
  const encrypted = encryptShishaPin('0123', key);
  const encryptedAgain = encryptShishaPin('0123', key);

  assert.equal(decryptShishaPin(encrypted, key), '0123');
  assert.notEqual(encrypted, encryptedAgain);
  assert.equal(isValidShishaPinEncryptionKey(key), true);
});

test('Shisha PIN encryption rejects invalid keys and tampered ciphertext', () => {
  assert.equal(isValidShishaPinEncryptionKey('not-a-key'), false);
  assert.throws(() => encryptShishaPin('1234', 'not-a-key'), /32-byte hexadecimal key/);

  const encrypted = encryptShishaPin('1234', key);
  const parts = encrypted.split(':');
  const finalNibble = parts[3].endsWith('0') ? '1' : '0';
  parts[3] = `${parts[3].slice(0, -1)}${finalNibble}`;
  assert.throws(() => decryptShishaPin(parts.join(':'), key));
});
