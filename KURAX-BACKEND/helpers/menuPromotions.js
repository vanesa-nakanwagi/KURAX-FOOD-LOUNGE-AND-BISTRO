const MONEY_PRECISION = 100;

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * MONEY_PRECISION) / MONEY_PRECISION;
}

function isEnabled(value) {
  return value === true || value === 'true';
}

function getPromotionValue(menu = {}) {
  return Number(menu.promotion_discount_value ?? menu.promotion_discount_percent ?? 0);
}

export function isPromotionActive(menu, at = new Date()) {
  const value = getPromotionValue(menu);
  const enabled = menu.promotion_enabled === undefined
    ? Number(menu.promotion_discount_percent || 0) > 0
    : isEnabled(menu.promotion_enabled);
  const type = String(menu.promotion_discount_type || 'percentage').toLowerCase();
  if (!enabled || !Number.isFinite(value) || value <= 0) return false;
  if (!['percentage', 'fixed'].includes(type) || (type === 'percentage' && value > 100)) return false;

  const start = menu.promotion_starts_at ? new Date(menu.promotion_starts_at) : null;
  const end = menu.promotion_ends_at ? new Date(menu.promotion_ends_at) : null;
  const timestamp = new Date(at).getTime();
  return (!start || (Number.isFinite(start.getTime()) && start.getTime() <= timestamp))
    && (!end || (Number.isFinite(end.getTime()) && end.getTime() >= timestamp));
}

export function parsePromotionSettings(body = {}, current = {}) {
  const type = String(
    body.promotion_discount_type ?? current.promotion_discount_type ?? 'percentage'
  ).trim().toLowerCase();
  if (!['percentage', 'fixed'].includes(type)) {
    return { error: 'Promotion discount type must be percentage or fixed.' };
  }

  const rawValue = body.promotion_discount_value
    ?? body.promotion_discount_percent
    ?? current.promotion_discount_value
    ?? current.promotion_discount_percent
    ?? 0;
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    return { error: 'Promotion discount must be a non-negative amount.' };
  }
  if (type === 'percentage' && value > 100) {
    return { error: 'Promotion discount must not exceed 100 percent.' };
  }

  const rawEnabled = body.promotion_enabled ?? current.promotion_enabled;
  const enabled = rawEnabled === undefined ? value > 0 : isEnabled(rawEnabled);
  const price = Number(body.price ?? current.price);
  if (enabled && type === 'fixed' && Number.isFinite(price) && value > price) {
    return { error: 'A fixed promotion discount cannot exceed the menu item price.' };
  }

  const startsAt = String(body.promotion_starts_at ?? current.promotion_starts_at ?? '').trim() || null;
  const endsAt = String(body.promotion_ends_at ?? current.promotion_ends_at ?? '').trim() || null;
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if ((startsAt && !Number.isFinite(start.getTime())) || (endsAt && !Number.isFinite(end.getTime()))) {
    return { error: 'Promotion start and end dates must be valid dates.' };
  }
  if ((startsAt && !endsAt) || (!startsAt && endsAt)) {
    return { error: 'Set both promotion start and end dates, or leave both blank.' };
  }
  if (start && end && start.getTime() > end.getTime()) {
    return { error: 'Promotion end date must be on or after the start date.' };
  }
  if (enabled && value <= 0) {
    return { error: 'Enter a positive discount value or disable the promotion.' };
  }
  if (enabled && (!start || !end)) {
    return { error: 'An enabled promotion requires both start and end dates.' };
  }

  return {
    promotion_enabled: enabled,
    promotion_discount_type: type,
    promotion_discount_value: value,
    promotion_discount_percent: type === 'percentage' ? value : 0,
    promotion_starts_at: startsAt,
    promotion_ends_at: endsAt,
  };
}

export function getEffectiveMenuPrice(menu, { at = new Date(), basePrice } = {}) {
  const listPrice = Number(basePrice ?? menu?.price);
  if (!Number.isFinite(listPrice) || listPrice < 0) return null;
  const active = isPromotionActive(menu || {}, at);
  const type = String(menu?.promotion_discount_type || 'percentage').toLowerCase();
  const value = getPromotionValue(menu || {});
  const discountAmount = active
    ? roundMoney(type === 'fixed' ? value : listPrice * value / 100)
    : 0;
  if (discountAmount > listPrice) return null;
  return {
    listPrice: roundMoney(listPrice),
    effectivePrice: roundMoney(listPrice - discountAmount),
    discountAmount,
    promotionActive: active,
    promotionDiscountPercent: active && type === 'percentage' ? value : 0,
    promotionDiscountType: active ? type : null,
    promotionDiscountValue: active ? value : 0,
  };
}

export function snapshotMenuPromotion(item, menu, at = new Date(), basePrice = menu?.price) {
  if (!item || typeof item !== 'object' || !menu) return item;
  const pricing = getEffectiveMenuPrice(menu, { at, basePrice });
  if (!pricing) return item;
  const quantity = Number(item.quantity || 1);
  if (!Number.isFinite(quantity) || quantity <= 0) return item;
  const originalLineAmount = roundMoney(pricing.listPrice * quantity);
  const payableAmount = roundMoney(pricing.effectivePrice * quantity);
  return {
    ...item,
    id: Number(menu.id || item.id),
    name: menu.name || item.name,
    category: menu.category || item.category || '',
    station: menu.station || item.station || 'Kitchen',
    price: pricing.effectivePrice,
    unit_price: pricing.effectivePrice,
    originalUnitPrice: pricing.listPrice,
    originalLineAmount,
    pricingSnapshot: true,
    line_total: payableAmount,
    lineTotal: payableAmount,
    payableAmount,
    menuDiscountAmount: pricing.discountAmount * quantity,
    menuPromotionPercent: pricing.promotionDiscountPercent,
    menuPromotionType: pricing.promotionDiscountType,
    menuPromotionValue: pricing.promotionDiscountValue,
    menuPromotionApplied: pricing.promotionActive,
  };
}

export function snapshotMenuPromotions(items, menus, at = new Date()) {
  const catalog = Array.isArray(menus) ? menus : [];
  return (Array.isArray(items) ? items : []).map((item) => {
    if (!item || typeof item !== 'object' || item.type === 'combo' || item.combo_id) return item;
    const menu = catalog.find((candidate) => (
      (item.id && Number(candidate.id) === Number(item.id))
      || (item.name && String(candidate.name || '').trim().toLowerCase()
        === String(item.name).trim().toLowerCase())
    ));
    return menu ? snapshotMenuPromotion(item, menu, at) : item;
  });
}

export function getOrderItemsTotal(items = []) {
  return roundMoney(items.reduce((total, item) => {
    if (!item || typeof item !== 'object') return total;
    if (item.voidProcessed === true || String(item.status || '').toUpperCase() === 'VOIDED') return total;
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.price ?? item.unit_price ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return total;
    return total + unitPrice * quantity;
  }, 0));
}
