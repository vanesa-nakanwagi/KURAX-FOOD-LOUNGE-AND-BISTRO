import {
  randomBytes, scrypt as scryptCallback, timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashStaffPin(pin) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(String(pin), salt, 64);
  return { salt, hash: hash.toString('hex') };
}

export async function verifyStaffPin(pin, salt, hash) {
  if (!salt || !hash || !/^[a-f\d]{128}$/i.test(String(hash))) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(String(pin), String(salt), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
