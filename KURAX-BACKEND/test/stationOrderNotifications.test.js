import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStationOrderNotifications } from '../helpers/stationOrderNotifications.js';

test('builds notifications only for routed stations in a staff order', () => {
  const notifications = buildStationOrderNotifications(42, [
    { name: 'Burger', station: 'Kitchen', station_routing_requested: true },
    { name: 'Tea', station: 'Barista', station_routing_requested: true },
    { name: 'Juice', station: 'Bar', station_routing_requested: true },
    { name: 'Shisha', station: 'Shisha', station_routing_requested: true },
  ]);

  assert.deepEqual(notifications.map(({ station }) => station), ['kitchen', 'bar', 'barista']);
  assert.deepEqual(notifications.map(({ roles }) => roles), [
    ['KITCHEN_HOD', 'CHEF'],
    ['BAR_HOD', 'BARMAN'],
    ['BARISTA_HOD', 'BARISTA'],
  ]);
  assert.deepEqual(notifications.map(({ event }) => event.link), [
    '/kitchen?order=42',
    '/barman?order=42',
    '/barista?order=42',
  ]);
  assert.ok(notifications.every(({ event }) => event.referenceId === 42));
});

test('defaults items without a station to kitchen and skips unrouted items', () => {
  const notifications = buildStationOrderNotifications(7, [
    { name: 'Unspecified dish', station_routing_requested: true },
    { name: 'Unrouted drink', station: 'Barista' },
  ]);

  assert.deepEqual(notifications.map(({ station }) => station), ['kitchen']);
});

test('public website orders identify their reference in station notifications', () => {
  const notifications = buildStationOrderNotifications(42, [
    { name: 'Burger', station: 'Kitchen', payment_confirmed: true },
  ], 'KX-ABCD123456');

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].event.body, 'Website order KX-ABCD123456 requires preparation.');
  assert.equal(notifications[0].event.referenceId, 42);
});
