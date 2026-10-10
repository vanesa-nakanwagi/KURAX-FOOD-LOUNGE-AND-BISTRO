import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateClosingQuantity,
  isMainInventoryItem,
  buildInventorySummary,
  generateInventorySummaryPdf,
} from '../helpers/inventorySummaryService.js';

test('calculateClosingQuantity includes all signed movements correctly', () => {
  const closing = calculateClosingQuantity({
    openingQuantity: 100,
    purchasesReceived: 30,
    transfersIn: 10,
    transfersOut: 5,
    consumption: 40,
    waste: 2,
    adjustmentIn: 3,
    adjustmentOut: 1,
  });

  assert.equal(closing, 95);
});

test('shisha items are excluded from main inventory summary', () => {
  const items = [
    { item_name: 'Tomato', station: 'KITCHEN', location_name: 'Kitchen', current_quantity: 30, minimum_stock_level: 10, unit_cost: 450 },
    { item_name: 'Hookah Charcoal', station: 'SHISHA', location_name: 'Shisha', current_quantity: 18, minimum_stock_level: 5, unit_cost: 600 },
    { item_name: 'Lemon', station: 'BAR', location_name: 'Bar', current_quantity: 0, minimum_stock_level: 8, unit_cost: 240 },
  ];

  const mainItems = items.filter(isMainInventoryItem);
  assert.equal(mainItems.length, 2);
  assert.ok(mainItems.every((item) => !['SHISHA'].includes(String(item.station || '').toUpperCase())));
});

test('summary build keeps department totals and excludes shisha', () => {
  const summary = buildInventorySummary({
    items: [
      { item_name: 'Tomato', station: 'KITCHEN', location_name: 'Kitchen', current_quantity: 20, unit_cost: 4, minimum_stock_level: 10 },
      { item_name: 'Mango', station: 'BAR', location_name: 'Bar', current_quantity: 15, unit_cost: 5, minimum_stock_level: 8 },
      { item_name: 'Shisha Mix', station: 'SHISHA', location_name: 'Shisha', current_quantity: 30, unit_cost: 7, minimum_stock_level: 6 },
    ],
    purchases: [{ total_cost: 50, location_name: 'Kitchen' }],
    transactions: [
      { transaction_type: 'CONSUMPTION', station: 'KITCHEN', quantity: 3, unit_cost: 4 },
      { transaction_type: 'TRANSFER_IN', station: 'KITCHEN', quantity: 2, unit_cost: 4 },
      { transaction_type: 'TRANSFER_OUT', station: 'KITCHEN', quantity: 1, unit_cost: 4 },
      { transaction_type: 'WASTE', station: 'BAR', quantity: 1, unit_cost: 5 },
      { transaction_type: 'ADJUSTMENT_IN', station: 'BAR', quantity: 2, unit_cost: 5 },
    ],
    waste: [{ quantity: 1, unit_cost: 5 }],
    adjustments: [{ adjustment_type: 'ADJUSTMENT_IN', quantity: 2, unit_cost: 5 }],
  });

  assert.equal(summary.totalItems, 2);
  assert.equal(summary.departmentBreakdown.Kitchen.itemCount, 1);
  assert.equal(summary.departmentBreakdown.Bar.itemCount, 1);
  assert.equal(summary.lowStockCount, 0);
  assert.ok(summary.alerts.every((alert) => !/SHISHA/i.test(String(alert.item || ''))));
});

test('pdf generation returns a valid PDF buffer', () => {
  const pdf = generateInventorySummaryPdf({
    reportTitle: 'Inventory Summary Report',
    businessDate: '2026-10-10',
    departmentLabel: 'All Main Departments',
    generatedBy: 'Accountant',
    generatedAt: '2026-10-10T12:00:00Z',
    summary: {
      totalItems: 1,
      closingInventoryValue: 1200,
      totalPurchases: 150,
      consumptionValue: 80,
      wasteValue: 20,
    },
    departmentBreakdown: {
      Kitchen: { itemCount: 1, closingInventoryValue: 1200 },
    },
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.subarray(0, 5).toString('ascii') === '%PDF-');
});
