export const DRINK_SERVINGS = Object.freeze([
  Object.freeze({ name: 'Single Glass', volumeMl: 50 }),
  Object.freeze({ name: 'Double Glass', volumeMl: 100 }),
]);

export function isEligibleDrink(item) {
  const category = String(item?.category || '').trim().toLowerCase();
  const station = String(item?.station || '').trim().toLowerCase();
  return category === 'drinks & cocktails' || ['barista', 'barman', 'bar'].includes(station);
}

export function parseBottleVolumeMl(item) {
  const text = `${item?.name || ''} ${item?.description || ''}`;
  if (/\bglass\b/i.test(text) && !/\bbottle\b/i.test(text)) return 0;
  const litreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:l|lit(?:re|er)s?)\b/i);
  if (litreMatch) return Math.round(Number(litreMatch[1]) * 1000);
  const mlMatch = text.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) return Math.round(Number(mlMatch[1]));
  return 0;
}

export function getDrinkServingOptions(item) {
  let bottleVolumeMl = Number(item?.bottle_volume_ml);
  if (!Number.isFinite(bottleVolumeMl) || bottleVolumeMl <= 0) {
    bottleVolumeMl = parseBottleVolumeMl(item);
  }
  if (!Number.isFinite(bottleVolumeMl) || bottleVolumeMl <= 0) return [];
  return [
    ...DRINK_SERVINGS.filter((option) => option.volumeMl < bottleVolumeMl),
    { name: 'Full Bottle', volumeMl: bottleVolumeMl },
  ];
}

export function applyDrinkServing(item, serving) {
  const configuredVolume = Number(item.bottle_volume_ml);
  const bottleVolumeMl = Number.isFinite(configuredVolume) && configuredVolume > 0
    ? configuredVolume
    : parseBottleVolumeMl(item);
  const bottlePrice = Number(item.list_price ?? item.price ?? 0);
  const quantity = Number(item.quantity || 1);
  const volumeMl = Number(serving?.volumeMl);
  if (!Number.isFinite(bottleVolumeMl) || bottleVolumeMl <= 0
    || !Number.isFinite(volumeMl) || volumeMl <= 0 || volumeMl > bottleVolumeMl) return item;
  const unitPrice = Math.round(((volumeMl / bottleVolumeMl) * bottlePrice + Number.EPSILON) * 100) / 100;
  return {
    ...item,
    price: unitPrice,
    unit_price: unitPrice,
    originalUnitPrice: unitPrice,
    original_unit_price: unitPrice,
    originalLineAmount: Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100,
    quantity,
    line_total: Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100,
    lineTotal: Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100,
    payableAmount: Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100,
    original_product_id: item.id,
    inventory_item_id: Number(item.inventory_item_id) || null,
    selected_serving_name: serving.name,
    serving_name: serving.name,
    serving_volume_ml: volumeMl,
    bottle_volume_ml: bottleVolumeMl,
    drink_serving: {
      name: serving.name,
      volume_ml: volumeMl,
      bottle_volume_ml: bottleVolumeMl,
      unit_selling_price: unitPrice,
      total_selling_amount: Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100,
      inventory_item_id: Number(item.inventory_item_id) || null,
    },
  };
}
