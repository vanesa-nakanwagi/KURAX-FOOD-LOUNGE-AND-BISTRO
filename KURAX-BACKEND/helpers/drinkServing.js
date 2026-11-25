export const DRINK_SERVINGS = Object.freeze([
  Object.freeze({ name: 'Single Glass', volumeMl: 50 }),
  Object.freeze({ name: 'Double Glass', volumeMl: 100 }),
]);

export function isDrinkCategory(item = {}) {
  return String(item.category || '').trim().toLowerCase() === 'drinks & cocktails'
    || ['barista', 'barman', 'bar'].includes(String(item.station || '').trim().toLowerCase());
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function parseBottleVolumeMl(item = {}) {
  const text = `${item.name || ''} ${item.description || ''}`;
  if (/\bglass\b/i.test(text) && !/\bbottle\b/i.test(text)) return 0;
  const litreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:l|lit(?:re|er)s?)\b/i);
  if (litreMatch) return Math.round(Number(litreMatch[1]) * 1000);
  const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) return Math.round(Number(mlMatch[1]));
  return 0;
}

export function snapshotDrinkServing(item, menu) {
  if (!item || typeof item !== 'object' || !isDrinkCategory(menu || item)) return item;

  let bottleVolumeMl = Number(menu?.bottle_volume_ml ?? item.bottle_volume_ml);
  if (!Number.isFinite(bottleVolumeMl) || bottleVolumeMl <= 0) {
    bottleVolumeMl = parseBottleVolumeMl(menu || item);
  }
  const inventoryItemId = Number(menu?.inventory_item_id ?? item.inventory_item_id);
  if (!Number.isFinite(bottleVolumeMl) || bottleVolumeMl <= 0) return item;

  const selected = item.drink_serving || {};
  const requestedName = String(selected.name || item.selected_serving_name || '').trim();
  const requestedVolume = Number(selected.volume_ml ?? item.serving_volume_ml);
  let servingName = requestedName;
  let servingVolumeMl = requestedVolume;

  if (!servingName || !Number.isFinite(servingVolumeMl) || servingVolumeMl <= 0) return item;
  if (servingVolumeMl > bottleVolumeMl) return { ...item, _invalidDrinkServing: 'Serving volume cannot exceed bottle volume.' };

  const isFullBottle = servingVolumeMl === bottleVolumeMl;
  if (!isFullBottle && !DRINK_SERVINGS.some((option) => option.name === servingName && option.volumeMl === servingVolumeMl)) {
    return { ...item, _invalidDrinkServing: 'Invalid drink serving selection.' };
  }

  const bottlePrice = Number(menu?.price ?? item.list_price ?? item.price ?? 0);
  if (!Number.isFinite(bottlePrice) || bottlePrice < 0) {
    return { ...item, _invalidDrinkServing: 'A valid bottle selling price is required.' };
  }
  if (isFullBottle) servingName = 'Full Bottle';
  const unitPrice = roundMoney((servingVolumeMl / bottleVolumeMl) * bottlePrice);
  const quantity = Number(item.quantity || 1);
  const totalAmount = roundMoney(unitPrice * quantity);

  return {
    ...item,
    price: unitPrice,
    unit_price: unitPrice,
    originalUnitPrice: unitPrice,
    original_unit_price: unitPrice,
    originalLineAmount: totalAmount,
    original_product_id: Number(menu?.id ?? item.id),
    inventory_item_id: Number.isInteger(inventoryItemId) && inventoryItemId > 0 ? inventoryItemId : null,
    selected_serving_name: servingName,
    serving_name: servingName,
    drink_serving: {
      name: servingName,
      volume_ml: servingVolumeMl,
      bottle_volume_ml: bottleVolumeMl,
      unit_selling_price: unitPrice,
      total_selling_amount: totalAmount,
      inventory_item_id: Number.isInteger(inventoryItemId) && inventoryItemId > 0 ? inventoryItemId : null,
    },
    serving_volume_ml: servingVolumeMl,
    bottle_volume_ml: bottleVolumeMl,
    line_total: totalAmount,
    lineTotal: totalAmount,
    payableAmount: totalAmount,
    menuDiscountAmount: 0,
    menuPromotionApplied: false,
    total_selling_amount: totalAmount,
    total_inventory_consumption_ml: servingVolumeMl * quantity,
  };
}
