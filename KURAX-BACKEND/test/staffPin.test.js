import test from 'node:test';
import assert from 'node:assert/strict';
import { hashStaffPin, verifyStaffPin } from '../helpers/staffPin.js';

test('staff PIN hashes use per-PIN random salts and verify only the matching PIN', async () => {
  const first = await hashStaffPin('4821');
  const second = await hashStaffPin('4821');

  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.match(first.hash, /^[a-f0-9]{128}$/);
  assert.notEqual(first.hash, '4821');
  assert.equal(await verifyStaffPin('4821', first.salt, first.hash), true);
  assert.equal(await verifyStaffPin('4822', first.salt, first.hash), false);
});

test('staff PIN verification rejects missing or malformed hashes', async () => {
  assert.equal(await verifyStaffPin('4821', '', ''), false);
  assert.equal(await verifyStaffPin('4821', 'salt', 'plaintext'), false);
});
