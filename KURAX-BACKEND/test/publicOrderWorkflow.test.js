import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arePublicOrderStationsReady,
  buildPublicOrderReadyNotification,
  notifyCashierOfReadyPublicOrder,
  refreshPublicOrderPreparationStatus,
} from '../helpers/publicOrderWorkflow.js';

test('public order is ready only after every station is ready', () => {
  assert.equal(arePublicOrderStationsReady(['Ready']), true);
  assert.equal(arePublicOrderStationsReady(['Ready', 'Ready', 'Ready']), true);
  assert.equal(arePublicOrderStationsReady(['Ready', 'Served']), true);
  assert.equal(arePublicOrderStationsReady(['Ready', 'Preparing']), false);
  assert.equal(arePublicOrderStationsReady(['Ready', 'Pending']), false);
  assert.equal(arePublicOrderStationsReady([]), false);
});

test('station status updates write Ready or Preparing onto the confirmed website request', async () => {
  const statements = [];
  const queryable = {
    async query(sql, params) {
      statements.push({ sql, params });
      if (sql.includes('UNION ALL')) return { rows: [{ status: 'Ready' }, { status: 'Ready' }] };
      return { rows: [{ preparation_status: params[0] }] };
    },
  };

  const result = await refreshPublicOrderPreparationStatus(42, queryable);

  assert.equal(result, 'Ready');
  assert.equal(statements.length, 2);
  assert.equal(statements[1].params[0], 'Ready');
  assert.equal(statements[1].params[1], 42);
  assert.match(statements[1].sql, /status IN \('Pending', 'Confirmed'\)/);
  assert.match(statements[1].sql, /preparation_status IS DISTINCT FROM \$1/);
});

test('public order ready notification links cashier to order after all stations are ready', () => {
  assert.deepEqual(buildPublicOrderReadyNotification(42), {
    type: 'PUBLIC_ORDER_READY',
    title: 'Website order ready',
    body: 'Website order #42 is ready at all stations.',
    referenceId: 42,
    referenceType: 'order',
    link: '/cashier',
  });
});

test('cashier is notified when a website order becomes ready', async () => {
  const sent = [];
  await notifyCashierOfReadyPublicOrder({
    async sendToRoles(roles, event) {
      sent.push({ roles, event });
      return { sent: 1, failed: 0 };
    },
  }, 42);

  assert.deepEqual(sent, [{
    roles: ['CASHIER'],
    event: buildPublicOrderReadyNotification(42),
  }]);
});

test('already-ready website orders do not report a new readiness transition', async () => {
  const queryable = {
    async query(sql) {
      if (sql.includes('UNION ALL')) return { rows: [{ status: 'Ready' }, { status: 'Served' }] };
      return { rows: [] };
    },
  };

  assert.equal(await refreshPublicOrderPreparationStatus(42, queryable), null);
});
