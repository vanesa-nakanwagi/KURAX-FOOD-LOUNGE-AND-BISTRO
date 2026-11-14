import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:65432/discount_test';
process.env.JWT_SECRET = 'discount-route-test-secret';
const [{ default: pool }, { default: discountRoutes }, { createSessionToken }] = await Promise.all([
  import('../db.js'),
  import('../routes/discountRoutes.js'),
  import('../middleware/sessionTokens.js'),
]);

function makeClient() {
  const items = [{
    id: 1,
    name: 'Test meal',
    price: 100,
    quantity: 1,
    originalLineAmount: 100,
    payableAmount: 100,
    pricingSnapshot: true,
  }];
  const queue = { id: 9, order_ids: [1], status: 'Pending', is_item: false, method: 'Cash', amount: 100 };
  const order = { id: 1, items, total: 100, status: 'Pending', special_bill_discount_amount: 0 };
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql === 'SELECT * FROM public.cashier_queue WHERE id = $1 FOR UPDATE') return { rows: [queue] };
      if (sql.includes('FROM public.orders WHERE id = ANY')) return { rows: [order] };
      if (sql.includes('FROM public.special_discount_settings')) return { rows: [{ max_discount_percent: 10 }] };
      if (sql.includes('UPDATE public.orders')) return { rows: [] };
      if (sql.includes('INSERT INTO public.special_bill_discount_audit')) return { rows: [] };
      if (sql.includes('UPDATE public.cashier_queue')) return { rows: [{ id: queue.id }] };
      return { rows: [] };
    },
    release() {},
  };
}

function makeApp(actor) {
  const app = express();
  app.use(express.json());
  pool.query = async (sql, params = []) => {
    if (sql.includes('SELECT id, name, role, is_active FROM public.staff')) {
      const requestedId = Number(params[0]);
      const fallbackRole = requestedId === 7 ? 'CASHIER' : 'WAITER';
      return {
        rows: [{
          id: requestedId,
          name: requestedId === actor.id ? actor.name : fallbackRole === 'CASHIER' ? 'Casey Cashier' : 'Waiter',
          role: requestedId === actor.id ? actor.role : fallbackRole,
          is_active: true,
        }],
      };
    }
    if (sql.includes('INSERT INTO public.special_discount_settings')) {
      return { rows: [{
        max_discount_type: params[0],
        max_discount_value: Number(params[1]),
        max_discount_percent: Number(params[2]),
        updated_by_name: actor.name,
      }] };
    }
    if (sql.includes('INSERT INTO activity_logs')) return { rows: [{ action_text: params[3] }] };
    return { rows: [] };
  };
  const client = makeClient();
  pool.connect = async () => client;
  app.use('/api/discounts', discountRoutes);
  return { app, client };
}

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    return await callback(url);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('authenticated cashier API applies an audited discount within the Director limit', async () => {
  const actor = { id: 7, name: 'Casey Cashier', role: 'CASHIER' };
  const { app, client } = makeApp(actor);
  const token = createSessionToken({ ...actor, scope: 'restaurant' });

  await withServer(app, async (url) => {
    const response = await fetch(`${url}/api/discounts/cashier-queue/9`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 5, reason: 'Service recovery' }),
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.discount_amount, 5);
    assert.equal(result.amount_due, 95);
    assert.equal(client.calls.some((call) => call.sql.includes('INSERT INTO public.special_bill_discount_audit')), true);
    assert.equal(client.calls.some((call) => call.sql === 'COMMIT'), true);
  });
});

test('cashier API rejects discounts above the configured limit and unauthorized roles', async () => {
  const cashier = { id: 7, name: 'Casey Cashier', role: 'CASHIER' };
  const { app } = makeApp(cashier);
  const cashierToken = createSessionToken({ ...cashier, scope: 'restaurant' });

  await withServer(app, async (url) => {
    const overLimit = await fetch(`${url}/api/discounts/cashier-queue/9`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 11, reason: 'Requested discount' }),
    });
    assert.equal(overLimit.status, 400);
    assert.match((await overLimit.json()).error, /authorized limit/);

    const waiterToken = createSessionToken({ id: 8, name: 'Waiter', role: 'WAITER', scope: 'restaurant' });
    const forbidden = await fetch(`${url}/api/discounts/cashier-queue/9`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waiterToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1, reason: 'Not authorized' }),
    });
    assert.equal(forbidden.status, 403);
  });
});

test('only a Director can update the special discount limit', async () => {
  const director = { id: 4, name: 'Dana Director', role: 'DIRECTOR' };
  const { app } = makeApp(director);
  const directorToken = createSessionToken({ ...director, scope: 'restaurant' });

  await withServer(app, async (url) => {
    const saved = await fetch(`${url}/api/discounts/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${directorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_discount_percent: 15 }),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).max_discount_percent, 15);

    const cashier = { id: 7, name: 'Casey Cashier', role: 'CASHIER' };
    const cashierToken = createSessionToken({ ...cashier, scope: 'restaurant' });
    const forbidden = await fetch(`${url}/api/discounts/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${cashierToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_discount_percent: 15 }),
    });
    assert.equal(forbidden.status, 403);
  });
});
