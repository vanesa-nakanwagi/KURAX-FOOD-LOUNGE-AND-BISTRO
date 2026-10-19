import test from 'node:test';
import assert from 'node:assert/strict';
import { getAssignedStationItems, getConfirmedStationItems, getStationItemsTotal } from '../helpers/confirmedStationItems.js';

test('station queue exposes only items confirmed by the cashier', () => {
  const ticketItems = [
    { name: 'Tea', station: 'Barista', quantity: 1, price: 5000 },
    { name: 'Coffee', station: 'Barista', quantity: 1, price: 7000 },
  ];
  const orderItems = [
    { ...ticketItems[0], payment_confirmed: true },
    { ...ticketItems[1], payment_confirmed: false },
  ];

  const visibleItems = getConfirmedStationItems(ticketItems, orderItems);
  assert.deepEqual(visibleItems.map(({ name }) => name), ['Tea']);
  assert.equal(getStationItemsTotal(visibleItems), 5000);
});

test('ticket order indexes identify duplicate lines without leaking unpaid quantities', () => {
  const ticketItems = [
    { name: 'Tea', station: 'Barista', quantity: 1, _orderItemIndex: 0 },
    { name: 'Tea', station: 'Barista', quantity: 1, _orderItemIndex: 1 },
  ];
  const orderItems = [
    { name: 'Tea', station: 'Barista', payment_confirmed: true },
    { name: 'Tea', station: 'Barista', payment_confirmed: false },
  ];

  assert.deepEqual(
    getConfirmedStationItems(ticketItems, orderItems).map(({ _orderItemIndex }) => _orderItemIndex),
    [0]
  );
});

test('legacy tickets match confirmed items once and malformed source data fails closed', () => {
  const ticketItems = [
    { name: 'Coffee', station: 'Barista', quantity: 1 },
    { name: 'Coffee', station: 'Barista', quantity: 1 },
  ];
  const orderItems = JSON.stringify([
    { name: 'Coffee', station: 'Barista', quantity: 1, payment_confirmed: true },
  ]);

  assert.equal(getConfirmedStationItems(ticketItems, orderItems).length, 1);
  assert.deepEqual(getConfirmedStationItems(ticketItems, '{bad json'), []);
});

test('active station tickets expose HOD-assigned items before cashier confirmation', () => {
  const ticketItems = [
    { name: 'Kurax Burger', station: 'Kitchen', assignedTo: 'Benji', payment_confirmed: false },
    { name: 'Coffee', station: 'Barista', assigned_to: 'Alex', payment_confirmed: false },
    { name: 'Unassigned fries', station: 'Kitchen', payment_confirmed: true },
  ];

  assert.deepEqual(
    getAssignedStationItems(ticketItems).map(({ name }) => name),
    ['Kurax Burger', 'Coffee']
  );
});
