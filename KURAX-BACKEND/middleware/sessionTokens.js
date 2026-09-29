import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

const sessionSecret = process.env.JWT_SECRET || process.env.DATABASE_URL || randomBytes(32).toString('hex');

export function createSessionToken(payload) {
  return jwt.sign(payload, sessionSecret, { expiresIn: '12h', issuer: 'kurax-api' });
}

export function readSessionToken(token) {
  return jwt.verify(token, sessionSecret, { issuer: 'kurax-api' });
}