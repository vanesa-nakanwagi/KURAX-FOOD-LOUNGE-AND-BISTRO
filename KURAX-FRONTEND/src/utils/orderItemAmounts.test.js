import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrderItemPayableAmount,
  getOrderItemUnitPrice,
} from "./orderItemAmounts.js";

test("bar ticket item price prefers the selected serving over the bottle price", () => {
  const item = {
    price: 600000,
    unit_price: 600000,
    drink_serving: {
      unit_selling_price: 25000,
    },
  };

  assert.equal(getOrderItemUnitPrice(item), 25000);
});

test("drink serving totals use the selected serving price instead of the bottle amount", () => {
  const item = {
    price: 25000,
    quantity: 2,
    originalLineAmount: 600000,
    originalUnitPrice: 600000,
    drink_serving: {
      name: "Single Glass",
    },
  };

  assert.equal(getOrderItemPayableAmount(item), 50000);
});
