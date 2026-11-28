export const DRINK_SERVINGS = Object.freeze([
  Object.freeze({ name: 'Single Glass', volumeMl: 50 }),
  Object.freeze({ name: 'Double Glass', volumeMl: 100 }),
  Object.freeze({ name: 'Glass', volumeMl: 150 }),
]);

export function isDrinkCategory(item = {}) {
  return String(item.category || '').trim().toLowerCase() === 'drinks & cocktails'
    || ['barista', 'barman', 'bar'].includes(String(item.station || '').trim().toLowerCase());
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function parseBottleVolumeMl(item = {}) {
  const text = String(item.name || '');
  const litreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:l|lit(?:re|er)s?)\b/i);
  if (litreMatch) return Math.round(Number(litreMatch[1]) * 1000);
  const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) return Math.round(Number(mlMatch[1]));
  return 0;
}

function getServingBaseVolumeMl(item, menu) {
  const parsedVolume = parseBottleVolumeMl(menu || item);
  if (parsedVolume > 0) return parsedVolume;
  const linkedInventoryVolume = Number(menu?.linked_inventory_bottle_volume_ml
    ?? item?.linked_inventory_bottle_volume_ml);
  if (Number.isFinite(linkedInventoryVolume) && linkedInventoryVolume > 0) return linkedInventoryVolume;
  const linkedInventoryName = menu?.linked_inventory_item_name ?? item?.linked_inventory_item_name;
  const parsedInventoryVolume = parseBottleVolumeMl({ name: linkedInventoryName });
  if (parsedInventoryVolume > 0) return parsedInventoryVolume;
  const configuredVolume = Number(menu?.bottle_volume_ml ?? item?.bottle_volume_ml);
  if (Number.isFinite(configuredVolume) && configuredVolume > 0) return configuredVolume;
  return 150;
}

export function snapshotDrinkServing(item, menu) {
  if (!item || typeof item !== 'object' || !isDrinkCategory(menu || item)) return item;

  const selected = item.drink_serving || {};
  const requestedName = String(selected.name || item.selected_serving_name || '').trim();
  const requestedVolume = Number(selected.volume_ml ?? item.serving_volume_ml);
  if (!requestedName && !Number.isFinite(requestedVolume)) return item;
  if (menu?.stock_available === false) {
    return { ...item, _invalidDrinkServing: 'This drink is out of stock.' };
  }
  const bottleVolumeMl = getServingBaseVolumeMl(item, menu);
  const inventoryItemId = Number(menu?.linked_inventory_item_id ?? menu?.inventory_item_id
    ?? item.linked_inventory_item_id ?? item.inventory_item_id);
  let servingName = requestedName;
  let servingVolumeMl = requestedVolume;

  if (!servingName || !Number.isFinite(servingVolumeMl) || servingVolumeMl <= 0) {
    return { ...item, _invalidDrinkServing: 'Select a serving size for this drink.' };
  }
  if (servingVolumeMl > bottleVolumeMl) return { ...item, _invalidDrinkServing: 'Serving volume cannot exceed bottle volume.' };

  const isFullBottle = servingVolumeMl === bottleVolumeMl;
  if (!isFullBottle && !DRINK_SERVINGS.some((option) => option.name === servingName && option.volumeMl === servingVolumeMl)) {
    return { ...item, _invalidDrinkServing: 'Invalid drink serving selection.' };
  }

  const bottlePrice = Number(item.price ?? menu?.price ?? item.list_price ?? 0);
  const originalBottlePrice = Number(item.originalUnitPrice ?? item.original_unit_price
    ?? item.list_price ?? menu?.price ?? item.price ?? 0);
  if (!Number.isFinite(bottlePrice) || bottlePrice < 0
    || !Number.isFinite(originalBottlePrice) || originalBottlePrice < 0) {
    return { ...item, _invalidDrinkServing: 'A valid bottle selling price is required.' };
  }
  if (isFullBottle) servingName = bottleVolumeMl >= 500 ? 'Full Bottle' : 'Full Serving';
  const unitPrice = roundMoney((servingVolumeMl / bottleVolumeMl) * bottlePrice);
  const originalUnitPrice = roundMoney((servingVolumeMl / bottleVolumeMl) * originalBottlePrice);
  const quantity = Number(item.quantity || 1);
  const totalAmount = roundMoney(unitPrice * quantity);
  const originalLineAmount = roundMoney(originalUnitPrice * quantity);

  return {
    ...item,
    price: unitPrice,
    unit_price: unitPrice,
    list_price: originalUnitPrice,
    originalUnitPrice,
    original_unit_price: originalUnitPrice,
    originalLineAmount,
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
    menuDiscountAmount: roundMoney((originalUnitPrice - unitPrice) * quantity),
    menuPromotionApplied: item.menuPromotionApplied === true && originalUnitPrice > unitPrice,
    total_selling_amount: totalAmount,
    total_inventory_consumption_ml: servingVolumeMl * quantity,
  };
}
