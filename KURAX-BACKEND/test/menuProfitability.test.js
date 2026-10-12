import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMenuProfitabilitySummary, calculateGrossProfitMargin, normalizeMoney } from '../helpers/menuProfitability.js';

test('buildMenuProfitabilitySummary aggregates sales, COGS, gross profit, and margin safely', () => {
  const summary = buildMenuProfitabilitySummary([
    { menu_name: 'Burger', net_sales: 1200, cogs: 700, other_direct_costs: 50, quantity_sold: 10 },
    { menu_name: 'Fries', net_sales: 500, cogs: 200, other_direct_costs: 0, quantity_sold: 20 },
    { menu_name: 'Water', net_sales: 0, cogs: 0, other_direct_costs: 0, quantity_sold: 0 },
  ]);

  assert.equal(summary.totalNetSales, 1700);
  assert.equal(summary.totalCogs, 900);
  assert.equal(summary.grossProfit, 800);
  assert.ok(Math.abs(summary.grossProfitMargin - 47.05882352941177) < 1e-9);
  assert.equal(summary.totalQuantitySold, 30);
  assert.equal(summary.menuCount, 3);
});

test('gross profit margin stays at zero when revenue is zero and no NaN or Infinity leaks through', () => {
  const margin = calculateGrossProfitMargin(0, 0);
  const other = calculateGrossProfitMargin(50, 0);

  assert.equal(margin, 0);
  assert.equal(other, 0);
});

test('money values are normalized to numeric minor-unit-safe values', () => {
  assert.equal(normalizeMoney('1200.50'), 1200.5);
  assert.equal(normalizeMoney(null), 0);
  assert.equal(normalizeMoney(undefined), 0);
});
