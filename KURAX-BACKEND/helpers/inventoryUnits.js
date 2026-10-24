const STATION_UNITS = Object.freeze({
  KITCHEN: Object.freeze(['kg', 'g', 'L', 'ml', 'pc', 'pack', 'btl', 'can', 'tin', 'bag', 'sachet', 'bunch', 'doz', 'portion', 'slice']),
  BAR: Object.freeze(['pc', 'btl', 'can', 'L', 'ml', 'kg', 'g', 'shot', 'glass', 'pour', 'pack', 'crate', 'carton']),
  BARISTA: Object.freeze(['kg', 'g', 'L', 'ml', 'pc', 'sachet', 'shot', 'cup', 'portion', 'btl', 'pack', 'box', 'tab']),
});

const UNIT_ALIASES = Object.freeze({
  kilogram: 'kg',
  kilograms: 'kg',
  kgs: 'kg',
  gram: 'g',
  grams: 'g',
  litre: 'L',
  liter: 'L',
  litres: 'L',
  liters: 'L',
  l: 'L',
  millilitre: 'ml',
  milliliter: 'ml',
  millilitres: 'ml',
  milliliters: 'ml',
  piece: 'pc',
  pieces: 'pc',
  pcs: 'pc',
  packet: 'pack',
  packets: 'pack',
  bottle: 'btl',
  bottles: 'btl',
  cans: 'can',
  tins: 'tin',
  bags: 'bag',
  sachets: 'sachet',
  bunches: 'bunch',
  portions: 'portion',
  slices: 'slice',
  shots: 'shot',
  glasses: 'glass',
  pours: 'pour',
  crates: 'crate',
  cartons: 'carton',
  cups: 'cup',
  packs: 'pack',
  boxes: 'box',
  dozen: 'doz',
  dozens: 'doz',
  tablet: 'tab',
  tablets: 'tab',
  tabs: 'tab',
});

const UNIT_FAMILY = Object.freeze({
  kg: 'mass',
  g: 'mass',
  L: 'volume',
  ml: 'volume',
});

const UNIT_BASE_FACTORS = Object.freeze({
  kg: 1000,
  g: 1,
  L: 1000,
  ml: 1,
});

const KNOWN_UNITS = new Set(Object.values(STATION_UNITS).flat());
const PACKAGING_UNITS = Object.freeze({
  KITCHEN: new Set(['pack', 'btl', 'can', 'tin', 'bag', 'sachet', 'bunch', 'doz']),
  BAR: new Set(['btl', 'can', 'pack', 'crate', 'carton']),
  BARISTA: new Set(['sachet', 'btl', 'pack', 'box', 'tab']),
});

export class UnitConversionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnitConversionError';
  }
}

export function normalizeInventoryUnit(unit) {
  const value = String(unit || '').trim().toLowerCase();
  if (!value) return '';
  const canonical = UNIT_ALIASES[value] || value;
  if (canonical === 'l') return 'L';
  return canonical;
}

export function inventoryUnitsForStation(station) {
  const key = String(station || '').trim().toUpperCase();
  return STATION_UNITS[key] || [];
}

export function isInventoryUnitForStation(unit, station) {
  return inventoryUnitsForStation(station).includes(normalizeInventoryUnit(unit));
}

export function isInventoryPurchaseUnitForStock(stockUnit, purchaseUnit, station) {
  const stock = normalizeInventoryUnit(stockUnit);
  const purchase = normalizeInventoryUnit(purchaseUnit);
  if (stock === purchase) return isInventoryUnitForStation(stock, station);

  const stationKey = String(station || '').trim().toUpperCase();
  const stockFamily = unitFamily(stock);
  const purchaseFamily = unitFamily(purchase);
  const samePhysicalFamily = stockFamily === purchaseFamily &&
    ['mass', 'volume'].includes(stockFamily);
  return isInventoryUnitForStation(purchase, station) &&
    (samePhysicalFamily || PACKAGING_UNITS[stationKey]?.has(purchase));
}

function unitFamily(unit) {
  const normalized = normalizeInventoryUnit(unit);
  return UNIT_FAMILY[normalized] || (KNOWN_UNITS.has(normalized) ? normalized : '');
}

export function inventoryUnitConversionFactor(fromUnit, toUnit, item = {}) {
  const from = normalizeInventoryUnit(fromUnit);
  const to = normalizeInventoryUnit(toUnit);
  const fromFamily = unitFamily(from);
  const toFamily = unitFamily(to);

  if (!fromFamily || !toFamily) {
    throw new UnitConversionError(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
  }
  if (from === to) return 1;

  if (fromFamily === toFamily && UNIT_BASE_FACTORS[from] && UNIT_BASE_FACTORS[to]) {
    return UNIT_BASE_FACTORS[from] / UNIT_BASE_FACTORS[to];
  }

  const stockUnit = normalizeInventoryUnit(item.unit || item.stock_unit);
  const purchaseUnit = normalizeInventoryUnit(item.purchase_unit);
  const configuredFactor = Number(item.purchase_conversion_factor);
  if (!Number.isFinite(configuredFactor) || configuredFactor <= 0) {
    throw new UnitConversionError(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
  }
  if (from === purchaseUnit && to === stockUnit) return configuredFactor;
  if (from === stockUnit && to === purchaseUnit) return 1 / configuredFactor;

  throw new UnitConversionError(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
}

export function convertInventoryQuantity(quantity, fromUnit, toUnit, item = {}) {
  const value = Number(quantity);
  if (!Number.isFinite(value)) {
    throw new UnitConversionError('Quantity must be a finite number.');
  }
  return value * inventoryUnitConversionFactor(fromUnit, toUnit, item);
}

export function configuredPurchaseConversionFactor(stockUnit, purchaseUnit, explicitFactor, item = {}) {
  const stock = normalizeInventoryUnit(stockUnit);
  const purchase = normalizeInventoryUnit(purchaseUnit);
  const hasExplicitFactor = explicitFactor !== undefined && explicitFactor !== null && String(explicitFactor).trim() !== '';
  const factor = hasExplicitFactor
    ? Number(explicitFactor)
    : inventoryUnitConversionFactor(purchase, stock, {
      ...item,
      unit: stock,
      stock_unit: stock,
      purchase_unit: item.purchase_unit,
    });

  if (!stock || !purchase || !Number.isFinite(factor) || factor <= 0) {
    throw new UnitConversionError('A valid positive purchase conversion factor is required.');
  }
  if (hasExplicitFactor && !/^\d+(?:\.\d{1,6})?$/.test(String(explicitFactor).trim())) {
    throw new UnitConversionError('Purchase conversion factors support up to six decimal places.');
  }

  const stockFamily = unitFamily(stock);
  const purchaseFamily = unitFamily(purchase);
  if (!stockFamily || !purchaseFamily) {
    throw new UnitConversionError(`Unsupported inventory unit: ${!stockFamily ? stockUnit : purchaseUnit}`);
  }

  if (stock === purchase || (stockFamily === purchaseFamily && UNIT_BASE_FACTORS[stock] && UNIT_BASE_FACTORS[purchase])) {
    const expected = stock === purchase ? 1 : UNIT_BASE_FACTORS[purchase] / UNIT_BASE_FACTORS[stock];
    if (factor !== expected) {
      throw new UnitConversionError(`The conversion from ${purchase} to ${stock} must be ${expected}.`);
    }
  }

  return factor;
}
