export function excludeReversedPurchaseActivity(transactions) {
  return transactions.filter((transaction) => transaction.is_reversed_purchase_activity !== true);
}
