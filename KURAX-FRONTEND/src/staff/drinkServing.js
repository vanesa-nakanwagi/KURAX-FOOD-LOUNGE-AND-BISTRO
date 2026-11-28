export const DRINK_SERVINGS = Object.freeze([
  Object.freeze({ name: 'Single Glass', volumeMl: 50 }),
  Object.freeze({ name: 'Double Glass', volumeMl: 100 }),
  Object.freeze({ name: 'Glass', volumeMl: 150 }),
]);

export function isEligibleDrink(item) {
  const category = String(item?.category || '').trim().toLowerCase();
  const station = String(item?.station || '').trim().toLowerCase();
  return category === 'drinks & cocktails' || ['barista', 'barman', 'bar'].includes(station);
}

function getServingBaseVolumeMl(item) {
  const parsedVolume = parseBottleVolumeMl(item);
  if (parsedVolume > 0) return parsedVolume;
  const linkedInventoryVolume = Number(item?.linked_inventory_bottle_volume_ml);
  if (Number.isFinite(linkedInventoryVolume) && linkedInventoryVolume > 0) return linkedInventoryVolume;
  const parsedInventoryVolume = parseBottleVolumeMl({ name: item?.linked_inventory_item_name });
  if (parsedInventoryVolume > 0) return parsedInventoryVolume;
  const configuredVolume = Number(item?.bottle_volume_ml);
  if (Number.isFinite(configuredVolume) && configuredVolume > 0) return configuredVolume;
  return 150;
}

export function parseBottleVolumeMl(item) {
  const text = String(item?.name || '');
  const litreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:l|lit(?:re|er)s?)\b/i);
  if (litreMatch) return Math.round(Number(litreMatch[1]) * 1000);
  const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) return Math.round(Number(mlMatch[1]));
  return 0;
}

export function getDrinkServingOptions(item) {
  if (item?.stock_available !== true && item?.stock_available !== 'true') return [];
  const bottleVolumeMl = getServingBaseVolumeMl(item);
  const fullServingName = bottleVolumeMl >= 500 ? 'Full Bottle' : 'Full Serving';
  return [
    ...DRINK_SERVINGS.filter((option) => option.volumeMl < bottleVolumeMl),
    { name: fullServingName, volumeMl: bottleVolumeMl },
  ];
}

export function applyDrinkServing(item, serving) {
  const bottleVolumeMl = getServingBaseVolumeMl(item);
  const bottlePrice = Number(item.list_price ?? item.price ?? 0);
  const effectiveBottlePrice = Number(item.price ?? bottlePrice);
  const quantity = Number(item.quantity || 1);
  const volumeMl = Number(serving?.volumeMl);
  if (!Number.isFinite(bottleVolumeMl) || bottleVolumeMl <= 0
    || !Number.isFinite(volumeMl) || volumeMl <= 0 || volumeMl > bottleVolumeMl
    || !Number.isFinite(bottlePrice) || !Number.isFinite(effectiveBottlePrice)) return item;
  const unitPrice = Math.round(((volumeMl / bottleVolumeMl) * effectiveBottlePrice + Number.EPSILON) * 100) / 100;
  const originalUnitPrice = Math.round(((volumeMl / bottleVolumeMl) * bottlePrice + Number.EPSILON) * 100) / 100;
  const lineTotal = Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100;
  return {
    ...item,
    price: unitPrice,
    unit_price: unitPrice,
    list_price: originalUnitPrice,
    originalUnitPrice,
    original_unit_price: originalUnitPrice,
    originalLineAmount: Math.round((originalUnitPrice * quantity + Number.EPSILON) * 100) / 100,
    quantity,
    line_total: lineTotal,
    lineTotal,
    payableAmount: lineTotal,
    original_product_id: item.id,
    inventory_item_id: Number(item.linked_inventory_item_id ?? item.inventory_item_id) || null,
    selected_serving_name: serving.name,
    serving_name: serving.name,
    serving_volume_ml: volumeMl,
    bottle_volume_ml: bottleVolumeMl,
    drink_serving: {
      name: serving.name,
      volume_ml: volumeMl,
      bottle_volume_ml: bottleVolumeMl,
      unit_selling_price: unitPrice,
      total_selling_amount: lineTotal,
      inventory_item_id: Number(item.linked_inventory_item_id ?? item.inventory_item_id) || null,
    },
  };
}
