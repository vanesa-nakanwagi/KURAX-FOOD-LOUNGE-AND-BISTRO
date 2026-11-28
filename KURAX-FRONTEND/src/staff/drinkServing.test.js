import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDrinkServing, getDrinkServingOptions } from './drinkServing.js';

test('150ml serving is selectable and priced as a proportion of the bottle price', () => {
  const bottle = {
    id: 1,
    name: 'Wine 750ml',
    price: 150000,
    list_price: 150000,
    category: 'Drinks & Cocktails',
    stock_available: true,
  };
  const serving = getDrinkServingOptions(bottle).find((option) => option.volumeMl === 150);

  assert.deepEqual(serving, { name: 'Glass', volumeMl: 150 });
  assert.equal(applyDrinkServing(bottle, serving).price, 30000);
});
