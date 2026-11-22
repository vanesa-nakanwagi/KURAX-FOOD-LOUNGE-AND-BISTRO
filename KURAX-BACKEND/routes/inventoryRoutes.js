import express from 'express';
import pool from '../db.js';
import { createJournalEntry } from '../helpers/accounting.js';
import { shishaInventoryFilterSql } from '../helpers/inventoryFilters.js';
import { excludeReversedPurchaseActivity } from '../helpers/inventoryActivity.js';
import { itemAssignedToStation } from '../helpers/inventoryStations.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { consumeSoldOrderItems } from '../helpers/recipeConsumption.js';
import { getReversedPurchaseStockCorrectionBlocker } from '../helpers/reversedPurchaseStock.js';
import {
  configuredPurchaseConversionFactor,
  inventoryUnitConversionFactor,
  isInventoryPurchaseUnitForStock,
  isInventoryUnitForStation,
  normalizeInventoryStation,
  normalizeInventoryUnit,
  UnitConversionError,
} from '../helpers/inventoryUnits.js';

const router = express.Router();

const ROLE_STATIONS = {
  KITCHEN_HOD: 'KITCHEN',
  BAR_HOD: 'BAR',
  BARISTA_HOD: 'BARISTA',
};
const RECIPE_VIEW_ROLES = new Set([
  ...Object.keys(ROLE_STATIONS),
  'ACCOUNTANT',
  'DIRECTOR',
  'MANAGER',
  'SUPERVISOR',
]);

async function authenticateAccountant(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : '';
  if (!token) return res.status(401).json({ error: 'Sign in as an accountant to manage inventory items.' });

  let session;
  try {
    session = readSessionToken(token);
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
  if (session.scope !== 'restaurant' || !session.id) {
    return res.status(401).json({ error: 'A valid staff session is required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, role, is_active FROM public.staff WHERE id = $1',
      [session.id]
    );
    const actor = result.rows[0];
    if (!actor || actor.is_active === false || actor.role !== session.role) {
      return res.status(401).json({ error: 'Staff account is inactive or has changed.' });
    }
    if (actor.role !== 'ACCOUNTANT') {
      return res.status(403).json({ error: 'Only an accountant can edit or delete inventory items.' });
    }
    req.inventoryActor = actor;
    return next();
  } catch (error) {
    console.error('Inventory item authentication error:', error.message);
    return res.status(500).json({ error: 'Could not verify accountant access.' });
  }
}

function normalizeStation(value) {
  const station = String(value || '').trim().toUpperCase();
  if (station === 'KITCHEN' || station === 'CHEF') return 'KITCHEN';
  if (station === 'BAR' || station === 'BARMAN') return 'BAR';
  if (station === 'BARISTA') return 'BARISTA';
  return '';
}

async function authenticateRecipeUser(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: 'Sign in to access recipes.' });

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
    if (!RECIPE_VIEW_ROLES.has(actor.role)) {
      return res.status(403).json({ error: 'This account cannot access recipes.' });
    }
    req.inventoryActor = actor;
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
}

function canManageStation(req, station) {
  const normalized = normalizeStation(station);
  const authorizedStation = ROLE_STATIONS[req.inventoryActor?.role];
  return Boolean(normalized && authorizedStation === normalized);
}

async function activateRecipeVersion(client, recipe, updatedBy) {
  await client.query(
    `UPDATE public.inventory_recipes
     SET status = 'INACTIVE', updated_at = NOW(), updated_by = $5
     WHERE id <> $1
       AND status = 'ACTIVE'
       AND UPPER(station) IN ($4, CASE WHEN $4 = 'BAR' THEN 'BARMAN' ELSE $4 END)
       AND (
         menu_item_id = $2
         OR (menu_item_id IS NULL AND LOWER(menu_name) = LOWER($3))
       )`,
    [recipe.id, recipe.menu_item_id, recipe.menu_name, normalizeStation(recipe.station), updatedBy]
  );
  const result = await client.query(
    `UPDATE public.inventory_recipes
     SET status = 'ACTIVE', updated_at = NOW(), updated_by = $2
     WHERE id = $1
     RETURNING *`,
    [recipe.id, updatedBy]
  );
  return result.rows[0];
}

function requestedRecipeStation(req, value, res) {
  const requested = normalizeStation(value);
  const authorizedStation = ROLE_STATIONS[req.inventoryActor?.role];
  const wantsAllStations = String(value || '').trim().toUpperCase() === 'ALL';
  if (wantsAllStations && authorizedStation) {
    res.status(403).json({ error: 'You can only access recipes for your assigned department.' });
    return null;
  }
  if (wantsAllStations) return 'ALL';
  if (authorizedStation && requested && authorizedStation !== requested) {
    res.status(403).json({ error: 'You can only access recipes for your assigned department.' });
    return null;
  }
  if (value && !requested) {
    res.status(400).json({ error: 'A valid recipe department is required.' });
    return null;
  }
  return authorizedStation || requested;
}

router.use(['/recipes', '/consumption', '/waste', '/reports'], authenticateRecipeUser);

function normalizeUnit(unit) {
  return normalizeInventoryUnit(unit) || 'kg';
}

function isValidDecimal(value, allowZero = false, maxScale = 3) {
  const text = String(value ?? '').trim();
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(text)) return false;
  if ((text.split('.')[1] || '').length > maxScale) return false;
  const number = Number(text);
  return Number.isFinite(number) && (allowZero ? number >= 0 : number > 0);
}

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currentBusinessDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
}

function stockStatus(item) {
  if (Number(item.current_quantity || 0) <= 0) return 'OUT OF STOCK';
  if (Number(item.minimum_stock_level || 0) >= 0 && Number(item.current_quantity || 0) <= Number(item.minimum_stock_level || 0)) return 'LOW STOCK';
  return 'IN STOCK';
}

async function postInventoryValueAdjustment(client, { amount, reference, description, actor }) {
  const value = Number(Math.abs(amount).toFixed(2));
  if (value === 0) return;

  const inventoryDebit = amount > 0;
  await createJournalEntry({
    entryDate: currentBusinessDate(),
    description,
    sourceTransaction: reference,
    postedBy: actor,
    reference,
    queryable: client,
    lines: [
      { accountCode: '1201', accountName: 'Inventory', debit: inventoryDebit ? value : 0, credit: inventoryDebit ? 0 : value },
      { accountCode: '5009', accountName: 'Other Operating Expenses', debit: inventoryDebit ? 0 : value, credit: inventoryDebit ? value : 0 },
    ],
  });
}

function isActiveOrderItem(item = {}) {
  return item.voidProcessed !== true && String(item.status || '').toUpperCase() !== 'VOIDED';
}

function getPaymentAccount(paymentMethod) {
  const method = String(paymentMethod || 'Cash').toLowerCase();
  if (method.includes('bank')) return '1002';
  if (method.includes('mtn')) return '1006';
  if (method.includes('airtel')) return '1007';
  if (method.includes('payable') || method.includes('supplier') || method.includes('credit')) return '2001';
  return '1001';
}

async function resolveLocationId(locationId, locationName) {
  if (locationId) return Number(locationId);
  if (!locationName) return null;
  const result = await pool.query(
    `SELECT id FROM public.inventory_locations WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [String(locationName).trim()]
  );
  return result.rows[0]?.id ?? null;
}

async function resolveSupplierId(supplierId, supplierName) {
  if (supplierId) return Number(supplierId);
  if (!supplierName) return null;
  const value = String(supplierName).trim();
  const result = await pool.query(
    `SELECT id FROM public.suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [value]
  );
  if (result.rows[0]) return result.rows[0].id;
  const created = await pool.query(
    `INSERT INTO public.suppliers (name, created_by, is_active)
     VALUES ($1, 'System', true)
     ON CONFLICT (name) DO NOTHING
     RETURNING id`,
    [value]
  );
  return created.rows[0]?.id ?? (await pool.query(`SELECT id FROM public.suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1`, [value])).rows[0]?.id ?? null;
}

async function resolveItemIdByName(name, station = null) {
  if (!name) return null;
  const result = await pool.query(
    `SELECT id FROM public.inventory_items
     WHERE LOWER(item_name) = LOWER($1)
       AND is_active = true
       AND ($2::text IS NULL OR UPPER(COALESCE(station, 'KITCHEN')) IN ($2, CASE WHEN $2 = 'BAR' THEN 'BARMAN' ELSE $2 END))
     ORDER BY id
     LIMIT 1`,
    [String(name).trim(), station ? normalizeInventoryStation(station) : null]
  );
  return result.rows[0]?.id ?? null;
}

async function buildItemSummary(item) {
  return {
    ...item,
    unit: normalizeUnit(item.unit || 'kg'),
    purchase_unit: normalizeUnit(item.purchase_unit || item.unit || 'kg'),
    purchase_conversion_factor: String(item.purchase_conversion_factor || '1'),
    stock_status: stockStatus(item),
    current_quantity: Number(item.current_quantity || 0),
    minimum_stock_level: Number(item.minimum_stock_level || 0),
    unit_cost: Number(item.unit_cost || 0),
    inventory_value: Number(item.inventory_value || 0),
  };
}

router.get('/locations', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO public.inventory_locations (name, type, is_active)
       VALUES ('MAIN STORE', 'STORE', true), ('KITCHEN', 'STATION', true),
              ('BAR', 'STATION', true), ('BARISTA', 'STATION', true)
       ON CONFLICT (name) DO UPDATE SET is_active = true, updated_at = NOW()`
    );
    const result = await pool.query(
      `SELECT * FROM public.inventory_locations WHERE is_active = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/suppliers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM public.suppliers WHERE is_active = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/suppliers', async (req, res) => {
  const { name, contact_person, phone, email, address } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Supplier name is required.' });

  try {
    const result = await pool.query(
      `INSERT INTO public.suppliers (name, contact_person, phone, email, address, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE SET
         contact_person = EXCLUDED.contact_person,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         address = EXCLUDED.address,
         updated_at = NOW()
       RETURNING *`,
      [String(name).trim(), contact_person || null, phone || null, email || null, address || null, req.user?.name || 'Accountant']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/items', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ii.*, il.name AS location_name, s.name AS supplier_name,
              CASE
                WHEN ii.current_quantity <= 0 THEN 'OUT OF STOCK'
                WHEN ii.current_quantity <= ii.minimum_stock_level THEN 'LOW STOCK'
                ELSE 'IN STOCK'
              END AS stock_status
       FROM public.inventory_items ii
       LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
       LEFT JOIN public.suppliers s ON s.id = ii.supplier_id
       WHERE ii.is_active = true
         AND ${shishaInventoryFilterSql('ii')}
       ORDER BY ii.item_name ASC`
    );

    const rows = await Promise.all(result.rows.map(buildItemSummary));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stock', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ii.*, il.name AS location_name, s.name AS supplier_name,
              CASE
                WHEN ii.current_quantity <= 0 THEN 'OUT OF STOCK'
                WHEN ii.current_quantity <= ii.minimum_stock_level THEN 'LOW STOCK'
                ELSE 'IN STOCK'
              END AS stock_status
       FROM public.inventory_items ii
       LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
       LEFT JOIN public.suppliers s ON s.id = ii.supplier_id
       WHERE ii.is_active = true
         AND ${shishaInventoryFilterSql('ii')}
       ORDER BY ii.item_name ASC`
    );
    res.json(result.rows.map(buildItemSummary));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/items', async (req, res) => {
  const payload = req.body || {};
  const {
    item_name,
    sku,
    category,
    unit,
    base_unit,
    purchase_unit,
    purchase_conversion_factor,
    minimum_stock_level,
    current_quantity,
    unit_cost,
    supplier_id,
    supplier_name,
    location_id,
    location_name,
    station,
    active,
  } = payload;

  if (!item_name) return res.status(400).json({ error: 'Item name is required.' });

  try {
    const finalStation = normalizeInventoryStation(station || 'KITCHEN');
    const finalUnit = normalizeUnit(unit || 'kg');
    const finalPurchaseUnit = normalizeUnit(purchase_unit || finalUnit);
    if (!finalStation) return res.status(400).json({ error: 'Select a valid inventory station.' });
    if (!isInventoryPurchaseUnitForStock(finalUnit, finalPurchaseUnit, finalStation)) {
      return res.status(400).json({ error: 'Select stock and purchase units supported by the selected station.' });
    }
    const conversionFactor = configuredPurchaseConversionFactor(
      finalUnit,
      finalPurchaseUnit,
      purchase_conversion_factor,
      { unit: finalUnit, purchase_unit: finalPurchaseUnit }
    );
    if (!isValidDecimal(current_quantity ?? 0, true)
        || !isValidDecimal(minimum_stock_level ?? 0, true)
        || (unit_cost !== undefined && unit_cost !== null && String(unit_cost).trim() !== ''
          && !isValidDecimal(unit_cost, true, 2))) {
      return res.status(400).json({ error: 'Stock quantity, minimum stock, and unit cost must be valid non-negative amounts.' });
    }
    const openingQuantity = Number(current_quantity || 0);
    if (openingQuantity > 0 && !isValidDecimal(unit_cost, false, 2)) {
      return res.status(400).json({ error: 'Enter a positive unit cost before adding opening stock.' });
    }
    const resolvedSupplierId = await resolveSupplierId(supplier_id || null, supplier_name || null);
    const resolvedLocationId = await resolveLocationId(location_id || null, location_name || 'MAIN STORE');
    const finalBaseUnit = normalizeUnit(base_unit || finalUnit);
    const quantity = openingQuantity;
    const unitPrice = Number(unit_cost || 0);
    const inventoryValue = quantity * unitPrice;

    const result = await pool.query(
      `INSERT INTO public.inventory_items (
        item_name, sku, category, unit, base_unit, purchase_unit, purchase_conversion_factor, minimum_stock_level, current_quantity,
        unit_cost, inventory_value, supplier_id, location_id, station, is_active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
      RETURNING *`,
      [
        String(item_name).trim(),
        sku || null,
        category || 'General',
        finalUnit,
        finalBaseUnit,
        finalPurchaseUnit,
        conversionFactor,
        Number(minimum_stock_level || 0),
        quantity,
        unitPrice,
        inventoryValue,
        resolvedSupplierId,
        resolvedLocationId,
        finalStation,
        active === false ? false : true,
        req.user?.name || 'Accountant',
      ]
    );

    const item = result.rows[0];
    res.status(201).json(await buildItemSummary(item));
  } catch (error) {
    res.status(error instanceof UnitConversionError ? 400 : 500).json({ error: error.message });
  }
});

router.patch('/items/:id', authenticateAccountant, async (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId) || itemId < 1) {
    return res.status(400).json({ error: 'A valid inventory item is required.' });
  }

  const {
    item_name,
    category,
    unit,
    purchase_unit,
    purchase_conversion_factor,
    minimum_stock_level,
    current_quantity,
    unit_cost,
    location_id,
    station,
  } = req.body || {};
  const finalName = String(item_name || '').trim();
  const finalStation = normalizeInventoryStation(station);
  const finalUnit = normalizeUnit(unit);
  const finalPurchaseUnit = normalizeUnit(purchase_unit);

  if (!finalName) return res.status(400).json({ error: 'Item name is required.' });
  if (!finalStation) return res.status(400).json({ error: 'Select a valid inventory station.' });
  if (!isInventoryPurchaseUnitForStock(finalUnit, finalPurchaseUnit, finalStation)) {
    return res.status(400).json({ error: 'Select stock and purchase units supported by the selected station.' });
  }
  if (!isValidDecimal(current_quantity, true) || !isValidDecimal(minimum_stock_level, true)) {
    return res.status(400).json({ error: 'Stock quantity and minimum stock must be valid non-negative numbers.' });
  }
  if (!isValidDecimal(unit_cost, true, 2)
      || (Number(current_quantity) > 0 && !isValidDecimal(unit_cost, false, 2))) {
    return res.status(400).json({ error: 'Stocked inventory must have a positive unit cost.' });
  }

  let conversionFactor;
  try {
    conversionFactor = configuredPurchaseConversionFactor(
      finalUnit,
      finalPurchaseUnit,
      purchase_conversion_factor,
      { unit: finalUnit, purchase_unit: finalPurchaseUnit }
    );
  } catch (error) {
    return res.status(error instanceof UnitConversionError ? 400 : 500).json({ error: error.message });
  }

  const finalLocationId = location_id ? Number(location_id) : null;
  if (!Number.isInteger(finalLocationId) || finalLocationId < 1) {
    return res.status(400).json({ error: 'Select a valid inventory location.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const location = await client.query(
      'SELECT id FROM public.inventory_locations WHERE id = $1 AND is_active = true',
      [finalLocationId]
    );
    if (!location.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The selected inventory location is unavailable.' });
    }

    const existingResult = await client.query(
      'SELECT * FROM public.inventory_items WHERE id = $1 AND is_active = true FOR UPDATE',
      [itemId]
    );
    const existing = existingResult.rows[0];
    if (!existing) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Active inventory item not found.' });
    }

    const reference = `INV-EDIT-${itemId}-${Date.now()}`;
    const result = await client.query(
      `UPDATE public.inventory_items
       SET item_name = $1, category = $2, unit = $3, base_unit = $3,
           purchase_unit = $4, purchase_conversion_factor = $5,
           minimum_stock_level = $6, current_quantity = $7, unit_cost = $8,
           inventory_value = $7::numeric * $8::numeric, location_id = $9,
           station = $10, updated_by = $11, updated_at = NOW()
       WHERE id = $12 AND is_active = true
       RETURNING *`,
      [
        finalName,
        String(category || 'General').trim() || 'General',
        finalUnit,
        finalPurchaseUnit,
        conversionFactor,
        Number(minimum_stock_level),
        Number(current_quantity),
        Number(unit_cost),
        finalLocationId,
        finalStation,
        req.inventoryActor.name,
        itemId,
      ]
    );
    const updated = result.rows[0];
    const oldValue = Number((Number(existing.current_quantity) * Number(existing.unit_cost)).toFixed(2));
    const newValue = Number((Number(updated.current_quantity) * Number(updated.unit_cost)).toFixed(2));
    const valueChange = Number((newValue - oldValue).toFixed(2));

    await postInventoryValueAdjustment(client, {
      amount: valueChange,
      reference,
      description: `Inventory value adjustment for ${updated.item_name}`,
      actor: req.inventoryActor.name,
    });

    const quantityChange = Number((Number(updated.current_quantity) - Number(existing.current_quantity)).toFixed(3));
    if (quantityChange !== 0) {
      const adjustmentType = quantityChange > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      await client.query(
        `INSERT INTO public.inventory_adjustments
           (item_id, location_id, adjustment_type, quantity, reason, business_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [itemId, updated.location_id, adjustmentType, Math.abs(quantityChange), 'Accountant inventory edit', currentBusinessDate(), req.inventoryActor.name]
      );
      await client.query(
        `INSERT INTO public.inventory_transactions
           (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
            source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          itemId,
          reference,
          adjustmentType,
          Math.abs(quantityChange),
          updated.unit,
          updated.unit_cost,
          Math.abs(valueChange),
          quantityChange < 0 ? existing.location_id : null,
          quantityChange > 0 ? updated.location_id : null,
          updated.station,
          currentBusinessDate(),
          req.inventoryActor.name,
          'Accountant inventory edit',
        ]
      );
    }

    await client.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('inventory_item', $1, 'updated', $2, $3)`,
      [itemId, req.inventoryActor.name, JSON.stringify({
        before: {
          item_name: existing.item_name,
          category: existing.category,
          current_quantity: existing.current_quantity,
          unit_cost: existing.unit_cost,
          inventory_value: oldValue,
          location_id: existing.location_id,
          station: existing.station,
        },
        after: {
          item_name: updated.item_name,
          category: updated.category,
          current_quantity: updated.current_quantity,
          unit_cost: updated.unit_cost,
          inventory_value: newValue,
          location_id: updated.location_id,
          station: updated.station,
        },
        value_change: valueChange,
        reference,
      })]
    );
    await client.query('COMMIT');
    return res.json(await buildItemSummary(result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Inventory item update error:', error.message);
    return res.status(500).json({ error: 'Could not update inventory item.' });
  } finally {
    client.release();
  }
});

router.delete('/items/:id', authenticateAccountant, async (req, res) => {
  const itemId = Number(req.params.id);
  if (!Number.isInteger(itemId) || itemId < 1) {
    return res.status(400).json({ error: 'A valid inventory item is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemResult = await client.query(
      'SELECT * FROM public.inventory_items WHERE id = $1 AND is_active = true FOR UPDATE',
      [itemId]
    );
    const item = itemResult.rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Active inventory item not found.' });
    }

    const quantity = Number(item.current_quantity || 0);
    const value = Number((quantity * Number(item.unit_cost || 0)).toFixed(2));
    const reference = `INV-DELETE-${itemId}-${Date.now()}`;
    await client.query(
      `UPDATE public.inventory_items
       SET is_active = false, current_quantity = 0, inventory_value = 0,
           updated_by = $1, updated_at = NOW()
       WHERE id = $2`,
      [req.inventoryActor.name, itemId]
    );

    if (quantity > 0) {
      await client.query(
        `INSERT INTO public.inventory_adjustments
           (item_id, location_id, adjustment_type, quantity, reason, business_date, created_by)
         VALUES ($1, $2, 'ADJUSTMENT_OUT', $3, $4, $5, $6)`,
        [itemId, item.location_id, quantity, 'Inventory item deleted; remaining stock written off', currentBusinessDate(), req.inventoryActor.name]
      );
      await client.query(
        `INSERT INTO public.inventory_transactions
           (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
            source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, 'ADJUSTMENT_OUT', $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11)`,
        [
          itemId,
          reference,
          quantity,
          item.unit,
          item.unit_cost,
          value,
          item.location_id,
          item.station,
          currentBusinessDate(),
          req.inventoryActor.name,
          'Inventory item deleted; remaining stock written off',
        ]
      );
    }

    await postInventoryValueAdjustment(client, {
      amount: -value,
      reference,
      description: `Inventory write-off for deleted item ${item.item_name}`,
      actor: req.inventoryActor.name,
    });
    await client.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('inventory_item', $1, 'deleted', $2, $3)`,
      [itemId, req.inventoryActor.name, JSON.stringify({
        item_name: item.item_name,
        quantity,
        unit: item.unit,
        unit_cost: item.unit_cost,
        inventory_value: value,
        reference,
      })]
    );
    await client.query('COMMIT');
    return res.json({ message: 'Inventory item deleted and accounting updated.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Inventory item delete error:', error.message);
    return res.status(500).json({ error: 'Could not delete inventory item.' });
  } finally {
    client.release();
  }
});

router.post('/purchases', async (req, res) => {
  const payload = req.body || {};
  const items = Array.isArray(payload.items) ? payload.items : [payload];
  const paymentMethod = payload.payment_method || 'Cash';
  const supplierName = payload.supplier_name || payload.supplier || 'KURAX PRIMARY SUPPLIER';
  const businessDate = payload.business_date || currentBusinessDate();
  const actor = req.user?.name || payload.posted_by || 'Accountant';
  const normalizedPaymentMethod = String(paymentMethod).toLowerCase();

  if ((normalizedPaymentMethod.includes('momo') || normalizedPaymentMethod.includes('mobile'))
    && !normalizedPaymentMethod.includes('mtn')
    && !normalizedPaymentMethod.includes('airtel')) {
    return res.status(400).json({ error: 'Choose MTN or Airtel for a mobile-money payment.' });
  }

  if (!items.length || items.some((item) => !item || typeof item !== 'object')) {
    return res.status(400).json({ error: 'At least one item is required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const supplierId = await resolveSupplierId(null, supplierName);
    const purchase = await client.query(
      `INSERT INTO public.purchase_receipts (supplier_id, receipt_number, payment_method, total_amount, business_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [supplierId, payload.receipt_number || `PUR-${Date.now()}`, paymentMethod, 0, businessDate, payload.notes || '', actor]
    );

    let totalAmount = '0';
    const purchaseLines = [];

    for (const row of items) {
      const itemName = row.item_name || row.name || row.itemId;
      const itemIdNumber = row.item_id || (itemName ? await resolveItemIdByName(itemName, row.station || 'KITCHEN') : null);
      let item = null;

      if (itemIdNumber) {
        const found = await client.query(
          `SELECT * FROM public.inventory_items WHERE id = $1 AND is_active = true FOR UPDATE`,
          [Number(itemIdNumber)]
        );
        item = found.rows[0];
      }

      if (!item && itemName) {
        const station = normalizeInventoryStation(row.station || 'KITCHEN');
        const stockUnit = normalizeUnit(row.stock_unit || row.unit || 'kg');
        const purchaseUnit = normalizeUnit(row.purchase_unit || row.unit || stockUnit);
        if (!station || !isInventoryPurchaseUnitForStock(stockUnit, purchaseUnit, station)) {
          throw new UnitConversionError('Select stock and purchase units supported by the selected station.');
        }
        const inactiveItems = await client.query(
          `SELECT id FROM public.inventory_items
           WHERE is_active = false
             AND current_quantity <= 0.0001
             AND LOWER(BTRIM(item_name)) = LOWER(BTRIM($1))
             AND UPPER(COALESCE(station, 'KITCHEN')) IN ($2, CASE WHEN $2 = 'BAR' THEN 'BARMAN' ELSE $2 END)
           FOR UPDATE`,
          [String(itemName).trim(), station]
        );
        const conversionFactor = configuredPurchaseConversionFactor(
          stockUnit,
          purchaseUnit,
          row.purchase_conversion_factor ?? row.conversion_factor,
          { unit: stockUnit, purchase_unit: purchaseUnit }
        );
        const createdItem = await client.query(
          `INSERT INTO public.inventory_items (item_name, category, unit, base_unit, purchase_unit, purchase_conversion_factor, minimum_stock_level, current_quantity, unit_cost, inventory_value, supplier_id, location_id, station, is_active, created_by, updated_by)
           VALUES ($1, $2, $3, $3, $4, $5, $6, 0, 0, 0, $7, $8, $9, true, $10, $10)
           RETURNING *`,
          [
            String(itemName).trim(),
            row.category || 'General',
            stockUnit,
            purchaseUnit,
            conversionFactor,
            Number(row.minimum_stock_level || 0),
            supplierId,
            await resolveLocationId(row.location_id || null, row.location_name || 'MAIN STORE'),
            station,
            actor,
          ]
        );
        item = createdItem.rows[0];
        const inactiveItemIds = inactiveItems.rows.map((inactiveItem) => inactiveItem.id);
        if (inactiveItemIds.length) {
          const relinkedRecipes = await client.query(
            `UPDATE public.recipe_ingredients ri
             SET ingredient_item_id = $1
             FROM public.inventory_recipes recipe
             WHERE ri.recipe_id = recipe.id
               AND recipe.status <> 'INACTIVE'
               AND ri.ingredient_item_id = ANY($2::int[])
             RETURNING ri.id`,
            [item.id, inactiveItemIds]
          );
          if (relinkedRecipes.rowCount) {
            await client.query(
              `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
               VALUES ('inventory_item', $1, 'recipe_ingredients_relinked', $2, $3)`,
              [
                item.id,
                actor,
                JSON.stringify({
                  previous_inventory_item_ids: inactiveItemIds,
                  relinked_recipe_ingredient_count: relinkedRecipes.rowCount,
                }),
              ]
            );
          }
        }
      }

      if (!item) {
        throw new Error(`Inventory item not found: ${itemName || 'unknown item'}`);
      }

      const quantity = String(row.quantity ?? '');
      const providedUnitCost = row.unit_cost === undefined || row.unit_cost === null || String(row.unit_cost).trim() === ''
        ? null
        : String(row.unit_cost);
      if (!isValidDecimal(quantity) || (providedUnitCost !== null && !isValidDecimal(providedUnitCost, false, 2))) {
        throw new UnitConversionError('Purchase quantity and unit cost must be positive amounts.');
      }

      const station = normalizeInventoryStation(item.station || row.station || 'KITCHEN');
      const stockUnit = normalizeUnit(item.unit || row.stock_unit || row.unit || 'kg');
      if (row.stock_unit && normalizeUnit(row.stock_unit) !== stockUnit) {
        throw new UnitConversionError(`The stock unit for ${item.item_name} cannot be changed by recording a purchase.`);
      }
      const requestedUnit = row.purchase_unit || (
        row.unit && normalizeUnit(row.unit) !== stockUnit ? row.unit : null
      );
      const purchaseUnit = normalizeUnit(requestedUnit || item.purchase_unit || row.unit || stockUnit);
      if (!station || !isInventoryUnitForStation(stockUnit, station) || !isInventoryPurchaseUnitForStock(stockUnit, purchaseUnit, station)) {
        throw new UnitConversionError('Select stock and purchase units supported by the item station.');
      }
      const requestedFactor = row.purchase_conversion_factor ?? row.conversion_factor;
      const conversionFactor = configuredPurchaseConversionFactor(
        stockUnit,
        purchaseUnit,
        requestedFactor ?? (purchaseUnit === normalizeUnit(item.purchase_unit) ? item.purchase_conversion_factor : undefined),
        item
      );
      const amountResult = await client.query(
        `SELECT
           ROUND($1::numeric * $2::numeric, 3)::numeric(12,3)::text AS normalized_quantity,
           ROUND($1::numeric * COALESCE($3::numeric, $4::numeric * $2::numeric), 2)::numeric(12,2)::text AS line_total,
           ROUND(COALESCE($3::numeric, $4::numeric * $2::numeric), 2)::numeric(12,2)::text AS purchase_unit_cost,
           CASE WHEN $2::numeric > 0
             THEN ROUND(COALESCE($3::numeric, $4::numeric * $2::numeric) / $2::numeric, 2)::numeric(12,2)::text
             ELSE '0' END AS normalized_unit_cost`,
        [quantity, String(conversionFactor), providedUnitCost, String(item.unit_cost || 0)]
      );
      const normalizedQuantity = amountResult.rows[0].normalized_quantity;
      const lineTotal = amountResult.rows[0].line_total;
      const unitCostInput = amountResult.rows[0].purchase_unit_cost;
      const normalizedUnitCost = amountResult.rows[0].normalized_unit_cost;
      if (Number(unitCostInput) <= 0) {
        throw new UnitConversionError('Enter a positive unit cost for this purchase or set a valid cost on the existing inventory item.');
      }
      if (Number(normalizedQuantity) <= 0) {
        throw new UnitConversionError('The converted stock quantity is below the supported precision.');
      }
      const nextTotal = await client.query(
        `SELECT ROUND($1::numeric + $2::numeric, 2)::numeric(12,2)::text AS amount`,
        [totalAmount, lineTotal]
      );
      totalAmount = nextTotal.rows[0].amount;
      const locationId = await resolveLocationId(row.location_id || item.location_id || null, row.location_name || 'MAIN STORE');

      await client.query(
        `UPDATE public.inventory_items
         SET current_quantity = current_quantity + $1::numeric,
             unit_cost = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_cost END,
             inventory_value = (current_quantity + $1::numeric) * CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE unit_cost END,
             purchase_unit = $3,
             purchase_conversion_factor = $4,
             updated_at = NOW(),
             supplier_id = COALESCE(supplier_id, $5),
             location_id = COALESCE(location_id, $6),
             updated_by = $7
         WHERE id = $8`,
        [normalizedQuantity, normalizedUnitCost, purchaseUnit, conversionFactor, supplierId, locationId, actor, item.id]
      );

      const transactionResult = await client.query(
        `INSERT INTO public.inventory_transactions (
          item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
          source_location_id, destination_location_id, station, supplier_id, business_date, created_by, notes
        ) VALUES ($1, $2, 'PURCHASE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          item.id,
          `PUR-${purchase.rows[0].id}-${item.id}-${Date.now()}`,
          normalizedQuantity,
          stockUnit,
          normalizedUnitCost,
          lineTotal,
          null,
          locationId,
          station,
          supplierId,
          businessDate,
          actor,
          `Purchase receipt ${quantity} ${purchaseUnit}; conversion ${conversionFactor} ${stockUnit} per ${purchaseUnit}`,
        ]
      );

      purchaseLines.push({
        ...transactionResult.rows[0],
        item_name: item.item_name,
        quantity: Number(quantity),
        unit: purchaseUnit,
        unit_cost: Number(unitCostInput),
        stock_unit_cost: Number(normalizedUnitCost),
        conversion_factor: String(conversionFactor),
        normalized_stock_quantity: Number(normalizedQuantity),
        normalized_stock_unit: stockUnit,
        lineTotal: Number(lineTotal),
        total_cost: Number(lineTotal),
      });

      await client.query(
        `INSERT INTO public.purchase_receipt_items
           (purchase_id, item_id, quantity, unit, unit_cost, total_cost, location_id, normalized_stock_quantity, conversion_factor, transaction_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [purchase.rows[0].id, item.id, quantity, purchaseUnit, unitCostInput, lineTotal, locationId, normalizedQuantity, conversionFactor, transactionResult.rows[0].reference_number]
      );
    }

    await client.query(
      `UPDATE public.purchase_receipts SET total_amount = $1 WHERE id = $2`,
      [totalAmount, purchase.rows[0].id]
    );

    await createJournalEntry({
      entryDate: businessDate,
      description: `Inventory purchase from ${supplierName}`,
      sourceTransaction: `PUR-${purchase.rows[0].id}`,
      postedBy: actor,
      reference: `INV-PUR-${purchase.rows[0].id}`,
      lines: [
        { accountCode: '1201', accountName: 'Inventory', debit: totalAmount },
        { accountCode: getPaymentAccount(paymentMethod), accountName: 'Cash / Bank / AP', credit: totalAmount },
      ],
    });

    await client.query('COMMIT');
    res.status(201).json({ purchase: purchase.rows[0], items: purchaseLines, total_amount: Number(totalAmount) });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error instanceof UnitConversionError ? 400 : 500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post('/purchases/:id/reverse', authenticateAccountant, async (req, res) => {
  const purchaseId = Number(req.params.id);
  const reason = String(req.body?.reason || '').trim();
  if (!Number.isInteger(purchaseId) || purchaseId < 1) {
    return res.status(400).json({ error: 'A valid purchase receipt is required.' });
  }
  if (!reason) return res.status(400).json({ error: 'A reason is required to reverse a purchase.' });
  if (reason.length > 1000) return res.status(400).json({ error: 'The reversal reason must be 1000 characters or fewer.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const receiptResult = await client.query(
      `SELECT pr.*, s.name AS supplier_name
       FROM public.purchase_receipts pr
       LEFT JOIN public.suppliers s ON s.id = pr.supplier_id
       WHERE pr.id = $1
       FOR UPDATE OF pr`,
      [purchaseId]
    );
    const receipt = receiptResult.rows[0];
    if (!receipt) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase receipt not found.' });
    }

    const originalResult = await client.query(
      `SELECT * FROM public.journal_entries WHERE reference = $1 FOR UPDATE`,
      [`INV-PUR-${purchaseId}`]
    );
    const original = originalResult.rows[0];
    if (!original) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This receipt has no original accounting entry and cannot be reversed automatically.' });
    }
    if (original.status !== 'Posted' || original.reversal_of) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This purchase receipt has already been reversed or its accounting entry is not posted.' });
    }

    let reversalDate = currentBusinessDate();
    let periodResult = await client.query(
      `SELECT start_date::text AS start_date
       FROM public.accounting_periods
       WHERE status = 'Open' AND $1::date BETWEEN start_date AND end_date
       ORDER BY start_date DESC LIMIT 1 FOR SHARE`,
      [reversalDate]
    );
    if (!periodResult.rows.length) {
      periodResult = await client.query(
        `SELECT start_date::text AS start_date
         FROM public.accounting_periods
         WHERE status = 'Open' AND start_date > $1::date
         ORDER BY start_date ASC LIMIT 1 FOR SHARE`,
        [reversalDate]
      );
      if (!periodResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'No open accounting period is available for this reversal.' });
      }
      reversalDate = periodResult.rows[0].start_date;
    }

    const linesResult = await client.query(
      `SELECT account_code, account_name, debit, credit
       FROM public.general_ledger
       WHERE journal_entry_id = $1
       ORDER BY id
       FOR SHARE`,
      [original.id]
    );
    if (!linesResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The original purchase has no ledger lines and cannot be reversed.' });
    }

    const purchaseItemsResult = await client.query(
      `SELECT pri.*, ii.item_name, ii.unit AS stock_unit, ii.unit_cost AS current_unit_cost,
              ii.current_quantity AS available_quantity, ii.location_id AS current_location_id,
              ii.station AS current_station, ii.is_active
       FROM public.purchase_receipt_items pri
       JOIN public.inventory_items ii ON ii.id = pri.item_id
       WHERE pri.purchase_id = $1
       ORDER BY pri.id
       FOR UPDATE OF ii`,
      [purchaseId]
    );
    if (!purchaseItemsResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This receipt has no inventory lines and cannot be reversed automatically.' });
    }

    for (const item of purchaseItemsResult.rows) {
      const quantity = Number(item.normalized_stock_quantity ?? item.quantity);
      if (item.is_active && Number(item.available_quantity) + 0.0001 < quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Cannot reverse this receipt: only ${item.available_quantity} ${item.stock_unit} of ${item.item_name} remain in stock. Full reversal is blocked until the receipt quantities can be reconciled with inventory.`,
        });
      }
    }

    const actor = req.inventoryActor.name;
    const reference = `REV-PUR-${purchaseId}-${Date.now()}`;
    const description = `Reversal of purchase receipt ${receipt.receipt_number || purchaseId}: ${reason}`;
    for (const item of purchaseItemsResult.rows) {
      if (!item.is_active) continue;
      const quantity = Number(item.normalized_stock_quantity ?? item.quantity);
      await client.query(
        `UPDATE public.inventory_items
         SET current_quantity = CASE
               WHEN current_quantity - $1::numeric <= 0.0001 THEN 0
               ELSE current_quantity - $1::numeric
             END,
             inventory_value = CASE
               WHEN current_quantity - $1::numeric <= 0.0001 THEN 0
               ELSE (current_quantity - $1::numeric) * unit_cost
             END,
             is_active = CASE WHEN current_quantity - $1::numeric <= 0.0001 THEN false ELSE is_active END,
             updated_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [quantity, actor, item.item_id]
      );
      await client.query(
        `INSERT INTO public.inventory_transactions
           (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
            source_location_id, station, supplier_id, business_date, created_by, notes)
         VALUES ($1, $2, 'RETURN_TO_SUPPLIER', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          item.item_id,
          reference,
          quantity,
          item.stock_unit || item.unit,
          item.current_unit_cost || item.unit_cost,
          item.total_cost,
          item.current_location_id,
          item.current_station,
          receipt.supplier_id,
          reversalDate,
          actor,
          `Reversal of purchase receipt ${receipt.receipt_number || purchaseId}: ${reason}`,
        ]
      );
      if (Number(item.available_quantity) - quantity <= 0.0001) {
        await client.query(
          `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
           VALUES ('inventory_item', $1, 'deactivated_after_purchase_reversal', $2, $3)`,
          [
            item.item_id,
            actor,
            JSON.stringify({
              purchase_id: purchaseId,
              receipt_number: receipt.receipt_number,
              reversed_quantity: quantity,
              reason,
            }),
          ]
        );
      }
    }

    const reversalResult = await client.query(
      `INSERT INTO public.journal_entries (
         reference, entry_date, description, source_transaction, posted_by,
         reversal_of, reversal_reason, status, system_type
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Posted', $8)
       RETURNING *`,
      [reference, reversalDate, description, `Reversal of ${original.reference}`, actor, original.id, reason, original.system_type || 'MAIN']
    );
    const reversal = reversalResult.rows[0];
    for (const line of linesResult.rows) {
      await client.query(
        `INSERT INTO public.general_ledger (
           journal_entry_id, account_code, account_name, debit, credit,
           entry_date, description, source_transaction, posted_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [reversal.id, line.account_code, line.account_name, line.credit, line.debit,
          reversalDate, description, `Reversal of ${original.reference}`, actor]
      );
    }
    await client.query(
      `UPDATE public.journal_entries SET status = 'Reversed' WHERE id = $1`,
      [original.id]
    );
    await client.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('purchase_receipt', $1, 'reversed', $2, $3),
              ('journal_entry', $4, 'reversed', $2, $5),
              ('journal_entry', $6, 'posted_reversal', $2, $7)`,
      [
        purchaseId,
        actor,
        JSON.stringify({ reason, reversal_reference: reference, reversal_date: reversalDate }),
        original.id,
        JSON.stringify({ reversal_id: reversal.id, reversal_reference: reference, reason, reversal_date: reversalDate }),
        reversal.id,
        JSON.stringify({ original_id: original.id, original_reference: original.reference, reason, reversal_date: reversalDate }),
      ]
    );
    await client.query('COMMIT');
    res.json({ success: true, reversal_reference: reference, reversal_date: reversalDate });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Purchase receipt reversal error:', error.message);
    res.status(500).json({ error: 'Could not reverse purchase receipt.' });
  } finally {
    client.release();
  }
});

router.post('/purchases/:id/reconcile-reversed-stock', authenticateAccountant, async (req, res) => {
  const purchaseId = Number(req.params.id);
  const reason = String(req.body?.reason || '').trim();
  if (!Number.isInteger(purchaseId) || purchaseId < 1) {
    return res.status(400).json({ error: 'A valid purchase receipt is required.' });
  }
  if (!reason) return res.status(400).json({ error: 'A reason is required to reconcile reversed stock.' });
  if (reason.length > 1000) return res.status(400).json({ error: 'The reason must be 1000 characters or fewer.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const receiptResult = await client.query(
      `SELECT * FROM public.purchase_receipts WHERE id = $1 FOR UPDATE`,
      [purchaseId]
    );
    const receipt = receiptResult.rows[0];
    if (!receipt) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase receipt not found.' });
    }

    const originalResult = await client.query(
      `SELECT * FROM public.journal_entries WHERE reference = $1 FOR UPDATE`,
      [`INV-PUR-${purchaseId}`]
    );
    const original = originalResult.rows[0];
    if (!original || original.status !== 'Reversed' || original.reversal_of) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only an already-reversed purchase receipt can be reconciled.' });
    }
    const reversalResult = await client.query(
      `SELECT id, reference
       FROM public.journal_entries
       WHERE reversal_of = $1 AND status = 'Posted'
       ORDER BY id DESC
       LIMIT 1
       FOR SHARE`,
      [original.id]
    );
    if (!reversalResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The receipt has no posted reversal entry to reconcile.' });
    }

    const itemsResult = await client.query(
      `SELECT pri.*, ii.item_name, ii.unit AS stock_unit, ii.current_quantity,
              ii.unit_cost, ii.inventory_value, ii.location_id, ii.station, ii.is_active
       FROM public.purchase_receipt_items pri
       JOIN public.inventory_items ii ON ii.id = pri.item_id
       WHERE pri.purchase_id = $1
       ORDER BY pri.id
       FOR UPDATE OF ii`,
      [purchaseId]
    );
    if (!itemsResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This receipt has no inventory lines to reconcile.' });
    }

    const groupedItems = new Map();
    for (const item of itemsResult.rows) {
      const itemId = Number(item.item_id);
      let group = groupedItems.get(itemId);
      if (!group) {
        group = {
          ...item,
          receiptQuantity: 0,
          transactionReferences: [],
        };
        groupedItems.set(itemId, group);
      }
      const lineQuantity = item.normalized_stock_quantity == null
        ? normalizeUnit(item.unit) === normalizeUnit(item.stock_unit) ? Number(item.quantity) : NaN
        : Number(item.normalized_stock_quantity);
      group.receiptQuantity += lineQuantity;
      group.transactionReferences.push(item.transaction_reference);
    }

    for (const [itemId, item] of groupedItems) {
      const otherReceiptsResult = await client.query(
        `SELECT 1 FROM public.purchase_receipt_items
         WHERE item_id = $1 AND purchase_id <> $2
         LIMIT 1`,
        [itemId, purchaseId]
      );
      const transactionsResult = await client.query(
        `SELECT transaction_type, reference_number
         FROM public.inventory_transactions
         WHERE item_id = $1
         ORDER BY id
         FOR SHARE`,
        [itemId]
      );
      const blocker = getReversedPurchaseStockCorrectionBlocker({
        currentQuantity: item.current_quantity,
        receiptQuantity: item.receiptQuantity,
        isActive: item.is_active,
        otherPurchaseReceiptExists: otherReceiptsResult.rows.length > 0,
        transactions: transactionsResult.rows,
        transactionReferences: item.transactionReferences,
        purchaseId,
        itemId,
      });
      if (blocker) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Cannot reconcile ${item.item_name}: ${blocker}` });
      }
    }

    const actor = req.inventoryActor.name;
    const businessDate = currentBusinessDate();
    for (const [itemId, item] of groupedItems) {
      const value = Number(item.inventory_value || 0);
      const reference = `REC-PUR-${purchaseId}-${itemId}-${Date.now()}`;
      await client.query(
        `UPDATE public.inventory_items
         SET is_active = false, current_quantity = 0, inventory_value = 0,
             updated_by = $1, updated_at = NOW()
         WHERE id = $2`,
        [actor, itemId]
      );
      await client.query(
        `INSERT INTO public.inventory_transactions
           (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
            source_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          itemId,
          reference,
          item.receiptQuantity,
          item.stock_unit,
          item.unit_cost,
          value,
          item.location_id,
          item.station,
          businessDate,
          actor,
          `Stale stock cleared for reversed receipt ${receipt.receipt_number || purchaseId}: ${reason}`,
        ]
      );
      await client.query(
        `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
         VALUES ('inventory_item', $1, 'reconciled_reversed_purchase_stock', $2, $3)`,
        [
          itemId,
          actor,
          JSON.stringify({
            purchase_id: purchaseId,
            receipt_number: receipt.receipt_number,
            reversal_reference: reversalResult.rows[0].reference,
            quantity: item.receiptQuantity,
            unit: item.stock_unit,
            inventory_value_cleared: value,
            reason,
          }),
        ]
      );
    }

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: 'Stale stock was cleared and the inventory item deactivated. Record the corrected purchase as a new receipt.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reversed purchase stock reconciliation error:', error.message);
    return res.status(500).json({ error: 'Could not reconcile stock for the reversed purchase.' });
  } finally {
    client.release();
  }
});

router.get('/purchases', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, s.name AS supplier_name,
              (je.status = 'Reversed') AS is_reversed,
              reversal.reference AS reversal_reference,
              reversal.reversal_reason,
              COALESCE((SELECT json_agg(row_to_json(pi)) FROM (
                SELECT pri.*, ii.item_name, ii.unit AS normalized_stock_unit FROM public.purchase_receipt_items pri
                JOIN public.inventory_items ii ON ii.id = pri.item_id
                WHERE pri.purchase_id = pr.id
              ) pi), '[]'::json) AS items
       FROM public.purchase_receipts pr
       LEFT JOIN public.suppliers s ON s.id = pr.supplier_id
       LEFT JOIN public.journal_entries je ON je.reference = 'INV-PUR-' || pr.id::text
       LEFT JOIN public.journal_entries reversal ON reversal.reversal_of = je.id
       ORDER BY pr.business_date DESC, pr.id DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/transfers', async (req, res) => {
  const payload = req.body || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const referenceNumber = payload.reference_number || `TRF-${Date.now()}`;

  if (!items.length || !payload.source_location_id || !payload.destination_location_id) {
    return res.status(400).json({ error: 'Transfer requires source and destination locations and one or more items.' });
  }
  if (Number(payload.source_location_id) === Number(payload.destination_location_id)) {
    return res.status(400).json({ error: 'Source and destination locations must be different.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const transfer = await client.query(
      `INSERT INTO public.inventory_transfers (reference_number, source_location_id, destination_location_id, status, notes, business_date, created_by)
       VALUES ($1, $2, $3, 'COMPLETED', $4, $5, $6)
       RETURNING *`,
      [referenceNumber, Number(payload.source_location_id), Number(payload.destination_location_id), payload.notes || '', payload.business_date || currentBusinessDate(), req.user?.name || 'Accountant']
    );

    const transferId = transfer.rows[0].id;
    const transferItems = [];

    for (const row of items) {
      const itemId = Number(row.item_id);
      const quantity = String(row.quantity ?? '');
      if (!isValidDecimal(quantity)) throw new UnitConversionError('Transfer quantity must be greater than zero.');
      const item = (await client.query(
        `SELECT * FROM public.inventory_items WHERE id = $1 AND location_id = $2 FOR UPDATE`,
        [itemId, Number(payload.source_location_id)]
      )).rows[0];

      if (!item) throw new Error(`Item not found for transfer: ${itemId}`);
      const unit = normalizeUnit(item.unit || 'kg');
      const conversionFactor = inventoryUnitConversionFactor(row.unit || item.unit || 'kg', item.unit || 'kg', item);
      const converted = await client.query(
        `SELECT ROUND($1::numeric * $2::numeric, 3)::numeric(12,3)::text AS quantity,
                current_quantity < ROUND($1::numeric * $2::numeric, 3) AS insufficient
         FROM public.inventory_items WHERE id = $3`,
        [quantity, String(conversionFactor), item.id]
      );
      const stockQuantity = converted.rows[0].quantity;
      if (Number(stockQuantity) <= 0) throw new UnitConversionError('The converted transfer quantity is below the supported stock precision.');
      if (converted.rows[0].insufficient) {
        throw new Error(`Insufficient stock for ${item.item_name}: has ${item.current_quantity}, needs ${stockQuantity} ${unit}.`);
      }
      const transferValue = await client.query(
        `SELECT ROUND($1::numeric * $2::numeric, 2)::numeric(12,2)::text AS value`,
        [stockQuantity, String(item.unit_cost || 0)]
      );

      await client.query(
        `UPDATE public.inventory_items
         SET current_quantity = current_quantity - $1::numeric,
             inventory_value = (current_quantity - $1::numeric) * unit_cost,
             updated_at = NOW()
         WHERE id = $2 AND location_id = $3`,
        [stockQuantity, itemId, Number(payload.source_location_id)]
      );

      const destinationResult = await client.query(
        `SELECT * FROM public.inventory_items
         WHERE LOWER(item_name) = LOWER($1)
           AND UPPER(COALESCE(station, 'KITCHEN')) = UPPER($2)
           AND location_id = $3
         ORDER BY id
         FOR UPDATE`,
        [item.item_name, item.station || 'KITCHEN', Number(payload.destination_location_id)]
      );
      let destinationItem = destinationResult.rows.find((candidate) => normalizeUnit(candidate.unit || 'kg') === unit);

      if (destinationItem) {
        const updatedDestination = await client.query(
          `UPDATE public.inventory_items
           SET current_quantity = current_quantity + $1::numeric,
               inventory_value = (current_quantity + $1::numeric) * unit_cost,
               updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [stockQuantity, destinationItem.id]
        );
        destinationItem = updatedDestination.rows[0];
      } else {
        const createdDestination = await client.query(
          `INSERT INTO public.inventory_items (
             item_name, sku, category, unit, base_unit, purchase_unit, purchase_conversion_factor, minimum_stock_level, current_quantity,
             unit_cost, inventory_value, supplier_id, location_id, station, is_active, created_by, updated_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
           RETURNING *`,
          [item.item_name, item.sku, item.category, unit, item.base_unit, item.purchase_unit || item.unit,
            item.purchase_conversion_factor || 1, item.minimum_stock_level, stockQuantity, item.unit_cost,
            transferValue.rows[0].value, item.supplier_id,
            Number(payload.destination_location_id), item.station, item.is_active, req.user?.name || 'Accountant']
        );
        destinationItem = createdDestination.rows[0];
      }

      await client.query(
        `INSERT INTO public.inventory_transfer_items (transfer_id, item_id, quantity, unit)
         VALUES ($1, $2, $3, $4)`,
        [transferId, itemId, stockQuantity, unit]
      );

      await client.query(
        `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, 'TRANSFER_OUT', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [item.id, `${referenceNumber}-OUT-${item.id}`, stockQuantity, unit, item.unit_cost || 0, transferValue.rows[0].value, Number(payload.source_location_id), Number(payload.destination_location_id), item.station || 'KITCHEN', payload.business_date || currentBusinessDate(), req.user?.name || 'Accountant', `Transfer out: ${item.item_name}`]
      );

      await client.query(
        `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, 'TRANSFER_IN', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [destinationItem.id, `${referenceNumber}-IN-${item.id}`, stockQuantity, unit, item.unit_cost || 0, transferValue.rows[0].value, Number(payload.source_location_id), Number(payload.destination_location_id), item.station || 'KITCHEN', payload.business_date || currentBusinessDate(), req.user?.name || 'Accountant', `Transfer in: ${item.item_name}`]
      );

      transferItems.push({ item_name: item.item_name, quantity: stockQuantity, unit });
    }

    await client.query('COMMIT');
    res.status(201).json({ transfer: transfer.rows[0], items: transferItems });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error instanceof UnitConversionError ? 400 : 500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT it.*, sl.name AS source_name, dl.name AS destination_name,
              COALESCE((SELECT json_agg(row_to_json(ti)) FROM (
                SELECT iti.*, ii.item_name FROM public.inventory_transfer_items iti
                JOIN public.inventory_items ii ON ii.id = iti.item_id
                WHERE iti.transfer_id = it.id
              ) ti), '[]'::json) AS transfer_items
       FROM public.inventory_transfers it
       LEFT JOIN public.inventory_locations sl ON sl.id = it.source_location_id
       LEFT JOIN public.inventory_locations dl ON dl.id = it.destination_location_id
       ORDER BY it.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recipes', async (req, res) => {
  try {
    const station = requestedRecipeStation(req, req.query.station, res);
    if (res.headersSent) return;
    const result = await pool.query(
      `WITH ranked_recipes AS (
         SELECT r.*,
                ROW_NUMBER() OVER (
                  PARTITION BY COALESCE(r.menu_item_id::text, LOWER(TRIM(r.menu_name))),
                               CASE WHEN UPPER(r.station) = 'BARMAN' THEN 'BAR' ELSE UPPER(r.station) END
                  ORDER BY (r.status = 'ACTIVE') DESC, r.updated_at DESC NULLS LAST,
                           r.created_at DESC, r.version_number DESC, r.id DESC
                ) AS recipe_rank
         FROM public.inventory_recipes r
         WHERE ($1 = 'ALL' OR UPPER(r.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
       )
       SELECT r.*, COALESCE((SELECT json_agg(row_to_json(ri)) FROM (
        SELECT ri.*, ii.item_name AS ingredient_name
        FROM public.recipe_ingredients ri
        LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
        WHERE ri.recipe_id = r.id
      ) ri), '[]'::json) AS ingredients
       FROM ranked_recipes r
       WHERE r.recipe_rank = 1
       ORDER BY r.created_at DESC`,
      [station || 'ALL']
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recipes/menu-items', async (req, res) => {
  const station = requestedRecipeStation(req, req.query.station, res);
  if (res.headersSent) return;
  if (!station) return res.status(400).json({ error: 'A department is required to browse menu items.' });

  try {
    const result = await pool.query(
      `SELECT m.id, m.name, m.category, m.station, m.price,
              COALESCE(recipe.status, 'NOT_CONFIGURED') AS recipe_status,
              recipe.id AS recipe_id,
              recipe.version_number AS recipe_version
       FROM public.menus m
       LEFT JOIN LATERAL (
         SELECT r.id, r.status, r.version_number
         FROM public.inventory_recipes r
         WHERE r.menu_item_id = m.id
          OR (r.menu_item_id IS NULL AND LOWER(r.menu_name) = LOWER(m.name)
            AND UPPER(r.station) IN (CASE WHEN UPPER(m.station) = 'BARMAN' THEN 'BAR' ELSE UPPER(m.station) END,
                         CASE WHEN UPPER(m.station) IN ('BAR', 'BARMAN') THEN 'BARMAN' ELSE UPPER(m.station) END))
         ORDER BY (r.status = 'ACTIVE') DESC, r.updated_at DESC NULLS LAST,
                  r.created_at DESC, r.version_number DESC
         LIMIT 1
       ) recipe ON true
       WHERE m.published = true
         AND LOWER(TRIM(COALESCE(m.category, ''))) <> 'shisha'
         AND LOWER(TRIM(COALESCE(m.station, ''))) <> 'shisha'
         AND (
           $1 = 'ALL'
           OR UPPER(m.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END)
           OR ($1 <> 'ALL' AND NULLIF(TRIM(m.station), '') IS NULL)
         )
       ORDER BY m.name ASC`,
      [station]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recipes', async (req, res) => {
  const payload = req.body || {};
  const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  const menuItemId = Number(payload.menu_item_id);
  if (!Number.isInteger(menuItemId) || menuItemId <= 0) return res.status(400).json({ error: 'Select an existing menu item.' });
  if (!ingredients.length) return res.status(400).json({ error: 'Add at least one ingredient to the recipe.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const menuResult = await client.query(
      `SELECT id, name, station FROM public.menus
       WHERE id = $1 AND published = true
         AND LOWER(TRIM(COALESCE(category, ''))) <> 'shisha'
         AND LOWER(TRIM(COALESCE(station, ''))) <> 'shisha'
       FOR SHARE`,
      [menuItemId]
    );
    const menuItem = menuResult.rows[0];
    const station = normalizeStation(menuItem?.station);
    if (!menuItem) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Published menu item not found.' });
    }
    if (!station) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This menu item has no station assignment. Assign it to Kitchen, Bar, or Barista before configuring a recipe.' });
    }
    if (!canManageStation(req, station)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only configure recipes for your assigned department.' });
    }
    if (ingredients.some((ingredient) => {
      return !isValidDecimal(ingredient.quantity) || !Number.isInteger(Number(ingredient.ingredient_item_id));
    })) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Each ingredient needs an existing inventory item and a quantity greater than zero.' });
    }

    const ingredientIds = [...new Set(ingredients.map((ingredient) => Number(ingredient.ingredient_item_id)))];
    const stockResult = await client.query(
      `SELECT ii.id, ii.item_name, ii.unit, ii.purchase_unit, ii.purchase_conversion_factor, ii.station, il.name AS location_name
       FROM public.inventory_items ii
       LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
       WHERE ii.id = ANY($1::int[]) AND ii.is_active = true`,
      [ingredientIds]
    );
    const stockItems = new Map(stockResult.rows.map((item) => [item.id, item]));
    for (const ingredient of ingredients) {
      const stockItem = stockItems.get(Number(ingredient.ingredient_item_id));
      if (!stockItem || !itemAssignedToStation(stockItem.station, station)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ingredient ${stockItem?.item_name || ingredient.ingredient_item_id} is not available to ${station}.` });
      }
      try {
        inventoryUnitConversionFactor(ingredient.unit || stockItem.unit, stockItem.unit, stockItem);
      } catch (error) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ingredient unit ${ingredient.unit} is incompatible with ${stockItem.unit} stock for ${stockItem.item_name}.` });
      }
    }

    await client.query('SELECT pg_advisory_xact_lock($1)', [menuItemId]);
    const existingResult = await client.query(
      `SELECT * FROM public.inventory_recipes
       WHERE (menu_item_id = $1 OR (menu_item_id IS NULL AND LOWER(menu_name) = LOWER($2)))
         AND UPPER(station) IN ($3, CASE WHEN $3 = 'BAR' THEN 'BARMAN' ELSE $3 END)
       ORDER BY (status = 'ACTIVE') DESC, updated_at DESC NULLS LAST, created_at DESC, id DESC
       LIMIT 1
       FOR UPDATE`,
      [menuItemId, menuItem.name, station]
    );
    let recipe;
    if (existingResult.rows[0]) {
      const currentRecipe = existingResult.rows[0];
      await client.query('DELETE FROM public.recipe_ingredients WHERE recipe_id = $1', [currentRecipe.id]);
      const updatedRecipe = await client.query(
        `UPDATE public.inventory_recipes
         SET menu_item_id = $2, menu_name = $3, station = $4, version_number = 1,
             status = 'DRAFT', updated_at = NOW(), updated_by = $5
         WHERE id = $1
         RETURNING *`,
        [currentRecipe.id, menuItem.id, menuItem.name, station, req.inventoryActor.name]
      );
      recipe = updatedRecipe.rows[0];
    } else {
      const recipeResult = await client.query(
        `INSERT INTO public.inventory_recipes (menu_item_id, menu_name, station, version_number, status, created_by, updated_by)
         VALUES ($1, $2, $3, 1, 'DRAFT', $4, $4)
         RETURNING *`,
        [menuItem.id, menuItem.name, station, req.inventoryActor.name]
      );
      recipe = recipeResult.rows[0];
    }

    for (const ingredient of ingredients) {
      const stockItem = stockItems.get(Number(ingredient.ingredient_item_id));
      await client.query(
        `INSERT INTO public.recipe_ingredients (recipe_id, ingredient_item_id, ingredient_name, quantity, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipe.id, stockItem.id, stockItem.item_name, String(ingredient.quantity), normalizeUnit(ingredient.unit || stockItem.unit)]
      );
    }

    const activeRecipe = await activateRecipeVersion(client, recipe, req.inventoryActor.name);
    await client.query('COMMIT');
    res.status(existingResult.rows[0] ? 200 : 201).json({ recipe: activeRecipe, ingredients });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.put('/recipes/:id', async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`SELECT * FROM public.inventory_recipes WHERE id = $1 FOR UPDATE`, [Number(id)]);
    const currentRecipe = current.rows[0];
    if (!currentRecipe) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipe not found.' });
    }
    if (!canManageStation(req, currentRecipe.station)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only edit recipes for your assigned department.' });
    }
    if (!ingredients.length || ingredients.some((ingredient) => !Number.isInteger(Number(ingredient.ingredient_item_id)) || !isValidDecimal(ingredient.quantity))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Each recipe needs inventory ingredients with quantities greater than zero.' });
    }
    const ingredientIds = [...new Set(ingredients.map((ingredient) => Number(ingredient.ingredient_item_id)))];
    const stockResult = await client.query(
      `SELECT ii.id, ii.item_name, ii.unit, ii.purchase_unit, ii.purchase_conversion_factor, ii.station, il.name AS location_name
       FROM public.inventory_items ii
       LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
       WHERE ii.id = ANY($1::int[]) AND ii.is_active = true`,
      [ingredientIds]
    );
    const stockItems = new Map(stockResult.rows.map((item) => [item.id, item]));
    for (const ingredient of ingredients) {
      const stockItem = stockItems.get(Number(ingredient.ingredient_item_id));
      if (!stockItem || !itemAssignedToStation(stockItem.station, currentRecipe.station)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ingredient ${stockItem?.item_name || ingredient.ingredient_item_id} is not available to this department.` });
      }
      try {
        inventoryUnitConversionFactor(ingredient.unit || stockItem.unit, stockItem.unit, stockItem);
      } catch (error) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ingredient unit ${ingredient.unit} is incompatible with ${stockItem.unit} stock for ${stockItem.item_name}.` });
      }
    }

    await client.query(`DELETE FROM public.recipe_ingredients WHERE recipe_id = $1`, [Number(id)]);
    for (const ingredient of ingredients) {
      const stockItem = stockItems.get(Number(ingredient.ingredient_item_id));
      await client.query(
        `INSERT INTO public.recipe_ingredients (recipe_id, ingredient_item_id, ingredient_name, quantity, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [Number(id), stockItem.id, stockItem.item_name, String(ingredient.quantity), normalizeUnit(ingredient.unit || stockItem.unit)]
      );
    }
    await client.query(
      `UPDATE public.inventory_recipes SET version_number = 1 WHERE id = $1`,
      [Number(id)]
    );
    const recipe = await activateRecipeVersion(client, currentRecipe, req.inventoryActor.name);
    await client.query('COMMIT');
    res.json(recipe);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.delete('/recipes/:id', async (req, res) => {
  const recipeId = Number(req.params.id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return res.status(400).json({ error: 'A valid recipe ID is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT id, menu_name, station, version_number, status FROM public.inventory_recipes WHERE id = $1 FOR UPDATE',
      [recipeId]
    );
    const recipe = result.rows[0];
    if (!recipe) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipe not found.' });
    }
    if (!canManageStation(req, recipe.station)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only remove recipes for your assigned department.' });
    }
    if (recipe.status === 'INACTIVE') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This recipe is already inactive.' });
    }

    await client.query(
      `UPDATE public.inventory_recipes
       SET status = 'INACTIVE', updated_at = NOW(), updated_by = $2
       WHERE id = $1`,
      [recipeId, req.inventoryActor.name]
    );
    await client.query(
      `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
       VALUES ('inventory_recipe', $1, 'deactivated', $2, $3)`,
      [recipeId, req.inventoryActor.name, JSON.stringify({
        menu_name: recipe.menu_name,
        station: recipe.station,
        version_number: recipe.version_number,
        previous_status: recipe.status,
        history_preserved: true,
      })]
    );

    await client.query('COMMIT');
    res.json({ id: recipeId, status: 'INACTIVE' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.get('/recipes/:id/costing', async (req, res) => {
  const { id } = req.params;
  try {
    const recipe = await pool.query(
      `SELECT r.*, COALESCE((SELECT json_agg(row_to_json(ri)) FROM (
        SELECT ri.*, ii.item_name, ii.unit, ii.unit_cost
        FROM public.recipe_ingredients ri
        LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
        WHERE ri.recipe_id = r.id
      ) ri), '[]'::json) AS ingredients
       FROM public.inventory_recipes r
       WHERE r.id = $1`,
      [Number(id)]
    );

    if (!recipe.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });
    if (ROLE_STATIONS[req.inventoryActor.role] && !canManageStation(req, recipe.rows[0].station)) {
      return res.status(403).json({ error: 'You can only view recipes for your assigned department.' });
    }

    const parsedIngredients = recipe.rows[0].ingredients || [];
    let totalCost = '0';
    let missingCostItems = 0;

    for (const ingredient of parsedIngredients) {
      const ingredientItem = ingredient.ingredient_item_id
        ? await pool.query(`SELECT * FROM public.inventory_items WHERE id = $1 LIMIT 1`, [ingredient.ingredient_item_id])
        : null;
      const item = ingredientItem?.rows[0] || null;
      if (!item) {
        missingCostItems += 1;
        continue;
      }
      let cost;
      try {
        const factor = inventoryUnitConversionFactor(ingredient.unit || item.unit, item.unit || 'kg', item);
        const costResult = await pool.query(
          `SELECT ROUND($1::numeric * $2::numeric * $3::numeric, 2)::numeric(12,2)::text AS cost`,
          [String(ingredient.quantity || 0), String(factor), String(item.unit_cost || 0)]
        );
        cost = costResult.rows[0].cost;
      } catch {
        missingCostItems += 1;
        continue;
      }
      if (Number(item.unit_cost || 0) <= 0) missingCostItems += 1;
      const runningTotal = await pool.query(
        `SELECT ROUND($1::numeric + $2::numeric, 2)::numeric(12,2)::text AS total`,
        [totalCost, cost]
      );
      totalCost = runningTotal.rows[0].total;
    }

    const sellingPrice = Number(recipe.rows[0].selling_price || 0);
    const grossProfit = sellingPrice - Number(totalCost);
    const foodCostPercentage = sellingPrice > 0 ? ((Number(totalCost) / sellingPrice) * 100) : 0;

    res.json({ recipe: recipe.rows[0], total_cost: Number(totalCost), selling_price: sellingPrice, gross_profit: grossProfit, food_cost_percentage: foodCostPercentage, cost_status: missingCostItems ? 'REVIEW_REQUIRED' : 'ESTIMATED', missing_cost_items: missingCostItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/consumption', async (req, res) => {
  try {
    const station = ROLE_STATIONS[req.inventoryActor.role];
    const result = await pool.query(
      `SELECT ic.*, ii.item_name, ir.menu_name
       FROM public.inventory_consumptions ic
       LEFT JOIN public.inventory_items ii ON ii.id = ic.item_id
       LEFT JOIN public.inventory_recipes ir ON ir.id = ic.recipe_id
       WHERE ($1::text IS NULL OR UPPER(ic.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
       ORDER BY ic.created_at DESC
       LIMIT 200`,
      [station || null]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/consumption', async (req, res) => {
  const payload = req.body || {};
  const orderId = Number(payload.order_id || payload.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'A paid order ID is required.' });
  if (!ROLE_STATIONS[req.inventoryActor.role] && !['ACCOUNTANT', 'DIRECTOR', 'MANAGER'].includes(req.inventoryActor.role)) {
    return res.status(403).json({ error: 'This account cannot post inventory consumption.' });
  }

  try {
    const order = await pool.query(`SELECT items FROM public.orders WHERE id = $1`, [orderId]);
    if (!order.rows[0]) return res.status(404).json({ error: 'Order not found.' });
    const orderItems = Array.isArray(order.rows[0].items) ? order.rows[0].items : JSON.parse(order.rows[0].items || '[]');
    const station = ROLE_STATIONS[req.inventoryActor.role];
    if (station && orderItems.some((item) => isActiveOrderItem(item) && normalizeStation(item.station || 'KITCHEN') !== station)) {
      return res.status(403).json({ error: 'You can only process consumption for your assigned department.' });
    }
    const entries = await consumeSoldOrderItems({
      orderId,
      items: orderItems,
      businessDate: payload.business_date,
      createdBy: req.inventoryActor.name,
    });
    res.json({ success: true, record_count: entries.filter((entry) => ['CONSUMED', 'CONSUMED_COST_REVIEW'].includes(entry.status)).length, entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/waste', async (req, res) => {
  try {
    const station = ROLE_STATIONS[req.inventoryActor.role];
    const result = await pool.query(
      `SELECT iw.*, ii.item_name
       FROM public.inventory_waste iw
       LEFT JOIN public.inventory_items ii ON ii.id = iw.item_id
       WHERE ($1::text IS NULL OR UPPER(iw.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
       ORDER BY iw.created_at DESC
       LIMIT 200`,
      [station || null]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/waste', async (req, res) => {
  const payload = req.body || {};
  const itemId = Number(payload.item_id || payload.itemId);
  const quantity = String(payload.quantity ?? '');
  const actor = req.inventoryActor.name;

  if (!Number.isInteger(itemId) || itemId <= 0 || !isValidDecimal(quantity)) {
    return res.status(400).json({ error: 'Item and quantity are required.' });
  }

  const client = await pool.connect();
  let item;
  let wasteEntry;
  const businessDate = payload.business_date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());

  try {
    await client.query('BEGIN');
    item = (await client.query(`SELECT * FROM public.inventory_items WHERE id = $1 FOR UPDATE`, [itemId])).rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const station = normalizeStation(payload.station || item.station || 'KITCHEN');
    if (ROLE_STATIONS[req.inventoryActor.role] && ROLE_STATIONS[req.inventoryActor.role] !== station) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only record waste for your assigned department.' });
    }
    if (ROLE_STATIONS[req.inventoryActor.role] && normalizeStation(item.station) && normalizeStation(item.station) !== station) {
      const location = await client.query(`SELECT name FROM public.inventory_locations WHERE id = $1`, [item.location_id]);
      if (String(location.rows[0]?.name || '').trim().toUpperCase() !== 'MAIN STORE') {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'This stock item belongs to another department.' });
      }
    }
    let recordedQuantity;
    let newCurrent;
    try {
      const factor = inventoryUnitConversionFactor(payload.unit || item.unit || 'kg', item.unit || 'kg', item);
      const converted = await client.query(
        `SELECT ROUND($1::numeric * $2::numeric, 3)::numeric(12,3)::text AS quantity,
                (current_quantity - ROUND($1::numeric * $2::numeric, 3)) < 0 AS insufficient,
                GREATEST(current_quantity - ROUND($1::numeric * $2::numeric, 3), 0)::numeric(12,3)::text AS remaining
         FROM public.inventory_items WHERE id = $3`,
        [quantity, String(factor), item.id]
      );
      recordedQuantity = converted.rows[0].quantity;
      newCurrent = converted.rows[0].remaining;
      if (Number(recordedQuantity) <= 0) throw new UnitConversionError('The converted waste quantity is below the supported stock precision.');
      if (converted.rows[0].insufficient) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Insufficient stock for ${item.item_name}. Available: ${item.current_quantity}.` });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: error.message });
    }

    wasteEntry = await client.query(
      `INSERT INTO public.inventory_waste (item_id, quantity, unit, station, reason, business_date, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [item.id, recordedQuantity, normalizeUnit(item.unit || 'kg'), station, payload.reason || 'Waste', businessDate, actor, payload.notes || '']
    );

    await client.query(
      `UPDATE public.inventory_items SET current_quantity = $1::numeric, inventory_value = $1::numeric * unit_cost, updated_at = NOW() WHERE id = $2`,
      [newCurrent, item.id]
    );

    const wasteCostResult = await client.query(
      `SELECT ROUND($1::numeric * $2::numeric, 2)::numeric(12,2)::text AS value`,
      [recordedQuantity, String(item.unit_cost || 0)]
    );
    const wasteCost = wasteCostResult.rows[0].value;
    await client.query(
      `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
       VALUES ($1, $2, 'WASTE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [item.id, `WASTE-${wasteEntry.rows[0].id}`, recordedQuantity, normalizeUnit(item.unit || 'kg'), String(item.unit_cost || 0), wasteCost, item.location_id || null, null, station, businessDate, actor, Number(item.unit_cost || 0) > 0 ? (payload.notes || 'Waste entry') : `COST_REVIEW: missing unit cost for ${item.item_name}; ${payload.notes || 'Waste entry'}`]
    );

    if (Number(wasteCost) > 0) {
      await createJournalEntry({
        queryable: client,
        entryDate: businessDate,
        description: `Waste for ${item.item_name}`,
        sourceTransaction: `WASTE-${wasteEntry.rows[0].id}`,
        postedBy: actor,
        reference: `WASTE-${wasteEntry.rows[0].id}`,
        lines: [
          { accountCode: '5009', accountName: 'Waste / Inventory Loss', debit: Number(wasteCost) },
          { accountCode: '1201', accountName: 'Inventory', credit: Number(wasteCost) },
        ],
      });
    }
    await client.query('COMMIT');

    res.status(201).json(wasteEntry.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.get('/stock-counts', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sc.*, ii.item_name, il.name AS location_name
       FROM public.stock_counts sc
       LEFT JOIN public.inventory_items ii ON ii.id = sc.item_id
       LEFT JOIN public.inventory_locations il ON il.id = sc.location_id
       ORDER BY sc.created_at DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/stock-counts', async (req, res) => {
  const payload = req.body || {};
  const itemId = Number(payload.item_id || payload.itemId);
  const locationId = Number(payload.location_id || payload.locationId || 0);
  const physicalQuantity = Number(payload.physical_quantity || 0);

  if (!itemId) return res.status(400).json({ error: 'Item is required.' });

  try {
    const item = (await pool.query(`SELECT * FROM public.inventory_items WHERE id = $1`, [itemId])).rows[0];
    if (!item) return res.status(404).json({ error: 'Inventory item not found.' });

    const systemQuantity = Number(item.current_quantity || 0);
    const variance = physicalQuantity - systemQuantity;
    const countRecord = await pool.query(
      `INSERT INTO public.stock_counts (item_id, location_id, system_quantity, physical_quantity, variance, reason, business_date, counted_by, approved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [item.id, locationId || item.location_id, systemQuantity, physicalQuantity, variance, payload.reason || 'Physical count', payload.business_date || currentBusinessDate(), payload.counted_by || req.user?.name || 'Accountant', payload.approved_by || null]
    );

    if (Math.abs(variance) > 0.0001) {
      const adjustmentType = variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      await pool.query(
        `INSERT INTO public.inventory_adjustments (item_id, location_id, adjustment_type, quantity, reason, business_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [item.id, locationId || item.location_id, adjustmentType, Math.abs(variance), payload.reason || 'Stock count variance', payload.business_date || currentBusinessDate(), req.user?.name || 'Accountant']
      );

        await pool.query(
          `UPDATE public.inventory_items SET current_quantity = current_quantity + $1, inventory_value = (current_quantity + $1) * unit_cost, updated_at = NOW() WHERE id = $2`,
        [variance, item.id]
      );

      await pool.query(
        `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [item.id, `ADJ-${countRecord.rows[0].id}`, adjustmentType, Math.abs(variance), normalizeUnit(item.unit || 'kg'), Number(item.unit_cost || 0), Math.abs(variance) * Number(item.unit_cost || 0), locationId || item.location_id, null, item.station || 'KITCHEN', payload.business_date || currentBusinessDate(), req.user?.name || 'Accountant', 'Stock count variance']
      );
    }

    res.status(201).json(countRecord.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/adjustments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ia.*, ii.item_name, il.name AS location_name
       FROM public.inventory_adjustments ia
       LEFT JOIN public.inventory_items ii ON ii.id = ia.item_id
       LEFT JOIN public.inventory_locations il ON il.id = ia.location_id
       ORDER BY ia.created_at DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(SUM(ii.current_quantity * ii.unit_cost), 0) AS total_inventory_value,
        COALESCE(SUM(CASE WHEN il.name = 'MAIN STORE' THEN ii.current_quantity * ii.unit_cost ELSE 0 END), 0) AS main_store_value,
        COALESCE(SUM(CASE WHEN il.name = 'KITCHEN' THEN ii.current_quantity * ii.unit_cost ELSE 0 END), 0) AS kitchen_value,
        COALESCE(SUM(CASE WHEN il.name = 'BAR' THEN ii.current_quantity * ii.unit_cost ELSE 0 END), 0) AS bar_value,
        COALESCE(SUM(CASE WHEN il.name = 'BARISTA' THEN ii.current_quantity * ii.unit_cost ELSE 0 END), 0) AS barista_value,
        COUNT(*) AS total_items,
        COUNT(*) FILTER (WHERE ii.current_quantity <= ii.minimum_stock_level) AS low_stock_items,
        COUNT(*) FILTER (WHERE ii.current_quantity <= 0) AS out_of_stock_items,
        COUNT(*) FILTER (WHERE ii.current_quantity < 0) AS negative_stock_items
      FROM public.inventory_items ii
      LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
      WHERE ii.is_active = true
        AND ${shishaInventoryFilterSql('ii')}
    `);

    const purchaseTotal = await pool.query(
      `SELECT COALESCE(SUM(pr.total_amount) FILTER (WHERE je.status IS DISTINCT FROM 'Reversed'), 0) AS total_purchases
       FROM public.purchase_receipts pr
       LEFT JOIN public.journal_entries je ON je.reference = 'INV-PUR-' || pr.id::text`
    );
    const consumptionTotal = await pool.query(`SELECT COALESCE(SUM(quantity * unit_cost), 0) AS total_consumption FROM public.inventory_transactions WHERE transaction_type = 'CONSUMPTION'`);
    const wasteTotal = await pool.query(`SELECT COALESCE(SUM(quantity * unit_cost), 0) AS total_waste FROM public.inventory_transactions WHERE transaction_type = 'WASTE'`);

    res.json({
      ...result.rows[0],
      total_purchases: Number(purchaseTotal.rows[0]?.total_purchases || 0),
      total_consumption: Number(consumptionTotal.rows[0]?.total_consumption || 0),
      total_waste: Number(wasteTotal.rows[0]?.total_waste || 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/inventory-activity', async (req, res) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
  const startDate = req.query.startDate || today;
  const endDate = req.query.endDate || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    return res.status(400).json({ error: 'A valid startDate and endDate range is required.' });
  }

  try {
    const station = ROLE_STATIONS[req.inventoryActor.role];
    const [transactionsResult, stockResult] = await Promise.all([
      pool.query(
        `SELECT it.business_date::text AS business_date, it.reference_number, ii.item_name,
                it.transaction_type, it.quantity, it.unit, it.unit_cost, it.total_value,
                UPPER(COALESCE(it.station, 'KITCHEN')) AS station,
                sl.name AS source_location, dl.name AS destination_location,
                s.name AS supplier_name, it.notes,
                CASE
                  WHEN it.transaction_type = 'PURCHASE' THEN EXISTS (
                    SELECT 1
                    FROM public.purchase_receipt_items pri
                    JOIN public.journal_entries purchase_je
                      ON purchase_je.reference = 'INV-PUR-' || pri.purchase_id::text
                    WHERE (
                      pri.transaction_reference = it.reference_number
                      OR (
                        pri.transaction_reference IS NULL
                        AND it.reference_number LIKE 'PUR-' || pri.purchase_id::text || '-' || pri.item_id::text || '-%'
                      )
                    )
                    AND (
                      purchase_je.status = 'Reversed'
                      OR EXISTS (
                        SELECT 1 FROM public.journal_entries reversal
                        WHERE reversal.reversal_of = purchase_je.id
                      )
                    )
                  )
                  WHEN it.transaction_type = 'RETURN_TO_SUPPLIER' THEN EXISTS (
                    SELECT 1
                    FROM public.purchase_receipts pr
                    JOIN public.journal_entries purchase_je
                      ON purchase_je.reference = 'INV-PUR-' || pr.id::text
                    WHERE it.reference_number LIKE 'REV-PUR-' || pr.id::text || '-%'
                      AND (
                        purchase_je.status = 'Reversed'
                        OR EXISTS (
                          SELECT 1 FROM public.journal_entries reversal
                          WHERE reversal.reversal_of = purchase_je.id
                        )
                      )
                  )
                  ELSE false
                END AS is_reversed_purchase_activity
         FROM public.inventory_transactions it
         LEFT JOIN public.inventory_items ii ON ii.id = it.item_id
         LEFT JOIN public.inventory_locations sl ON sl.id = it.source_location_id
         LEFT JOIN public.inventory_locations dl ON dl.id = it.destination_location_id
         LEFT JOIN public.suppliers s ON s.id = it.supplier_id
         WHERE it.business_date BETWEEN $1::date AND $2::date
           AND ($3::text IS NULL OR UPPER(COALESCE(it.station, 'KITCHEN')) IN ($3, CASE WHEN $3 = 'BAR' THEN 'BARMAN' ELSE $3 END))
         ORDER BY it.business_date DESC, it.id DESC`,
        [startDate, endDate, station || null]
      ),
      pool.query(
        `SELECT ii.item_name, UPPER(COALESCE(ii.station, 'KITCHEN')) AS station,
                ii.current_quantity, ii.unit, ii.unit_cost,
                ii.current_quantity * ii.unit_cost AS inventory_value,
                il.name AS location_name, s.name AS supplier_name
         FROM public.inventory_items ii
         LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
         LEFT JOIN public.suppliers s ON s.id = ii.supplier_id
         WHERE ii.is_active = true
           AND ${shishaInventoryFilterSql('ii')}
           AND ($1::text IS NULL OR UPPER(COALESCE(ii.station, 'KITCHEN')) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
         ORDER BY ii.item_name, ii.id`,
        [station || null]
      ),
    ]);

    const transactions = excludeReversedPurchaseActivity(transactionsResult.rows).map(({
      is_reversed_purchase_activity,
      ...row
    }) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      unit_cost: Number(row.unit_cost || 0),
      total_value: Number(row.total_value || 0),
    }));
    const totalsByType = transactions.reduce((totals, row) => {
      const current = totals[row.transaction_type] || { count: 0, quantity: 0, value: 0 };
      current.count += 1;
      current.quantity += row.quantity;
      current.value += row.total_value;
      totals[row.transaction_type] = current;
      return totals;
    }, {});
    const stock = stockResult.rows.map((row) => ({
      ...row,
      current_quantity: Number(row.current_quantity || 0),
      unit_cost: Number(row.unit_cost || 0),
      inventory_value: Number(row.inventory_value || 0),
    }));

    res.json({
      startDate,
      endDate,
      generatedAt: new Date().toISOString(),
      totalsByType,
      netPurchases: (totalsByType.PURCHASE?.value || 0) - (totalsByType.RETURN_TO_SUPPLIER?.value || 0),
      transactionCount: transactions.length,
      inventoryValue: stock.reduce((total, row) => total + row.inventory_value, 0),
      transactions,
      currentStock: stock,
    });
  } catch (error) {
    console.error('Inventory activity report failed:', error.message);
    res.status(500).json({ error: 'Could not load the inventory activity report.' });
  }
});

router.get('/reports/cogs', async (req, res) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
  const startDate = req.query.startDate || `${today.slice(0, 7)}-01`;
  const endDate = req.query.endDate || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
    return res.status(400).json({ error: 'A valid startDate and endDate range is required.' });
  }

  try {
    const station = ROLE_STATIONS[req.inventoryActor.role];
    const [consumptionResult, wasteResult, salesResult, refundsResult] = await Promise.all([
      pool.query(
        `SELECT it.business_date, UPPER(COALESCE(it.station, 'KITCHEN')) AS station,
                COALESCE(ir.menu_name, 'Unassigned menu item') AS menu_name,
                ii.item_name,
                SUM(CASE WHEN it.transaction_type = 'REVERSAL' THEN -it.quantity ELSE it.quantity END) AS quantity,
                SUM(CASE WHEN it.transaction_type = 'REVERSAL' THEN -it.total_value ELSE it.total_value END) AS cost,
                BOOL_OR(COALESCE(it.notes, '') LIKE 'COST_REVIEW:%') AS needs_cost_review
         FROM public.inventory_transactions it
         LEFT JOIN public.inventory_recipes ir ON ir.id = it.recipe_id
         LEFT JOIN public.inventory_items ii ON ii.id = it.item_id
         WHERE (it.transaction_type = 'CONSUMPTION' OR (it.transaction_type = 'REVERSAL' AND it.notes LIKE 'COGS_REVERSAL:%'))
           AND it.business_date BETWEEN $1::date AND $2::date
           AND ($3::text IS NULL OR UPPER(it.station) IN ($3, CASE WHEN $3 = 'BAR' THEN 'BARMAN' ELSE $3 END))
         GROUP BY it.business_date, UPPER(COALESCE(it.station, 'KITCHEN')), COALESCE(ir.menu_name, 'Unassigned menu item'), ii.item_name
         ORDER BY it.business_date DESC, menu_name, ii.item_name`,
        [startDate, endDate, station || null]
      ),
      pool.query(
        `SELECT it.business_date, UPPER(COALESCE(it.station, 'KITCHEN')) AS station,
                ii.item_name, SUM(it.quantity) AS quantity, SUM(it.total_value) AS cost
         FROM public.inventory_transactions it
         LEFT JOIN public.inventory_items ii ON ii.id = it.item_id
         WHERE it.transaction_type = 'WASTE'
           AND it.business_date BETWEEN $1::date AND $2::date
           AND ($3::text IS NULL OR UPPER(it.station) IN ($3, CASE WHEN $3 = 'BAR' THEN 'BARMAN' ELSE $3 END))
         GROUP BY it.business_date, UPPER(COALESCE(it.station, 'KITCHEN')), ii.item_name
         ORDER BY it.business_date DESC, ii.item_name`,
        [startDate, endDate, station || null]
      ),
      pool.query(
        `SELECT item->>'name' AS menu_name,
                CASE
                  WHEN UPPER(COALESCE(item->>'station', '')) IN ('BAR', 'BARMAN') OR LOWER(COALESCE(item->>'category', '')) ~ 'barman|bar|cocktail|drink|beer' THEN 'BAR'
                  WHEN UPPER(COALESCE(item->>'station', '')) = 'BARISTA' OR LOWER(COALESCE(item->>'category', '')) ~ 'barista|coffee|tea' THEN 'BARISTA'
                  ELSE 'KITCHEN'
                END AS station,
                    SUM(COALESCE(NULLIF(item->>'line_total', '')::numeric, NULLIF(item->>'lineTotal', '')::numeric,
                    COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                      * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1))) AS net_sales,
                    SUM(COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                      * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)) AS gross_sales,
                    SUM(GREATEST(0, COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                      * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)
                      - COALESCE(NULLIF(item->>'line_total', '')::numeric, NULLIF(item->>'lineTotal', '')::numeric,
                    COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                      * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)))) AS discounts
         FROM public.orders o
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
         LEFT JOIN LATERAL (
           SELECT c.id, c.approved_at, c.created_at
           FROM public.credits c
           LEFT JOIN public.cashier_queue cq ON cq.id = c.cashier_queue_id
           WHERE c.order_id = o.id AND c.status IN ('Approved', 'PartiallySettled', 'FullySettled')
             AND (LOWER(BTRIM(COALESCE(cq.item->>'name', ''))) = LOWER(BTRIM(COALESCE(item->>'name', '')))
               OR LOWER(BTRIM(COALESCE(c.label, ''))) = LOWER(BTRIM(COALESCE(item->>'name', ''))))
           ORDER BY c.approved_at DESC NULLS LAST, c.created_at DESC LIMIT 1
         ) approved_credit ON true
         WHERE (UPPER(COALESCE(item->>'station', '')) NOT LIKE '%SHISHA%' AND UPPER(COALESCE(item->>'category', '')) NOT LIKE '%SHISHA%')
           AND ((approved_credit.id IS NOT NULL AND (COALESCE(approved_credit.approved_at, approved_credit.created_at) AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date)
             OR (approved_credit.id IS NULL AND COALESCE(item->>'_rowPaid', 'false') = 'true'
                 AND UPPER(COALESCE(item->>'payment_method', '')) NOT LIKE '%CREDIT%'
                 AND (COALESCE(NULLIF(item->>'paid_at', '')::timestamptz, o.paid_at, o.created_at) AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date))
           AND ($3::text IS NULL OR CASE
             WHEN UPPER(COALESCE(item->>'station', '')) IN ('BAR', 'BARMAN') OR LOWER(COALESCE(item->>'category', '')) ~ 'barman|bar|cocktail|drink|beer' THEN 'BAR'
             WHEN UPPER(COALESCE(item->>'station', '')) = 'BARISTA' OR LOWER(COALESCE(item->>'category', '')) ~ 'barista|coffee|tea' THEN 'BARISTA'
             ELSE 'KITCHEN' END = $3)
         GROUP BY item->>'name', station
         ORDER BY menu_name`,
        [startDate, endDate, station || null]
      ),
      pool.query(
        `SELECT item->>'name' AS menu_name,
                CASE
                  WHEN UPPER(COALESCE(item->>'station', '')) IN ('BAR', 'BARMAN') OR LOWER(COALESCE(item->>'category', '')) ~ 'barman|bar|cocktail|drink|beer' THEN 'BAR'
                  WHEN UPPER(COALESCE(item->>'station', '')) = 'BARISTA' OR LOWER(COALESCE(item->>'category', '')) ~ 'barista|coffee|tea' THEN 'BARISTA'
                  ELSE 'KITCHEN'
                END AS station,
                COALESCE(NULLIF(item->>'line_total', '')::numeric, NULLIF(item->>'lineTotal', '')::numeric,
                  COALESCE(NULLIF(item->>'price', '')::numeric, NULLIF(item->>'unit_price', '')::numeric)
                    * COALESCE(NULLIF(item->>'quantity', '')::numeric, 1)) AS refund
         FROM public.void_requests vr
         JOIN public.orders o ON o.id = vr.order_id
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.items, '[]'::jsonb)) AS order_items(item)
         LEFT JOIN LATERAL (
           SELECT c.id
           FROM public.credits c
           LEFT JOIN public.cashier_queue cq ON cq.id = c.cashier_queue_id
           WHERE c.order_id = o.id AND c.status IN ('Approved', 'PartiallySettled', 'FullySettled')
             AND (LOWER(BTRIM(COALESCE(cq.item->>'name', ''))) = LOWER(BTRIM(COALESCE(item->>'name', '')))
               OR LOWER(BTRIM(COALESCE(c.label, ''))) = LOWER(BTRIM(COALESCE(item->>'name', ''))))
           ORDER BY c.approved_at DESC NULLS LAST, c.created_at DESC LIMIT 1
         ) approved_credit ON true
         WHERE vr.status = 'Approved'
           AND LOWER(BTRIM(COALESCE(item->>'name', ''))) = LOWER(BTRIM(vr.item_name))
           AND (COALESCE(item->>'voidProcessed', 'false') = 'true' OR UPPER(COALESCE(item->>'status', '')) = 'VOIDED')
           AND (approved_credit.id IS NOT NULL OR (COALESCE(item->>'_rowPaid', 'false') = 'true' AND UPPER(COALESCE(item->>'payment_method', '')) NOT LIKE '%CREDIT%'))
           AND (vr.resolved_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date
           AND ($3::text IS NULL OR CASE
             WHEN UPPER(COALESCE(item->>'station', '')) IN ('BAR', 'BARMAN') OR LOWER(COALESCE(item->>'category', '')) ~ 'barman|bar|cocktail|drink|beer' THEN 'BAR'
             WHEN UPPER(COALESCE(item->>'station', '')) = 'BARISTA' OR LOWER(COALESCE(item->>'category', '')) ~ 'barista|coffee|tea' THEN 'BARISTA'
             ELSE 'KITCHEN' END = $3)`,
        [startDate, endDate, station || null]
      ),
    ]);

    const consumption = consumptionResult.rows.map((row) => ({ ...row, quantity: Number(row.quantity || 0), cost: Number(row.cost || 0) }));
    const waste = wasteResult.rows.map((row) => ({ ...row, quantity: Number(row.quantity || 0), cost: Number(row.cost || 0) }));
    const sales = salesResult.rows.map((row) => ({ ...row, gross_sales: Number(row.gross_sales || 0), net_sales: Number(row.net_sales || 0), discounts: Number(row.discounts || 0) }));
    const refunds = refundsResult.rows.map((row) => ({ ...row, refund: Number(row.refund || 0) }));
    const groupedBy = (rows, key, valueKey) => Object.entries(rows.reduce((groups, row) => {
      const keyValue = row[key] || 'Unassigned';
      groups[keyValue] = (groups[keyValue] || 0) + Number(row[valueKey] || 0);
      return groups;
    }, {})).map(([name, value]) => ({ name, value }));
    const cogsByMenu = new Map();
    for (const row of consumption) {
      const key = `${row.station}::${row.menu_name}`;
      cogsByMenu.set(key, (cogsByMenu.get(key) || 0) + row.cost);
    }
    const salesByMenu = new Map(sales.map((row) => [`${row.station}::${row.menu_name}`, row.gross_sales]));
    const netSalesByMenu = new Map(sales.map((row) => [`${row.station}::${row.menu_name}`, row.net_sales]));
    const discountsByMenu = new Map(sales.map((row) => [`${row.station}::${row.menu_name}`, row.discounts]));
    const refundsByMenu = new Map();
    for (const row of refunds) {
      const key = `${row.station}::${row.menu_name}`;
      refundsByMenu.set(key, (refundsByMenu.get(key) || 0) + row.refund);
    }
    const menuItems = [...new Set([...salesByMenu.keys(), ...cogsByMenu.keys(), ...refundsByMenu.keys()])].map((key) => {
      const [department, menuName] = key.split('::');
      const grossSales = salesByMenu.get(key) || 0;
      const discounts = discountsByMenu.get(key) || 0;
      const refunds = refundsByMenu.get(key) || 0;
      const netSales = (netSalesByMenu.get(key) || 0) - refunds;
      const cogs = cogsByMenu.get(key) || 0;
      return { department, menu_name: menuName, gross_sales: grossSales, discounts, refunds, net_sales: netSales, cogs, gross_profit: netSales - cogs, gross_profit_margin: netSales > 0 ? ((netSales - cogs) / netSales) * 100 : 0 };
    }).sort((left, right) => left.menu_name.localeCompare(right.menu_name));
    const netSalesByDepartment = [...new Set([...sales.map((row) => row.station), ...refunds.map((row) => row.station)])].map((department) => ({
      name: department,
      value: sales.filter((row) => row.station === department).reduce((sum, row) => sum + row.net_sales, 0)
        - refunds.filter((row) => row.station === department).reduce((sum, row) => sum + row.refund, 0),
    }));

    res.json({
      startDate,
      endDate,
      grossSales: sales.reduce((sum, row) => sum + row.gross_sales, 0),
      discounts: sales.reduce((sum, row) => sum + row.discounts, 0),
      refunds: refunds.reduce((sum, row) => sum + row.refund, 0),
      netSales: sales.reduce((sum, row) => sum + row.net_sales, 0) - refunds.reduce((sum, row) => sum + row.refund, 0),
      cogs: consumption.reduce((sum, row) => sum + row.cost, 0),
      wasteCost: waste.reduce((sum, row) => sum + row.cost, 0),
      grossProfit: sales.reduce((sum, row) => sum + row.net_sales, 0) - refunds.reduce((sum, row) => sum + row.refund, 0) - consumption.reduce((sum, row) => sum + row.cost, 0),
      salesByDepartment: netSalesByDepartment,
      departments: groupedBy(consumption, 'station', 'cost'),
      daily: groupedBy(consumption, 'business_date', 'cost'),
      ingredients: groupedBy(consumption, 'item_name', 'cost'),
      wasteByDepartment: groupedBy(waste, 'station', 'cost'),
      menuItems,
      consumption,
      waste,
      costReviewCount: consumption.filter((row) => row.needs_cost_review).length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/low-stock', async (req, res) => {
  try {
    const station = ROLE_STATIONS[req.inventoryActor.role];
    const result = await pool.query(
      `SELECT ii.*, il.name AS location_name
       FROM public.inventory_items ii
       LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
       WHERE ii.is_active = true
         AND ${shishaInventoryFilterSql('ii')}
         AND ii.current_quantity <= ii.minimum_stock_level
         AND ($1::text IS NULL OR UPPER(ii.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
       ORDER BY ii.item_name ASC`,
      [station || null]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.use('/transactions', authenticateRecipeUser);

router.get('/reports/menu-items-without-recipes', async (req, res) => {
  try {
    const station = ROLE_STATIONS[req.inventoryActor.role];
    const result = await pool.query(
      `SELECT m.id, m.name, m.station, m.category, m.price
       FROM public.menus m
       LEFT JOIN public.inventory_recipes r ON (r.menu_item_id = m.id OR LOWER(m.name) = LOWER(r.menu_name)) AND r.status = 'ACTIVE'
       WHERE m.published = true AND r.id IS NULL
         AND ($1::text IS NULL OR UPPER(m.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
       ORDER BY m.name ASC`,
      [station || null]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const station = ROLE_STATIONS[req.inventoryActor.role];
    const result = await pool.query(
      `SELECT it.*, ii.item_name, sl.name AS source_location, dl.name AS destination_location
       FROM public.inventory_transactions it
       LEFT JOIN public.inventory_items ii ON ii.id = it.item_id
       LEFT JOIN public.inventory_locations sl ON sl.id = it.source_location_id
       LEFT JOIN public.inventory_locations dl ON dl.id = it.destination_location_id
      WHERE ($1::text IS NULL OR UPPER(it.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
       ORDER BY it.created_at DESC
      LIMIT 200`,
          [station || null]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
