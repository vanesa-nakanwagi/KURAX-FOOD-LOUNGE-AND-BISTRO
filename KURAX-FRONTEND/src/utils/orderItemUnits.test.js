import assert from "node:assert/strict";
import test from "node:test";
import { expandOrderItemUnits, getOrderItemUnitPayableAmount } from "./orderItemAmounts.js";
import {
  getActiveOrderItems,
  hasOutstandingCreditItems,
  isManagerCreatedOrder,
} from "./paymentStatus.js";

test("expands a quantity line into independently payable units", () => {
  const rows = expandOrderItemUnits({
    name: "Masala Spiced Chips",
    quantity: 2,
    price: 15000,
    unitStates: [{ paid: true, paidAmount: 15000 }, { voidProcessed: true }],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0]._unitIndex, 0);
  assert.equal(rows[0]._unitPaid, true);
  assert.equal(rows[1]._unitVoided, true);
  assert.equal(rows[0].quantity, 1);
  assert.equal(rows[1].quantity, 1);
});

test("allocates rounded unit balances without losing the line total", () => {
  const item = { quantity: 3, price: 10 };
  const amount = [0, 1, 2].reduce(
    (total, index) => total + getOrderItemUnitPayableAmount(item, index),
    0
  );

  assert.equal(amount, 30);
});

test("expands credit state only onto the requested unit", () => {
  const rows = expandOrderItemUnits({
    name: "Mineral Water",
    quantity: 2,
    price: 5000,
    unitStates: [{ paid: true }, { creditRequested: true, creditApproved: true }],
  });

  assert.equal(rows[0].creditRequested, false);
  assert.equal(rows[1].creditRequested, true);
  assert.equal(rows[1].creditApproved, true);
});

test("detects outstanding credit on an individual unit", () => {
  assert.equal(hasOutstandingCreditItems({
    items: [{
      quantity: 2,
      unitStates: [{ paid: true }, { creditRequested: true }],
    }],
  }), true);
});

test("keeps unpaid units active when another unit is paid, credited, or voided", () => {
  const rows = expandOrderItemUnits({
    name: "Mineral Water",
    quantity: 4,
    price: 5000,
    unitStates: [
      { paid: true },
      { creditRequested: true },
      {},
      { voidProcessed: true },
    ],
  });

  assert.deepEqual(getActiveOrderItems(rows).map(item => item._unitIndex), [2]);
});

test("identifies manager-created orders from their saved or joined staff role", () => {
  assert.equal(isManagerCreatedOrder({ staff_role: "MANAGER" }), true);
  assert.equal(isManagerCreatedOrder({ staff_role_name: "manager" }), true);
  assert.equal(isManagerCreatedOrder({ staff_role: "WAITER" }), false);
  assert.equal(isManagerCreatedOrder({}), false);
});
