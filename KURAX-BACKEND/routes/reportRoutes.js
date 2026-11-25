import express from 'express';
import pool from '../db.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import {
  orderItemGrossAmountSql,
  orderItemNetAmountSql,
  orderItemPayableAmountSql,
} from '../helpers/orderItemSalesAmounts.js';
import {
  buildMenuProfitabilityRow,
  buildMenuProfitabilitySummary,
  calculateRecipeUnitCost,
  normalizeMoney,
  buildProfitabilityAnalytics,
  mergeCogsRows,
} from '../helpers/menuProfitability.js';

const router = express.Router();
const FINANCIAL_REPORT_ROLES = new Set(['DIRECTOR', 'MANAGER', 'ACCOUNTANT']);
const DEFAULT_MENU_CATEGORIES = ['Fast Foods', 'Local Foods', 'Drinks & Cocktails'];

function normalizeString(value) {
  return String(value ?? '').trim();
}

function normalizeMenuName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
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
    cogs: (row) => Number(row.total_cogs ?? (Number(row.cogs || 0) + Number(row.direct_purchase_cost || 0))),
    gross_profit: (row) => Number(row.gross_profit || 0),
    gross_profit_margin: (row) => Number(row.gross_profit_margin || 0),
    selling_price: (row) => Number(row.selling_price || 0),
    contribution: (row) => Number(row.contribution || 0),
  };

  const sortKey = keyResolver[sortValue] || keyResolver.gross_profit;
  return [...rows].sort((left, right) => {
    if (left.has_cost_data === false && right.has_cost_data !== false) return 1;
    if (left.has_cost_data !== false && right.has_cost_data === false) return -1;
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
    SELECT MIN(NULLIF(BTRIM(item->>'name'), '')) AS menu_name,
           COALESCE(MIN(NULLIF(BTRIM(item->>'category'), '')), '') AS category,
           SUM(COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)) AS quantity_sold,
           SUM(${orderItemNetAmountSql('item')}) AS net_sales,
           SUM(${orderItemGrossAmountSql('item')}) AS gross_sales,
           SUM(
             GREATEST(
               0,
               ${orderItemGrossAmountSql('item')} - ${orderItemNetAmountSql('item')}
             )
           ) AS discounts,
           SUM(COALESCE(NULLIF(item->>'menuDiscountAmount', '')::numeric, 0)) AS menu_discounts,
           SUM(COALESCE(NULLIF(item->>'specialBillDiscountAmount', '')::numeric, 0)) AS special_discounts,
           BOOL_OR(EXISTS (
             SELECT 1
             FROM public.inventory_recipes ir
             LEFT JOIN public.menus recipe_menu ON recipe_menu.id = ir.menu_item_id
             WHERE ir.status = 'ACTIVE'
               AND (LOWER(REGEXP_REPLACE(BTRIM(ir.menu_name), '[[:space:]]+', ' ', 'g'))
                    = LOWER(REGEXP_REPLACE(BTRIM(item->>'name'), '[[:space:]]+', ' ', 'g'))
                 OR LOWER(REGEXP_REPLACE(BTRIM(recipe_menu.name), '[[:space:]]+', ' ', 'g'))
                    = LOWER(REGEXP_REPLACE(BTRIM(item->>'name'), '[[:space:]]+', ' ', 'g')))
           )) AS is_recipe_based
    FROM public.orders o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
    WHERE (
        COALESCE(item->>'_rowPaid', 'false') = 'true'
        OR (o.public_order_ref IS NOT NULL AND o.payment_confirmed = true)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o2
        WHERE o2.original_order_ids IS NOT NULL
          AND o2.original_order_ids::text LIKE '%' || o.id::text || '%'
      )
      AND COALESCE(item->>'voidProcessed', 'false') <> 'true'
      AND UPPER(COALESCE(item->>'status', '')) <> 'VOIDED'
      AND (
        COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at) AT TIME ZONE 'Africa/Kampala'
      )::date BETWEEN $1::date AND $2::date
      AND ($3::text = '' OR LOWER(COALESCE(item->>'category', '')) = LOWER($3))
      AND ($4::text = '' OR
           LOWER(REGEXP_REPLACE(BTRIM(COALESCE(item->>'name', '')), '[[:space:]]+', ' ', 'g'))
             = LOWER(REGEXP_REPLACE(BTRIM($4), '[[:space:]]+', ' ', 'g')))
      AND ($5::text = '' OR LOWER(COALESCE(item->>'name', '')) LIKE LOWER('%' || $5 || '%'))
    GROUP BY LOWER(REGEXP_REPLACE(BTRIM(COALESCE(item->>'name', '')), '[[:space:]]+', ' ', 'g'))
    ORDER BY MIN(item->>'name') ASC`;

  const result = await pool.query(query, [startDate, endDate, category, menuName, search]);
  return result.rows.map((row) => ({
    menu_name: row.menu_name || 'Unknown menu item',
    category: row.category || 'Uncategorized',
    quantity_sold: normalizeMoney(row.quantity_sold),
    gross_sales: normalizeMoney(row.gross_sales),
    discounts: normalizeMoney(row.discounts),
    menu_discounts: normalizeMoney(row.menu_discounts),
    special_discounts: normalizeMoney(row.special_discounts),
    net_sales: normalizeMoney(row.net_sales),
    selling_price: Number(row.quantity_sold || 0) > 0 ? normalizeMoney(row.gross_sales) / Number(row.quantity_sold || 1) : 0,
    is_recipe_based: row.is_recipe_based === true,
  }));
}

async function getCogsRows(startDate, endDate, menuName, category, salesRows = []) {
  const [recipeResult, recipeCostResult, directResult] = await Promise.all([
    pool.query(
    `SELECT COALESCE(ir.menu_name, m.name) AS menu_name,
            COALESCE(m.category, 'Uncategorized') AS category,
            SUM(ic.quantity * ii.unit_cost) AS cogs,
            SUM(ic.quantity) AS consumed_quantity,
            BOOL_AND(COALESCE(ii.unit_cost > 0, false)) AS has_cogs_data,
            true AS is_recipe_based
     FROM public.inventory_consumptions ic
     LEFT JOIN public.inventory_recipes ir ON ir.id = ic.recipe_id
     LEFT JOIN public.inventory_items ii ON ii.id = ic.item_id
     LEFT JOIN public.menus m ON LOWER(m.name) = LOWER(COALESCE(ir.menu_name, ''))
     WHERE ic.recipe_id IS NOT NULL
       AND ic.business_date BETWEEN $1::date AND $2::date
       AND ($3::text = '' OR
            LOWER(REGEXP_REPLACE(BTRIM(COALESCE(ir.menu_name, m.name)), '[[:space:]]+', ' ', 'g'))
              = LOWER(REGEXP_REPLACE(BTRIM($3), '[[:space:]]+', ' ', 'g')))
       AND ($4::text = '' OR LOWER(COALESCE(m.category, '')) = LOWER($4))
     GROUP BY COALESCE(ir.menu_name, m.name), COALESCE(m.category, 'Uncategorized')`,
      [startDate, endDate, menuName, category]
    ),
    pool.query(
      `SELECT COALESCE(NULLIF(BTRIM(ir.menu_name), ''), m.name) AS menu_name,
             m.name AS menu_item_name,
             COALESCE(m.category, 'Uncategorized') AS category,
             ir.id AS recipe_id,
             ri.id AS recipe_ingredient_id,
             ri.ingredient_item_id,
             ri.quantity AS recipe_quantity,
             ri.unit AS recipe_unit,
             ii.unit AS stock_unit,
             ii.purchase_unit,
             ii.purchase_conversion_factor,
             ii.unit_cost
       FROM public.inventory_recipes ir
       LEFT JOIN public.menus m
         ON m.id = ir.menu_item_id
         OR (ir.menu_item_id IS NULL
             AND LOWER(REGEXP_REPLACE(BTRIM(m.name), '[[:space:]]+', ' ', 'g'))
               = LOWER(REGEXP_REPLACE(BTRIM(ir.menu_name), '[[:space:]]+', ' ', 'g')))
       LEFT JOIN public.recipe_ingredients ri ON ri.recipe_id = ir.id
       LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
       WHERE ir.status = 'ACTIVE'
         AND ($1::text = '' OR
              LOWER(REGEXP_REPLACE(BTRIM(COALESCE(ir.menu_name, m.name)), '[[:space:]]+', ' ', 'g'))
                = LOWER(REGEXP_REPLACE(BTRIM($1), '[[:space:]]+', ' ', 'g'))
              OR LOWER(REGEXP_REPLACE(BTRIM(m.name), '[[:space:]]+', ' ', 'g'))
                = LOWER(REGEXP_REPLACE(BTRIM($1), '[[:space:]]+', ' ', 'g')))
       ORDER BY LOWER(COALESCE(ir.menu_name, m.name)), ir.version_number DESC, ir.created_at DESC, ri.id`,
      [menuName]
    ),
    pool.query(
      `WITH sold_lines AS (
         SELECT o.id AS order_id,
                (order_item.item_ordinal - 1)::integer AS item_index,
                item->>'name' AS menu_name,
                COALESCE(item->>'category', 'Uncategorized') AS category,
                COALESCE(NULLIF(item->>'quantity', '')::numeric, 1) AS quantity,
                CASE WHEN COALESCE(item->>'serving_volume_ml', '') ~ '^[0-9]+([.][0-9]+)?$'
                  THEN (item->>'serving_volume_ml')::numeric END AS serving_volume_ml,
                CASE WHEN COALESCE(item->>'bottle_volume_ml', '') ~ '^[0-9]+([.][0-9]+)?$'
                  THEN (item->>'bottle_volume_ml')::numeric END AS bottle_volume_ml,
                CASE WHEN COALESCE(item->>'inventory_item_id', '') ~ '^[0-9]+$'
                  THEN (item->>'inventory_item_id')::integer END AS inventory_item_id,
                COALESCE(
                  NULLIF(item->>'paid_at', '')::timestamptz,
                  o.paid_at,
                  o.created_at
                ) AS sold_at
         FROM public.orders o
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb))
           WITH ORDINALITY AS order_item(item, item_ordinal)
         WHERE (
             COALESCE(item->>'_rowPaid', 'false') = 'true'
             OR (o.public_order_ref IS NOT NULL AND o.payment_confirmed = true)
           )
           AND NOT EXISTS (
             SELECT 1 FROM public.orders o2
             WHERE o2.original_order_ids IS NOT NULL
               AND o2.original_order_ids::text LIKE '%' || o.id::text || '%'
           )
           AND COALESCE(item->>'voidProcessed', 'false') <> 'true'
           AND UPPER(COALESCE(item->>'status', '')) <> 'VOIDED'
           AND (
             COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at)
               AT TIME ZONE 'Africa/Kampala'
           )::date BETWEEN $1::date AND $2::date
           AND ($3::text = '' OR
                LOWER(REGEXP_REPLACE(BTRIM(COALESCE(item->>'name', '')), '[[:space:]]+', ' ', 'g'))
                  = LOWER(REGEXP_REPLACE(BTRIM($3), '[[:space:]]+', ' ', 'g')))
           AND ($4::text = '' OR LOWER(COALESCE(item->>'category', '')) = LOWER($4))
           AND NOT EXISTS (
             SELECT 1
             FROM public.inventory_recipes ir
             LEFT JOIN public.menus recipe_menu ON recipe_menu.id = ir.menu_item_id
             WHERE ir.status = 'ACTIVE'
               AND (LOWER(REGEXP_REPLACE(BTRIM(ir.menu_name), '[[:space:]]+', ' ', 'g'))
                    = LOWER(REGEXP_REPLACE(BTRIM(COALESCE(item->>'name', '')), '[[:space:]]+', ' ', 'g'))
                 OR LOWER(REGEXP_REPLACE(BTRIM(recipe_menu.name), '[[:space:]]+', ' ', 'g'))
                    = LOWER(REGEXP_REPLACE(BTRIM(COALESCE(item->>'name', '')), '[[:space:]]+', ' ', 'g')))
           )
           AND NOT EXISTS (
             SELECT 1
             FROM public.inventory_consumptions ic
             WHERE ic.order_id = o.id
               AND ic.recipe_id IS NOT NULL
               AND ic.order_item_id = o.id::text || ':' || (order_item.item_ordinal - 1)::text
           )
       )
       SELECT sold.menu_name,
              sold.category,
              0::numeric AS cogs,
              SUM(sold.quantity * serving_cost.unit_cost) FILTER (
                WHERE match.match_count = 1 AND serving_cost.unit_cost > 0
              ) / NULLIF(SUM(sold.quantity) FILTER (
                WHERE match.match_count = 1 AND serving_cost.unit_cost > 0
              ), 0) AS unit_purchase_cost,
              COALESCE(SUM(sold.quantity * serving_cost.unit_cost) FILTER (WHERE serving_cost.unit_cost > 0), 0)
                AS direct_purchase_cost,
              SUM(sold.quantity) AS consumed_quantity,
              BOOL_AND(COALESCE(match.match_count = 1 AND serving_cost.unit_cost > 0, false))
                AS has_purchase_cost,
              BOOL_OR(COALESCE(match.match_count = 1 AND serving_cost.unit_cost > 0, false))
                AS has_any_purchase_cost,
              false AS is_recipe_based
       FROM sold_lines sold
       JOIN LATERAL (
         SELECT MIN(ii.id) AS id, COUNT(*)::integer AS match_count
         FROM public.inventory_items ii
         WHERE (sold.inventory_item_id IS NOT NULL AND ii.id = sold.inventory_item_id)
            OR (sold.inventory_item_id IS NULL
              AND LOWER(REGEXP_REPLACE(BTRIM(ii.item_name), '[[:space:]]+', ' ', 'g'))
                = LOWER(REGEXP_REPLACE(BTRIM(sold.menu_name), '[[:space:]]+', ' ', 'g')))
       ) match ON true
       LEFT JOIN public.inventory_items stock ON stock.id = match.id AND match.match_count = 1
       LEFT JOIN LATERAL (
         SELECT COALESCE(
           (
             SELECT purchase_tx.unit_cost
             FROM public.inventory_transactions purchase_tx
             WHERE purchase_tx.item_id = stock.id
               AND purchase_tx.transaction_type = 'PURCHASE'
               AND purchase_tx.business_date <= (sold.sold_at AT TIME ZONE 'Africa/Kampala')::date
             ORDER BY purchase_tx.business_date DESC, purchase_tx.id DESC
             LIMIT 1
           ),
           CASE WHEN NOT EXISTS (
             SELECT 1 FROM public.inventory_transactions purchase_tx
             WHERE purchase_tx.item_id = stock.id AND purchase_tx.transaction_type = 'PURCHASE'
           ) THEN stock.unit_cost END
         ) AS unit_cost
       ) cost ON true
       LEFT JOIN LATERAL (
         SELECT SUM(inventory_tx.total_value) / NULLIF(sold.quantity, 0) AS actual_unit_cost
         FROM public.inventory_consumptions consumption
         JOIN public.inventory_transactions inventory_tx
           ON inventory_tx.reference_number = consumption.reference_number
          AND inventory_tx.transaction_type = 'CONSUMPTION'
         WHERE consumption.order_id = sold.order_id
           AND consumption.order_item_id = sold.order_id::text || ':' || sold.item_index::text
           AND consumption.item_id = stock.id
       ) recorded_consumption ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(
           NULLIF(recorded_consumption.actual_unit_cost, 0),
           CASE
             WHEN sold.serving_volume_ml > 0 AND sold.bottle_volume_ml > 0
               AND sold.serving_volume_ml <= sold.bottle_volume_ml
             THEN CASE LOWER(BTRIM(COALESCE(stock.unit, '')))
               WHEN 'btl' THEN cost.unit_cost * sold.serving_volume_ml / sold.bottle_volume_ml
               WHEN 'bottle' THEN cost.unit_cost * sold.serving_volume_ml / sold.bottle_volume_ml
               WHEN 'l' THEN cost.unit_cost * sold.serving_volume_ml / 1000
               WHEN 'ml' THEN cost.unit_cost * sold.serving_volume_ml
               ELSE NULL
             END
             ELSE cost.unit_cost
           END
         ) AS unit_cost
       ) serving_cost ON true
       WHERE ($3::text = '' OR
              LOWER(REGEXP_REPLACE(BTRIM(sold.menu_name), '[[:space:]]+', ' ', 'g'))
                = LOWER(REGEXP_REPLACE(BTRIM($3), '[[:space:]]+', ' ', 'g')))
         AND ($4::text = '' OR LOWER(sold.category) = LOWER($4))
       GROUP BY sold.menu_name, sold.category`,
      [startDate, endDate, menuName, category]
    ),
  ]);

  const rows = [...recipeResult.rows, ...directResult.rows].map((row) => ({
    menu_name: row.menu_name || 'Unknown menu item',
    category: row.category || 'Uncategorized',
    cogs: normalizeMoney(row.cogs),
    unit_purchase_cost: row.unit_purchase_cost === null || row.unit_purchase_cost === undefined
      ? null
      : normalizeMoney(row.unit_purchase_cost),
    direct_purchase_cost: normalizeMoney(row.direct_purchase_cost),
    consumed_quantity: normalizeMoney(row.consumed_quantity),
    has_cogs_data: row.is_recipe_based === true ? row.has_cogs_data !== false : true,
    has_purchase_cost: row.is_recipe_based === true ? null : row.has_purchase_cost === true,
    has_any_purchase_cost: row.is_recipe_based === true ? null : row.has_any_purchase_cost === true,
    is_recipe_based: row.is_recipe_based === true,
  }));
  const mergedRows = mergeCogsRows(rows);
  const recipeCosts = new Map();
  for (const row of recipeCostResult.rows) {
    for (const name of [row.menu_name, row.menu_item_name]) {
      const key = normalizeMenuName(name);
      if (!key) continue;

      let recipe = recipeCosts.get(key);
      if (!recipe) {
        recipe = { recipe_id: row.recipe_id, ingredients: [] };
        recipeCosts.set(key, recipe);
      }
      if (recipe.recipe_id === row.recipe_id && row.recipe_ingredient_id
        && !recipe.ingredients.some((ingredient) => ingredient.recipe_ingredient_id === row.recipe_ingredient_id)) {
        recipe.ingredients.push(row);
      }
    }
  }

  const costsByMenu = new Map(mergedRows.map((row) => [normalizeMenuName(row.menu_name), row]));
  for (const sale of salesRows) {
    if (sale.is_recipe_based !== true) continue;
    const key = normalizeMenuName(sale.menu_name);
    const existingCost = costsByMenu.get(key);
    if (existingCost?.is_recipe_based && Number(existingCost.consumed_quantity) > 0) continue;

    const recipe = recipeCosts.get(key);
    if (!recipe) continue;
    const expectedCost = calculateRecipeUnitCost(recipe.ingredients);
    const fallbackCost = {
      menu_name: sale.menu_name,
      category: sale.category || 'Uncategorized',
      cogs: expectedCost.unit_cost * normalizeMoney(sale.quantity_sold),
      consumed_quantity: normalizeMoney(sale.quantity_sold),
      direct_purchase_cost: 0,
      has_cogs_data: expectedCost.has_cogs_data,
      has_purchase_cost: null,
      has_any_purchase_cost: null,
      is_recipe_based: true,
    };

    if (existingCost) {
      Object.assign(existingCost, fallbackCost);
    } else {
      mergedRows.push(fallbackCost);
      costsByMenu.set(key, fallbackCost);
    }
  }

  return mergedRows;
}

function mergeMenuRows(salesRows, cogsRows) {
  const cogsMap = new Map();
  for (const row of cogsRows) {
    const key = normalizeMenuName(row.menu_name);
    cogsMap.set(key, {
      ...row,
      cogs: normalizeMoney(row.cogs),
      direct_purchase_cost: normalizeMoney(row.direct_purchase_cost),
    });
  }

  const rows = salesRows.map((sale) => {
    const key = normalizeMenuName(sale.menu_name);
    const cost = cogsMap.get(key) || { cogs: 0, category: sale.category };
    return buildMenuProfitabilityRow(sale, cost);
  });

  for (const row of cogsRows) {
    const key = normalizeMenuName(row.menu_name);
    if (rows.some((saleRow) => normalizeMenuName(saleRow.menu_name) === key)) continue;
    rows.push(buildMenuProfitabilityRow({
      menu_name: row.menu_name,
      category: row.category,
      quantity_sold: 0,
      selling_price: 0,
      gross_sales: 0,
      discounts: 0,
      menu_discounts: 0,
      special_discounts: 0,
      net_sales: 0,
      is_recipe_based: row.is_recipe_based,
    }, row));
    const unsoldRow = rows[rows.length - 1];
    if (unsoldRow.has_cost_data) unsoldRow.profitability_status = Number(unsoldRow.cogs) > 0 ? 'No sales' : 'Healthy';
  }

  return rows;
}

router.use(authenticateReportUser);

router.get('/discount-audit', async (req, res) => {
  if (!['ACCOUNTANT', 'DIRECTOR'].includes(String(req.reportActor?.role || '').toUpperCase())) {
    return res.status(403).json({ error: 'Only an Accountant or Director may view the discount audit.' });
  }
  const startDate = normalizeString(req.query.startDate);
  const endDate = normalizeString(req.query.endDate);
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime())
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return res.status(400).json({ error: 'Provide valid startDate and endDate values in YYYY-MM-DD format.' });
  }

  try {
    const [salesResult, specialResult, menuResult, voidResult] = await Promise.all([
      pool.query(
        `SELECT
           COALESCE(SUM(COALESCE(NULLIF(item->>'originalLineAmount', '')::numeric,
             COALESCE(NULLIF(item->>'originalUnitPrice', '')::numeric,
               NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric, 0)
               * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1))), 0) AS gross_sales,
           COALESCE(SUM(CASE WHEN COALESCE(item->>'voidProcessed', 'false') <> 'true'
                                  AND UPPER(COALESCE(item->>'status', '')) <> 'VOIDED'
             THEN COALESCE(NULLIF(item->>'menuDiscountAmount', '')::numeric, 0) ELSE 0 END), 0) AS menu_discounts,
           COALESCE(SUM(CASE WHEN COALESCE(item->>'voidProcessed', 'false') <> 'true'
                                  AND UPPER(COALESCE(item->>'status', '')) <> 'VOIDED'
             THEN COALESCE(NULLIF(item->>'specialBillDiscountAmount', '')::numeric, 0) ELSE 0 END), 0) AS special_discounts
         FROM public.orders o
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) order_items(item)
         WHERE (COALESCE(item->>'_rowPaid', 'false') = 'true'
                OR (o.public_order_ref IS NOT NULL AND o.payment_confirmed = true))
           AND NOT EXISTS (
             SELECT 1 FROM public.orders o2
             WHERE o2.original_order_ids IS NOT NULL
               AND o2.original_order_ids::text LIKE '%' || o.id::text || '%'
           )
           AND (COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at)
                 AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date`,
        [startDate, endDate]
      ),
      pool.query(
        `SELECT audit.id, audit.order_id, audit.queue_id, audit.discount_type,
                audit.discount_value, audit.original_bill_amount, audit.discount_amount,
                audit.final_payable_amount, audit.reason, audit.applied_by_name,
                audit.max_discount_type, audit.max_discount_value,
                audit.config_updated_by_name, audit.applied_at,
                o.table_name, o.staff_name
         FROM public.special_bill_discount_audit audit
         JOIN public.orders o ON o.id = audit.order_id
         WHERE (audit.applied_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
         ORDER BY audit.applied_at DESC, audit.id DESC`,
        [startDate, endDate]
      ),
      pool.query(
        `SELECT o.id AS order_id, o.table_name,
                item->>'name' AS menu_name,
                COALESCE(NULLIF(item->>'menuPromotionType', ''), 'percentage') AS discount_type,
                COALESCE(NULLIF(item->>'menuPromotionValue', '')::numeric,
                         NULLIF(item->>'menuPromotionPercent', '')::numeric, 0) AS discount_value,
                COALESCE(NULLIF(item->>'menuDiscountAmount', '')::numeric, 0) AS discount_amount,
                COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at) AS sold_at
         FROM public.orders o
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) order_items(item)
         WHERE COALESCE(NULLIF(item->>'menuDiscountAmount', '')::numeric, 0) > 0
           AND (COALESCE(item->>'_rowPaid', 'false') = 'true'
                OR (o.public_order_ref IS NOT NULL AND o.payment_confirmed = true))
           AND COALESCE(item->>'voidProcessed', 'false') <> 'true'
           AND UPPER(COALESCE(item->>'status', '')) <> 'VOIDED'
           AND (COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at)
                 AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
         ORDER BY sold_at DESC, o.id DESC`,
        [startDate, endDate]
      ),
      pool.query(
        `SELECT vr.id, vr.order_id, vr.item_name, vr.reason, vr.table_name,
                vr.waiter_name, vr.approved_by, vr.resolved_at,
                COALESCE((
                  SELECT SUM(COALESCE(NULLIF(line.item->>'originalLineAmount', '')::numeric,
                    COALESCE(NULLIF(line.item->>'originalUnitPrice', '')::numeric,
                      NULLIF(line.item->>'price', '')::numeric,
                      NULLIF(line.item->>'unit_price', '')::numeric, 0)
                    * COALESCE(NULLIF(line.item->>'quantity', '')::numeric, 1)))
                  FROM jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS line(item)
                  WHERE LOWER(COALESCE(line.item->>'name', '')) = LOWER(vr.item_name)
                    AND (COALESCE(line.item->>'voidProcessed', 'false') = 'true'
                      OR UPPER(COALESCE(line.item->>'status', '')) = 'VOIDED')
                ), 0) AS void_amount
         FROM public.void_requests vr
         LEFT JOIN public.orders o ON o.id = vr.order_id
         WHERE vr.status = 'Approved'
           AND (vr.resolved_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
         ORDER BY vr.resolved_at DESC, vr.id DESC`,
        [startDate, endDate]
      ),
    ]);

    const grossSales = normalizeMoney(salesResult.rows[0]?.gross_sales);
    const menuDiscounts = normalizeMoney(salesResult.rows[0]?.menu_discounts);
    const specialDiscounts = normalizeMoney(salesResult.rows[0]?.special_discounts);
    const voidAmount = normalizeMoney(voidResult.rows.reduce(
      (sum, row) => sum + normalizeMoney(row.void_amount), 0
    ));
    const netSales = normalizeMoney(Math.max(
      0,
      grossSales - menuDiscounts - specialDiscounts - voidAmount
    ));
    return res.json({
      startDate,
      endDate,
      summary: {
        gross_sales: grossSales,
        net_sales: netSales,
        menu_discounts: menuDiscounts,
        special_bill_discounts: specialDiscounts,
        approved_voids: voidAmount,
        total_discounts: normalizeMoney(menuDiscounts + specialDiscounts),
        cogs_and_profit_source: 'Menu profitability uses discounted net sales and inventory consumption COGS.',
      },
      menu_discounts: menuResult.rows,
      special_bill_discounts: specialResult.rows,
      approved_voids: voidResult.rows,
    });
  } catch (error) {
    console.error('Discount audit report error:', error);
    return res.status(500).json({ error: 'Unable to load the discount audit report.' });
  }
});

router.get('/complimentary-items', async (req, res) => {
  const startDate = normalizeString(req.query.startDate);
  const endDate = normalizeString(req.query.endDate);
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime())
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return res.status(400).json({ error: 'Provide valid startDate and endDate values in YYYY-MM-DD format.' });
  }

  try {
    const originalAmountSql = orderItemGrossAmountSql('item');
    const payableAmountSql = orderItemPayableAmountSql('item');
    const result = await pool.query(
      `WITH complimentary_lines AS (
         SELECT o.id AS order_id,
                o.table_name,
                COALESCE(item->>'name', item->>'menu_name', 'Unknown item') AS item_name,
                COALESCE(NULLIF(item->>'quantity', '')::numeric, 1) AS quantity,
                COALESCE(item->>'station', item->>'department', item->>'category', 'Other') AS department,
                ${originalAmountSql} AS original_amount,
                COALESCE(NULLIF(item->>'complimentaryWaivedAmount', '')::numeric, 0) AS waived_amount,
                ${payableAmountSql} AS payable_amount,
                COALESCE(NULLIF(item->>'paidAmount', '')::numeric,
                  CASE WHEN COALESCE(item->>'_rowPaid', 'false') = 'true'
                    THEN ${payableAmountSql}
                    ELSE 0
                  END
                ) AS paid_amount,
                COALESCE(NULLIF(item->>'complimentaryAt', '')::timestamptz, o.created_at) AS complimentary_at,
                COALESCE(NULLIF(item->>'complimentaryByName', ''), marker.name, 'Unknown staff') AS marked_by,
                COALESCE(NULLIF(item->>'complimentaryApprovedByName', ''), approver.name) AS approved_by,
                COALESCE(item->>'complimentaryReason', '') AS reason,
                o.created_at,
                o.public_order_ref,
                item->>'_rowPaid' AS row_paid,
                item->>'complimentaryBy' AS marked_by_id,
                (order_item.item_ordinal - 1)::integer AS item_index,
                o.id::text || ':' || (order_item.item_ordinal - 1)::text AS consumption_item_key
         FROM public.orders o
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb))
           WITH ORDINALITY AS order_item(item, item_ordinal)
         LEFT JOIN public.staff marker ON marker.id = NULLIF(item->>'complimentaryBy', '')::integer
         LEFT JOIN public.staff approver ON approver.id = NULLIF(item->>'complimentaryApprovedBy', '')::integer
         WHERE COALESCE(item->>'voidProcessed', 'false') <> 'true'
           AND UPPER(COALESCE(item->>'status', '')) <> 'VOIDED'
           AND COALESCE(jsonb_array_length(o.original_order_ids), 0) = 0
       )
       SELECT line.order_id,
              COALESCE(line.public_order_ref, 'Order #' || line.order_id::text) AS order_reference,
              COALESCE(line.table_name, 'WALK-IN') AS table_name,
              line.item_name,
              line.quantity,
              line.department,
              line.original_amount,
              line.waived_amount,
              line.payable_amount,
              line.paid_amount,
              GREATEST(0, line.payable_amount - line.paid_amount) AS outstanding_receivable,
              GREATEST(0, line.paid_amount - line.payable_amount) AS credit_balance,
              line.marked_by,
              line.marked_by_id,
              line.approved_by,
              line.reason,
              line.complimentary_at,
              ROUND(
                COALESCE(consumption.total_cost, 0)
                * CASE WHEN line.original_amount > 0 THEN line.waived_amount / line.original_amount ELSE 0 END,
                0
              ) AS complimentary_cost
       FROM complimentary_lines line
       LEFT JOIN LATERAL (
         SELECT SUM(COALESCE(transaction.total_value, consumption.quantity * inventory.unit_cost, 0)) AS total_cost
         FROM public.inventory_consumptions consumption
         LEFT JOIN public.inventory_transactions transaction
           ON transaction.reference_number = consumption.reference_number
          AND transaction.transaction_type = 'CONSUMPTION'
         LEFT JOIN public.inventory_items inventory ON inventory.id = consumption.item_id
         WHERE consumption.order_id = line.order_id
           AND consumption.order_item_id = line.consumption_item_key
           AND NOT EXISTS (
             SELECT 1 FROM public.inventory_transactions reversal
             WHERE reversal.reference_number = 'REV-' || consumption.reference_number
               AND reversal.transaction_type = 'REVERSAL'
           )
       ) consumption ON true
       WHERE line.waived_amount > 0
         AND (line.complimentary_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
       ORDER BY line.complimentary_at DESC, line.order_id DESC, line.item_index ASC`,
      [startDate, endDate]
    );
    const rows = result.rows.map((row) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      original_amount: normalizeMoney(row.original_amount),
      waived_amount: normalizeMoney(row.waived_amount),
      payable_amount: normalizeMoney(row.payable_amount),
      paid_amount: normalizeMoney(row.paid_amount),
      outstanding_receivable: normalizeMoney(row.outstanding_receivable),
      credit_balance: normalizeMoney(row.credit_balance),
      complimentary_cost: normalizeMoney(row.complimentary_cost),
    }));
    const totals = rows.reduce((summary, row) => {
      summary.items += 1;
      summary.quantity += row.quantity;
      summary.original_amount += row.original_amount;
      summary.waived_amount += row.waived_amount;
      summary.paid_amount += row.paid_amount;
      summary.outstanding_receivable += row.outstanding_receivable;
      summary.credit_balance += row.credit_balance;
      summary.complimentary_cost += row.complimentary_cost;
      return summary;
    }, {
      items: 0,
      quantity: 0,
      original_amount: 0,
      waived_amount: 0,
      paid_amount: 0,
      outstanding_receivable: 0,
      credit_balance: 0,
      complimentary_cost: 0,
    });
    for (const key of ['original_amount', 'waived_amount', 'paid_amount', 'outstanding_receivable', 'credit_balance', 'complimentary_cost']) {
      totals[key] = normalizeMoney(totals[key]);
    }
    return res.json({ startDate, endDate, totals, rows });
  } catch (error) {
    console.error('Complimentary items report error:', error);
    return res.status(500).json({ error: 'Unable to generate the complimentary items report.' });
  }
});

router.get('/profitability-analytics', async (req, res) => {
  try {
    const startDate = parseDate(req.query.startDate, '2025-01-01');
    const endDate = parseDate(req.query.endDate, new Date().toISOString().slice(0, 10));
    const category = normalizeString(req.query.category);
    const selectedCategory = category && category.toUpperCase() !== 'ALL' ? category : '';
    const department = normalizeString(req.query.department);
    const menuName = normalizeString(req.query.menuItem || req.query.menu_name || req.query.item);
    const search = normalizeString(req.query.search);
    const includeInactive = req.query.includeInactive !== 'false';

    if (startDate > endDate) {
      return res.status(400).json({ error: 'The start date must be before or equal to the end date.' });
    }

    const salesRows = await getSalesRows(startDate, endDate, selectedCategory, menuName, search);
    const cogsRows = await getCogsRows(startDate, endDate, menuName, selectedCategory, salesRows);
    const rows = mergeMenuRows(salesRows, cogsRows)
      .filter((row) => {
        if (search && !String(row.menu_name || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (selectedCategory && row.category !== selectedCategory) return false;
        if (department && String(row.category || '').toLowerCase() !== department.toLowerCase() && String(row.department || '').toLowerCase() !== department.toLowerCase()) return false;
        return true;
      })
      .map((row) => ({
        ...row,
        department: String(row.department || row.category || 'Uncategorized').trim() || 'Uncategorized',
        gross_profit_margin: Number.isFinite(row.gross_profit_margin) ? row.gross_profit_margin : null,
      }));

    const analytics = buildProfitabilityAnalytics(rows, { includeInactive });
    const departmentRankings = [...analytics.departmentRankings].sort((a, b) => b.gross_profit - a.gross_profit);
    const articleRows = [...analytics.rows].sort((a, b) => b.gross_profit - a.gross_profit);

    return res.json({
      startDate,
      endDate,
      summary: analytics.summary,
      rows: articleRows,
      departmentRankings,
      rankings: { ...analytics },
      filters: { category: selectedCategory, department, menuName, search, includeInactive },
      warnings: analytics.missing_cost_data.length ? `Missing costing data for ${analytics.missing_cost_data.length} item(s); excluded from profitability ranking until validated.` : '',
    });
  } catch (error) {
    console.error('Profitability analytics error:', error);
    return res.status(500).json({ error: error.message || 'Unable to generate the profitability analytics report.' });
  }
});

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
    const cogsRows = await getCogsRows(startDate, endDate, menuName, selectedCategory, salesRows);
    const rows = mergeMenuRows(salesRows, cogsRows)
      .filter((row) => {
        if (search && !String(row.menu_name || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (selectedCategory && row.category !== selectedCategory) return false;
        return true;
      })
      .map((row) => ({
        ...row,
        gross_profit_margin: Number.isFinite(row.gross_profit_margin) ? row.gross_profit_margin : null,
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
    const cogsRows = await getCogsRows('2000-01-01', new Date().toISOString().slice(0, 10), context.menu.name, '', itemSales);
    const profitabilityRow = mergeMenuRows(itemSales, cogsRows)
      .find((row) => String(row.menu_name || '').toLowerCase() === String(context.menu.name || '').toLowerCase())
      || buildMenuProfitabilityRow({
        menu_name: context.menu.name,
        category: context.menu.category,
        quantity_sold: 0,
        net_sales: 0,
        gross_sales: 0,
      }, {
        is_recipe_based: Boolean(context.recipe),
        has_cogs_data: false,
        has_purchase_cost: false,
      });

    res.json({
      menu: context.menu,
      recipe: context.recipe,
      ingredients: context.ingredients,
      sales: {
        quantity_sold: profitabilityRow.quantity_sold,
        gross_sales: profitabilityRow.gross_sales,
        discounts: profitabilityRow.discounts,
        net_sales: profitabilityRow.net_sales,
        unit_purchase_cost: profitabilityRow.unit_purchase_cost,
        direct_purchase_cost: profitabilityRow.direct_purchase_cost,
        cogs: profitabilityRow.cogs,
        total_cogs: profitabilityRow.total_cogs,
        gross_profit: profitabilityRow.gross_profit,
        gross_profit_margin: profitabilityRow.gross_profit_margin,
        other_direct_costs: 0,
        contribution: profitabilityRow.contribution,
        has_cost_data: profitabilityRow.has_cost_data,
        profitability_status: profitabilityRow.profitability_status,
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
