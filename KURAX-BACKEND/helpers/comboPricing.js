function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeComboComponents(components = []) {
  return (Array.isArray(components) ? components : [])
    .map((component) => ({
      menu_item_id: Number(component.menu_item_id ?? component.menuId ?? component.id ?? 0),
      quantity: Number(component.quantity ?? 1),
      unit_price: toNumber(component.unit_price ?? component.price ?? 0),
      unit_cost: toNumber(component.unit_cost ?? component.cost ?? 0),
    }))
    .filter((component) => component.menu_item_id > 0);
}

export function validateComboPayload(payload = {}, menuItems = []) {
  const errors = [];
  const normalized = normalizeComboComponents(payload.components || []);
  const name = String(payload.name || '').trim();
  const price = toNumber(payload.price);

  if (!name) errors.push('Combo name is required.');
  if (!Number.isFinite(price) || price <= 0) errors.push('Combo package price must be greater than zero.');

  if (normalized.length < 2) {
    errors.push('A combo must contain at least 2 menu items.');
  }

  const validMenuIds = new Set((menuItems || []).map((menu) => Number(menu.id)).filter(Boolean));
  for (const [index, component] of normalized.entries()) {
    if (!Number.isFinite(component.quantity) || component.quantity <= 0) {
      errors.push(`Component ${index + 1} must have a positive quantity.`);
    }
    if (!validMenuIds.has(component.menu_item_id)) {
      errors.push(`Component ${index + 1} references an invalid menu item.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      name,
      price,
      components: normalized,
      regular_total: calculateComboBreakdown({ price, components: normalized }).regular_total,
    },
  };
}

export function calculateComboBreakdown({ price, components = [], componentCost = null }) {
  const packagePrice = toNumber(price);
  const normalizedComponents = normalizeComboComponents(components);
  const regularTotal = normalizedComponents.reduce((sum, component) => {
    const quantity = Number(component.quantity || 1);
    const unitPrice = Number(component.unit_price || 0);
    return sum + unitPrice * quantity;
  }, 0);

  const totalCost = componentCost != null
    ? toNumber(componentCost)
    : normalizedComponents.reduce((sum, component) => {
        const quantity = Number(component.quantity || 1);
        const unitCost = Number(component.unit_cost || component.unit_price || 0);
        return sum + unitCost * quantity;
      }, 0);

  const discountAmount = Math.max(0, regularTotal - packagePrice);
  const discountPercentage = regularTotal > 0 ? (discountAmount / regularTotal) * 100 : 0;
  const grossProfit = packagePrice - totalCost;
  const marginPercentage = packagePrice > 0 ? (grossProfit / packagePrice) * 100 : 0;

  return {
    package_price: packagePrice,
    regular_total: regularTotal,
    total_cost: totalCost,
    discount_amount: discountAmount,
    discount_percentage: discountPercentage,
    gross_profit: grossProfit,
    margin_percentage: marginPercentage,
    components: normalizedComponents,
  };
}
