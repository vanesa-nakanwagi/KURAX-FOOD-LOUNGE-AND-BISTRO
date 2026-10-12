export function normalizeMoney(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateGrossProfitMargin(grossProfit, netSales) {
  const gross = normalizeMoney(grossProfit);
  const sales = normalizeMoney(netSales);
  if (sales <= 0) return 0;
  return (gross / sales) * 100;
}

export function buildMenuProfitabilitySummary(rows = []) {
  const normalizedRows = (rows || []).map((row) => ({
    menu_name: String(row.menu_name || row.name || 'Unknown menu item').trim() || 'Unknown menu item',
    category: String(row.category || 'Uncategorized').trim() || 'Uncategorized',
    quantity_sold: normalizeMoney(row.quantity_sold),
    net_sales: normalizeMoney(row.net_sales),
    cogs: normalizeMoney(row.cogs),
    other_direct_costs: normalizeMoney(row.other_direct_costs),
  }));

  const totalNetSales = normalizedRows.reduce((sum, row) => sum + row.net_sales, 0);
  const totalCogs = normalizedRows.reduce((sum, row) => sum + row.cogs, 0);
  const totalOtherDirectCosts = normalizedRows.reduce((sum, row) => sum + row.other_direct_costs, 0);
  const grossProfit = totalNetSales - totalCogs;
  const contribution = grossProfit - totalOtherDirectCosts;
  const totalQuantitySold = normalizedRows.reduce((sum, row) => sum + row.quantity_sold, 0);

  return {
    totalNetSales,
    totalCogs,
    grossProfit,
    grossProfitMargin: calculateGrossProfitMargin(grossProfit, totalNetSales),
    totalOtherDirectCosts,
    contribution,
    totalQuantitySold,
    menuCount: normalizedRows.length,
  };
}
