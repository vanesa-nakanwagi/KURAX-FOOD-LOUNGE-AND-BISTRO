import pool from '../db.js';
import { createJournalEntry } from './accounting.js';
import {
  convertInventoryQuantity,
  inventoryUnitConversionFactor,
  normalizeInventoryUnit,
} from './inventoryUnits.js';

function normalizeUnit(unit = '') {
  return normalizeInventoryUnit(unit);
}

export function convertRecipeQuantity(quantity, fromUnit, toUnit, item = {}) {
  return convertInventoryQuantity(quantity, fromUnit, toUnit, item);
}

export function isSoldOrderItem(item = {}) {
  if (item.voidProcessed === true || String(item.status || '').toUpperCase() === 'VOIDED') return false;
  if (item.complimentary === true) return item.served === true;
  if (item._approvedCreditSale === true) return true;
  const isCredit = item.creditRequested === true || String(item.payment_method || '').toUpperCase().includes('CREDIT');
  return item._rowPaid === true && !isCredit;
}

export function getPreparedVoidQuantity(item = {}, completedQuantity = 0) {
  const quantity = Number(item.quantity || 1);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (item.served === true || item.readyForService === true) return quantity;
  const completed = Number(completedQuantity);
  return Number.isFinite(completed) ? Math.min(Math.max(completed, 0), quantity) : 0;
}

export function getUnpreparedQuantityRatio(itemQuantity, preparedQuantity) {
  const quantity = Number(itemQuantity);
  const prepared = Number(preparedQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(prepared)) return 0;
  return Math.max(0, 1 - Math.min(Math.max(prepared, 0), quantity) / quantity);
}

export function getOrderItemInventoryDisposition(item = {}) {
  if (item._approvedPreparedVoid === true && Number(item._wasteQuantity) > 0) return 'WASTE';
  return isSoldOrderItem(item) ? 'CONSUMPTION' : 'SKIP';
}

export function directStockQuantity(itemQuantity, item = {}, stock = {}) {
  const servingVolumeMl = Number(item.serving_volume_ml ?? item.drink_serving?.volume_ml);
  const bottleVolumeMl = Number(item.bottle_volume_ml ?? item.drink_serving?.bottle_volume_ml);
  if (Number.isFinite(servingVolumeMl) && servingVolumeMl > 0
    && Number.isFinite(bottleVolumeMl) && bottleVolumeMl > 0) {
    const quantity = Number(itemQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return 0;
    const totalMl = servingVolumeMl * quantity;
    const stockUnit = normalizeUnit(stock.unit);
    if (stockUnit === 'ml') return totalMl;
    if (stockUnit === 'L') return totalMl / 1000;
    if (stockUnit === 'btl') return totalMl / bottleVolumeMl;
    throw new UnitConversionError(`Serving volume cannot be converted to inventory unit ${stock.unit}.`);
  }
  const explicitUnit = item.inventory_unit || item.stock_unit || item.sale_unit;
  if (explicitUnit) {
    return convertInventoryQuantity(itemQuantity, explicitUnit, stock.unit, stock);
  }
  return Number(itemQuantity);
}

function stationForItem(item = {}) {
  const station = String(item.station || '').trim().toUpperCase();
  if (station === 'BARISTA' || station === 'BARMAN' || station === 'BAR' || station === 'KITCHEN') return station === 'BARMAN' ? 'BAR' : station;
  const category = String(item.category || '').toLowerCase();
  if (/barista|coffee|tea/.test(category)) return 'BARISTA';
  if (/barman|bar|cocktail|drink|beer/.test(category)) return 'BAR';
  return 'KITCHEN';
}

function businessDateInKampala() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })).toISOString().slice(0, 10);
}

async function recordInventoryReduction({
  client,
  orderId,
  orderItemIndex,
  itemKey,
  stock,
  quantity,
  lineCost,
  station,
  businessDate,
  createdBy,
  menuName,
  recipeId,
  recipeVersion,
  reference,
  asWaste,
  wasteReason,
}) {
  const unitCost = String(stock.unit_cost || 0);
  const unit = normalizeUnit(stock.unit);
  await client.query(
    `UPDATE public.inventory_items
     SET current_quantity = current_quantity - $1,
         inventory_value = (current_quantity - $1) * unit_cost,
         updated_at = NOW()
     WHERE id = $2`,
    [quantity, stock.id]
  );

  if (asWaste) {
    const voidReason = wasteReason || {};
    const notes = `Prepared void for order #${orderId}, item ${orderItemIndex + 1}; void request #${voidReason.requestId}.`;
    const waste = await client.query(
      `INSERT INTO public.inventory_waste
         (item_id, quantity, unit, station, reason, business_date, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [stock.id, quantity, unit, station, voidReason.reason || 'Prepared order item void', businessDate, createdBy, notes]
    );
    const wasteReference = `WASTE-ORDER-${orderId}-VOID-${voidReason.requestId}-ITEM-${orderItemIndex}-${reference}`;
    await client.query(
      `INSERT INTO public.inventory_transactions
         (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
          source_location_id, station, order_id, recipe_id, recipe_version, business_date, created_by, notes)
       VALUES ($1, $2, 'WASTE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        stock.id, wasteReference, quantity, unit, unitCost, lineCost, stock.location_id,
        station, orderId, recipeId, recipeVersion, businessDate, createdBy,
        `Approved prepared void; inventory_waste_id=${waste.rows[0].id}`,
      ]
    );
    if (Number(lineCost) > 0) {
      await createJournalEntry({
        queryable: client,
        entryDate: businessDate,
        description: `Prepared void waste for ${menuName}`,
        sourceTransaction: wasteReference,
        postedBy: createdBy,
        reference: wasteReference,
        lines: [
          { accountCode: '5009', accountName: 'Waste / Inventory Loss', debit: Number(lineCost) },
          { accountCode: '1201', accountName: 'Inventory', credit: Number(lineCost) },
        ],
      });
    }
    return;
  }

  await client.query(
    `INSERT INTO public.inventory_consumptions
       (order_id, order_item_id, recipe_id, recipe_version, item_id, quantity, unit, station, business_date, created_by, reference_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [orderId, itemKey, recipeId, recipeVersion, stock.id, quantity, unit, station, businessDate, createdBy, reference]
  );
  await client.query(
    `INSERT INTO public.inventory_transactions
       (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
        source_location_id, station, order_id, recipe_id, recipe_version, business_date, created_by, notes)
     VALUES ($1, $2, 'CONSUMPTION', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      stock.id, reference, quantity, unit, unitCost, lineCost, stock.location_id,
      station, orderId, recipeId, recipeVersion, businessDate, createdBy,
      Number(unitCost) > 0
        ? `${recipeId ? 'Recipe' : 'Direct sale'} consumption for ${menuName}`
        : `COST_REVIEW: missing unit cost for ${stock.item_name}`,
    ]
  );
  if (Number(lineCost) > 0) {
    await createJournalEntry({
      queryable: client,
      entryDate: businessDate,
      description: `COGS for ${menuName}`,
      sourceTransaction: reference,
      postedBy: createdBy,
      reference: `COGS-${reference}`,
      lines: [
        { accountCode: '5010', accountName: 'Cost of Goods Sold', debit: Number(lineCost) },
        { accountCode: '1201', accountName: 'Inventory', credit: Number(lineCost) },
      ],
    });
  }
}

export async function consumeSoldOrderItems({
  orderId,
  items,
  businessDate = businessDateInKampala(),
  createdBy = 'System',
  queryable,
  onlyOrderItemIndex,
}) {
  const parsedOrderId = Number(orderId);
  if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0 || !Array.isArray(items)) {
    throw new Error('A valid order ID and item list are required for inventory consumption.');
  }

  async function consumeDirectItem({ client, orderItemIndex, item, menuName, itemQuantity, station, itemKey }) {
    const inventoryItemId = Number(item.inventory_item_id ?? item.drink_serving?.inventory_item_id);
    const matches = Number.isInteger(inventoryItemId) && inventoryItemId > 0
      ? await client.query(
        `SELECT id FROM public.inventory_items
         WHERE id = $1 AND is_active = true
         LIMIT 2`,
        [inventoryItemId]
      )
      : await client.query(
        `SELECT id
         FROM public.inventory_items
         WHERE is_active = true
           AND LOWER(REGEXP_REPLACE(BTRIM(item_name), '[[:space:]]+', ' ', 'g'))
               = LOWER(REGEXP_REPLACE(BTRIM($1), '[[:space:]]+', ' ', 'g'))
         ORDER BY id
         LIMIT 2`,
        [menuName]
      );
    if (!matches.rows.length) {
      return { order_item: menuName, status: 'MISSING_INVENTORY_ITEM', message: 'No matching active inventory item; no stock was deducted.' };
    }
    if (matches.rows.length > 1) {
      return { order_item: menuName, status: 'AMBIGUOUS_INVENTORY_ITEM', message: 'Multiple inventory items match this menu item; no stock was deducted.' };
    }

    const stockResult = await client.query(
      `SELECT id, item_name, unit, purchase_unit, purchase_conversion_factor,
              current_quantity, unit_cost, location_id, station
       FROM public.inventory_items
       WHERE id = $1 AND is_active = true
       FOR UPDATE`,
      [matches.rows[0].id]
    );
    const stock = stockResult.rows[0];
    if (!stock) {
      return { order_item: menuName, status: 'MISSING_INVENTORY_ITEM', message: 'The matching inventory item is no longer active; no stock was deducted.' };
    }

    let requiredQuantity;
    try {
      requiredQuantity = directStockQuantity(itemQuantity, item, stock);
    } catch (error) {
      return { order_item: menuName, status: 'INVALID_INVENTORY_UNIT', message: error.message };
    }
    if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
      return { order_item: menuName, status: 'INVALID_ORDER_ITEM', message: 'The inventory deduction quantity must be positive.' };
    }

    const roundedQuantity = await client.query(
      `SELECT ROUND($1::numeric, 3)::numeric(12,3)::text AS quantity`,
      [String(requiredQuantity)]
    );
    const quantity = roundedQuantity.rows[0].quantity;
    if (Number(quantity) <= 0) {
      return { order_item: menuName, status: 'INVALID_ORDER_ITEM', message: 'The inventory deduction quantity is below supported precision.' };
    }

    const shortageResult = await client.query(
      `SELECT current_quantity < $1::numeric AS is_short,
              GREATEST($1::numeric - current_quantity, 0)::numeric(12,3)::text AS shortage
       FROM public.inventory_items
       WHERE id = $2`,
      [quantity, stock.id]
    );
    if (shortageResult.rows[0]?.is_short) {
      return {
        order_item: menuName,
        status: 'INSUFFICIENT_STOCK',
        ingredient: stock.item_name,
        shortage: shortageResult.rows[0].shortage,
        available: String(stock.current_quantity || 0),
      };
    }

    const unitCost = Number(stock.unit_cost || 0);
    const costResult = await client.query(
      `SELECT CASE WHEN $2::numeric > 0
        THEN ROUND($1::numeric * $2::numeric, 2)::numeric(12,2)::text
        ELSE '0' END AS cost`,
      [quantity, String(unitCost)]
    );
    const lineCost = costResult.rows[0].cost;
    const asWaste = item._approvedPreparedVoid === true;
    const reference = asWaste
      ? `DIRECT-${stock.id}`
      : `ORDER-${parsedOrderId}-ITEM-${orderItemIndex}-DIRECT-${stock.id}`;
    await recordInventoryReduction({
      client,
      orderId: parsedOrderId,
      orderItemIndex,
      itemKey,
      stock,
      quantity,
      lineCost,
      station,
      businessDate,
      createdBy,
      menuName,
      recipeId: null,
      recipeVersion: null,
      reference,
      asWaste,
      wasteReason: item._voidWasteReason,
    });
    return {
      order_item: menuName,
      inventory_item: stock.item_name,
      quantity,
      unit: normalizeUnit(stock.unit),
      cost: Number(lineCost),
      status: asWaste
        ? (unitCost > 0 ? 'WASTED' : 'WASTED_COST_REVIEW')
        : (unitCost > 0 ? 'CONSUMED' : 'CONSUMED_COST_REVIEW'),
    };
  }

  async function consumeSingleMenuItem({
    client,
    orderItemIndex,
    item,
    menuName,
    menuItemId,
    itemQuantity,
    station,
    itemKey,
  }) {
    if (Number(item.serving_volume_ml ?? item.drink_serving?.volume_ml) > 0) {
      return consumeDirectItem({
        client,
        orderItemIndex,
        item,
        menuName,
        itemQuantity,
        station,
        itemKey,
      });
    }
    const recipeResult = await client.query(
      `SELECT * FROM public.inventory_recipes
       WHERE status = 'ACTIVE'
         AND (($2::int IS NOT NULL AND menu_item_id = $2)
           OR LOWER(REGEXP_REPLACE(BTRIM(menu_name), '[[:space:]]+', ' ', 'g'))
              = LOWER(REGEXP_REPLACE(BTRIM($3), '[[:space:]]+', ' ', 'g')))
       ORDER BY CASE WHEN menu_item_id = $2 THEN 0 ELSE 1 END,
                CASE WHEN UPPER(station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END) THEN 0 ELSE 1 END,
                version_number DESC
       LIMIT 1 FOR SHARE`,
      [station, Number.isInteger(menuItemId) && menuItemId > 0 ? menuItemId : null, menuName]
    );
    const recipe = recipeResult.rows[0];
    if (!recipe) {
      const configuredRecipe = await client.query(
        `SELECT status
         FROM public.inventory_recipes
         WHERE (($1::int IS NOT NULL AND menu_item_id = $1)
           OR LOWER(REGEXP_REPLACE(BTRIM(menu_name), '[[:space:]]+', ' ', 'g'))
              = LOWER(REGEXP_REPLACE(BTRIM($2), '[[:space:]]+', ' ', 'g')))
         ORDER BY version_number DESC
         LIMIT 1
         FOR SHARE`,
        [Number.isInteger(menuItemId) && menuItemId > 0 ? menuItemId : null, menuName]
      );
      if (configuredRecipe.rows.length) {
        return {
          order_item: menuName,
          status: 'INACTIVE_RECIPE',
          message: 'A recipe exists but is not active; no stock was deducted.',
        };
      }
      return consumeDirectItem({ client, orderItemIndex, item, menuName, itemQuantity, station, itemKey });
    }
    const recipeStation = stationForItem({ station: recipe.station });

    const ingredientResult = await client.query(
      `SELECT ri.id AS recipe_ingredient_id, ri.ingredient_item_id, ri.ingredient_name,
              ri.quantity AS recipe_quantity, ri.unit AS recipe_unit,
              ii.item_name, ii.unit AS stock_unit, ii.purchase_unit,
              ii.purchase_conversion_factor, ii.current_quantity, ii.unit_cost
       FROM public.recipe_ingredients ri
       LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
       WHERE ri.recipe_id = $1 ORDER BY ri.id`,
      [recipe.id]
    );
    if (!ingredientResult.rows.length || ingredientResult.rows.some((ingredient) => !ingredient.ingredient_item_id || !ingredient.item_name)) {
      return { order_item: menuName, status: 'MISSING_INGREDIENT', message: 'Recipe contains an ingredient not linked to active inventory; no stock was deducted.' };
    }

    const planned = [];
    let invalidUnit = null;
    for (const ingredient of ingredientResult.rows) {
      const stockResult = await client.query(
        `SELECT id, item_name, unit, purchase_unit, purchase_conversion_factor, current_quantity, unit_cost
         FROM public.inventory_items WHERE id = $1 AND is_active = true FOR UPDATE`,
        [ingredient.ingredient_item_id]
      );
      const stock = stockResult.rows[0];
      if (!stock) {
        invalidUnit = { status: 'MISSING_INGREDIENT', message: `${ingredient.ingredient_name} is not active inventory.` };
        break;
      }
      try {
        const factor = inventoryUnitConversionFactor(ingredient.recipe_unit, stock.unit, stock);
        const convertedResult = await client.query(
          `SELECT ROUND($1::numeric * $2::numeric * $3::numeric, 3)::numeric(12,3)::text AS quantity`,
          [String(ingredient.recipe_quantity), String(factor), String(itemQuantity)]
        );
        const required = convertedResult.rows[0].quantity;
        if (Number(required) <= 0) throw new Error('Recipe quantity is below the supported stock precision.');
        const existingPlan = planned.find((entry) => entry.stock.id === stock.id);
        if (existingPlan) {
          const total = await client.query(
            `SELECT ROUND($1::numeric + $2::numeric, 3)::numeric(12,3)::text AS quantity`,
            [existingPlan.quantity, required]
          );
          existingPlan.quantity = total.rows[0].quantity;
        }
        else planned.push({ stock, quantity: required, ingredients: [ingredient] });
        if (existingPlan) existingPlan.ingredients.push(ingredient);
      } catch (error) {
        invalidUnit = { status: 'INVALID_RECIPE_UNIT', ingredient: stock.item_name, message: error.message };
        break;
      }
    }

    if (invalidUnit) {
      return { order_item: menuName, ...invalidUnit };
    }

    const shortageChecks = await Promise.all(planned.map(async (entry) => {
      const result = await client.query(
        `SELECT current_quantity < $1::numeric AS is_short,
                GREATEST($1::numeric - current_quantity, 0)::numeric(12,3)::text AS shortage
         FROM public.inventory_items WHERE id = $2`,
        [entry.quantity, entry.stock.id]
      );
      return { ...entry, isShort: result.rows[0]?.is_short, shortage: result.rows[0]?.shortage };
    }));
    const shortage = shortageChecks.find((entry) => entry.isShort);
    if (shortage) {
      return {
        order_item: menuName,
        status: 'INSUFFICIENT_STOCK',
        ingredient: shortage.stock.item_name,
        shortage: shortage.shortage,
        available: String(shortage.stock.current_quantity || 0),
      };
    }

    const recorded = [];
    let needsCostReview = false;
    for (const entry of planned) {
      const unitCost = String(entry.stock.unit_cost || 0);
      const costResult = await client.query(
        `SELECT CASE WHEN $2::numeric > 0
          THEN ROUND($1::numeric * $2::numeric, 2)::numeric(12,2)::text
          ELSE '0' END AS cost`,
        [entry.quantity, unitCost]
      );
      const lineCost = costResult.rows[0].cost;
      needsCostReview ||= Number(unitCost) <= 0;
      const asWaste = item._approvedPreparedVoid === true;
      const reference = asWaste
        ? `RECIPE-${recipe.id}-ING-${entry.stock.id}`
        : `ORDER-${parsedOrderId}-ITEM-${orderItemIndex}-RECIPE-${recipe.id}-ING-${entry.stock.id}`;
      await recordInventoryReduction({
        client,
        orderId: parsedOrderId,
        orderItemIndex,
        itemKey,
        stock: entry.stock,
        quantity: entry.quantity,
        lineCost,
        station: recipeStation,
        businessDate,
        createdBy,
        menuName,
        recipeId: recipe.id,
        recipeVersion: String(recipe.version_number || 1),
        reference,
        asWaste,
        wasteReason: item._voidWasteReason,
      });
      recorded.push({ ingredient: entry.stock.item_name, quantity: entry.quantity, unit: normalizeUnit(entry.stock.unit), cost: lineCost });
    }

    const asWaste = item._approvedPreparedVoid === true;
    return {
      order_item: menuName,
      recipe_id: recipe.id,
      recipe_version: recipe.version_number,
      status: asWaste
        ? (needsCostReview ? 'WASTED_COST_REVIEW' : 'WASTED')
        : (needsCostReview ? 'CONSUMED_COST_REVIEW' : 'CONSUMED'),
      ingredients: recorded,
    };
  }

  const entries = [];
  for (const [index, item] of items.entries()) {
    if (onlyOrderItemIndex !== undefined && Number(onlyOrderItemIndex) !== index) continue;
    const disposition = getOrderItemInventoryDisposition(item);
    if (disposition === 'SKIP') continue;

    const itemKey = `${parsedOrderId}:${index}`;
    const asWaste = disposition === 'WASTE';
    const isComboItem = item.type === 'combo' || item.combo_id || item.is_combo === true;
    const comboComponents = isComboItem ? (Array.isArray(item.components) ? item.components.map((component) => ({
      menu_item_id: Number(component.menu_item_id ?? component.menuId ?? component.menu_id ?? component.id ?? 0),
      menu_name: String(component.menu_name || component.name || '').trim(),
      quantity: Number(component.quantity || 1) * Number(asWaste ? item._wasteQuantity : item.quantity || 1),
      station: String(component.station || item.station || '').trim() || stationForItem(item),
    })) : []) : [];

    const menuName = String(item.menu_name || item.name || item.item_name || '').trim();
    const quantity = Number(asWaste ? item._wasteQuantity : item.quantity || 1);
    const station = stationForItem(item);
    if (!menuName || !Number.isFinite(quantity) || quantity <= 0) {
      entries.push({ order_item: menuName || `Item ${index + 1}`, status: 'INVALID_ORDER_ITEM', message: 'Menu item name and quantity are required.' });
      continue;
    }

    const ownsClient = !queryable;
    const client = queryable || await pool.connect();
    try {
      if (ownsClient) await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [itemKey]);
      const previous = await client.query(
        `SELECT id FROM public.inventory_consumptions WHERE order_id = $1 AND order_item_id = $2 LIMIT 1`,
        [parsedOrderId, itemKey]
      );
      if (previous.rows.length) {
        if (ownsClient) await client.query('COMMIT');
        entries.push({ order_item: menuName, status: 'ALREADY_CONSUMED' });
        continue;
      }
      if (asWaste) {
        const previousWaste = await client.query(
          `SELECT id FROM public.inventory_transactions
           WHERE order_id = $1 AND transaction_type = 'WASTE'
             AND reference_number LIKE $2
           LIMIT 1`,
          [parsedOrderId, `WASTE-ORDER-${parsedOrderId}-VOID-${item._voidRequestId}-ITEM-${index}-%`]
        );
        if (previousWaste.rows.length) {
          if (ownsClient) await client.query('COMMIT');
          entries.push({ order_item: menuName, status: 'ALREADY_WASTED' });
          continue;
        }
      }

      if (isComboItem && comboComponents.length) {
        const comboEntry = { order_item: menuName, components: [] };
        let hasFailure = false;
        for (const component of comboComponents) {
          const resolvedName = component.menu_name || menuName;
          const resolvedItemId = Number(component.menu_item_id || item.menu_item_id || item.menuId || item.menu_id || item.id || 0);
          const componentItem = {
            ...item,
            menu_name: resolvedName,
            name: resolvedName,
            inventory_unit: component.inventory_unit || item.inventory_unit,
            stock_unit: component.stock_unit || item.stock_unit,
            sale_unit: component.sale_unit || item.sale_unit,
          };
          const componentResult = await consumeSingleMenuItem({
            client,
            orderItemIndex: index,
            item: componentItem,
            menuName: resolvedName,
            menuItemId: resolvedItemId,
            itemQuantity: Number(component.quantity || 1),
            station: component.station || station,
            itemKey,
          });
          comboEntry.components.push(componentResult);
          if (!(asWaste
            ? ['WASTED', 'WASTED_COST_REVIEW'].includes(componentResult.status)
            : ['CONSUMED', 'CONSUMED_COST_REVIEW'].includes(componentResult.status))) {
            hasFailure = true;
          }
        }

        if (hasFailure) {
          if (ownsClient) await client.query('ROLLBACK');
          entries.push({ ...comboEntry, status: 'PARTIALLY_CONSUMED', combo_id: item.combo_id || item.id });
          continue;
        }

        if (ownsClient) await client.query('COMMIT');
        entries.push({ ...comboEntry, status: asWaste ? 'WASTED' : 'CONSUMED', combo_id: item.combo_id || item.id });
        continue;
      }

      const menuItemId = Number(item.menu_item_id || item.menuId || item.menu_id || item.id);
      const result = await consumeSingleMenuItem({
        client,
        orderItemIndex: index,
        item,
        menuName,
        menuItemId,
        itemQuantity: quantity,
        station,
        itemKey,
      });
      if (ownsClient) await client.query('COMMIT');
      entries.push(result);
    } catch (error) {
      if (ownsClient) await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      if (ownsClient) client.release();
    }
  }
  return entries;
}

export async function reverseConsumedOrderItem({
  orderId,
  orderItemIndex,
  createdBy = 'Accountant',
  businessDate = businessDateInKampala(),
  queryable,
  quantityRatio = 1,
}) {
  const parsedOrderId = Number(orderId);
  const parsedIndex = Number(orderItemIndex);
  if (!Number.isInteger(parsedOrderId) || !Number.isInteger(parsedIndex) || parsedOrderId <= 0 || parsedIndex < 0) {
    throw new Error('A valid order ID and order item index are required for a consumption reversal.');
  }
  const normalizedRatio = Number(quantityRatio);
  if (!Number.isFinite(normalizedRatio) || normalizedRatio <= 0 || normalizedRatio > 1) {
    throw new Error('The consumption reversal quantity ratio must be greater than zero and at most one.');
  }

  const ownsClient = !queryable;
  const client = queryable || await pool.connect();
  const itemKey = `${parsedOrderId}:${parsedIndex}`;
  try {
    if (ownsClient) await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [itemKey]);
    const consumptions = await client.query(
      `SELECT * FROM public.inventory_consumptions WHERE order_id = $1 AND order_item_id = $2 ORDER BY id`,
      [parsedOrderId, itemKey]
    );
    if (!consumptions.rows.length) {
      if (ownsClient) await client.query('COMMIT');
      return { status: 'NO_CONSUMPTION_TO_REVERSE', order_id: parsedOrderId, order_item_id: itemKey };
    }

    let reversed = 0;
    for (const consumption of consumptions.rows) {
      const reversalReference = `REV-${consumption.reference_number}`;
      const existing = await client.query(
        `SELECT id FROM public.inventory_transactions WHERE reference_number = $1 AND transaction_type = 'REVERSAL' LIMIT 1`,
        [reversalReference]
      );
      if (existing.rows.length) continue;

      const stockResult = await client.query(
        `SELECT * FROM public.inventory_items WHERE id = $1 FOR UPDATE`,
        [consumption.item_id]
      );
      const stock = stockResult.rows[0];
      if (!stock) throw new Error(`Cannot reverse missing inventory item ${consumption.item_id}.`);
      const transactionResult = await client.query(
        `SELECT unit_cost, total_value FROM public.inventory_transactions
         WHERE reference_number = $1 AND transaction_type = 'CONSUMPTION' LIMIT 1`,
        [consumption.reference_number]
      );
      const originalCost = transactionResult.rows[0]
        ? Number(transactionResult.rows[0].total_value || 0)
        : Number(consumption.quantity || 0) * Number(stock.unit_cost || 0);
      const originalUnitCost = transactionResult.rows[0]
        ? Number(transactionResult.rows[0].unit_cost || 0)
        : Number(stock.unit_cost || 0);
      const reversedQuantityResult = await client.query(
        `SELECT ROUND($1::numeric * $2::numeric, 3)::numeric(12,3)::text AS quantity,
                ROUND($3::numeric * $2::numeric, 2)::numeric(12,2)::text AS cost`,
        [consumption.quantity, normalizedRatio, String(originalCost)]
      );
      const reversedQuantity = reversedQuantityResult.rows[0].quantity;
      const reversedCost = Number(reversedQuantityResult.rows[0].cost);
      if (Number(reversedQuantity) <= 0) continue;

      await client.query(
        `UPDATE public.inventory_items
         SET current_quantity = current_quantity + $1,
             inventory_value = (current_quantity + $1) * unit_cost,
             updated_at = NOW()
         WHERE id = $2`,
        [reversedQuantity, stock.id]
      );
      await client.query(
        `INSERT INTO public.inventory_transactions
           (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
            destination_location_id, station, order_id, recipe_id, recipe_version, business_date, created_by, notes)
         VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [stock.id, reversalReference, reversedQuantity, consumption.unit, originalUnitCost, reversedCost, stock.location_id, consumption.station, parsedOrderId, consumption.recipe_id, consumption.recipe_version, businessDate, createdBy, `COGS_REVERSAL:${consumption.reference_number}`]
      );
      if (reversedCost > 0) {
        await createJournalEntry({
          queryable: client,
          entryDate: businessDate,
          description: `COGS reversal for order ${parsedOrderId}`,
          sourceTransaction: reversalReference,
          postedBy: createdBy,
          reference: `REV-COGS-${consumption.reference_number}`,
          lines: [
            { accountCode: '1201', accountName: 'Inventory', debit: reversedCost },
            { accountCode: '5010', accountName: 'Cost of Goods Sold', credit: reversedCost },
          ],
        });
      }
      reversed += 1;
    }

    if (ownsClient) await client.query('COMMIT');
    return { status: reversed ? 'REVERSED' : 'ALREADY_REVERSED', order_id: parsedOrderId, order_item_id: itemKey, ingredient_count: reversed };
  } catch (error) {
    if (ownsClient) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (ownsClient) client.release();
  }
}