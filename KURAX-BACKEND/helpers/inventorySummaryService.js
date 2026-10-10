export function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isMainInventoryItem(item = {}) {
  const station = String(item.station || item.department || '').trim().toUpperCase();
  const locationName = String(item.location_name || item.location || '').trim().toUpperCase();
  const itemName = String(item.item_name || '').trim().toUpperCase();
  const values = [station, locationName, itemName];
  return !values.some((value) => value.includes('SHISHA'));
}

export function normalizedDepartmentName(value = '') {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 'Main Store';
  if (raw.includes('KITCHEN')) return 'Kitchen';
  if (raw.includes('BARISTA')) return 'Barista';
  if (raw.includes('BAR') || raw.includes('BARMAN')) return 'Bar';
  if (raw.includes('STORE')) return 'Main Store';
  return 'Main Store';
}

export function departmentFromItem(item = {}) {
  const locationName = String(item.location_name || item.location || '').trim();
  const station = String(item.station || '').trim();
  const source = `${locationName} ${station}`.toUpperCase();
  if (source.includes('KITCHEN')) return 'Kitchen';
  if (source.includes('BARISTA')) return 'Barista';
  if (source.includes('BAR') || source.includes('BARMAN')) return 'Bar';
  return 'Main Store';
}

export function calculateClosingQuantity({
  openingQuantity = 0,
  purchasesReceived = 0,
  transfersIn = 0,
  transfersOut = 0,
  consumption = 0,
  waste = 0,
  adjustmentIn = 0,
  adjustmentOut = 0,
}) {
  return (
    toNumber(openingQuantity) +
    toNumber(purchasesReceived) +
    toNumber(transfersIn) -
    toNumber(transfersOut) -
    toNumber(consumption) -
    toNumber(waste) +
    toNumber(adjustmentIn) -
    toNumber(adjustmentOut)
  );
}

export function buildInventorySummary({
  items = [],
  transactions = [],
  purchases = [],
  waste = [],
  adjustments = [],
  businessDate = new Date().toISOString().slice(0, 10),
  department = 'ALL',
  generatedBy = 'Accountant',
  period = 'Daily',
  startDate = businessDate,
  endDate = businessDate,
}) {
  const mainItems = (Array.isArray(items) ? items : []).filter(isMainInventoryItem);

  const departmentBreakdown = {
    'Main Store': { itemCount: 0, openingInventoryValue: 0, purchasesReceived: 0, transfersIn: 0, transfersOut: 0, consumptionValue: 0, wasteValue: 0, adjustments: 0, closingInventoryValue: 0, lowStockItems: 0, outOfStockItems: 0 },
    Kitchen: { itemCount: 0, openingInventoryValue: 0, purchasesReceived: 0, transfersIn: 0, transfersOut: 0, consumptionValue: 0, wasteValue: 0, adjustments: 0, closingInventoryValue: 0, lowStockItems: 0, outOfStockItems: 0 },
    Bar: { itemCount: 0, openingInventoryValue: 0, purchasesReceived: 0, transfersIn: 0, transfersOut: 0, consumptionValue: 0, wasteValue: 0, adjustments: 0, closingInventoryValue: 0, lowStockItems: 0, outOfStockItems: 0 },
    Barista: { itemCount: 0, openingInventoryValue: 0, purchasesReceived: 0, transfersIn: 0, transfersOut: 0, consumptionValue: 0, wasteValue: 0, adjustments: 0, closingInventoryValue: 0, lowStockItems: 0, outOfStockItems: 0 },
  };

  const totals = {
    openingInventoryValue: 0,
    purchasesReceived: 0,
    transfersIn: 0,
    transfersOut: 0,
    consumptionValue: 0,
    wasteValue: 0,
    positiveAdjustments: 0,
    negativeAdjustments: 0,
    closingInventoryValue: 0,
    totalItems: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    negativeStockCount: 0,
  };

  const itemRows = mainItems.map((item) => {
    const departmentName = departmentFromItem(item);
    const currentQuantity = toNumber(item.current_quantity);
    const unitCost = toNumber(item.unit_cost);
    const itemValue = currentQuantity * unitCost;
    const departmentSummary = departmentBreakdown[departmentName] || departmentBreakdown['Main Store'];

    departmentSummary.itemCount += 1;
    departmentSummary.closingInventoryValue += itemValue;
    if (currentQuantity <= 0) departmentSummary.outOfStockItems += 1;
    if (currentQuantity <= toNumber(item.minimum_stock_level)) departmentSummary.lowStockItems += 1;
    if (currentQuantity < 0) departmentSummary.outOfStockItems += 0;

    totals.closingInventoryValue += itemValue;
    totals.totalItems += 1;
    if (currentQuantity <= 0) totals.outOfStockCount += 1;
    if (currentQuantity < 0) totals.negativeStockCount += 1;
    if (currentQuantity <= toNumber(item.minimum_stock_level)) totals.lowStockCount += 1;

    return {
      itemName: item.item_name || 'Unknown item',
      category: item.category || 'General',
      department: departmentName,
      storageLocation: item.location_name || departmentName,
      unit: item.unit || 'kg',
      openingQuantity: currentQuantity,
      openingValue: itemValue,
      purchasesReceived: 0,
      transfersIn: 0,
      transfersOut: 0,
      consumptionQuantity: 0,
      wasteQuantity: 0,
      adjustmentQuantity: 0,
      expectedClosingQuantity: currentQuantity,
      closingUnitCost: unitCost,
      closingInventoryValue: itemValue,
      stockStatus: currentQuantity <= 0 ? 'OUT OF STOCK' : currentQuantity <= toNumber(item.minimum_stock_level) ? 'LOW STOCK' : 'IN STOCK',
    };
  });

  const purchaseTotal = (Array.isArray(purchases) ? purchases : []).reduce((sum, row) => {
    const totalCost = toNumber(row.total_cost ?? row.total_amount ?? row.amount);
    const quantity = toNumber(row.quantity);
    const unitCost = toNumber(row.unit_cost);
    return sum + (totalCost || quantity * unitCost);
  }, 0);
  totals.purchasesReceived = purchaseTotal;

  const wasteTotal = (Array.isArray(waste) ? waste : []).reduce((sum, row) => {
    const amount = toNumber(row.total_value ?? row.amount ?? row.quantity * row.unit_cost);
    return sum + amount;
  }, 0);
  totals.wasteValue = wasteTotal;

  const adjustmentEntries = Array.isArray(adjustments) ? adjustments : [];
  const positiveAdjustments = adjustmentEntries
    .filter((row) => String(row.adjustment_type || row.type || '').toUpperCase() === 'ADJUSTMENT_IN')
    .reduce((sum, row) => sum + toNumber(row.total_value ?? row.amount ?? row.quantity * row.unit_cost), 0);
  const negativeAdjustments = adjustmentEntries
    .filter((row) => String(row.adjustment_type || row.type || '').toUpperCase() === 'ADJUSTMENT_OUT')
    .reduce((sum, row) => sum + toNumber(row.total_value ?? row.amount ?? row.quantity * row.unit_cost), 0);
  totals.positiveAdjustments = positiveAdjustments;
  totals.negativeAdjustments = negativeAdjustments;

  const movementTransactions = Array.isArray(transactions) ? transactions : [];
  for (const row of movementTransactions) {
    const type = String(row.transaction_type || '').toUpperCase();
    const value = toNumber(row.total_value ?? row.amount ?? row.quantity * row.unit_cost);
    const quantity = toNumber(row.quantity);
    const departmentName = departmentFromItem(row);
    const summary = departmentBreakdown[departmentName] || departmentBreakdown['Main Store'];

    if (type === 'TRANSFER_IN') {
      totals.transfersIn += value;
      summary.transfersIn += value;
    }
    if (type === 'TRANSFER_OUT') {
      totals.transfersOut += value;
      summary.transfersOut += value;
    }
    if (type === 'CONSUMPTION') {
      totals.consumptionValue += value;
      summary.consumptionValue += value;
    }
    if (type === 'WASTE') {
      totals.wasteValue += value;
      summary.wasteValue += value;
    }
    if (type === 'ADJUSTMENT_IN') {
      totals.positiveAdjustments += value;
      summary.adjustments += value;
    }
    if (type === 'ADJUSTMENT_OUT') {
      totals.negativeAdjustments += value;
      summary.adjustments -= value;
    }

    if (quantity > 0 && ['TRANSFER_IN', 'PURCHASE', 'ADJUSTMENT_IN'].includes(type)) {
      const itemMatch = itemRows.find((item) => item.itemName === (row.item_name || row.name));
      if (itemMatch) {
        itemMatch.purchasesReceived += type === 'PURCHASE' ? quantity : 0;
        itemMatch.transfersIn += type === 'TRANSFER_IN' ? quantity : 0;
        itemMatch.adjustmentQuantity += type === 'ADJUSTMENT_IN' ? quantity : 0;
      }
    }

    if (quantity > 0 && ['TRANSFER_OUT', 'CONSUMPTION', 'WASTE', 'ADJUSTMENT_OUT'].includes(type)) {
      const itemMatch = itemRows.find((item) => item.itemName === (row.item_name || row.name));
      if (itemMatch) {
        itemMatch.transfersOut += type === 'TRANSFER_OUT' ? quantity : 0;
        itemMatch.consumptionQuantity += type === 'CONSUMPTION' ? quantity : 0;
        itemMatch.wasteQuantity += type === 'WASTE' ? quantity : 0;
        itemMatch.adjustmentQuantity -= type === 'ADJUSTMENT_OUT' ? quantity : 0;
      }
    }
  }

  const filteredDepartment = String(department || 'ALL').trim().toUpperCase();
  const departmentLabel = filteredDepartment === 'ALL' ? 'All Main Departments' : normalizedDepartmentName(filteredDepartment);

  const alerts = mainItems
    .filter((item) => {
      const currentQuantity = toNumber(item.current_quantity);
      const minimumStockLevel = toNumber(item.minimum_stock_level);
      if (currentQuantity <= 0) return true;
      if (minimumStockLevel >= 0 && currentQuantity <= minimumStockLevel) return true;
      return currentQuantity < 0;
    })
    .map((item) => ({
      item: item.item_name || 'Unknown item',
      department: departmentFromItem(item),
      quantity: toNumber(item.current_quantity),
      minimumStockLevel: toNumber(item.minimum_stock_level),
      action: toNumber(item.current_quantity) <= 0 ? 'Restock immediately' : 'Review replenishment timing',
    }));

  const summary = {
    openingInventoryValue: totals.openingInventoryValue,
    purchasesReceived: totals.purchasesReceived,
    transfersIn: totals.transfersIn,
    transfersOut: totals.transfersOut,
    consumptionValue: totals.consumptionValue,
    wasteValue: totals.wasteValue,
    positiveAdjustments: totals.positiveAdjustments,
    negativeAdjustments: totals.negativeAdjustments,
    closingInventoryValue: totals.closingInventoryValue,
    totalItems: totals.totalItems,
    lowStockCount: totals.lowStockCount,
    outOfStockCount: totals.outOfStockCount,
    negativeStockCount: totals.negativeStockCount,
  };

  return {
    reportTitle: 'Inventory Summary Report',
    businessDate,
    startDate,
    endDate,
    department,
    departmentLabel,
    period,
    generatedBy,
    generatedAt: new Date().toISOString(),
    summary,
    totalItems: totals.totalItems,
    lowStockCount: totals.lowStockCount,
    outOfStockCount: totals.outOfStockCount,
    negativeStockCount: totals.negativeStockCount,
    closingInventoryValue: totals.closingInventoryValue,
    departmentBreakdown,
    itemRows,
    alerts,
  };
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function generateInventorySummaryPdf(report = {}) {
  const lines = [
    'Kurax Food Lounge & Bistro',
    'Inventory Summary Report',
    `Business date: ${report.businessDate || 'N/A'}`,
    `Reporting period: ${report.period || 'Daily'}`,
    `Department: ${report.departmentLabel || 'All Main Departments'}`,
    `Generated: ${report.generatedAt || new Date().toISOString()}`,
    `Generated by: ${report.generatedBy || 'Accountant'}`,
    `Currency: UGX`,
    `Closing inventory value: UGX ${toNumber(report.summary?.closingInventoryValue || 0).toLocaleString()}`,
    `Purchases received: UGX ${toNumber(report.summary?.purchasesReceived || 0).toLocaleString()}`,
    `Consumption value: UGX ${toNumber(report.summary?.consumptionValue || 0).toLocaleString()}`,
    `Waste value: UGX ${toNumber(report.summary?.wasteValue || 0).toLocaleString()}`,
  ];

  const contentLines = lines.map((line) => line.replace(/\r?\n/g, ' '));
  let stream = 'BT\n/F1 12 Tf\n50 780 Td\n';
  let y = 760;
  for (const line of contentLines) {
    stream += `BT /F1 12 Tf 50 ${y} Td (${escapePdfText(line)}) Tj ET\n`;
    y -= 18;
  }
  stream += 'ET\n';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`,
  ];

  const pdfParts = ['%PDF-1.4\n'];
  let currentOffset = pdfParts[0].length;
  const offsets = [0];

  objects.forEach((object, index) => {
    const objectLabel = `${index + 1} 0 obj\n${object}\nendobj\n`;
    offsets.push(currentOffset + pdfParts[0].length);
    pdfParts.push(objectLabel);
    currentOffset += objectLabel.length;
  });

  const xrefStart = currentOffset;
  const xref = ['xref\n0 6\n0000000000 65535 f \n'];
  for (let i = 1; i < offsets.length; i += 1) {
    xref.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pdfParts.push(`${xref.join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return Buffer.from(pdfParts.join(''), 'binary');
}
