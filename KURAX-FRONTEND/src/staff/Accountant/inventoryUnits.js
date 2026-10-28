export const STATION_UNITS = Object.freeze({
  KITCHEN: Object.freeze(['kg', 'g', 'L', 'ml', 'pc', 'pack', 'btl', 'can', 'tin', 'bag', 'sachet', 'bunch', 'doz', 'portion', 'slice']),
  BAR: Object.freeze(['pc', 'btl', 'can', 'L', 'ml', 'kg', 'g', 'shot', 'glass', 'pour', 'pack', 'crate', 'carton']),
  BARISTA: Object.freeze(['kg', 'g', 'L', 'ml', 'pc', 'sachet', 'shot', 'cup', 'portion', 'btl', 'pack', 'box', 'tab']),
});

const ALIASES = Object.freeze({
  kilogram: 'kg', kilograms: 'kg', kgs: 'kg', gram: 'g', grams: 'g',
  litre: 'L', liter: 'L', litres: 'L', liters: 'L', l: 'L',
  millilitre: 'ml', milliliter: 'ml', millilitres: 'ml', milliliters: 'ml',
  piece: 'pc', pieces: 'pc', pcs: 'pc', packet: 'pack', packets: 'pack', packs: 'pack',
  bottle: 'btl', bottles: 'btl', cans: 'can', tins: 'tin', bags: 'bag', sachets: 'sachet',
  bunches: 'bunch', dozen: 'doz', dozens: 'doz', portions: 'portion', slices: 'slice',
  shots: 'shot', glasses: 'glass', pours: 'pour', crates: 'crate', cartons: 'carton',
  cups: 'cup', box: 'box', boxes: 'box', tablet: 'tab', tablets: 'tab', tabs: 'tab',
});

const PHYSICAL_FACTORS = Object.freeze({ kg: 1000, g: 1, L: 1000, ml: 1 });

export function normalizeInventoryUnit(unit) {
  const value = String(unit ?? '').trim().toLowerCase();
  return ALIASES[value] || (value === 'l' ? 'L' : value);
}

export function inventoryUnitsForStation(station) {
  const key = String(station || '').trim().toUpperCase();
  return STATION_UNITS[key] || [];
}

export function defaultPurchaseConversionFactor(stockUnit, purchaseUnit) {
  const stock = normalizeInventoryUnit(stockUnit);
  const purchase = normalizeInventoryUnit(purchaseUnit);
  if (stock === purchase) return 1;
  if (PHYSICAL_FACTORS[stock] && PHYSICAL_FACTORS[purchase]) return PHYSICAL_FACTORS[purchase] / PHYSICAL_FACTORS[stock];
  return '';
}

export function recipeUnitConversionFactor(fromUnit, toUnit, item = {}) {
  const from = normalizeInventoryUnit(fromUnit);
  const to = normalizeInventoryUnit(toUnit);
  if (from === to) return 1;
  const fromFamily = PHYSICAL_FACTORS[from] ? (from === 'kg' || from === 'g' ? 'mass' : 'volume') : '';
  const toFamily = PHYSICAL_FACTORS[to] ? (to === 'kg' || to === 'g' ? 'mass' : 'volume') : '';
  if (fromFamily && fromFamily === toFamily) return PHYSICAL_FACTORS[from] / PHYSICAL_FACTORS[to];
  if ((fromFamily === 'mass' && toFamily === 'volume') || (fromFamily === 'volume' && toFamily === 'mass')) {
    throw new Error(`Incompatible inventory units: ${fromUnit} to ${toUnit}`);
  }
  const stock = normalizeInventoryUnit(item.unit || item.stock_unit);
  const purchase = normalizeInventoryUnit(item.purchase_unit);
  const factor = Number(item.purchase_conversion_factor);
  if (Number.isFinite(factor) && factor > 0 && from === purchase && to === stock) return factor;
  if (Number.isFinite(factor) && factor > 0 && from === stock && to === purchase) return 1 / factor;
  throw new Error(`Incompatible inventory units: ${fromUnit} to ${toUnit}`);
}

export function recipeUnitsForItem(item) {
  const stock = normalizeInventoryUnit(item?.unit || 'kg');
  const purchase = normalizeInventoryUnit(item?.purchase_unit);
  const options = [stock];
  if (PHYSICAL_FACTORS[stock]) {
    for (const unit of Object.keys(PHYSICAL_FACTORS)) {
      if (!options.includes(unit) && (stock === 'kg' || stock === 'g') === (unit === 'kg' || unit === 'g')) options.push(unit);
    }
  }
  if (purchase && Number(item?.purchase_conversion_factor) > 0 && !options.includes(purchase)) {
    options.push(purchase);
  }
  return options;
}
