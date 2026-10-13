import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateComboBreakdown, validateComboPayload } from '../helpers/comboPricing.js';

test('combo validation rejects missing components and negative quantities', () => {
  const invalid = validateComboPayload({
    name: 'Burger Combo',
    price: '20000',
    components: [{ menu_item_id: 1, quantity: 0 }],
  }, [
    { id: 1, name: 'Chicken Burger', price: 12000 },
  ]);

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((entry) => entry.includes('at least 2') || entry.includes('positive')));
});

test('combo breakdown calculates regular total, discount and gross profit', () => {
  const result = calculateComboBreakdown({
    price: '20000',
    components: [
      { menu_item_id: 1, quantity: 1, unit_price: 12000 },
      { menu_item_id: 2, quantity: 1, unit_price: 5000 },
      { menu_item_id: 3, quantity: 1, unit_price: 2000 },
    ],
  });

  assert.equal(result.regular_total, 19000);
  assert.equal(result.discount_amount, 0);
  assert.equal(result.discount_percentage, 0);
  assert.equal(result.package_price, 20000);
  assert.equal(result.gross_profit, 1000);
  assert.ok(result.margin_percentage > 0);
});
