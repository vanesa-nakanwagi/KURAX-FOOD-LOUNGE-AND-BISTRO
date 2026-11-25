import test from "node:test";
import assert from "node:assert/strict";
import {
  getPaidOrderItems,
  hasReadyForServiceItems,
  isItemReadyForService,
} from "./paymentStatus.js";

test("paid item history does not count source orders duplicated by cashier payment copies", () => {
  const paidItems = [
    { name: "Serving one", _rowPaid: true },
    { name: "Serving two", _rowPaid: true },
    { name: "Meal", _rowPaid: true },
  ];
  const orders = [
    { id: 10, items: paidItems },
    {
      id: 11,
      original_order_ids: "[10]",
      items: paidItems,
    },
  ];

  assert.equal(getPaidOrderItems(orders).length, 3);
});

test("paid item history ignores unpaid items and preserves standalone paid items", () => {
  const orders = [
    {
      id: 20,
      items: [
        { name: "Paid item", paid_at: "2026-11-25T18:00:00Z" },
        { name: "Unpaid item", _rowPaid: false },
      ],
    },
  ];

  assert.deepEqual(
    getPaidOrderItems(orders).map(({ item }) => item.name),
    ["Paid item"],
  );
});

test("ready items remain available for service unless served, paid, voided, or not ready", () => {
  assert.equal(isItemReadyForService({ readyForService: true }), true);
  assert.equal(isItemReadyForService({ readyForService: true, served: true }), false);
  assert.equal(isItemReadyForService({ readyForService: true, _rowPaid: true }), false);
  assert.equal(isItemReadyForService({ readyForService: true, status: "VOIDED" }), false);
  assert.equal(isItemReadyForService({ readyForService: false }), false);
  assert.equal(
    hasReadyForServiceItems({ items: JSON.stringify([{ readyForService: true }]) }),
    true,
  );
});
