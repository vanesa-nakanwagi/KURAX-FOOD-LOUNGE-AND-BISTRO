export function summarizeDepartmentCredits(credits = []) {
  const summary = {
    partially_paid_credit_count: 0,
    partially_paid_credit_amount: 0,
    partially_paid_credit_balance: 0,
    settled_credit_count: 0,
    settled_credit_amount: 0,
    outstanding_credit_count: 0,
    outstanding_credit_balance: 0,
  };

  for (const credit of Array.isArray(credits) ? credits : []) {
    const amount = Math.max(0, Number(credit.amount) || 0);
    if (!amount) continue;

    const amountPaid = Math.min(amount, Math.max(0, Number(credit.amount_paid) || 0));
    const balance = amount - amountPaid;

    if (balance === 0) {
      summary.settled_credit_count += 1;
      summary.settled_credit_amount += amountPaid;
      continue;
    }

    summary.outstanding_credit_count += 1;
    summary.outstanding_credit_balance += balance;

    if (amountPaid > 0) {
      summary.partially_paid_credit_count += 1;
      summary.partially_paid_credit_amount += amountPaid;
      summary.partially_paid_credit_balance += balance;
    }
  }

  return summary;
}

export function updateCreditOrderItems(items, { label, amountPaid, fullySettled }) {
  const normalizedLabel = String(label || '').trim().toLowerCase();
  const paid = Math.max(0, Number(amountPaid) || 0);
  const settledAt = new Date().toISOString();

  return (Array.isArray(items) ? items : []).map((item) => {
    const matchesCredit = normalizedLabel
      ? String(item.name || '').trim().toLowerCase() === normalizedLabel
      : item.creditRequested === true;
    if (!matchesCredit) return item;

    const itemTotal = Math.max(0, (Number(item.price || item.unit_price) || 0) * (Number(item.quantity) || 1));
    const itemPaid = Math.min(itemTotal, paid);
    if (fullySettled) {
      return {
        ...item,
        _rowPaid: true,
        is_partially_paid: false,
        partial_amount_paid: itemPaid,
        remaining_balance: 0,
        paid_at: settledAt,
        creditRequested: false,
      };
    }

    return {
      ...item,
      _rowPaid: false,
      is_partially_paid: true,
      partial_amount_paid: itemPaid,
      remaining_balance: Math.max(itemTotal - itemPaid, 0),
      creditRequested: true,
    };
  });
}