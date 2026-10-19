import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicOrderItems,
  calculatePublicOrderTotal,
  groupPublicOrderItemsByStation,
  markPublicOrderItemsPaid,
  normalizePublicCustomer,
} from '../helpers/publicOrderValidation.js';

const customer = {
  firstName: '  Amina ',
  lastName: 'N.',
  email: 'AMINA@example.com',
  mobileMoneyNumber: '+256 700 123 456',
  paymentProvider: 'mtn',
  deliveryType: 'Home',
  city: 'Kampala',
  locationDesc: 'Acacia Avenue',
};

test('public checkout normalizes contact and payment details', () => {
  assert.deepEqual(normalizePublicCustomer(customer), {
    customerName: 'Amina N.',
    customerEmail: 'amina@example.com',
    mobileMoneyNumber: '+256 700 123 456',
    paymentProvider: 'MTN',
    deliveryType: 'Home',
    city: 'Kampala',
    locationDesc: 'Acacia Avenue',
  });
});

test('menu items and combos share the same catalog-priced order flow', async () => {
  const catalog = {
    'menu:1': { id: 1, name: 'Chicken Wrap', price: '12000', category: 'Food', station: 'Kitchen' },
    'combo:7': { id: 7, name: 'Lunch Combo', price: '25000', category: 'Combos', station: 'Kitchen' },
  };
  const items = await buildPublicOrderItems([
    { id: 1, type: 'menu', quantity: 2, price: 1 },
    { id: 'combo-7', combo_id: 7, type: 'combo', quantity: 1, price: 1 },
  ], async (type, id) => catalog[`${type}:${id}`] || null);

  assert.deepEqual(items.map(({ type, name, price, quantity }) => ({ type, name, price, quantity })), [
    { type: 'menu', name: 'Chicken Wrap', price: 12000, quantity: 2 },
    { type: 'combo', name: 'Lunch Combo', price: 25000, quantity: 1 },
  ]);
  assert.equal(calculatePublicOrderTotal(items), 49000);
});

test('public checkout rejects unavailable items and invalid quantities', async () => {
  await assert.rejects(
    buildPublicOrderItems([{ id: 99, quantity: 1 }], async () => null),
    /no longer available/
  );
  await assert.rejects(
    buildPublicOrderItems([{ id: 1, quantity: 1.5 }], async () => ({ id: 1, name: 'Dish', price: 1000 })),
    /whole numbers/
  );
});

test('public checkout rejects invalid contact and payment information', () => {
  assert.throws(
    () => normalizePublicCustomer({ ...customer, paymentProvider: 'Cash' }),
    /Select MTN or Airtel/
  );
  assert.throws(
    () => normalizePublicCustomer({ ...customer, mobileMoneyNumber: 'abc' }),
    /valid mobile money number/
  );
});

test('public checkout requires an exact customer location', () => {
  assert.throws(
    () => normalizePublicCustomer({ ...customer, locationDesc: '' }),
    /exact delivery location is required/
  );
  assert.throws(
    () => normalizePublicCustomer({ ...customer, locationDesc: '   ' }),
    /exact delivery location is required/
  );
  assert.throws(
    () => normalizePublicCustomer({ ...customer, locationDesc: 'x'.repeat(501) }),
    /maximum 500 characters/
  );
});

test('confirmed public order items are marked paid for sales and inventory reports', () => {
  const paidAt = new Date('2026-10-18T09:00:00.000Z');
  assert.deepEqual(markPublicOrderItemsPaid([
    { name: 'Chicken Wrap', quantity: 2, price: 12000 },
  ], 'Momo-MTN', paidAt), [
    {
      name: 'Chicken Wrap',
      quantity: 2,
      price: 12000,
      _rowPaid: true,
      payment_confirmed: true,
      payment_method: 'Momo-MTN',
      paid_at: '2026-10-18T09:00:00.000Z',
    },
  ]);
});

test('website order items are grouped into kitchen, bar and barista tickets', () => {
  const grouped = groupPublicOrderItemsByStation([
    { name: 'Wrap', station: 'Kitchen', price: 12000 },
    { name: 'Juice', station: 'Bar', price: 5000 },
    { name: 'Coffee', station: 'Barista', price: 6000, instructions: 'No sugar' },
  ]);

  assert.deepEqual(grouped.kitchen.map(item => item.name), ['Wrap']);
  assert.deepEqual(grouped.barman.map(({ name, station }) => ({ name, station })), [
    { name: 'Juice', station: 'Barman' },
  ]);
  assert.deepEqual(grouped.barista[0], {
    name: 'Coffee',
    station: 'Barista',
    price: 6000,
    instructions: 'No sugar',
    note: 'No sugar',
  });
});

test('website orders with unsupported station routing fail explicitly', () => {
  assert.throws(
    () => groupPublicOrderItemsByStation([{ name: 'Shisha', station: 'Shisha' }]),
    /cannot currently be sent to the shisha station/
  );
});
