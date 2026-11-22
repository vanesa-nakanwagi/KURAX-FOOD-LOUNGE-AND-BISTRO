import test from 'node:test';
import assert from 'node:assert/strict';

import { excludeReversedPurchaseActivity } from '../helpers/inventoryActivity.js';

test('inventory activity excludes reversed purchase and supplier-return movements', () => {
  const rows = [
    { transaction_type: 'PURCHASE', reference_number: 'PUR-10-2-123', is_reversed_purchase_activity: true },
    { transaction_type: 'RETURN_TO_SUPPLIER', reference_number: 'REV-PUR-10-456', is_reversed_purchase_activity: true },
    { transaction_type: 'PURCHASE', reference_number: 'PUR-11-2-789', is_reversed_purchase_activity: false },
    { transaction_type: 'CONSUMPTION', reference_number: 'CON-20', is_reversed_purchase_activity: false },
  ];

  assert.deepEqual(
    excludeReversedPurchaseActivity(rows).map((row) => row.reference_number),
    ['PUR-11-2-789', 'CON-20']
  );
});
