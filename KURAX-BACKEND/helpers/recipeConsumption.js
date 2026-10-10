import pool from '../db.js';
import { createJournalEntry } from './accounting.js';

const UNIT_FACTORS = {
  kg: 1000, kgs: 1000, kilogram: 1000, kilograms: 1000,
  g: 1, gram: 1, grams: 1,
  litre: 1000, liter: 1000, litres: 1000, liters: 1000, l: 1000,
  ml: 1, millilitre: 1, milliliter: 1, millilitres: 1, milliliters: 1,
  piece: 1, pieces: 1, slice: 1, slices: 1,
  packet: 1, packets: 1, box: 1, boxes: 1, bottle: 1, bottles: 1,
};

function normalizeUnit(unit = '') {
  const value = String(unit || '').trim().toLowerCase();
  const aliases = { kgs: 'kg', kilograms: 'kg', kilogram: 'kg', grams: 'g', gram: 'g', litres: 'litre', liters: 'litre', l: 'litre', millilitres: 'ml', milliliters: 'ml', millilitre: 'ml', milliliter: 'ml', pieces: 'piece', slices: 'slice', packets: 'packet', boxes: 'box', bottles: 'bottle' };
  return aliases[value] || value;
}

function unitFamily(unit) {
  const normalized = normalizeUnit(unit);
  if (normalized === 'kg' || normalized === 'g') return 'mass';
  if (normalized === 'litre' || normalized === 'ml') return 'volume';
  return normalized;
}

export function convertRecipeQuantity(quantity, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!Object.hasOwn(UNIT_FACTORS, from) || !Object.hasOwn(UNIT_FACTORS, to) || unitFamily(from) !== unitFamily(to)) {
    throw new Error(`Incompatible recipe and inventory units: ${fromUnit} to ${toUnit}`);
  }
  return Number(quantity) * UNIT_FACTORS[from] / UNIT_FACTORS[to];
}

export function isSoldOrderItem(item = {}) {
  if (item.voidProcessed === true || String(item.status || '').toUpperCase() === 'VOIDED') return false;
  if (item._approvedCreditSale === true) return true;
  const isCredit = item.creditRequested === true || String(item.payment_method || '').toUpperCase().includes('CREDIT');
  return item._rowPaid === true && !isCredit;
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

export async function consumeSoldOrderItems({ orderId, items, businessDate = businessDateInKampala(), createdBy = 'System' }) {
  const parsedOrderId = Number(orderId);
  if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0 || !Array.isArray(items)) {
    throw new Error('A valid order ID and item list are required for recipe consumption.');
  }

  const entries = [];
  for (const [index, item] of items.entries()) {
    if (!isSoldOrderItem(item)) continue;
    const menuName = String(item.menu_name || item.name || item.item_name || '').trim();
    const quantity = Number(item.quantity || 1);
    const station = stationForItem(item);
    if (!menuName || !Number.isFinite(quantity) || quantity <= 0) {
      entries.push({ order_item: menuName || `Item ${index + 1}`, status: 'INVALID_ORDER_ITEM', message: 'Menu item name and quantity are required.' });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const itemKey = `${parsedOrderId}:${index}`;
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [itemKey]);
      const previous = await client.query(
        `SELECT id FROM public.inventory_consumptions WHERE order_id = $1 AND order_item_id = $2 LIMIT 1`,
        [parsedOrderId, itemKey]
      );
      if (previous.rows.length) {
        await client.query('COMMIT');
        entries.push({ order_item: menuName, status: 'ALREADY_CONSUMED' });
        continue;
      }

      const menuItemId = Number(item.menu_item_id || item.menuId || item.menu_id || item.id);
      const recipeResult = await client.query(
        `SELECT * FROM public.inventory_recipes
         WHERE status = 'ACTIVE'
           AND UPPER(station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END)
           AND (($2::int IS NOT NULL AND menu_item_id = $2) OR LOWER(menu_name) = LOWER($3))
         ORDER BY CASE WHEN menu_item_id = $2 THEN 0 ELSE 1 END, version_number DESC
         LIMIT 1 FOR SHARE`,
        [station, Number.isInteger(menuItemId) && menuItemId > 0 ? menuItemId : null, menuName]
      );
      const recipe = recipeResult.rows[0];
      if (!recipe) {
        await client.query('COMMIT');
        entries.push({ order_item: menuName, status: 'MISSING_RECIPE', message: 'Recipe not configured; no stock was deducted.' });
        continue;
      }

      const ingredientResult = await client.query(
        `SELECT ri.id AS recipe_ingredient_id, ri.ingredient_item_id, ri.ingredient_name,
                ri.quantity AS recipe_quantity, ri.unit AS recipe_unit,
                ii.item_name, ii.unit AS stock_unit, ii.current_quantity, ii.unit_cost
         FROM public.recipe_ingredients ri
         LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
         WHERE ri.recipe_id = $1 ORDER BY ri.id`,
        [recipe.id]
      );
      if (!ingredientResult.rows.length || ingredientResult.rows.some((ingredient) => !ingredient.ingredient_item_id || !ingredient.item_name)) {
        await client.query('COMMIT');
        entries.push({ order_item: menuName, status: 'MISSING_INGREDIENT', message: 'Recipe contains an ingredient not linked to active inventory; no stock was deducted.' });
        continue;
      }

      const planned = [];
      let invalidUnit = null;
      for (const ingredient of ingredientResult.rows) {
        const stockResult = await client.query(
          `SELECT id, item_name, unit, current_quantity, unit_cost
           FROM public.inventory_items WHERE id = $1 AND is_active = true FOR UPDATE`,
          [ingredient.ingredient_item_id]
        );
        const stock = stockResult.rows[0];
        if (!stock) {
          invalidUnit = { status: 'MISSING_INGREDIENT', message: `${ingredient.ingredient_name} is not active inventory.` };
          break;
        }
        try {
          const required = convertRecipeQuantity(Number(ingredient.recipe_quantity), ingredient.recipe_unit, stock.unit) * quantity;
          const existingPlan = planned.find((entry) => entry.stock.id === stock.id);
          if (existingPlan) existingPlan.quantity += required;
          else planned.push({ stock, quantity: required, ingredients: [ingredient] });
          if (existingPlan) existingPlan.ingredients.push(ingredient);
        } catch (error) {
          invalidUnit = { status: 'INVALID_RECIPE_UNIT', ingredient: stock.item_name, message: error.message };
          break;
        }
      }

      if (invalidUnit) {
        await client.query('ROLLBACK');
        entries.push({ order_item: menuName, ...invalidUnit });
        continue;
      }
      const shortage = planned.find((entry) => Number(entry.stock.current_quantity || 0) < entry.quantity);
      if (shortage) {
        await client.query('ROLLBACK');
        entries.push({ order_item: menuName, status: 'INSUFFICIENT_STOCK', ingredient: shortage.stock.item_name, shortage: shortage.quantity - Number(shortage.stock.current_quantity || 0), available: Number(shortage.stock.current_quantity || 0) });
        continue;
      }

      const recorded = [];
      let needsCostReview = false;
      for (const entry of planned) {
        const unitCost = Number(entry.stock.unit_cost || 0);
        const lineCost = unitCost > 0 ? entry.quantity * unitCost : 0;
        needsCostReview ||= unitCost <= 0;
        await client.query(
          `UPDATE public.inventory_items
           SET current_quantity = current_quantity - $1,
               inventory_value = (current_quantity - $1) * unit_cost,
               updated_at = NOW()
           WHERE id = $2`,
          [entry.quantity, entry.stock.id]
        );
        const reference = `ORDER-${parsedOrderId}-ITEM-${index}-RECIPE-${recipe.id}-ING-${entry.stock.id}`;
        await client.query(
          `INSERT INTO public.inventory_consumptions
             (order_id, order_item_id, recipe_id, recipe_version, item_id, quantity, unit, station, business_date, created_by, reference_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [parsedOrderId, itemKey, recipe.id, String(recipe.version_number || 1), entry.stock.id, entry.quantity, normalizeUnit(entry.stock.unit), station, businessDate, createdBy, reference]
        );
        await client.query(
          `INSERT INTO public.inventory_transactions
             (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, station, order_id, recipe_id, recipe_version, business_date, created_by, notes)
           SELECT ii.id, $1, 'CONSUMPTION', $2, $3, $4, $5, ii.location_id, $6, $7, $8, $9, $10, $11, $12
           FROM public.inventory_items ii WHERE ii.id = $13`,
          [reference, entry.quantity, normalizeUnit(entry.stock.unit), unitCost, lineCost, station, parsedOrderId, recipe.id, String(recipe.version_number || 1), businessDate, createdBy, unitCost > 0 ? `Recipe consumption for ${menuName}` : `COST_REVIEW: missing unit cost for ${entry.stock.item_name}`, entry.stock.id]
        );
        if (lineCost > 0) {
          await createJournalEntry({
            queryable: client,
            entryDate: businessDate,
            description: `COGS for ${menuName}`,
            sourceTransaction: reference,
            postedBy: createdBy,
            reference: `COGS-${reference}`,
            lines: [
                { accountCode: '5010', accountName: 'Cost of Goods Sold', debit: lineCost },
              { accountCode: '1201', accountName: 'Inventory', credit: lineCost },
            ],
          });
        }
        recorded.push({ ingredient: entry.stock.item_name, quantity: entry.quantity, unit: normalizeUnit(entry.stock.unit), cost: lineCost });
      }

      await client.query('COMMIT');
      entries.push({ order_item: menuName, recipe_id: recipe.id, recipe_version: recipe.version_number, status: needsCostReview ? 'CONSUMED_COST_REVIEW' : 'CONSUMED', ingredients: recorded });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  return entries;
}

export async function reverseConsumedOrderItem({ orderId, orderItemIndex, createdBy = 'Accountant', businessDate = businessDateInKampala(), queryable }) {
  const parsedOrderId = Number(orderId);
  const parsedIndex = Number(orderItemIndex);
  if (!Number.isInteger(parsedOrderId) || !Number.isInteger(parsedIndex) || parsedOrderId <= 0 || parsedIndex < 0) {
    throw new Error('A valid order ID and order item index are required for a consumption reversal.');
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

      await client.query(
        `UPDATE public.inventory_items
         SET current_quantity = current_quantity + $1,
             inventory_value = (current_quantity + $1) * unit_cost,
             updated_at = NOW()
         WHERE id = $2`,
        [consumption.quantity, stock.id]
      );
      await client.query(
        `INSERT INTO public.inventory_transactions
           (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
            destination_location_id, station, order_id, recipe_id, recipe_version, business_date, created_by, notes)
         VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [stock.id, reversalReference, consumption.quantity, consumption.unit, originalUnitCost, originalCost, stock.location_id, consumption.station, parsedOrderId, consumption.recipe_id, consumption.recipe_version, businessDate, createdBy, `COGS_REVERSAL:${consumption.reference_number}`]
      );
      if (originalCost > 0) {
        await createJournalEntry({
          queryable: client,
          entryDate: businessDate,
          description: `COGS reversal for order ${parsedOrderId}`,
          sourceTransaction: reversalReference,
          postedBy: createdBy,
          reference: `REV-COGS-${consumption.reference_number}`,
          lines: [
            { accountCode: '1201', accountName: 'Inventory', debit: originalCost },
            { accountCode: '5010', accountName: 'Cost of Goods Sold', credit: originalCost },
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