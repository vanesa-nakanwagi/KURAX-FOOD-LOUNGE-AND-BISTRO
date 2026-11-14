import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderItemGrossAmountSql,
  orderItemNetAmountSql,
  orderItemPayableAmountSql,
} from '../helpers/orderItemSalesAmounts.js';

test('gross sales SQL uses the original price snapshot before any discount', () => {
  const expression = orderItemGrossAmountSql('order_items.item');

  assert.match(expression, /order_items\.item->>'originalLineAmount'/);
  assert.match(expression, /order_items\.item->>'originalUnitPrice'/);
  assert.match(expression, /order_items\.item->>'price'/);
});

test('gross sales reconstructs legacy complimentary snapshots from payable amount plus waiver', () => {
  const expression = orderItemGrossAmountSql('order_items.item');

  assert.match(expression, /order_items\.item->>'complimentary', 'false'\) = 'true'/);
  assert.match(expression, /order_items\.item->>'payableAmount'/);
  assert.match(expression, /order_items\.item->>'complimentaryWaivedAmount'/);
});

test('payable sales SQL subtracts the waived amount without inflating collected sales', () => {
  const expression = orderItemPayableAmountSql();

  assert.match(expression, /item->>'payableAmount'/);
  assert.match(expression, /item->>'line_total'/);
  assert.match(expression, /item->>'complimentaryWaivedAmount'/);
  assert.match(expression, /GREATEST\(\s*0,/);
});

test('net sales SQL applies only recorded item discounts to the original item price', () => {
  const expression = orderItemNetAmountSql('order_items.item');

  assert.match(expression, /order_items\.item->>'originalLineAmount'/);
  assert.match(expression, /order_items\.item->>'menuDiscountAmount'/);
  assert.match(expression, /order_items\.item->>'specialBillDiscountAmount'/);
  assert.match(expression, /order_items\.item->>'complimentaryWaivedAmount'/);
  assert.match(expression, /order_items\.item->>'payableAmount'/);
  assert.doesNotMatch(expression, /line_total/);
});
