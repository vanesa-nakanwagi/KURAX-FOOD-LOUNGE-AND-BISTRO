import test from 'node:test';
import assert from 'node:assert/strict';
import { arePublicOrderStationsReady, refreshPublicOrderPreparationStatus } from '../helpers/publicOrderWorkflow.js';

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
});
