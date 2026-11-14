import {
  getOrderItemPaidAmount,
  getOrderItemPayableAmount,
  roundMoney,
} from './complimentaryItems.js';

function isCreditItem(item = {}) {
  return item.creditRequested === true
    || item.creditApproved === true
    || item._approvedCreditSale === true
    || String(item.payment_method || '').toUpperCase() === 'CREDIT';
}

function getItemUnpaidBalance(item = {}) {
  if (item.voidProcessed === true
    || String(item.status || '').toUpperCase() === 'VOIDED'
    || isCreditItem(item)) return 0;
  return roundMoney(Math.max(0, getOrderItemPayableAmount(item) - getOrderItemPaidAmount(item)));
}

export function getDiscountableBillBalance(items = []) {
  return roundMoney(items.reduce((total, item) => total + getItemUnpaidBalance(item), 0));
}

export function validateSpecialDiscountSettings(value) {
  const maximum = Number(value);
  if (!Number.isFinite(maximum) || maximum < 0 || maximum > 100) {
    throw new Error('The maximum discount percentage must be between zero and 100.');
  }
  return maximum;
}

export function normalizeSpecialDiscountSettings(settings = {}) {
  const type = String(settings.max_discount_type || 'percentage').toLowerCase();
  if (!['percentage', 'fixed'].includes(type)) {
    throw new Error('Maximum discount type must be percentage or fixed.');
  }
  const rawValue = settings.max_discount_value
    ?? settings.max_discount_percent
    ?? 0;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('The maximum discount must be a non-negative amount.');
  }
  if (type === 'percentage' && value > 100) {
    throw new Error('The maximum discount percentage must not exceed 100.');
  }
  return { max_discount_type: type, max_discount_value: roundMoney(value) };
}

export function getSpecialDiscountLimit(items, maximum) {
  const balance = getDiscountableBillBalance(items);
  if (typeof maximum === 'object' && maximum !== null) {
    const settings = normalizeSpecialDiscountSettings(maximum);
    return roundMoney(settings.max_discount_type === 'fixed'
      ? Math.min(balance, settings.max_discount_value)
      : balance * settings.max_discount_value / 100);
  }
  const percentage = validateSpecialDiscountSettings(maximum);
  return roundMoney(balance * percentage / 100);
}

export function splitDiscountAmount(amount, balances) {
  const total = roundMoney(Number(amount));
  const weights = balances.map((balance) => roundMoney(Math.max(0, Number(balance) || 0)));
  const available = roundMoney(weights.reduce((sum, balance) => sum + balance, 0));
  if (!Number.isFinite(total) || total < 0 || total > available) {
    throw new Error('The discount cannot exceed the unpaid bill balance.');
  }
  if (total === 0 || available === 0) return weights.map(() => 0);

  const allocations = weights.map(() => 0);
  let remaining = total;
  let remainingWeight = available;
  const eligible = weights.map((balance, index) => ({ balance, index })).filter(({ balance }) => balance > 0);
  eligible.forEach(({ balance, index }, position) => {
    const allocation = position === eligible.length - 1
      ? remaining
      : Math.min(balance, roundMoney(remaining * balance / remainingWeight));
    allocations[index] = roundMoney(allocation);
    remaining = roundMoney(remaining - allocations[index]);
    remainingWeight = roundMoney(remainingWeight - balance);
  });
  if (remaining > 0) {
    for (let index = 0; index < weights.length && remaining > 0; index += 1) {
      const availableForItem = roundMoney(weights[index] - allocations[index]);
      const addition = roundMoney(Math.min(availableForItem, remaining));
      allocations[index] = roundMoney(allocations[index] + addition);
      remaining = roundMoney(remaining - addition);
    }
  }
  if (remaining > 0) throw new Error('The discount could not be allocated to the unpaid bill balance.');
  return allocations;
}

export function applySpecialBillDiscount(items = [], amount, details = {}) {
  const normalizedAmount = roundMoney(Number(amount));
  const balanceBefore = getDiscountableBillBalance(items);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0 || normalizedAmount > balanceBefore) {
    throw new Error('The special discount must be positive and no greater than the unpaid bill balance.');
  }

  const balances = items.map(getItemUnpaidBalance);
  const allocations = splitDiscountAmount(normalizedAmount, balances);
  const discountedItems = items.map((item, index) => {
    const allocation = allocations[index];
    if (!allocation) return item;
    const currentPayable = getOrderItemPayableAmount(item);
    const payableAmount = roundMoney(Math.max(getOrderItemPaidAmount(item), currentPayable - allocation));
    const quantity = Number(item.quantity || 1);
    const price = roundMoney(payableAmount / quantity);
    return {
      ...item,
      price,
      unit_price: price,
      line_total: payableAmount,
      lineTotal: payableAmount,
      payableAmount,
      specialBillDiscountAmount: roundMoney(Number(item.specialBillDiscountAmount || 0) + allocation),
      specialBillDiscountType: details.discount_type || item.specialBillDiscountType || 'fixed',
      specialBillDiscountValue: Number(details.discount_value ?? item.specialBillDiscountValue ?? allocation),
    };
  });

  return {
    items: discountedItems,
    balanceBefore,
    balanceAfter: roundMoney(balanceBefore - normalizedAmount),
    discountAmount: normalizedAmount,
  };
}
