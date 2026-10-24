export const STATION_UNITS = Object.freeze({
  KITCHEN: Object.freeze(['kg', 'g', 'L', 'ml', 'pc', 'pack', 'btl', 'can', 'tin', 'bag', 'sachet', 'bunch', 'doz', 'portion', 'slice']),
  BAR: Object.freeze(['pc', 'btl', 'can', 'L', 'ml', 'kg', 'g', 'shot', 'glass', 'pour', 'pack', 'crate', 'carton']),
  BARISTA: Object.freeze(['kg', 'g', 'L', 'ml', 'pc', 'sachet', 'shot', 'cup', 'portion', 'btl', 'pack', 'box', 'tab']),
});

const UNIT_ALIASES = Object.freeze({
  kilogram: 'kg', kilograms: 'kg', kgs: 'kg',
  gram: 'g', grams: 'g',
  litre: 'L', liter: 'L', litres: 'L', liters: 'L', l: 'L',
  millilitre: 'ml', milliliter: 'ml', millilitres: 'ml', milliliters: 'ml',
  piece: 'pc', pieces: 'pc', pcs: 'pc',
  packet: 'pack', packets: 'pack',
  bottle: 'btl', bottles: 'btl',
  cans: 'can', tins: 'tin', bags: 'bag', sachets: 'sachet', bunches: 'bunch',
  portions: 'portion', slices: 'slice', shots: 'shot', glasses: 'glass',
  pours: 'pour', crates: 'crate', cartons: 'carton', cups: 'cup',
  packs: 'pack', boxes: 'box', tabs: 'tab',
  dozen: 'doz', dozens: 'doz',
  tablet: 'tab', tablets: 'tab',
});

const BASE_FACTORS = Object.freeze({ kg: 1000, g: 1, L: 1000, ml: 1 });
const PACKAGING_UNITS = Object.freeze({
  KITCHEN: ['pack', 'btl', 'can', 'tin', 'bag', 'sachet', 'bunch', 'doz'],
  BAR: ['btl', 'can', 'pack', 'crate', 'carton'],
  BARISTA: ['sachet', 'btl', 'pack', 'box', 'tab'],
});

export function normalizeInventoryUnit(unit) {
  const value = String(unit || '').trim().toLowerCase();
  if (!value) return '';
  const canonical = UNIT_ALIASES[value] || value;
  return canonical === 'l' ? 'L' : canonical;
}

export function purchaseUnitsForStation(station, stockUnit) {
  const stationKey = String(station || '').toUpperCase();
  const stock = normalizeInventoryUnit(stockUnit);
  const stockFamily = ['kg', 'g'].includes(stock) ? 'mass' : ['L', 'ml'].includes(stock) ? 'volume' : '';

  return (STATION_UNITS[stationKey] || []).filter((unit) => {
    const purchase = normalizeInventoryUnit(unit);
    const purchaseFamily = ['kg', 'g'].includes(purchase) ? 'mass' : ['L', 'ml'].includes(purchase) ? 'volume' : '';
    return purchase === stock ||
      (stockFamily && purchaseFamily === stockFamily) ||
      (PACKAGING_UNITS[stationKey] || []).includes(purchase);
  });
}

export function compatibleRecipeUnits(station, stockItem) {
  const allowed = STATION_UNITS[String(station || '').toUpperCase()] || [];
  const stockUnit = normalizeInventoryUnit(stockItem?.unit);
  const purchaseUnit = normalizeInventoryUnit(stockItem?.purchase_unit);
  const purchaseFactor = Number(stockItem?.purchase_conversion_factor);
  const stockFamily = ['kg', 'g'].includes(stockUnit) ? 'mass' : ['L', 'ml'].includes(stockUnit) ? 'volume' : stockUnit;

  return allowed.filter((unit) => {
    const candidate = normalizeInventoryUnit(unit);
    const candidateFamily = ['kg', 'g'].includes(candidate) ? 'mass' : ['L', 'ml'].includes(candidate) ? 'volume' : candidate;
    if (candidateFamily === stockFamily) return true;
    return candidate === purchaseUnit && Number.isFinite(purchaseFactor) && purchaseFactor > 0;
  });
}

export function defaultPurchaseConversionFactor(stockUnit, purchaseUnit) {
  const stock = normalizeInventoryUnit(stockUnit);
  const purchase = normalizeInventoryUnit(purchaseUnit);
  if (stock === purchase) return '1';
  const stockFamily = ['kg', 'g'].includes(stock) ? 'mass' : ['L', 'ml'].includes(stock) ? 'volume' : '';
  const purchaseFamily = ['kg', 'g'].includes(purchase) ? 'mass' : ['L', 'ml'].includes(purchase) ? 'volume' : '';
  if (stockFamily && stockFamily === purchaseFamily) {
    return String(BASE_FACTORS[purchase] / BASE_FACTORS[stock]);
  }
  return '';
}

export function convertInventoryQuantity(quantity, fromUnit, toUnit, item = {}) {
  const from = normalizeInventoryUnit(fromUnit);
  const to = normalizeInventoryUnit(toUnit);
  const stock = normalizeInventoryUnit(item.unit || item.stock_unit);
  const purchase = normalizeInventoryUnit(item.purchase_unit);
  const customFactor = Number(item.purchase_conversion_factor);

  if (from === to) return Number(quantity);
  const family = (unit) => ['kg', 'g'].includes(unit) ? 'mass' : ['L', 'ml'].includes(unit) ? 'volume' : unit;
  if (family(from) === family(to) && BASE_FACTORS[from] && BASE_FACTORS[to]) {
    return Number(quantity) * BASE_FACTORS[from] / BASE_FACTORS[to];
  }
  if (from === purchase && to === stock && Number.isFinite(customFactor) && customFactor > 0) {
    return Number(quantity) * customFactor;
  }
  if (from === stock && to === purchase && Number.isFinite(customFactor) && customFactor > 0) {
    return Number(quantity) / customFactor;
  }
  throw new Error(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
}
