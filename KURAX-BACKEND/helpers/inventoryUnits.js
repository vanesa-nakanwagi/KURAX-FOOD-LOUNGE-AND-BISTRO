const STATION_UNITS = Object.freeze({
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
  packet: 'pack', packets: 'pack', packs: 'pack',
  bottle: 'btl', bottles: 'btl',
  cans: 'can', tins: 'tin', bags: 'bag', sachets: 'sachet',
  bunches: 'bunch', dozen: 'doz', dozens: 'doz',
  portions: 'portion', slices: 'slice', shots: 'shot',
  glasses: 'glass', pours: 'pour', crates: 'crate', cartons: 'carton',
  cups: 'cup', box: 'box', boxes: 'box', tablet: 'tab', tablets: 'tab', tabs: 'tab',
});

const UNIT_FAMILY = Object.freeze({ kg: 'mass', g: 'mass', L: 'volume', ml: 'volume' });
const BASE_FACTOR = Object.freeze({ kg: 1000, g: 1, L: 1000, ml: 1 });

export class UnitConversionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnitConversionError';
  }
}

export function normalizeInventoryUnit(unit) {
  const value = String(unit ?? '').trim().toLowerCase();
  if (!value) return '';
  return UNIT_ALIASES[value] || (value === 'l' ? 'L' : value);
}

export function normalizeInventoryStation(station) {
  const value = String(station || '').trim().toUpperCase();
  if (value === 'CHEF') return 'KITCHEN';
  if (value === 'BARMAN') return 'BAR';
  return Object.hasOwn(STATION_UNITS, value) ? value : '';
}

export function inventoryUnitsForStation(station) {
  return STATION_UNITS[normalizeInventoryStation(station)] || [];
}

export function isInventoryUnitForStation(unit, station) {
  return inventoryUnitsForStation(station).includes(normalizeInventoryUnit(unit));
}

function unitFamily(unit) {
  const normalized = normalizeInventoryUnit(unit);
  return UNIT_FAMILY[normalized] || (normalized ? `count:${normalized}` : '');
}

export function inventoryUnitConversionFactor(fromUnit, toUnit, item = {}) {
  const from = normalizeInventoryUnit(fromUnit);
  const to = normalizeInventoryUnit(toUnit);
  if (!from || !to) {
    throw new UnitConversionError(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
  }
  if (from === to) return 1;

  const fromFamily = unitFamily(from);
  const toFamily = unitFamily(to);
  if (fromFamily === toFamily && BASE_FACTOR[from] && BASE_FACTOR[to]) {
    return BASE_FACTOR[from] / BASE_FACTOR[to];
  }
  if ((fromFamily === 'mass' && toFamily === 'volume') || (fromFamily === 'volume' && toFamily === 'mass')) {
    throw new UnitConversionError(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
  }

  const stockUnit = normalizeInventoryUnit(item.unit || item.stock_unit);
  const purchaseUnit = normalizeInventoryUnit(item.purchase_unit);
  const factor = Number(item.purchase_conversion_factor);
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new UnitConversionError(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
  }
  if (from === purchaseUnit && to === stockUnit) return factor;
  if (from === stockUnit && to === purchaseUnit) return 1 / factor;
  throw new UnitConversionError(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
}

export function convertInventoryQuantity(quantity, fromUnit, toUnit, item = {}) {
  const value = Number(quantity);
  if (!Number.isFinite(value)) throw new UnitConversionError('Quantity must be a finite number.');
  return Number((value * inventoryUnitConversionFactor(fromUnit, toUnit, item)).toFixed(12));
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
      purchase_unit: item.purchase_unit || purchase,
    });

  if (!stock || !purchase || !Number.isFinite(factor) || factor <= 0) {
    throw new UnitConversionError('A valid positive purchase conversion factor is required.');
  }
  if (hasExplicitFactor && !/^(?:\d+(?:\.\d{1,6})?|\.\d{1,6})$/.test(String(explicitFactor).trim())) {
    throw new UnitConversionError('Purchase conversion factors support up to six decimal places.');
  }
  const stockFamily = unitFamily(stock);
  const purchaseFamily = unitFamily(purchase);
  if (!stockFamily || !purchaseFamily) {
    throw new UnitConversionError(`Unsupported inventory unit: ${!stockFamily ? stockUnit : purchaseUnit}`);
  }
  if ((stockFamily === 'mass' && purchaseFamily === 'volume') || (stockFamily === 'volume' && purchaseFamily === 'mass')) {
    throw new UnitConversionError(`Incompatible recipe and inventory units: ${purchase} to ${stock}`);
  }
  if (BASE_FACTOR[stock] && BASE_FACTOR[purchase]) {
    const expected = BASE_FACTOR[purchase] / BASE_FACTOR[stock];
    if (factor !== expected) throw new UnitConversionError(`The conversion from ${purchase} to ${stock} must be ${expected}.`);
  } else if (stock === purchase && factor !== 1) {
    throw new UnitConversionError(`The conversion from ${purchase} to ${stock} must be 1.`);
  }
  return factor;
}

export function isInventoryPurchaseUnitForStock(stockUnit, purchaseUnit, station) {
  const stock = normalizeInventoryUnit(stockUnit);
  const purchase = normalizeInventoryUnit(purchaseUnit);
  return isInventoryUnitForStation(stock, station) && isInventoryUnitForStation(purchase, station);
}
