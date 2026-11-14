import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMenuProfitabilityRow,
  buildMenuProfitabilitySummary,
  calculateRecipeUnitCost,
  calculateGrossProfitMargin,
  normalizeMoney,
  buildProfitabilityAnalytics,
  mergeCogsRows,
} from '../helpers/menuProfitability.js';

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

test('mergeCogsRows combines recipe and direct inventory costs for the same menu item', () => {
  const rows = mergeCogsRows([
    { menu_name: 'Four Cousins', category: 'Drinks', cogs: 80000, consumed_quantity: 1 },
    { menu_name: 'four cousins', category: 'Drinks', cogs: 75000, consumed_quantity: 1 },
    { menu_name: 'Beer', category: 'Drinks', cogs: 0, consumed_quantity: 2, has_cogs_data: false },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].cogs, 155000);
  assert.equal(rows[0].consumed_quantity, 2);
  assert.equal(rows[0].has_cogs_data, true);
  assert.equal(rows[1].has_cogs_data, false);
});

test('recipe costs take precedence over direct purchase costs for same-named items', () => {
  const [row] = mergeCogsRows([
    {
      menu_name: 'Burger',
      cogs: 7000,
      direct_purchase_cost: 0,
      has_cogs_data: true,
      is_recipe_based: true,
    },
    {
      menu_name: 'Burger',
      cogs: 0,
      direct_purchase_cost: 5000,
      unit_purchase_cost: 5000,
      has_purchase_cost: true,
      is_recipe_based: false,
    },
  ]);

  assert.equal(row.is_recipe_based, true);
  assert.equal(row.cogs, 7000);
  assert.equal(row.direct_purchase_cost, 0);
  assert.equal(row.unit_purchase_cost, null);
});

test('buildProfitabilityAnalytics ranks departments and items from the same gross-profit foundations', () => {
  const analytics = buildProfitabilityAnalytics([
    { menu_name: 'Burger', department: 'Kitchen', net_sales: 1200, cogs: 700, quantity_sold: 30 },
    { menu_name: 'Fries', department: 'Kitchen', net_sales: 400, cogs: 200, quantity_sold: 25 },
    { menu_name: 'Tea', department: 'Bar', net_sales: 300, cogs: 100, quantity_sold: 15 },
    { menu_name: 'Juice', department: 'Bar', net_sales: 200, cogs: 180, quantity_sold: 10 },
  ]);

  assert.equal(analytics.most_profitable_department.department, 'Kitchen');
  assert.equal(analytics.least_profitable_department.department, 'Bar');
  assert.equal(analytics.most_profitable_item.menu_name, 'Burger');
  assert.equal(analytics.least_profitable_item.menu_name, 'Juice');
  assert.equal(analytics.most_sold_item.menu_name, 'Burger');
  assert.equal(analytics.least_sold_item.menu_name, 'Juice');
  assert.equal(analytics.summary.grossProfit, 620);
});

test('buildProfitabilityAnalytics flags rows without cost data', () => {
  const analytics = buildProfitabilityAnalytics([
    { menu_name: 'No Cost Item', department: 'Kitchen', net_sales: 500, cogs: 0, quantity_sold: 10, has_cogs_data: false },
    { menu_name: 'Healthy Item', department: 'Kitchen', net_sales: 500, cogs: 250, quantity_sold: 10, has_cogs_data: true },
  ]);

  assert.equal(analytics.missing_cost_data.length, 1);
  assert.equal(analytics.missing_cost_data[0].menu_name, 'No Cost Item');
});

test('incomplete item costs are excluded from profitability department rankings', () => {
  const analytics = buildProfitabilityAnalytics([
    { menu_name: 'Bottle', department: 'Bar', net_sales: 100000, quantity_sold: 1, has_cost_data: false },
    { menu_name: 'Burger', department: 'Kitchen', net_sales: 20000, cogs: 8000, quantity_sold: 1, has_cost_data: true },
  ]);
  const barRanking = analytics.departmentRankings.find((row) => row.department === 'Bar');

  assert.equal(analytics.most_profitable_department.department, 'Kitchen');
  assert.equal(barRanking.gross_profit, null);
  assert.equal(barRanking.gross_profit_margin, null);
});

test('ready-made products use historical unit purchase cost separately from recipe COGS', () => {
  const wine = buildMenuProfitabilityRow({
    menu_name: 'Four Cousins',
    category: 'Drinks',
    quantity_sold: 2,
    selling_price: 155000,
    gross_sales: 310000,
    net_sales: 310000,
  }, {
    is_recipe_based: false,
    has_purchase_cost: true,
    unit_purchase_cost: 5000,
    direct_purchase_cost: 10000,
  });

  assert.equal(wine.unit_purchase_cost, 5000);
  assert.equal(wine.cogs, 0);
  assert.equal(wine.direct_purchase_cost, 10000);
  assert.equal(wine.total_cogs, 10000);
  assert.equal(wine.gross_profit, 300000);
  assert.equal(wine.gross_profit_margin, (300000 / 310000) * 100);
});

test('selling price uses gross sales before discounts and displayed COGS includes direct purchase costs', () => {
  const wine = buildMenuProfitabilityRow({
    menu_name: 'Four Cousins Sweet Red/White 1.5L',
    quantity_sold: 3,
    gross_sales: 450000,
    net_sales: 400000,
  }, {
    is_recipe_based: false,
    has_purchase_cost: true,
    unit_purchase_cost: 50000,
    direct_purchase_cost: 150000,
  });

  assert.equal(wine.selling_price, 150000);
  assert.equal(wine.quantity_sold, 3);
  assert.equal(wine.total_cogs, 150000);
  assert.equal(wine.gross_profit, 250000);
});

test('recipe costs convert ingredient quantities to inventory units', () => {
  const cost = calculateRecipeUnitCost([
    {
      ingredient_item_id: 1,
      recipe_quantity: 250,
      recipe_unit: 'g',
      stock_unit: 'kg',
      unit_cost: 10000,
    },
    {
      ingredient_item_id: 2,
      recipe_quantity: 20,
      recipe_unit: 'ml',
      stock_unit: 'L',
      unit_cost: 10000,
    },
  ]);

  assert.deepEqual(cost, { unit_cost: 2700, has_cogs_data: true });
});

test('recipe costs remain in cost review when an ingredient has no usable cost', () => {
  const cost = calculateRecipeUnitCost([
    {
      ingredient_item_id: 1,
      recipe_quantity: 250,
      recipe_unit: 'g',
      stock_unit: 'kg',
      unit_cost: 10000,
    },
    {
      ingredient_item_id: 2,
      recipe_quantity: 1,
      recipe_unit: 'pc',
      stock_unit: 'pc',
      unit_cost: 0,
    },
  ]);

  assert.deepEqual(cost, { unit_cost: 2500, has_cogs_data: false });
});

test('missing purchase and recipe costs do not appear as zero-cost profitability', () => {
  const missingBottle = buildMenuProfitabilityRow({
    menu_name: 'Uncosted Bottle',
    quantity_sold: 1,
    net_sales: 100000,
  }, {
    is_recipe_based: false,
    has_purchase_cost: false,
  });
  const incompleteRecipe = buildMenuProfitabilityRow({
    menu_name: 'Burger',
    is_recipe_based: true,
    quantity_sold: 1,
    net_sales: 20000,
  }, {
    is_recipe_based: true,
    has_cogs_data: false,
    cogs: 0,
  });

  assert.equal(missingBottle.profitability_status, 'Cost missing');
  assert.equal(missingBottle.gross_profit, null);
  assert.equal(missingBottle.gross_profit_margin, null);
  assert.equal(incompleteRecipe.profitability_status, 'Cost review');
  assert.equal(incompleteRecipe.unit_purchase_cost, null);
  assert.equal(incompleteRecipe.gross_profit, null);
  assert.equal(incompleteRecipe.gross_profit_margin, null);
});

test('known historical purchase costs remain visible when other sales have no applicable cost', () => {
  const partiallyCostedBottle = buildMenuProfitabilityRow({
    menu_name: 'Four Cousins',
    quantity_sold: 2,
    net_sales: 310000,
  }, {
    is_recipe_based: false,
    unit_purchase_cost: 150000,
    direct_purchase_cost: 150000,
    has_purchase_cost: false,
    has_any_purchase_cost: true,
  });

  assert.equal(partiallyCostedBottle.unit_purchase_cost, 150000);
  assert.equal(partiallyCostedBottle.direct_purchase_cost, 150000);
  assert.equal(partiallyCostedBottle.gross_profit, null);
  assert.equal(partiallyCostedBottle.gross_profit_margin, null);
  assert.equal(partiallyCostedBottle.profitability_status, 'Cost review');
});

test('summary includes direct purchase costs once and marks totals for review when costs are missing', () => {
  const summary = buildMenuProfitabilitySummary([
    {
      menu_name: 'Wine',
      net_sales: 310000,
      cogs: 0,
      direct_purchase_cost: 10000,
      gross_profit: 300000,
      has_cost_data: true,
    },
    {
      menu_name: 'Burger',
      net_sales: 20000,
      cogs: 5000,
      direct_purchase_cost: 0,
      gross_profit: 15000,
      has_cost_data: true,
    },
  ]);
  const incompleteSummary = buildMenuProfitabilitySummary([
    { menu_name: 'Bottle', net_sales: 100000, cogs: 0, direct_purchase_cost: 0, gross_profit: null, has_cost_data: false },
  ]);

  assert.equal(summary.totalCogs, 5000);
  assert.equal(summary.totalDirectPurchaseCosts, 10000);
  assert.equal(summary.totalCost, 15000);
  assert.equal(summary.grossProfit, 315000);
  assert.equal(summary.grossProfitMargin, (315000 / 330000) * 100);
  assert.equal(incompleteSummary.grossProfit, null);
  assert.equal(incompleteSummary.grossProfitMargin, null);
  assert.equal(incompleteSummary.totalCost, null);
});
