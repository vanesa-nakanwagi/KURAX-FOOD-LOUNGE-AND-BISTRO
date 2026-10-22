import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfirmedItemsForStation, syncConfirmedStationTickets } from '../helpers/stationOrderTickets.js';

const items = [
  { name: 'Burger', station: 'Kitchen', price: 12000, quantity: 1, payment_confirmed: true },
  { name: 'Tea', station: 'Barista', price: 4000, quantity: 2, payment_confirmed: true },
  { name: 'Juice', station: 'Bar', price: 6000, quantity: 1, payment_confirmed: true },
  { name: 'Shisha', station: 'Shisha', price: 10000, quantity: 1, payment_confirmed: true },
  { name: 'Unpaid coffee', station: 'Barista', price: 5000, quantity: 1, payment_confirmed: false },
  { name: 'Unmarked kitchen item', price: 3000, quantity: 1, payment_confirmed: true },
];

test('confirmed routed order items are grouped into the correct station without assignment', () => {
  assert.deepEqual(
    getConfirmedItemsForStation(items, 'kitchen').map((item) => item.name),
    ['Burger', 'Unmarked kitchen item']
  );
  assert.deepEqual(
    getConfirmedItemsForStation(items, 'bar').map((item) => item.name),
    ['Juice']
  );
  assert.deepEqual(
    getConfirmedItemsForStation(items, 'barista').map((item) => item.name),
    ['Tea']
  );
  assert.deepEqual(getConfirmedItemsForStation('{invalid', 'barista'), []);
});

test('station ticket sync upserts only confirmed routed items and leaves ticket status intact', async () => {
  let query;
  await syncConfirmedStationTickets({
    async query(sql) {
      query = sql;
      return { rows: [], rowCount: 1 };
    },
  }, 'barista');

  assert.match(query, /INSERT INTO public\.barista_tickets/);
  assert.match(query, /ON CONFLICT \(order_id\) DO UPDATE/);
  assert.match(query, /expanded\.item->'payment_confirmed' = 'true'::jsonb/);
  assert.match(query, /LOWER\(BTRIM\(expanded\.item->>'station'\)\) = 'barista'/);
  assert.match(query, /OR ticket\.items IS DISTINCT FROM EXCLUDED\.items/);
  assert.doesNotMatch(query, /status\s*=/i);
  assert.doesNotMatch(query, /assignments/i);
});

test('each station sync writes to its existing ticket table and preserves station routing', async () => {
  const expected = {
    kitchen: ['kitchen_tickets', /NOT IN \('bar', 'barman', 'barista', 'shisha'\)/],
    bar: ['barman_tickets', /IN \('bar', 'barman'\)/],
    barista: ['barista_tickets', /= 'barista'/],
  };

  for (const [station, [table, stationCondition]] of Object.entries(expected)) {
    let query;
    await syncConfirmedStationTickets({
      async query(sql) {
        query = sql;
        return { rows: [], rowCount: 1 };
      },
    }, station);

    assert.match(query, new RegExp(`INSERT INTO public\\.${table}`));
    assert.match(query, stationCondition);
    assert.match(query, /'_orderItemIndex'/);
    assert.match(query, /GROUP BY o\.id, o\.table_name, o\.staff_name, o\.staff_role/);
  }
});

test('station item filtering does not expose unpaid items', () => {
  assert.deepEqual(
    getConfirmedItemsForStation(
      [{ name: 'Unpaid coffee', station: 'Barista', payment_confirmed: false }],
      'barista'
    ),
    []
  );
});
