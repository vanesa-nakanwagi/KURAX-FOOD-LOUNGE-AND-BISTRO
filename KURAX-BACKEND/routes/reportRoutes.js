import express from 'express';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { buildMenuProfitabilitySummary, calculateGrossProfitMargin, normalizeMoney } from '../helpers/menuProfitability.js';

const router = express.Router();
const FINANCIAL_REPORT_ROLES = new Set(['DIRECTOR', 'MANAGER', 'ACCOUNTANT']);
const DEFAULT_MENU_CATEGORIES = ['Starters', 'Local Foods', 'Drinks & Cocktails'];

function normalizeString(value) {
  return String(value ?? '').trim();
}

function parseDate(value, fallback) {
  const text = normalizeString(value || fallback);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

async function authenticateReportUser(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (!token) return res.status(401).json({ error: 'Sign in to access financial reports.' });

  try {
    const session = readSessionToken(token);
    if (session.scope !== 'restaurant' || !session.id) {
      return res.status(401).json({ error: 'Invalid staff session.' });
    }

    const result = await pool.query(
      'SELECT id, name, role, is_active FROM public.staff WHERE id = $1',
      [session.id]
    );
    const actor = result.rows[0];
    if (!actor || actor.is_active === false || actor.role !== session.role) {
      return res.status(401).json({ error: 'Staff account is inactive or has changed.' });
    }
    if (!FINANCIAL_REPORT_ROLES.has(actor.role)) {
      return res.status(403).json({ error: 'You are not authorized to view financial reports.' });
    }

    req.reportActor = actor;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
}

function sortMenuRows(rows, sortBy = 'gross_profit', sortDir = 'desc') {
  const direction = String(sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  const sortValue = String(sortBy || 'gross_profit').toLowerCase();

  const keyResolver = {
    menu_name: (row) => String(row.menu_name || '').toLowerCase(),
    category: (row) => String(row.category || '').toLowerCase(),
    quantity_sold: (row) => Number(row.quantity_sold || 0),
    net_sales: (row) => Number(row.net_sales || 0),
    cogs: (row) => Number(row.cogs || 0),
    gross_profit: (row) => Number(row.gross_profit || 0),
    gross_profit_margin: (row) => Number(row.gross_profit_margin || 0),
    selling_price: (row) => Number(row.selling_price || 0),
    contribution: (row) => Number(row.contribution || 0),
  };

  const sortKey = keyResolver[sortValue] || keyResolver.gross_profit;
  return [...rows].sort((left, right) => {
    const leftValue = sortKey(left);
    const rightValue = sortKey(right);
    if (typeof leftValue === 'string' && typeof rightValue === 'string') {
      return leftValue.localeCompare(rightValue) * direction;
    }
    return (Number(leftValue) - Number(rightValue)) * direction;
  });
}

async function getSalesRows(startDate, endDate, category, menuName, search) {
  const query = `
    SELECT item->>'name' AS menu_name,
           COALESCE(item->>'category', '') AS category,
           SUM(COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)) AS quantity_sold,
           SUM(
             COALESCE(
               NULLIF(item->>'line_total', '')::numeric,
               NULLIF(item->>'lineTotal', '')::numeric,
               (
                 COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                 * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)
               )
             )
           ) AS net_sales,
           SUM(
             COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
             * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)
           ) AS gross_sales,
           SUM(
             GREATEST(
               0,
               (
                 COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                 * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)
               )
               - COALESCE(
                   NULLIF(item->>'line_total', '')::numeric,
                   NULLIF(item->>'lineTotal', '')::numeric,
                   (
                     COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                     * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)
                   )
                 )
             )
           ) AS discounts
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
    WHERE (
        COALESCE(item->>'_rowPaid', 'false') = 'true'
        OR (o.public_order_ref IS NOT NULL AND o.payment_confirmed = true)
      )
      AND COALESCE(item->>'voidProcessed', 'false') <> 'true'
      AND UPPER(COALESCE(item->>'status', '')) <> 'VOIDED'
      AND (
        COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at) AT TIME ZONE 'Africa/Kampala'
      )::date BETWEEN $1::date AND $2::date
      AND ($3::text = '' OR LOWER(COALESCE(item->>'category', '')) = LOWER($3))
      AND ($4::text = '' OR LOWER(COALESCE(item->>'name', '')) = LOWER($4))
      AND ($5::text = '' OR LOWER(COALESCE(item->>'name', '')) LIKE LOWER('%' || $5 || '%'))
    GROUP BY item->>'name', item->>'category'
    ORDER BY item->>'name' ASC`;

  const result = await pool.query(query, [startDate, endDate, category, menuName, search]);
  return result.rows.map((row) => ({
    menu_name: row.menu_name || 'Unknown menu item',
    category: row.category || 'Uncategorized',
    quantity_sold: normalizeMoney(row.quantity_sold),
    gross_sales: normalizeMoney(row.gross_sales),
    discounts: normalizeMoney(row.discounts),
    net_sales: normalizeMoney(row.net_sales),
    selling_price: Number(row.quantity_sold || 0) > 0 ? normalizeMoney(row.net_sales) / Number(row.quantity_sold || 1) : 0,
  }));
}

async function getCogsRows(startDate, endDate, menuName, category) {
  const result = await pool.query(
    `SELECT COALESCE(ir.menu_name, m.name) AS menu_name,
            COALESCE(m.category, 'Uncategorized') AS category,
            SUM(ic.quantity * ii.unit_cost) AS cogs,
            SUM(ic.quantity) AS consumed_quantity
     FROM public.inventory_consumptions ic
     LEFT JOIN public.inventory_recipes ir ON ir.id = ic.recipe_id
     LEFT JOIN public.inventory_items ii ON ii.id = ic.item_id
     LEFT JOIN public.menus m ON LOWER(m.name) = LOWER(COALESCE(ir.menu_name, ''))
     WHERE ic.business_date BETWEEN $1::date AND $2::date
       AND ($3::text = '' OR LOWER(COALESCE(ir.menu_name, m.name)) = LOWER($3))
       AND ($4::text = '' OR LOWER(COALESCE(m.category, '')) = LOWER($4))
     GROUP BY COALESCE(ir.menu_name, m.name), COALESCE(m.category, 'Uncategorized')`,
    [startDate, endDate, menuName, category]
  );

  return result.rows.map((row) => ({
    menu_name: row.menu_name || 'Unknown menu item',
    category: row.category || 'Uncategorized',
    cogs: normalizeMoney(row.cogs),
    consumed_quantity: normalizeMoney(row.consumed_quantity),
  }));
}

function mergeMenuRows(salesRows, cogsRows) {
  const cogsMap = new Map();
  for (const row of cogsRows) {
    const key = String(row.menu_name || '').trim().toLowerCase();
    cogsMap.set(key, { ...row, cogs: normalizeMoney(row.cogs) });
  }

  const rows = salesRows.map((sale) => {
    const key = String(sale.menu_name || '').trim().toLowerCase();
    const cost = cogsMap.get(key) || { cogs: 0, category: sale.category };
    const netSales = normalizeMoney(sale.net_sales);
    const cogs = normalizeMoney(cost.cogs);
    const grossProfit = netSales - cogs;
    const grossProfitMargin = calculateGrossProfitMargin(grossProfit, netSales);
    const contribution = grossProfit;
    return {
      menu_name: sale.menu_name,
      category: sale.category || cost.category || 'Uncategorized',
      quantity_sold: normalizeMoney(sale.quantity_sold),
      selling_price: normalizeMoney(sale.selling_price),
      gross_sales: normalizeMoney(sale.gross_sales),
      discounts: normalizeMoney(sale.discounts),
      net_sales: netSales,
      cogs,
      gross_profit: grossProfit,
      gross_profit_margin: grossProfitMargin,
      other_direct_costs: 0,
      contribution,
      profitability_status: grossProfit >= 0 ? 'Profitable' : 'At risk',
    };
  });

  for (const row of cogsRows) {
    const key = String(row.menu_name || '').trim().toLowerCase();
    if (rows.some((saleRow) => String(saleRow.menu_name || '').trim().toLowerCase() === key)) continue;
    const netSales = 0;
    const cogs = normalizeMoney(row.cogs);
    const grossProfit = -cogs;
    rows.push({
      menu_name: row.menu_name,
      category: row.category || 'Uncategorized',
      quantity_sold: 0,
      selling_price: 0,
      gross_sales: 0,
      discounts: 0,
      net_sales: 0,
      cogs,
      gross_profit: grossProfit,
      gross_profit_margin: 0,
      other_direct_costs: 0,
      contribution: grossProfit,
      profitability_status: cogs > 0 ? 'No sales' : 'Healthy',
    });
  }

  return rows;
}

router.use(authenticateReportUser);

router.get('/menu-profitability', async (req, res) => {
  try {
    const startDate = parseDate(req.query.startDate, '2025-01-01');
    const endDate = parseDate(req.query.endDate, new Date().toISOString().slice(0, 10));
    const category = normalizeString(req.query.category);
    const selectedCategory = category && category.toUpperCase() !== 'ALL' ? category : '';
    const menuName = normalizeString(req.query.menuItem || req.query.menu_name || req.query.item);
    const search = normalizeString(req.query.search);
    const sortBy = normalizeString(req.query.sortBy || 'gross_profit');
    const sortDir = normalizeString(req.query.sortDir || 'desc');

    if (startDate > endDate) {
      return res.status(400).json({ error: 'The start date must be before or equal to the end date.' });
    }

    const salesRows = await getSalesRows(startDate, endDate, selectedCategory, menuName, search);
    const cogsRows = await getCogsRows(startDate, endDate, menuName, selectedCategory);
    const rows = mergeMenuRows(salesRows, cogsRows)
      .filter((row) => {
        if (search && !String(row.menu_name || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (selectedCategory && row.category !== selectedCategory) return false;
        return true;
      })
      .map((row) => ({
        ...row,
        gross_profit_margin: Number.isFinite(row.gross_profit_margin) ? row.gross_profit_margin : 0,
      }));

    const summary = buildMenuProfitabilitySummary(rows);
    const categories = [...new Set([...DEFAULT_MENU_CATEGORIES, ...rows.map((row) => row.category).filter(Boolean)])].sort();
    const sortedRows = sortMenuRows(rows, sortBy, sortDir);

    return res.json({
      startDate,
      endDate,
      summary,
      rows: sortedRows,
      categories,
      filters: { category: selectedCategory, menuName, search, sortBy, sortDir },
    });
  } catch (error) {
    console.error('Menu profitability error:', error);
    return res.status(500).json({ error: error.message || 'Unable to generate the menu profitability report.' });
  }
});

async function getMenuContext(menuItemId) {
  const menuResult = await pool.query(
    `SELECT id, name, category, price, station FROM public.menus WHERE id = $1 LIMIT 1`,
    [Number(menuItemId)]
  );
  const menu = menuResult.rows[0];
  if (!menu) return null;

  const recipeResult = await pool.query(
    `SELECT * FROM public.inventory_recipes
     WHERE (menu_item_id = $1 OR (menu_item_id IS NULL AND LOWER(menu_name) = LOWER($2)))
     ORDER BY version_number DESC, created_at DESC
     LIMIT 1`,
    [Number(menuItemId), String(menu.name)]
  );
  const recipe = recipeResult.rows[0] || null;

  const ingredientsResult = recipe
    ? await pool.query(
        `SELECT ri.*, ii.item_name AS ingredient_name, ii.unit AS stock_unit, ii.unit_cost
         FROM public.recipe_ingredients ri
         LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
         WHERE ri.recipe_id = $1 ORDER BY ri.id`,
        [recipe.id]
      )
    : { rows: [] };

  return { menu, recipe, ingredients: ingredientsResult.rows };
}

router.get('/menu-profitability/:menuItemId', async (req, res) => {
  const { menuItemId } = req.params;
  try {
    const context = await getMenuContext(menuItemId);
    if (!context || !context.menu) return res.status(404).json({ error: 'Menu item not found.' });

    const salesRows = await getSalesRows('2000-01-01', new Date().toISOString().slice(0, 10), '', context.menu.name, '');
    const itemSales = salesRows.filter((row) => String(row.menu_name || '').toLowerCase() === String(context.menu.name || '').toLowerCase());
    const cogsRows = await getCogsRows('2000-01-01', new Date().toISOString().slice(0, 10), context.menu.name, '');
    const cogsRow = cogsRows.find((row) => String(row.menu_name || '').toLowerCase() === String(context.menu.name || '').toLowerCase()) || { cogs: 0 };

    const totalNetSales = itemSales.reduce((sum, row) => sum + Number(row.net_sales || 0), 0);
    const totalCogs = Number(cogsRow.cogs || 0);
    const grossProfit = totalNetSales - totalCogs;

    res.json({
      menu: context.menu,
      recipe: context.recipe,
      ingredients: context.ingredients,
      sales: {
        quantity_sold: itemSales.reduce((sum, row) => sum + Number(row.quantity_sold || 0), 0),
        gross_sales: itemSales.reduce((sum, row) => sum + Number(row.gross_sales || 0), 0),
        discounts: itemSales.reduce((sum, row) => sum + Number(row.discounts || 0), 0),
        net_sales: totalNetSales,
        cogs: totalCogs,
        gross_profit: grossProfit,
        gross_profit_margin: calculateGrossProfitMargin(grossProfit, totalNetSales),
        other_direct_costs: 0,
        contribution: grossProfit,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load the menu item profitability detail.' });
  }
});

router.get('/menu-profitability/:menuItemId/ingredients', async (req, res) => {
  try {
    const context = await getMenuContext(req.params.menuItemId);
    if (!context || !context.menu) return res.status(404).json({ error: 'Menu item not found.' });
    return res.json({ menu: context.menu, recipe: context.recipe, ingredients: context.ingredients });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load ingredient breakdown.' });
  }
});

router.get('/menu-profitability/:menuItemId/sales', async (req, res) => {
  try {
    const context = await getMenuContext(req.params.menuItemId);
    if (!context || !context.menu) return res.status(404).json({ error: 'Menu item not found.' });
    const startDate = parseDate(req.query.startDate, '2000-01-01');
    const endDate = parseDate(req.query.endDate, new Date().toISOString().slice(0, 10));
    const salesRows = await getSalesRows(startDate, endDate, '', context.menu.name, '');
    return res.json({ menu: context.menu, sales: salesRows.filter((row) => String(row.menu_name || '').toLowerCase() === String(context.menu.name || '').toLowerCase()) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load sales breakdown.' });
  }
});

router.get('/menu-profitability/:menuItemId/variance', async (req, res) => {
  try {
    const context = await getMenuContext(req.params.menuItemId);
    if (!context || !context.menu) return res.status(404).json({ error: 'Menu item not found.' });
    const startDate = parseDate(req.query.startDate, '2000-01-01');
    const endDate = parseDate(req.query.endDate, new Date().toISOString().slice(0, 10));
    const salesRows = await getSalesRows(startDate, endDate, '', context.menu.name, '');
    const quantitySold = salesRows.reduce((sum, row) => sum + Number(row.quantity_sold || 0), 0);
    const expectedUsage = (context.ingredients || []).reduce((sum, ingredient) => {
      const ingredientQuantity = Number(ingredient.quantity || 0);
      return sum + (ingredientQuantity * quantitySold);
    }, 0);
    const actualUsage = (await getCogsRows(startDate, endDate, context.menu.name, '')).reduce((sum, row) => sum + Number(row.cogs || 0), 0);
    return res.json({
      menu: context.menu,
      quantity_sold: quantitySold,
      expected_usage: expectedUsage,
      actual_usage: actualUsage,
      variance: actualUsage - expectedUsage,
      variance_warning: actualUsage !== expectedUsage ? 'Inventory variance detected; investigate before treating as theft.' : 'No material variance detected.',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to calculate the inventory variance.' });
  }
});

export default router;
