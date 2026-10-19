import { readSessionToken } from './sessionTokens.js';

export default function requireCashier(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    return res.status(401).json({ error: 'Cashier authentication is required.' });
  }

  try {
    const user = readSessionToken(token);
    if (user.scope !== 'restaurant' || String(user.role).toUpperCase() !== 'CASHIER') {
      return res.status(403).json({ error: 'Only an authenticated cashier may process payments.' });
    }

    req.cashier = {
      id: user.id,
      name: user.name,
    };
    return next();
  } catch (error) {
    console.warn('Cashier authentication failed:', error.message);
    return res.status(401).json({ error: 'Cashier session is invalid or has expired.' });
  }
}
