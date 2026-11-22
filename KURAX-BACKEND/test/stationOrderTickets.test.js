import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRoutableItemsForStation,
  syncRoutableStationTickets,
  syncRoutableStationTicketsForAllStations,
} from '../helpers/stationOrderTickets.js';

const items = [
  { name: 'Burger', station: 'Kitchen', price: 12000, quantity: 1, payment_confirmed: true },
  { name: 'Tea', station: 'Barista', price: 4000, quantity: 2, payment_confirmed: true },
  { name: 'Juice', station: 'Bar', price: 6000, quantity: 1, payment_confirmed: true },
  { name: 'Shisha', station: 'Shisha', price: 10000, quantity: 1, payment_confirmed: true },
  { name: 'Unpaid coffee', station: 'Barista', price: 5000, quantity: 1, payment_confirmed: false },
  { name: 'Unmarked kitchen item', price: 3000, quantity: 1, payment_confirmed: true },
  { name: 'Voided pizza', station: 'Kitchen', price: 25000, quantity: 1, payment_confirmed: true, voidProcessed: true },
  { name: 'Voided coffee', station: 'Barista', price: 4000, quantity: 1, payment_confirmed: true, status: 'VOIDED' },
];

test('confirmed routed order items are grouped into the correct station without assignment', () => {
  assert.deepEqual(
    getRoutableItemsForStation(items, 'kitchen').map((item) => item.name),
    ['Burger', 'Unmarked kitchen item']
  );
  assert.deepEqual(
    getRoutableItemsForStation(items, 'bar').map((item) => item.name),
    ['Juice']
  );
  assert.deepEqual(
    getRoutableItemsForStation(items, 'barista').map((item) => item.name),
    ['Tea']
  );
  assert.deepEqual(getRoutableItemsForStation('{invalid', 'barista'), []);
});

test('staff-routed unpaid items are grouped into their assigned stations', () => {
  const staffItems = [
    { name: 'Burger', station: 'Kitchen', station_routing_requested: true },
    { name: 'Tea', station: 'Barista', station_routing_requested: true },
    { name: 'Juice', station: 'Bar', station_routing_requested: true },
    { name: 'Unsent coffee', station: 'Barista', payment_confirmed: false },
  ];

  assert.deepEqual(getRoutableItemsForStation(staffItems, 'kitchen').map(({ name }) => name), ['Burger']);
  assert.deepEqual(getRoutableItemsForStation(staffItems, 'barista').map(({ name }) => name), ['Tea']);
  assert.deepEqual(getRoutableItemsForStation(staffItems, 'bar').map(({ name }) => name), ['Juice']);
});

test('public website orders require confirmed payment even if a station route flag is set', () => {
  const publicItems = [
    { name: 'Paid dish', station: 'Kitchen', payment_confirmed: true },
    { name: 'Unpaid drink', station: 'Barista', station_routing_requested: true },
  ];

  assert.deepEqual(
    getRoutableItemsForStation(publicItems, 'kitchen', { publicOrder: true }).map(({ name }) => name),
    ['Paid dish']
  );
  assert.deepEqual(
    getRoutableItemsForStation(publicItems, 'barista', { publicOrder: true }),
    []
  );
});

test('station ticket sync upserts confirmed or staff-routed items and leaves ticket status intact', async () => {
  let query;
  await syncRoutableStationTickets({
    async query(sql) {
      query = sql;
      return { rows: [], rowCount: 1 };
    },
  }, 'barista');

  assert.match(query, /INSERT INTO public\.barista_tickets/);
  assert.match(query, /ON CONFLICT \(order_id\) DO UPDATE/);
  assert.match(query, /expanded\.item->'payment_confirmed' = 'true'::jsonb/);
  assert.match(query, /o\.public_order_ref IS NULL/);
  assert.match(query, /o\.public_order_ref IS NULL OR o\.payment_confirmed = true/);
  assert.match(query, /COALESCE\(jsonb_array_length\(o\.original_order_ids\), 0\) = 0/);
  assert.match(query, /expanded\.item->'station_routing_requested' = 'true'::jsonb/);
  assert.match(query, /LOWER\(BTRIM\(expanded\.item->>'station'\)\) = 'barista'/);
  assert.match(query, /expanded\.item->>'voidProcessed'/);
  assert.match(query, /UPPER\(COALESCE\(expanded\.item->>'status'/);
  assert.match(query, /FROM public\.void_requests vr/);
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
    await syncRoutableStationTickets({
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

test('public payment confirmation can synchronize tickets for every intended station', async () => {
  const statements = [];
  await syncRoutableStationTicketsForAllStations({
    async query(sql) {
      statements.push(sql);
      return { rows: [], rowCount: 1 };
    },
  });

  assert.equal(statements.length, 3);
  assert.match(statements[0], /INSERT INTO public\.kitchen_tickets/);
  assert.match(statements[1], /INSERT INTO public\.barman_tickets/);
  assert.match(statements[2], /INSERT INTO public\.barista_tickets/);
  for (const sql of statements) {
    assert.match(sql, /o\.public_order_ref IS NULL OR o\.payment_confirmed = true/);
    assert.match(sql, /COALESCE\(jsonb_array_length\(o\.original_order_ids\), 0\) = 0/);
    assert.match(sql, /expanded\.item->'payment_confirmed' = 'true'::jsonb/);
  }
});

test('station item filtering does not expose unpaid items', () => {
  assert.deepEqual(
    getRoutableItemsForStation(
      [{ name: 'Unpaid coffee', station: 'Barista', payment_confirmed: false }],
      'barista'
    ),
    []
  );
});
