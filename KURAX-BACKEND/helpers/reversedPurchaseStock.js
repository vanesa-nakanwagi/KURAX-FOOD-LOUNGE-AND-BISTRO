export function getReversedPurchaseStockCorrectionBlocker({
  currentQuantity,
  receiptQuantity,
  isActive,
  otherPurchaseReceiptExists,
  transactions,
  transactionReferences,
  purchaseId,
  itemId,
}) {
  if (!isActive) return 'The inventory item is already inactive.';

  const current = Number(currentQuantity);
  const expected = Number(receiptQuantity);
  if (!Number.isFinite(current) || !Number.isFinite(expected) || expected <= 0) {
    return 'The reversed receipt quantity could not be verified.';
  }
  if (Math.abs(current - expected) > 0.0001) {
    return 'Current stock does not exactly match the reversed receipt quantity.';
  }
  if (otherPurchaseReceiptExists) {
    return 'The item has another purchase receipt, so its remaining stock cannot be isolated safely.';
  }

  const allowedReferences = new Set(transactionReferences.filter(Boolean));
  const hasUnrelatedTransaction = transactions.some((transaction) => {
    const reference = String(transaction.reference_number || '');
    if (allowedReferences.has(reference)) return false;
    if (
      transaction.transaction_type === 'PURCHASE'
      && reference.startsWith(`PUR-${purchaseId}-${itemId}-`)
    ) return false;
    return !(
      transaction.transaction_type === 'RETURN_TO_SUPPLIER'
      && reference.startsWith(`REV-PUR-${purchaseId}-`)
    );
  });
  if (hasUnrelatedTransaction) {
    return 'The item has other inventory activity, so its remaining stock cannot be isolated safely.';
  }

  return null;
}
