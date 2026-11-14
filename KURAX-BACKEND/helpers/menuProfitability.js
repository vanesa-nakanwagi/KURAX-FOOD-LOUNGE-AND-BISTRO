import { inventoryUnitConversionFactor, UnitConversionError } from './inventoryUnits.js';

export function normalizeMoney(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMenuName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function calculateRecipeUnitCost(ingredients = []) {
  let unitCost = 0;
  let hasCogsData = ingredients.length > 0;

  for (const ingredient of ingredients) {
    const quantity = normalizeMoney(ingredient.recipe_quantity);
    const cost = normalizeMoney(ingredient.unit_cost);
    if (!ingredient.ingredient_item_id || !ingredient.stock_unit || quantity <= 0 || cost <= 0) {
      hasCogsData = false;
      continue;
    }

    try {
      unitCost += quantity
        * inventoryUnitConversionFactor(ingredient.recipe_unit, ingredient.stock_unit, ingredient)
        * cost;
    } catch (error) {
      if (!(error instanceof UnitConversionError)) throw error;
      hasCogsData = false;
    }
  }

  return { unit_cost: unitCost, has_cogs_data: hasCogsData };
}

export function calculateGrossProfitMargin(grossProfit, netSales) {
  const gross = normalizeMoney(grossProfit);
  const sales = normalizeMoney(netSales);
  if (sales <= 0) return 0;
  return (gross / sales) * 100;
}

export function mergeCogsRows(rows = []) {
  const merged = new Map();
  for (const row of rows) {
    const key = normalizeMenuName(row.menu_name);
    if (!key) continue;
    const existing = merged.get(key);
    if (existing) {
      const rowIsRecipeBased = row.is_recipe_based === true;
      if (rowIsRecipeBased && !existing.is_recipe_based) {
        existing.cogs = normalizeMoney(row.cogs);
        existing.consumed_quantity = normalizeMoney(row.consumed_quantity);
        existing.direct_purchase_cost = 0;
        existing.unit_purchase_cost = null;
        existing.has_cogs_data = row.has_cogs_data !== false;
        existing.has_purchase_cost = null;
        existing.has_any_purchase_cost = null;
        existing.is_recipe_based = true;
      } else if (rowIsRecipeBased === existing.is_recipe_based) {
        existing.cogs += normalizeMoney(row.cogs);
        existing.consumed_quantity += normalizeMoney(row.consumed_quantity);
        existing.direct_purchase_cost += normalizeMoney(row.direct_purchase_cost);
        existing.has_cogs_data = existing.has_cogs_data && row.has_cogs_data !== false;
        existing.has_purchase_cost = existing.has_purchase_cost && row.has_purchase_cost !== false;
        existing.has_any_purchase_cost = existing.has_any_purchase_cost || row.has_any_purchase_cost === true;
      }
    } else {
      merged.set(key, {
        ...row,
        cogs: normalizeMoney(row.cogs),
        consumed_quantity: normalizeMoney(row.consumed_quantity),
        direct_purchase_cost: normalizeMoney(row.direct_purchase_cost),
        has_cogs_data: row.has_cogs_data !== false,
        has_purchase_cost: row.has_purchase_cost !== false,
        has_any_purchase_cost: row.has_any_purchase_cost === true,
        is_recipe_based: row.is_recipe_based === true,
      });
    }
  }
  return [...merged.values()];
}

export function buildMenuProfitabilityRow(sale, cost = {}) {
  const isRecipeBased = sale.is_recipe_based === true || cost.is_recipe_based === true;
  const hasCostData = isRecipeBased
    ? cost.has_cogs_data === true
    : cost.has_purchase_cost === true;
  const netSales = normalizeMoney(sale.net_sales);
  const cogs = isRecipeBased ? normalizeMoney(cost.cogs) : 0;
  const directPurchaseCost = isRecipeBased ? 0 : normalizeMoney(cost.direct_purchase_cost);
  const grossProfit = hasCostData ? netSales - cogs - directPurchaseCost : null;
  const quantitySold = normalizeMoney(sale.quantity_sold);
  const grossSales = normalizeMoney(sale.gross_sales);
  const sellingPrice = quantitySold > 0 && sale.gross_sales !== null && sale.gross_sales !== undefined
    ? grossSales / quantitySold
    : normalizeMoney(sale.selling_price);

  return {
    menu_name: sale.menu_name,
    category: sale.category || cost.category || 'Uncategorized',
    quantity_sold: quantitySold,
    selling_price: sellingPrice,
    gross_sales: grossSales,
    discounts: normalizeMoney(sale.discounts),
    menu_discounts: normalizeMoney(sale.menu_discounts),
    special_discounts: normalizeMoney(sale.special_discounts),
    net_sales: netSales,
    unit_purchase_cost: isRecipeBased ? null : (
      cost.unit_purchase_cost === null || cost.unit_purchase_cost === undefined
        ? null
        : normalizeMoney(cost.unit_purchase_cost)
    ),
    direct_purchase_cost: directPurchaseCost,
    cogs,
    total_cogs: cogs + directPurchaseCost,
    gross_profit: grossProfit,
    gross_profit_margin: grossProfit === null ? null : calculateGrossProfitMargin(grossProfit, netSales),
    other_direct_costs: 0,
    contribution: grossProfit,
    is_recipe_based: isRecipeBased,
    has_cogs_data: isRecipeBased ? hasCostData : true,
    has_purchase_cost: isRecipeBased ? null : hasCostData,
    has_cost_data: hasCostData,
    profitability_status: !hasCostData
      ? isRecipeBased ? 'Cost review' : cost.has_any_purchase_cost ? 'Cost review' : 'Cost missing'
      : grossProfit >= 0 ? 'Profitable' : 'At risk',
  };
}

function pickRowLabel(row, fallback) {
  return String(row?.menu_name || row?.name || row?.department || fallback || 'Unknown').trim() || fallback || 'Unknown';
}

function buildRanking(entries, valueKey, labelKey = 'name', { top = true, allowZero = true } = {}) {
  if (!entries.length) {
    return { label: 'No data', value: 0, matches: [] };
  }

  const ranked = entries
    .filter((entry) => (allowZero || Number(entry[valueKey] || 0) !== 0))
    .map((entry) => ({
      ...entry,
      label: pickRowLabel(entry, 'Unknown'),
      value: normalizeMoney(entry[valueKey]),
    }))
    .sort((left, right) => Number(right.value) - Number(left.value));

  if (!ranked.length) {
    return { label: 'No data', value: 0, matches: [] };
  }

  const bestValue = ranked[0].value;
  const matches = ranked.filter((entry) => Math.abs(Number(entry.value) - Number(bestValue)) < 1e-9);
  return {
    label: matches.length > 1 ? matches.map((entry) => entry.label).join(', ') : matches[0]?.label || 'No data',
    value: bestValue,
    matches: matches.map((entry) => ({
      [labelKey]: entry.label,
      [valueKey]: entry.value,
    })),
    isTie: matches.length > 1,
    sortDirection: top ? 'highest' : 'lowest',
  };
}

export function buildMenuProfitabilitySummary(rows = []) {
  const normalizedRows = (rows || []).map((row) => ({
    menu_name: String(row.menu_name || row.name || 'Unknown menu item').trim() || 'Unknown menu item',
    category: String(row.category || 'Uncategorized').trim() || 'Uncategorized',
    quantity_sold: normalizeMoney(row.quantity_sold),
    gross_sales: normalizeMoney(row.gross_sales),
    menu_discounts: normalizeMoney(row.menu_discounts),
    special_discounts: normalizeMoney(row.special_discounts),
    net_sales: normalizeMoney(row.net_sales),
    cogs: normalizeMoney(row.cogs),
    direct_purchase_cost: normalizeMoney(row.direct_purchase_cost),
    other_direct_costs: normalizeMoney(row.other_direct_costs),
    has_cost_data: row.has_cost_data !== false,
    gross_profit: row.gross_profit === null || row.has_cost_data === false
      ? null
      : normalizeMoney(row.gross_profit ?? (
        row.net_sales - row.cogs - normalizeMoney(row.direct_purchase_cost)
      )),
  }));

  const totalNetSales = normalizedRows.reduce((sum, row) => sum + row.net_sales, 0);
  const totalGrossSales = normalizedRows.reduce((sum, row) => sum + row.gross_sales, 0);
  const totalMenuDiscounts = normalizedRows.reduce((sum, row) => sum + row.menu_discounts, 0);
  const totalSpecialDiscounts = normalizedRows.reduce((sum, row) => sum + row.special_discounts, 0);
  const totalCogs = normalizedRows.reduce((sum, row) => sum + row.cogs, 0);
  const totalDirectPurchaseCosts = normalizedRows.reduce((sum, row) => sum + row.direct_purchase_cost, 0);
  const costReviewCount = normalizedRows.filter((row) => !row.has_cost_data).length;
  const totalCost = costReviewCount ? null : totalCogs + totalDirectPurchaseCosts;
  const totalOtherDirectCosts = normalizedRows.reduce((sum, row) => sum + row.other_direct_costs, 0);
  const grossProfit = totalCost === null ? null : totalNetSales - totalCost;
  const contribution = grossProfit === null ? null : grossProfit - totalOtherDirectCosts;
  const totalQuantitySold = normalizedRows.reduce((sum, row) => sum + row.quantity_sold, 0);

  return {
    totalNetSales,
    totalGrossSales,
    totalMenuDiscounts,
    totalSpecialDiscounts,
    totalDiscounts: normalizedRows.reduce((sum, row) => sum + Math.max(0, row.gross_sales - row.net_sales), 0),
    totalCogs,
    totalDirectPurchaseCosts,
    totalCost,
    grossProfit,
    grossProfitMargin: grossProfit === null ? null : calculateGrossProfitMargin(grossProfit, totalNetSales),
    totalOtherDirectCosts,
    contribution,
    costReviewCount,
    totalQuantitySold,
    menuCount: normalizedRows.length,
  };
}

export function buildProfitabilityAnalytics(rows = [], options = {}) {
  const includeInactive = Boolean(options.includeInactive ?? true);
  const departmentField = options.departmentField || 'department';
  const itemField = options.itemField || 'menu_name';

  const normalizedRows = (rows || []).map((row) => {
    const netSales = normalizeMoney(row.net_sales ?? row.netSales ?? row.sales ?? 0);
    const cogs = normalizeMoney(row.cogs ?? row.cost_of_goods_sold ?? 0);
    const directPurchaseCost = normalizeMoney(row.direct_purchase_cost ?? row.directPurchaseCost ?? 0);
    const quantitySold = normalizeMoney(row.quantity_sold ?? row.quantitySold ?? 0);
    const hasCostData = row.has_cost_data !== false;
    const grossProfit = hasCostData
      ? normalizeMoney(row.gross_profit ?? row.grossProfit ?? (netSales - cogs - directPurchaseCost))
      : null;
    const grossProfitMargin = grossProfit === null
      ? null
      : normalizeMoney(row.gross_profit_margin ?? row.grossProfitMargin ?? calculateGrossProfitMargin(grossProfit, netSales));
    const departmentName = String(row[departmentField] || row.department || row.category || 'Uncategorized').trim() || 'Uncategorized';
    const itemName = String(row[itemField] || row.menu_name || row.name || 'Unknown menu item').trim() || 'Unknown menu item';
    return {
      ...row,
      department: departmentName,
      menu_name: itemName,
      item_name: itemName,
      quantity_sold: quantitySold,
      net_sales: netSales,
      cogs,
      direct_purchase_cost: directPurchaseCost,
      gross_profit: grossProfit,
      gross_profit_margin: grossProfitMargin,
      has_cost_data: hasCostData,
      is_active: row.is_active !== undefined ? Boolean(row.is_active) : true,
    };
  });

  const filteredRows = normalizedRows.filter((row) => includeInactive || row.is_active !== false);

  const byDepartment = filteredRows.reduce((acc, row) => {
    const key = row.department || 'Uncategorized';
    if (!acc[key]) {
      acc[key] = {
        department: key,
        net_sales: 0,
        cogs: 0,
        gross_profit: 0,
        quantity_sold: 0,
        item_count: 0,
        has_cost_data: true,
      };
    }
    acc[key].net_sales += row.net_sales;
    acc[key].cogs += row.cogs;
    if (row.has_cost_data) acc[key].gross_profit += row.gross_profit;
    else acc[key].has_cost_data = false;
    acc[key].quantity_sold += row.quantity_sold;
    acc[key].item_count += 1;
    return acc;
  }, {});

  const costCompleteRows = filteredRows.filter((row) => row.has_cost_data);
  const departmentEntries = Object.values(byDepartment).map((row) => ({
    ...row,
    gross_profit: row.has_cost_data ? row.gross_profit : null,
  }));
  const costCompleteDepartments = departmentEntries.filter((row) => row.has_cost_data);
  const mostProfitableDepartment = costCompleteDepartments.length
    ? [...costCompleteDepartments].sort((a, b) => b.gross_profit - a.gross_profit)[0]
    : { department: 'No data', gross_profit: 0 };
  const leastProfitableDepartment = costCompleteDepartments.length
    ? [...costCompleteDepartments].sort((a, b) => a.gross_profit - b.gross_profit)[0]
    : { department: 'No data', gross_profit: 0 };

  const mostProfitableItem = costCompleteRows.length
    ? [...costCompleteRows].sort((a, b) => b.gross_profit - a.gross_profit)[0]
    : { menu_name: 'No data', gross_profit: 0 };
  const leastProfitableItem = costCompleteRows.length
    ? [...costCompleteRows].sort((a, b) => a.gross_profit - b.gross_profit)[0]
    : { menu_name: 'No data', gross_profit: 0 };
  const mostSoldItem = filteredRows.length
    ? [...filteredRows].sort((a, b) => b.quantity_sold - a.quantity_sold)[0]
    : { menu_name: 'No data', quantity_sold: 0 };
  const leastSoldItem = filteredRows.length
    ? [...filteredRows].sort((a, b) => a.quantity_sold - b.quantity_sold)[0]
    : { menu_name: 'No data', quantity_sold: 0 };

  const missingCostRows = filteredRows.filter((row) => row.has_cost_data === false);

  return {
    summary: buildMenuProfitabilitySummary(filteredRows),
    departmentRankings: departmentEntries
      .map((row) => ({
        department: row.department,
        net_sales: row.net_sales,
        cogs: row.cogs,
        gross_profit: row.gross_profit,
        gross_profit_margin: row.has_cost_data
          ? calculateGrossProfitMargin(row.gross_profit, row.net_sales)
          : null,
        quantity_sold: row.quantity_sold,
        has_cost_data: row.has_cost_data,
      }))
      .sort((a, b) => {
        if (a.gross_profit === null && b.gross_profit === null) return 0;
        if (a.gross_profit === null) return 1;
        if (b.gross_profit === null) return -1;
        return b.gross_profit - a.gross_profit;
      }),
    most_profitable_department: {
      department: mostProfitableDepartment.department,
      gross_profit: normalizeMoney(mostProfitableDepartment.gross_profit),
    },
    least_profitable_department: {
      department: leastProfitableDepartment.department,
      gross_profit: normalizeMoney(leastProfitableDepartment.gross_profit),
    },
    most_profitable_item: {
      menu_name: mostProfitableItem.menu_name,
      gross_profit: normalizeMoney(mostProfitableItem.gross_profit),
      department: mostProfitableItem.department,
    },
    least_profitable_item: {
      menu_name: leastProfitableItem.menu_name,
      gross_profit: normalizeMoney(leastProfitableItem.gross_profit),
      department: leastProfitableItem.department,
    },
    most_sold_item: {
      menu_name: mostSoldItem.menu_name,
      quantity_sold: normalizeMoney(mostSoldItem.quantity_sold),
      department: mostSoldItem.department,
    },
    least_sold_item: {
      menu_name: leastSoldItem.menu_name,
      quantity_sold: normalizeMoney(leastSoldItem.quantity_sold),
      department: leastSoldItem.department,
    },
    missing_cost_data: missingCostRows.map((row) => ({
      menu_name: row.menu_name,
      department: row.department,
      net_sales: row.net_sales,
      cogs: row.cogs,
    })),
    includeInactive,
    rows: filteredRows.map((row) => ({
      menu_name: row.menu_name,
      department: row.department,
      quantity_sold: row.quantity_sold,
      net_sales: row.net_sales,
      unit_purchase_cost: row.unit_purchase_cost ?? null,
      direct_purchase_cost: row.direct_purchase_cost,
      cogs: row.cogs,
      gross_profit: row.gross_profit,
      gross_profit_margin: row.gross_profit_margin,
      contribution: row.gross_profit,
      has_cost_data: row.has_cost_data,
      is_recipe_based: row.is_recipe_based,
      profitability_status: row.has_cost_data
        ? row.gross_profit >= 0 ? 'Profitable' : 'At risk'
        : row.is_recipe_based ? 'Cost review' : 'Cost missing',
      is_active: row.is_active,
    })),
  };
}
