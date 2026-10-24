import test from 'node:test';
import assert from 'node:assert/strict';
import { orderItemGrossAmountSql, orderItemPayableAmountSql } from '../helpers/orderItemSalesAmounts.js';

test('gross sales SQL uses the original line value for complimentary items', () => {
  const expression = orderItemGrossAmountSql('order_items.item');

  assert.match(expression, /order_items\.item->>'complimentary'/);
  assert.match(expression, /order_items\.item->>'originalLineAmount'/);
  assert.match(expression, /order_items\.item->>'originalUnitPrice'/);
  assert.match(expression, /order_items\.item->>'line_total'/);
});

test('payable sales SQL subtracts the waived amount without inflating collected sales', () => {
  const expression = orderItemPayableAmountSql();

  assert.match(expression, /item->>'payableAmount'/);
  assert.match(expression, /item->>'complimentaryWaivedAmount'/);
  assert.match(expression, /GREATEST\(\s*0,/);
});
