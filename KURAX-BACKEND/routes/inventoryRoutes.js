import express from 'express';
import pool from '../db.js';
import { createJournalEntry } from '../helpers/accounting.js';
import { buildInventorySummary, generateInventorySummaryPdf } from '../helpers/inventorySummaryService.js';
import { readSessionToken } from '../middleware/sessionTokens.js';

const router = express.Router();
const INVENTORY_STATION_BY_ROLE = {
  KITCHEN_HOD: 'KITCHEN',
  CHEF: 'KITCHEN',
  BAR_HOD: 'BARMAN',
  BARMAN: 'BARMAN',
  BARISTA_HOD: 'BARISTA',
  BARISTA: 'BARISTA',
};

async function authenticateInventory(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: 'Sign in to access inventory workflows.' });

  try {
    const session = readSessionToken(token);
    if (session.scope !== 'restaurant' || !session.id) return res.status(401).json({ error: 'Invalid staff session.' });
    const result = await pool.query(
      'SELECT id, name, role, is_active FROM public.staff WHERE id=$1',
      [session.id]
    );
    const actor = result.rows[0];
    if (!actor || actor.is_active === false || actor.role !== session.role) {
      return res.status(401).json({ error: 'Staff account is inactive or has changed.' });
    }

    req.user = actor;
    req.inventoryStation = INVENTORY_STATION_BY_ROLE[actor.role] || null;
    req.inventoryIsHod = actor.role.endsWith('_HOD');
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
}

function allowInventoryReport(req, res, next) {
  const role = req.user?.role;
  if (['ACCOUNTANT', 'DIRECTOR', 'MANAGER'].includes(role) || req.inventoryStation) return next();
  return res.status(403).json({ error: 'This account cannot view department inventory records.' });
}

function requireDepartmentOperator(req, res, next) {
  if (!req.inventoryStation) return res.status(403).json({ error: 'Only department staff and HODs can record this inventory activity.' });
  return next();
}

function stationMatchesDepartment(itemStation, departmentStation) {
  const station = String(itemStation || '').trim().toUpperCase();
  if (departmentStation === 'KITCHEN') return !['BARMAN', 'BAR', 'BARISTA', 'SHISHA'].includes(station);
  if (departmentStation === 'BARMAN') return ['BARMAN', 'BAR'].includes(station);
  return station === departmentStation;
}

function requireRecipeDepartment({ hodOnly = false } = {}) {
  return async (req, res, next) => {
    if (!req.inventoryStation || (hodOnly && !req.inventoryIsHod)) {
      return res.status(403).json({ error: hodOnly ? 'Only the department HOD can approve or activate recipes.' : 'Department access is required.' });
    }
    try {
      const result = await pool.query('SELECT station FROM public.inventory_recipes WHERE id=$1', [Number(req.params.id)]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });
      if (!stationMatchesDepartment(result.rows[0].station, req.inventoryStation)) {
        return res.status(403).json({ error: 'You cannot change a recipe for another department.' });
      }
      return next();
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };
}

const UNIT_FACTORS = {
  piece: 1,
  pieces: 1,
  slice: 1,
  slices: 1,
  portion: 1,
  portions: 1,
  packet: 1,
  packets: 1,
  box: 1,
  boxes: 1,
  bottle: 1,
  bottles: 1,
  kg: 1000,
  kgs: 1000,
  g: 1,
  gram: 1,
  grams: 1,
  litre: 1000,
  liter: 1000,
  litres: 1000,
  liters: 1000,
  l: 1000,
  ml: 1,
  millilitre: 1,
  milliliter: 1,
  millilitres: 1,
  milliliters: 1,
};

function normalizeUnit(unit) {
  if (!unit) return 'kg';
  const value = String(unit).trim().toLowerCase();
  if (value === 'litres') return 'litre';
  if (value === 'liters') return 'liter';
  if (value === 'kgs') return 'kg';
  if (value === 'grams') return 'g';
  if (value === 'millilitres') return 'ml';
  if (value === 'milliliters') return 'ml';
  if (value === 'pcs') return 'piece';
  if (value === 'packets') return 'packet';
  if (value === 'boxes') return 'box';
  if (value === 'bottles') return 'bottle';
  return value;
}

function toBaseQuantity(quantity, unit) {
  const factor = UNIT_FACTORS[normalizeUnit(unit)] ?? 1;
  return Number(quantity || 0) * factor;
}

function fromBaseQuantity(quantity, unit) {
  const factor = UNIT_FACTORS[normalizeUnit(unit)] ?? 1;
  return Number(quantity || 0) / factor;
}

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stockStatus(item) {
  if (Number(item.current_quantity || 0) <= 0) return 'OUT OF STOCK';
  if (Number(item.minimum_stock_level || 0) >= 0 && Number(item.current_quantity || 0) <= Number(item.minimum_stock_level || 0)) return 'LOW STOCK';
  return 'IN STOCK';
}

function getPaymentAccount(paymentMethod) {
  const method = String(paymentMethod || 'Cash').toLowerCase();
  if (method.includes('bank')) return '1002';
  if (method.includes('momo') || method.includes('mobile')) return '1003';
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

async function resolveItemIdByName(name) {
  if (!name) return null;
  const result = await pool.query(
    `SELECT id FROM public.inventory_items WHERE LOWER(item_name) = LOWER($1) LIMIT 1`,
    [String(name).trim()]
  );
  return result.rows[0]?.id ?? null;
}

async function buildItemSummary(item) {
  return {
    ...item,
    stock_status: stockStatus(item),
    current_quantity: Number(item.current_quantity || 0),
    minimum_stock_level: Number(item.minimum_stock_level || 0),
    unit_cost: Number(item.unit_cost || 0),
    inventory_value: Number(item.inventory_value || 0),
  };
}

router.get('/locations', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM public.inventory_locations WHERE is_active = true AND UPPER(name) <> 'SHISHA' ORDER BY name ASC`
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
         AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
         AND ($1::text IS NULL OR
           (CASE WHEN $1 = 'KITCHEN'
             THEN UPPER(COALESCE(ii.station, 'KITCHEN')) NOT IN ('BARMAN', 'BAR', 'BARISTA', 'SHISHA')
             ELSE UPPER(COALESCE(ii.station, '')) = $1 OR ($1 = 'BARMAN' AND UPPER(COALESCE(ii.station, '')) = 'BAR')
           END))
       ORDER BY ii.item_name ASC`,
      [req.query.station ? String(req.query.station).toUpperCase() : null]
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
      WHERE ii.is_active = true AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
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
  if (String(station || '').toUpperCase() === 'SHISHA' || String(location_name || '').toUpperCase() === 'SHISHA') {
    return res.status(400).json({ error: 'Shisha stock is managed outside the main inventory system.' });
  }

  try {
    const resolvedSupplierId = await resolveSupplierId(supplier_id || null, supplier_name || null);
    const resolvedLocationId = await resolveLocationId(location_id || null, location_name || 'MAIN STORE');
    const finalUnit = normalizeUnit(unit || 'kg');
    const finalBaseUnit = normalizeUnit(base_unit || finalUnit);
    const quantity = Number(current_quantity || 0);
    const unitPrice = Number(unit_cost || 0);
    const inventoryValue = quantity * unitPrice;

    const result = await pool.query(
      `INSERT INTO public.inventory_items (
        item_name, sku, category, unit, base_unit, minimum_stock_level, current_quantity,
        unit_cost, inventory_value, supplier_id, location_id, station, is_active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
      RETURNING *`,
      [
        String(item_name).trim(),
        sku || null,
        category || 'General',
        finalUnit,
        finalBaseUnit,
        Number(minimum_stock_level || 0),
        quantity,
        unitPrice,
        inventoryValue,
        resolvedSupplierId,
        resolvedLocationId,
        station || 'KITCHEN',
        active === false ? false : true,
        req.user?.name || 'Accountant',
      ]
    );

    const item = result.rows[0];
    res.status(201).json(await buildItemSummary(item));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/purchases', async (req, res) => {
  const payload = req.body || {};
  const items = Array.isArray(payload.items) ? payload.items : [payload];
  const paymentMethod = payload.payment_method || 'Cash';
  const supplierName = payload.supplier_name || payload.supplier || 'KURAX PRIMARY SUPPLIER';
  const businessDate = payload.business_date || new Date().toISOString().slice(0, 10);

  if (!items.length) {
    return res.status(400).json({ error: 'At least one item is required.' });
  }
  if (items.some((row) => String(row.station || '').toUpperCase() === 'SHISHA' || String(row.location_name || '').toUpperCase() === 'SHISHA')) {
    return res.status(400).json({ error: 'Shisha purchases must remain in the separate Shisha subsystem.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const supplierId = await resolveSupplierId(null, supplierName);
    const purchase = await client.query(
      `INSERT INTO public.purchase_receipts (supplier_id, receipt_number, payment_method, total_amount, business_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [supplierId, payload.receipt_number || `PUR-${Date.now()}`, paymentMethod, 0, businessDate, payload.notes || '', req.user?.name || 'Accountant']
    );

    let totalAmount = 0;
    const purchaseLines = [];

    for (const row of items) {
      const itemName = row.item_name || row.name || row.itemId;
      const itemIdNumber = row.item_id || (itemName ? await resolveItemIdByName(itemName) : null);
      let item = null;

      if (itemIdNumber) {
        const found = await client.query(`SELECT * FROM public.inventory_items WHERE id = $1`, [Number(itemIdNumber)]);
        item = found.rows[0];
      }
      if (item && String(item.station || '').toUpperCase() === 'SHISHA') {
        throw new Error('Shisha stock is managed outside the main inventory system.');
      }

      if (!item && itemName) {
        const createdItem = await client.query(
          `INSERT INTO public.inventory_items (item_name, category, unit, base_unit, minimum_stock_level, current_quantity, unit_cost, inventory_value, supplier_id, location_id, station, is_active, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $12)
           RETURNING *`,
          [
            String(itemName).trim(),
            row.category || 'General',
            normalizeUnit(row.unit || 'kg'),
            normalizeUnit(row.base_unit || row.unit || 'kg'),
            Number(row.minimum_stock_level || 0),
            0,
            Number(row.unit_cost || 0),
            0,
            supplierId,
            await resolveLocationId(row.location_id || null, row.location_name || 'MAIN STORE'),
            row.station || 'KITCHEN',
            req.user?.name || 'Accountant',
          ]
        );
        item = createdItem.rows[0];
      }

      if (!item) {
        throw new Error(`Inventory item not found: ${itemName || 'unknown item'}`);
      }

      const quantity = Number(row.quantity || 0);
      const unit = normalizeUnit(row.unit || item.unit || 'kg');
      const unitCost = Number(row.unit_cost || item.unit_cost || 0);
      const lineTotal = quantity * unitCost;
      totalAmount += lineTotal;

      await client.query(
        `UPDATE public.inventory_items
         SET current_quantity = current_quantity + $1,
             unit_cost = CASE WHEN $2 > 0 THEN $2 ELSE unit_cost END,
             inventory_value = (current_quantity + $1) * CASE WHEN $2 > 0 THEN $2 ELSE unit_cost END,
             updated_at = NOW(),
             supplier_id = COALESCE(supplier_id, $3),
             location_id = COALESCE(location_id, $4),
             updated_by = $5
         WHERE id = $6`,
        [quantity, unitCost, supplierId, await resolveLocationId(row.location_id || item.location_id || null, row.location_name || 'MAIN STORE'), req.user?.name || 'Accountant', item.id]
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
          quantity,
          unit,
          unitCost,
          lineTotal,
          null,
          await resolveLocationId(row.location_id || item.location_id || null, row.location_name || 'MAIN STORE'),
          row.station || item.station || 'KITCHEN',
          supplierId,
          businessDate,
          req.user?.name || 'Accountant',
          `Purchase receipt for ${item.item_name}`,
        ]
      );

      purchaseLines.push({ ...transactionResult.rows[0], item_name: item.item_name, quantity, unit, lineTotal });

      await client.query(
        `INSERT INTO public.purchase_receipt_items (purchase_id, item_id, quantity, unit, unit_cost, total_cost, location_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [purchase.rows[0].id, item.id, quantity, unit, unitCost, lineTotal, await resolveLocationId(row.location_id || item.location_id || null, row.location_name || 'MAIN STORE')]
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
      postedBy: req.user?.name || 'Accountant',
      reference: `INV-PUR-${purchase.rows[0].id}`,
      lines: [
        { accountCode: '1201', accountName: 'Inventory', debit: totalAmount },
        { accountCode: getPaymentAccount(paymentMethod), accountName: 'Cash / Bank / AP', credit: totalAmount },
      ],
    });

    await client.query('COMMIT');
    res.status(201).json({ purchase: purchase.rows[0], items: purchaseLines, total_amount: totalAmount });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.get('/purchases', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pr.*, s.name AS supplier_name,
              COALESCE((SELECT json_agg(row_to_json(pi)) FROM (
                SELECT pri.*, ii.item_name FROM public.purchase_receipt_items pri
                JOIN public.inventory_items ii ON ii.id = pri.item_id
                WHERE pri.purchase_id = pr.id
              ) pi), '[]'::json) AS items
       FROM public.purchase_receipts pr
       LEFT JOIN public.suppliers s ON s.id = pr.supplier_id
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
      [referenceNumber, Number(payload.source_location_id), Number(payload.destination_location_id), payload.notes || '', payload.business_date || new Date().toISOString().slice(0, 10), req.user?.name || 'Accountant']
    );

    const transferId = transfer.rows[0].id;
    const transferItems = [];

    for (const row of items) {
      const itemId = Number(row.item_id);
      const quantity = Number(row.quantity || 0);
      const unit = normalizeUnit(row.unit || 'kg');
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Transfer quantity must be greater than zero.');
      const item = (await client.query(
        `SELECT * FROM public.inventory_items WHERE id = $1 AND location_id = $2 FOR UPDATE`,
        [itemId, Number(payload.source_location_id)]
      )).rows[0];

      if (!item) throw new Error(`Item not found for transfer: ${itemId}`);
      if (Number(item.current_quantity || 0) < quantity) {
        throw new Error(`Insufficient stock for ${item.item_name}: has ${item.current_quantity}, needs ${quantity}.`);
      }

      await client.query(
        `UPDATE public.inventory_items
         SET current_quantity = current_quantity - $1,
             inventory_value = (current_quantity - $1) * unit_cost,
             updated_at = NOW()
         WHERE id = $2 AND location_id = $3`,
        [quantity, itemId, Number(payload.source_location_id)]
      );

      const destinationResult = await client.query(
        `SELECT * FROM public.inventory_items
         WHERE LOWER(item_name) = LOWER($1)
           AND LOWER(COALESCE(unit, 'kg')) = LOWER($2)
           AND UPPER(COALESCE(station, 'KITCHEN')) = UPPER($3)
           AND location_id = $4
         ORDER BY id
         LIMIT 1
         FOR UPDATE`,
        [item.item_name, unit, item.station || 'KITCHEN', Number(payload.destination_location_id)]
      );
      let destinationItem = destinationResult.rows[0];

      if (destinationItem) {
        const updatedDestination = await client.query(
          `UPDATE public.inventory_items
           SET current_quantity = current_quantity + $1,
               inventory_value = (current_quantity + $1) * unit_cost,
               updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          [quantity, destinationItem.id]
        );
        destinationItem = updatedDestination.rows[0];
      } else {
        const createdDestination = await client.query(
          `INSERT INTO public.inventory_items (
             item_name, sku, category, unit, base_unit, minimum_stock_level, current_quantity,
             unit_cost, inventory_value, supplier_id, location_id, station, is_active, created_by, updated_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
           RETURNING *`,
          [item.item_name, item.sku, item.category, item.unit, item.base_unit, item.minimum_stock_level,
            quantity, item.unit_cost, quantity * Number(item.unit_cost || 0), item.supplier_id,
            Number(payload.destination_location_id), item.station, item.is_active, req.user?.name || 'Accountant']
        );
        destinationItem = createdDestination.rows[0];
      }

      await client.query(
        `INSERT INTO public.inventory_transfer_items (transfer_id, item_id, quantity, unit)
         VALUES ($1, $2, $3, $4)`,
        [transferId, itemId, quantity, unit]
      );

      await client.query(
        `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, 'TRANSFER_OUT', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [item.id, `${referenceNumber}-OUT-${item.id}`, quantity, unit, item.unit_cost || 0, quantity * Number(item.unit_cost || 0), Number(payload.source_location_id), Number(payload.destination_location_id), item.station || 'KITCHEN', payload.business_date || new Date().toISOString().slice(0, 10), req.user?.name || 'Accountant', `Transfer out: ${item.item_name}`]
      );

      await client.query(
        `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, 'TRANSFER_IN', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [destinationItem.id, `${referenceNumber}-IN-${item.id}`, quantity, unit, item.unit_cost || 0, quantity * Number(item.unit_cost || 0), Number(payload.source_location_id), Number(payload.destination_location_id), item.station || 'KITCHEN', payload.business_date || new Date().toISOString().slice(0, 10), req.user?.name || 'Accountant', `Transfer in: ${item.item_name}`]
      );

      transferItems.push({ item_name: item.item_name, quantity, unit });
    }

    await client.query('COMMIT');
    res.status(201).json({ transfer: transfer.rows[0], items: transferItems });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
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

router.get('/recipes', authenticateInventory, allowInventoryReport, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, COALESCE((SELECT json_agg(row_to_json(ri)) FROM (
        SELECT ri.*, ii.item_name AS ingredient_name
        FROM public.recipe_ingredients ri
        LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
        WHERE ri.recipe_id = r.id
      ) ri), '[]'::json) AS ingredients
       FROM public.inventory_recipes r
      WHERE ($1::text IS NULL OR UPPER(r.station) = $1 OR ($1 = 'BARMAN' AND UPPER(r.station) = 'BAR'))
      ORDER BY r.created_at DESC`,
          [req.inventoryStation]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recipes', authenticateInventory, requireDepartmentOperator, async (req, res) => {
  const payload = req.body || {};
  const ingredients = Array.isArray(payload.ingredients) ? payload.ingredients : [];

  if (!payload.menu_name) return res.status(400).json({ error: 'Menu item name is required.' });
  if (!ingredients.length) return res.status(400).json({ error: 'At least one inventory ingredient is required.' });

  try {
    const validatedIngredients = [];
    for (const ingredient of ingredients) {
      const ingredientItemId = ingredient.ingredient_item_id || (ingredient.ingredient_name ? await resolveItemIdByName(ingredient.ingredient_name) : null);
      if (!ingredientItemId) return res.status(400).json({ error: 'Select a stock item for every recipe ingredient.' });
      const ingredientItem = await pool.query('SELECT id, station FROM public.inventory_items WHERE id=$1 AND is_active=true', [Number(ingredientItemId)]);
      if (!ingredientItem.rows[0]) return res.status(400).json({ error: 'A selected recipe ingredient is not active inventory.' });
      if (!stationMatchesDepartment(ingredientItem.rows[0].station, req.inventoryStation)) {
        return res.status(403).json({ error: 'Recipes can only use ingredients assigned to your department.' });
      }
      validatedIngredients.push({ ...ingredient, ingredient_item_id: ingredientItem.rows[0].id });
    }

    const recipe = await pool.query(
      `INSERT INTO public.inventory_recipes (menu_item_id, menu_name, station, version_number, status, created_by)
       VALUES ($1, $2, $3, $4, 'DRAFT', $5)
       RETURNING *`,
      [payload.menu_item_id || null, String(payload.menu_name).trim(), req.inventoryStation, Number(payload.version_number || 1), req.user.name]
    );

    for (const ingredient of validatedIngredients) {
      const ingredientItemId = ingredient.ingredient_item_id;
      await pool.query(
        `INSERT INTO public.recipe_ingredients (recipe_id, ingredient_item_id, ingredient_name, quantity, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipe.rows[0].id, ingredientItemId || null, ingredient.ingredient_name || ingredient.name || 'Ingredient', Number(ingredient.quantity || 0), normalizeUnit(ingredient.unit || 'g')]
      );
    }

    res.status(201).json({ recipe: recipe.rows[0], ingredients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/recipes/:id', authenticateInventory, requireDepartmentOperator, requireRecipeDepartment({ hodOnly: true }), async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};

  try {
    const recipe = await pool.query(
      `UPDATE public.inventory_recipes
       SET menu_name = $1,
           station = $2,
           version_number = $3,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [String(payload.menu_name || '').trim() || 'Unknown Menu', req.inventoryStation, Number(payload.version_number || 1), Number(id)]
    );

    if (!recipe.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });

    if (Array.isArray(payload.ingredients)) {
      await pool.query(`DELETE FROM public.recipe_ingredients WHERE recipe_id = $1`, [Number(id)]);
      for (const ingredient of payload.ingredients) {
        const ingredientItemId = ingredient.ingredient_item_id || (ingredient.ingredient_name ? await resolveItemIdByName(ingredient.ingredient_name) : null);
        await pool.query(
          `INSERT INTO public.recipe_ingredients (recipe_id, ingredient_item_id, ingredient_name, quantity, unit) VALUES ($1, $2, $3, $4, $5)`,
          [Number(id), ingredientItemId || null, ingredient.ingredient_name || ingredient.name || 'Ingredient', Number(ingredient.quantity || 0), normalizeUnit(ingredient.unit || 'g')]
        );
      }
    }

    res.json(recipe.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recipes/:id/submit', authenticateInventory, requireDepartmentOperator, requireRecipeDepartment(), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE public.inventory_recipes SET status = 'SUBMITTED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [Number(id)]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recipes/:id/approve', authenticateInventory, requireRecipeDepartment({ hodOnly: true }), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE public.inventory_recipes SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [req.user.name, Number(id)]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recipes/:id/activate', authenticateInventory, requireRecipeDepartment({ hodOnly: true }), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE public.inventory_recipes SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [Number(id)]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recipes/:id/costing', async (req, res) => {
  const { id } = req.params;
  try {
    const recipe = await pool.query(
      `SELECT r.*, COALESCE((SELECT json_agg(row_to_json(ri)) FROM (
        SELECT ri.*, ii.item_name, ii.unit_cost
        FROM public.recipe_ingredients ri
        LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
        WHERE ri.recipe_id = r.id
      ) ri), '[]'::json) AS ingredients
       FROM public.inventory_recipes r
       WHERE r.id = $1`,
      [Number(id)]
    );

    if (!recipe.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });

    const parsedIngredients = recipe.rows[0].ingredients || [];
    let totalCost = 0;

    for (const ingredient of parsedIngredients) {
      const ingredientItem = ingredient.item_name ? await pool.query(`SELECT * FROM public.inventory_items WHERE LOWER(item_name) = LOWER($1) LIMIT 1`, [ingredient.item_name]) : null;
      const item = ingredientItem?.rows[0] || null;
      if (!item) continue;
      const qty = Number(ingredient.quantity || 0);
      const itemUnit = normalizeUnit(item.unit || 'kg');
      const ingredientUnit = normalizeUnit(ingredient.unit || itemUnit);
      const baseQty = toBaseQuantity(qty, ingredientUnit);
      const unitFactor = toBaseQuantity(1, itemUnit);
      const cost = (baseQty / unitFactor) * Number(item.unit_cost || 0);
      totalCost += cost;
    }

    const sellingPrice = Number(recipe.rows[0].selling_price || 0);
    const grossProfit = sellingPrice - totalCost;
    const foodCostPercentage = sellingPrice > 0 ? ((totalCost / sellingPrice) * 100) : 0;

    res.json({ recipe: recipe.rows[0], total_cost: totalCost, selling_price: sellingPrice, gross_profit: grossProfit, food_cost_percentage: foodCostPercentage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/consumption', authenticateInventory, allowInventoryReport, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ic.*, ii.item_name, ir.menu_name
       FROM public.inventory_consumptions ic
       LEFT JOIN public.inventory_items ii ON ii.id = ic.item_id
      LEFT JOIN public.inventory_recipes ir ON ir.id = ic.recipe_id
      WHERE ($1::text IS NULL OR UPPER(ic.station) = $1 OR ($1 = 'BARMAN' AND UPPER(ic.station) = 'BAR'))
       ORDER BY ic.created_at DESC
      LIMIT 200`,
          [req.inventoryStation]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/consumption', authenticateInventory, requireDepartmentOperator, async (req, res) => {
  const payload = req.body || {};
  const orderId = payload.order_id || payload.orderId || null;
  const submittedItems = Array.isArray(payload.items) ? payload.items : [];
  const items = req.inventoryStation
    ? submittedItems.map((item) => ({ ...item, station: req.inventoryStation }))
    : submittedItems;

  if (!orderId && !items.length) return res.status(400).json({ error: 'Order ID or item list is required.' });

  try {
    let orderItems = items;
    if (!orderItems.length && orderId) {
      const order = await pool.query(`SELECT items FROM public.orders WHERE id = $1`, [Number(orderId)]);
      if (!order.rows[0]) return res.status(404).json({ error: 'Order not found.' });
      orderItems = Array.isArray(order.rows[0].items) ? order.rows[0].items : JSON.parse(order.rows[0].items || '[]');
    }

    const consumptionRecords = [];
    const businessDate = payload.business_date || new Date().toISOString().slice(0, 10);

    for (let index = 0; index < orderItems.length; index += 1) {
      const item = orderItems[index];
      const menuName = item.menu_name || item.name || item.item_name;
      const itemQty = Number(item.quantity || 1);
      const station = (item.station || payload.station || 'KITCHEN').toUpperCase();
      const recipe = await pool.query(
        `SELECT * FROM public.inventory_recipes WHERE LOWER(menu_name) = LOWER($1) AND UPPER(station) = UPPER($2) AND status = 'ACTIVE' ORDER BY version_number DESC LIMIT 1`,
        [String(menuName).trim(), station]
      );

      if (!recipe.rows[0]) {
        consumptionRecords.push({ order_item: menuName, status: 'MISSING_RECIPE', message: 'Recipe not configured' });
        continue;
      }

      const ingredients = await pool.query(
        `SELECT ri.*, ii.item_name, ii.unit, ii.current_quantity, ii.unit_cost
         FROM public.recipe_ingredients ri
         LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
         WHERE ri.recipe_id = $1`,
        [recipe.rows[0].id]
      );

      for (const ingredient of ingredients.rows) {
        const ingredientName = ingredient.item_name || ingredient.ingredient_name;
        const ingredientItem = ingredient.ingredient_item_id
          ? await pool.query(`SELECT * FROM public.inventory_items WHERE id = $1 LIMIT 1`, [ingredient.ingredient_item_id])
          : ingredient.item_name
            ? await pool.query(`SELECT * FROM public.inventory_items WHERE LOWER(item_name) = LOWER($1) LIMIT 1`, [ingredient.item_name])
            : null;
        const stockItem = ingredientItem?.rows[0] || null;

        if (!stockItem) {
          consumptionRecords.push({ order_item: menuName, status: 'MISSING_INGREDIENT', ingredient: ingredientName, message: 'Ingredient not configured in stock inventory.' });
          continue;
        }

        const stockUnit = normalizeUnit(stockItem.unit || 'kg');
        const consumptionUnit = stockUnit;
        const requiredQty = (toBaseQuantity(ingredient.quantity || 0, ingredient.unit || stockUnit) / toBaseQuantity(1, stockUnit)) * itemQty;
        if (Number(stockItem.current_quantity || 0) < requiredQty) {
          consumptionRecords.push({ order_item: menuName, status: 'INSUFFICIENT_STOCK', ingredient: ingredientName, shortage: requiredQty - Number(stockItem.current_quantity || 0), available: stockItem.current_quantity });
          continue;
        }

        const referenceNumber = `${orderId || 'manual'}-${menuName}-${ingredientName}-${recipe.rows[0].id}-${Date.now()}-${index}`;
        const existing = await pool.query(`SELECT id FROM public.inventory_consumptions WHERE reference_number = $1 LIMIT 1`, [referenceNumber]);
        if (existing.rows[0]) continue;

        const stockUpdate = await pool.query(
          `UPDATE public.inventory_items
           SET current_quantity = current_quantity - $1,
               inventory_value = (current_quantity - $1) * unit_cost,
               updated_at = NOW()
           WHERE id = $2 AND current_quantity >= $1
           RETURNING id`,
          [requiredQty, stockItem.id]
        );
        if (!stockUpdate.rows[0]) {
          consumptionRecords.push({ order_item: menuName, status: 'INSUFFICIENT_STOCK', ingredient: ingredientName, message: 'Stock changed before consumption could be posted.' });
          continue;
        }

        await pool.query(
          `INSERT INTO public.inventory_consumptions (order_id, order_item_id, recipe_id, recipe_version, item_id, quantity, unit, station, business_date, created_by, reference_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [orderId || null, String(item.id || `${menuName}-${index}`), recipe.rows[0].id, String(recipe.rows[0].version_number || 1), stockItem.id, requiredQty, consumptionUnit, station, businessDate, req.user?.name || 'System', referenceNumber]
        );

        const cogsValue = requiredQty * Number(stockItem.unit_cost || 0);
        await pool.query(
          `INSERT INTO public.inventory_transactions (
            item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value,
            source_location_id, destination_location_id, station, business_date, created_by, notes
          ) VALUES ($1, $2, 'CONSUMPTION', $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11)`,
          [stockItem.id, referenceNumber, requiredQty, consumptionUnit, Number(stockItem.unit_cost || 0), cogsValue, stockItem.location_id || null, station, businessDate, req.user?.name || 'System', `Consumption for ${menuName}`]
        );

        await createJournalEntry({
          entryDate: businessDate,
          description: `COGS for ${menuName}`,
          sourceTransaction: referenceNumber,
          postedBy: req.user?.name || 'System',
          reference: `COGS-${referenceNumber}`,
          lines: [
            { accountCode: '5009', accountName: 'Other Operating Expenses', debit: cogsValue },
            { accountCode: '1201', accountName: 'Inventory', credit: cogsValue },
          ],
        });

        consumptionRecords.push({ order_item: menuName, ingredient: ingredientName, quantity: requiredQty, unit: consumptionUnit, status: 'CONSUMED' });
      }
    }

    res.json({ success: true, record_count: consumptionRecords.length, entries: consumptionRecords });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/waste', authenticateInventory, allowInventoryReport, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT iw.*, ii.item_name
       FROM public.inventory_waste iw
       LEFT JOIN public.inventory_items ii ON ii.id = iw.item_id
      WHERE ($1::text IS NULL OR UPPER(iw.station) = $1 OR ($1 = 'BARMAN' AND UPPER(iw.station) = 'BAR'))
       ORDER BY iw.created_at DESC
       LIMIT 200`,
      [req.inventoryStation]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/waste', authenticateInventory, requireDepartmentOperator, async (req, res) => {
  const payload = req.body || {};
  const itemId = Number(payload.item_id || payload.itemId);
  const quantity = Number(payload.quantity || 0);

  if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Item and quantity are required.' });
  }

  const client = await pool.connect();
  let item;
  let wasteEntry;
  const businessDate = payload.business_date || new Date().toISOString().slice(0, 10);

  try {
    await client.query('BEGIN');
    item = (await client.query(`SELECT * FROM public.inventory_items WHERE id = $1 FOR UPDATE`, [itemId])).rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inventory item not found.' });
    }
    if (!stationMatchesDepartment(item.station, req.inventoryStation)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only record waste for your department stock.' });
    }
    const wasteStation = req.inventoryStation;

    const newCurrent = Number(item.current_quantity || 0) - quantity;
    if (newCurrent < 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Insufficient stock for ${item.item_name}. Available: ${item.current_quantity}.` });
    }

    wasteEntry = await client.query(
      `INSERT INTO public.inventory_waste (item_id, quantity, unit, station, reason, business_date, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [item.id, quantity, normalizeUnit(payload.unit || item.unit || 'kg'), wasteStation, payload.reason || 'Waste', businessDate, req.user.name, payload.notes || '']
    );

    await client.query(
      `UPDATE public.inventory_items SET current_quantity = $1, inventory_value = $1 * unit_cost, updated_at = NOW() WHERE id = $2`,
      [newCurrent, item.id]
    );

    await client.query(
      `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
       VALUES ($1, $2, 'WASTE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [item.id, `WASTE-${wasteEntry.rows[0].id}`, quantity, normalizeUnit(payload.unit || item.unit || 'kg'), Number(item.unit_cost || 0), quantity * Number(item.unit_cost || 0), item.location_id || null, null, wasteStation, businessDate, req.user.name, payload.notes || 'Waste entry']
    );

    await client.query('COMMIT');

    await createJournalEntry({
      entryDate: businessDate,
      description: `Waste for ${item.item_name}`,
      sourceTransaction: `WASTE-${wasteEntry.rows[0].id}`,
      postedBy: req.user?.name || 'Accountant',
      reference: `WASTE-${wasteEntry.rows[0].id}`,
      lines: [
        { accountCode: String(payload.expense_account || '5009'), accountName: 'Waste / Inventory Loss', debit: quantity * Number(item.unit_cost || 0) },
        { accountCode: '1201', accountName: 'Inventory', credit: quantity * Number(item.unit_cost || 0) },
      ],
    });

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const item = (await client.query(`SELECT * FROM public.inventory_items WHERE id = $1 FOR UPDATE`, [itemId])).rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const systemQuantity = Number(item.current_quantity || 0);
    const variance = physicalQuantity - systemQuantity;
    const businessDate = payload.business_date || new Date().toISOString().slice(0, 10);
    const actor = req.user?.name || 'Accountant';
    const reason = payload.reason || 'Stock count variance';
    const adjustmentLocationId = locationId || item.location_id;
    const countRecord = await client.query(
      `INSERT INTO public.stock_counts (item_id, location_id, system_quantity, physical_quantity, variance, reason, business_date, counted_by, approved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [item.id, adjustmentLocationId, systemQuantity, physicalQuantity, variance, reason, businessDate, payload.counted_by || actor, payload.approved_by || null]
    );

    if (Math.abs(variance) > 0.0001) {
      const adjustmentType = variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
      const adjustmentRecord = await client.query(
        `INSERT INTO public.inventory_adjustments (item_id, location_id, adjustment_type, quantity, reason, business_date, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [item.id, adjustmentLocationId, adjustmentType, Math.abs(variance), reason, businessDate, actor]
      );

      await client.query(
        `UPDATE public.inventory_items SET current_quantity = current_quantity + $1, inventory_value = (current_quantity + $1) * unit_cost, updated_at = NOW() WHERE id = $2`,
        [variance, item.id]
      );

      await client.query(
        `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [item.id, `ADJ-${countRecord.rows[0].id}`, adjustmentType, Math.abs(variance), normalizeUnit(item.unit || 'kg'), Number(item.unit_cost || 0), Math.abs(variance) * Number(item.unit_cost || 0), adjustmentLocationId, null, item.station || 'KITCHEN', businessDate, actor, reason]
      );

      await client.query(
        `INSERT INTO public.accounting_audit_log (entity_type, entity_id, action, actor, details)
         VALUES ('inventory_adjustment', $1, $2, $3, $4)`,
        [adjustmentRecord.rows[0].id, adjustmentType.toLowerCase(), actor, JSON.stringify({
          item_id: item.id,
          item_name: item.item_name,
          adjustment_type: adjustmentType,
          quantity: Math.abs(variance),
          unit: normalizeUnit(item.unit || 'kg'),
          system_quantity: systemQuantity,
          physical_quantity: physicalQuantity,
          variance,
          reason,
          business_date: businessDate,
          location_id: adjustmentLocationId,
          stock_count_id: countRecord.rows[0].id,
          reference: `ADJ-${countRecord.rows[0].id}`,
        })]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(countRecord.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
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
        AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
        AND LOWER(COALESCE(il.name, '')) NOT LIKE '%shisha%'
    `);

    const purchaseTotal = await pool.query(`SELECT COALESCE(SUM(total_amount), 0) AS total_purchases FROM public.purchase_receipts`);
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

async function handleInventorySummaryRequest(req, res) {
  try {
    const payload = req.body || {};
    const businessDate = payload.business_date || payload.start_date || payload.end_date || new Date().toISOString().slice(0, 10);
    const startDate = payload.start_date || businessDate;
    const endDate = payload.end_date || businessDate;
    const period = payload.period || 'Daily';
    const department = payload.department || 'ALL';
    const exportFormat = String(payload.export_format || payload.format || 'json').toLowerCase();

    const reportDepartmentValue = String(department || 'ALL').trim();
    const departmentClause = reportDepartmentValue.toUpperCase() === 'ALL'
      ? "AND UPPER(COALESCE(ii.station, '')) NOT IN ('SHISHA') AND LOWER(COALESCE(il.name, '')) NOT LIKE '%shisha%'"
      : reportDepartmentValue.toUpperCase() === 'MAIN STORE'
        ? "AND (LOWER(COALESCE(il.name, '')) NOT LIKE '%kitchen%' AND LOWER(COALESCE(il.name, '')) NOT LIKE '%bar%' AND LOWER(COALESCE(il.name, '')) NOT LIKE '%barista%' AND LOWER(COALESCE(il.name, '')) NOT LIKE '%shisha%' OR LOWER(COALESCE(ii.station, '')) IN ('', 'MAIN STORE'))"
        : reportDepartmentValue.toUpperCase() === 'KITCHEN'
          ? "AND (UPPER(COALESCE(ii.station, '')) = 'KITCHEN' OR LOWER(COALESCE(il.name, '')) LIKE '%kitchen%')"
          : reportDepartmentValue.toUpperCase() === 'BAR'
            ? "AND (UPPER(COALESCE(ii.station, '')) IN ('BAR', 'BARMAN') OR LOWER(COALESCE(il.name, '')) LIKE '%bar%')"
            : "AND (UPPER(COALESCE(ii.station, '')) = 'BARISTA' OR LOWER(COALESCE(il.name, '')) LIKE '%barista%')";

    const [itemsResult, purchaseResult, transactionResult, wasteResult, adjustmentResult] = await Promise.all([
      pool.query(`
        SELECT ii.*, il.name AS location_name
        FROM public.inventory_items ii
        LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
        WHERE ii.is_active = true
          ${departmentClause}
          AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
          AND LOWER(COALESCE(il.name, '')) NOT LIKE '%shisha%'
        ORDER BY ii.item_name ASC
      `),
      pool.query(`
        SELECT pr.id, pr.business_date, pri.item_id, pri.quantity, pri.unit_cost, pri.total_cost, ii.item_name, ii.station, il.name AS location_name
        FROM public.purchase_receipt_items pri
        LEFT JOIN public.purchase_receipts pr ON pr.id = pri.purchase_id
        LEFT JOIN public.inventory_items ii ON ii.id = pri.item_id
        LEFT JOIN public.inventory_locations il ON il.id = pri.location_id
        WHERE pr.business_date BETWEEN $1 AND $2
          AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
          AND LOWER(COALESCE(il.name, '')) NOT LIKE '%shisha%'
      `, [startDate, endDate]),
      pool.query(`
        SELECT it.*, ii.item_name, ii.station, sl.name AS source_location, dl.name AS destination_location
        FROM public.inventory_transactions it
        LEFT JOIN public.inventory_items ii ON ii.id = it.item_id
        LEFT JOIN public.inventory_locations sl ON sl.id = it.source_location_id
        LEFT JOIN public.inventory_locations dl ON dl.id = it.destination_location_id
        WHERE it.business_date BETWEEN $1 AND $2
          AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
          AND LOWER(COALESCE(sl.name, '')) NOT LIKE '%shisha%'
          AND LOWER(COALESCE(dl.name, '')) NOT LIKE '%shisha%'
      `, [startDate, endDate]),
      pool.query(`
        SELECT iw.*, ii.item_name, ii.station, il.name AS location_name
        FROM public.inventory_waste iw
        LEFT JOIN public.inventory_items ii ON ii.id = iw.item_id
        LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
        WHERE iw.business_date BETWEEN $1 AND $2
          AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
          AND LOWER(COALESCE(il.name, '')) NOT LIKE '%shisha%'
      `, [startDate, endDate]),
      pool.query(`
        SELECT ia.*, ii.item_name, ii.station, il.name AS location_name
        FROM public.inventory_adjustments ia
        LEFT JOIN public.inventory_items ii ON ii.id = ia.item_id
        LEFT JOIN public.inventory_locations il ON il.id = ia.location_id
        WHERE ia.business_date BETWEEN $1 AND $2
          AND UPPER(COALESCE(ii.station, '')) <> 'SHISHA'
          AND LOWER(COALESCE(il.name, '')) NOT LIKE '%shisha%'
      `, [startDate, endDate])
    ]);

    const report = buildInventorySummary({
      items: itemsResult.rows,
      transactions: transactionResult.rows,
      purchases: purchaseResult.rows,
      waste: wasteResult.rows,
      adjustments: adjustmentResult.rows,
      businessDate,
      department: reportDepartmentValue,
      generatedBy: req.user?.name || 'Accountant',
      period,
      startDate,
      endDate,
    });

    if (exportFormat === 'pdf') {
      const pdfBuffer = generateInventorySummaryPdf(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Kurax_Inventory_Summary_${businessDate}.pdf`);
      return res.send(pdfBuffer);
    }

    return res.json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to generate inventory summary.' });
  }
}

router.post('/reports/summary', authenticateInventory, allowInventoryReport, handleInventorySummaryRequest);

router.get('/reports/summary', authenticateInventory, allowInventoryReport, async (req, res) => {
  const businessDate = req.query.business_date || req.query.start_date || req.query.end_date || new Date().toISOString().slice(0, 10);
  const startDate = req.query.start_date || businessDate;
  const endDate = req.query.end_date || businessDate;
  const department = req.query.department || 'ALL';
  const period = req.query.period || 'Daily';
  const exportFormat = String(req.query.format || req.query.export_format || 'json').toLowerCase();

  req.body = {
    business_date: businessDate,
    start_date: startDate,
    end_date: endDate,
    department,
    period,
    export_format: exportFormat,
  };

  return handleInventorySummaryRequest(req, res);
});

router.get('/reports/low-stock', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ii.*, il.name AS location_name
       FROM public.inventory_items ii
       LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
       WHERE ii.is_active = true AND ii.current_quantity <= ii.minimum_stock_level
       ORDER BY ii.item_name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/menu-items-without-recipes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.name, m.station, m.category, m.price
       FROM public.menus m
       LEFT JOIN public.inventory_recipes r ON LOWER(m.name) = LOWER(r.menu_name) AND r.status = 'ACTIVE'
       WHERE m.published = true AND r.id IS NULL
       ORDER BY m.name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT it.*, ii.item_name, sl.name AS source_location, dl.name AS destination_location
       FROM public.inventory_transactions it
       LEFT JOIN public.inventory_items ii ON ii.id = it.item_id
       LEFT JOIN public.inventory_locations sl ON sl.id = it.source_location_id
       LEFT JOIN public.inventory_locations dl ON dl.id = it.destination_location_id
       ORDER BY it.created_at DESC
       LIMIT 200`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
