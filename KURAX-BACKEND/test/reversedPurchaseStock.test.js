import test from 'node:test';
import assert from 'node:assert/strict';

import { getReversedPurchaseStockCorrectionBlocker } from '../helpers/reversedPurchaseStock.js';

const eligibleStock = {
  currentQuantity: 1.5,
  receiptQuantity: 1.5,
  isActive: true,
  otherPurchaseReceiptExists: false,
  transactions: [
    { transaction_type: 'PURCHASE', reference_number: 'PUR-8-12-123' },
    { transaction_type: 'RETURN_TO_SUPPLIER', reference_number: 'REV-PUR-8-456' },
  ],
  transactionReferences: ['PUR-8-12-123'],
  purchaseId: 8,
  itemId: 12,
};

test('allows clearing stock only when it matches the reversed receipt and has no other activity', () => {
  assert.equal(getReversedPurchaseStockCorrectionBlocker(eligibleStock), null);
});

test('blocks clearing when the current quantity differs from the reversed receipt', () => {
  assert.match(
    getReversedPurchaseStockCorrectionBlocker({ ...eligibleStock, currentQuantity: 2 }),
    /does not exactly match/
  );
});

test('blocks clearing when another receipt or stock transaction exists', () => {
  assert.match(
    getReversedPurchaseStockCorrectionBlocker({ ...eligibleStock, otherPurchaseReceiptExists: true }),
    /another purchase receipt/
  );
  assert.match(
    getReversedPurchaseStockCorrectionBlocker({
      ...eligibleStock,
      transactions: [...eligibleStock.transactions, { transaction_type: 'CONSUMPTION', reference_number: 'CON-2' }],
    }),
    /other inventory activity/
  );
});
