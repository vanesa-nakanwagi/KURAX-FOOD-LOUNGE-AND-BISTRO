import test from 'node:test';
import assert from 'node:assert/strict';
import {
  orderItemGrossAmountSql,
  orderItemNetAmountSql,
  orderItemPayableAmountSql,
  orderItemUnitPriceSql,
} from '../helpers/orderItemSalesAmounts.js';

test('gross sales SQL uses the original price snapshot before any discount', () => {
  const expression = orderItemGrossAmountSql('order_items.item');

  assert.match(expression, /order_items\.item->>'originalLineAmount'/);
  assert.match(expression, /order_items\.item->>'originalUnitPrice'/);
  assert.match(expression, /order_items\.item->>'price'/);
});

test('serving prices take precedence over stale bottle amounts in gross and payable SQL', () => {
  const gross = orderItemGrossAmountSql('order_items.item');
  const payable = orderItemPayableAmountSql('order_items.item');

  assert.match(gross, /order_items\.item->'drink_serving'->>'unit_selling_price'/);
  assert.match(gross, /jsonb_typeof\(order_items\.item->'drink_serving'\)/);
  assert.match(payable, /LEAST\(/);
  assert.match(payable, /order_items\.item->'drink_serving'->>'unit_selling_price'/);
  assert.ok(
    gross.indexOf("order_items.item->'drink_serving'->>'unit_selling_price'")
      < gross.indexOf("order_items.item->>'originalLineAmount'")
  );
});

test('unit price SQL selects the serving price before the bottle price', () => {
  const expression = orderItemUnitPriceSql('ticket_items.item');

  assert.match(expression, /ticket_items\.item->'drink_serving'->>'unit_selling_price'/);
  assert.ok(
    expression.indexOf("ticket_items.item->'drink_serving'->>'unit_selling_price'")
      < expression.indexOf("ticket_items.item->>'price'")
  );
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
