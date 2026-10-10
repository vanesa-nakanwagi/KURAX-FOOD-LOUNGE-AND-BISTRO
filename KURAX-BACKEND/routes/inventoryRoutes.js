import express from 'express';
import pool from '../db.js';
import { createJournalEntry } from '../helpers/accounting.js';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { consumeSoldOrderItems, convertRecipeQuantity } from '../helpers/recipeConsumption.js';

const router = express.Router();

const ROLE_STATIONS = {
  CHEF: 'KITCHEN',
  KITCHEN_HOD: 'KITCHEN',
  BARMAN: 'BAR',
  BAR_HOD: 'BAR',
  BARISTA: 'BARISTA',
  BARISTA_HOD: 'BARISTA',
};
const HOD_STATION_ROLES = {
  KITCHEN: 'KITCHEN_HOD',
  BAR: 'BAR_HOD',
  BARISTA: 'BARISTA_HOD',
};
const RECIPE_VIEW_ROLES = new Set([
  ...Object.keys(ROLE_STATIONS),
  'ACCOUNTANT',
  'DIRECTOR',
  'MANAGER',
  'SUPERVISOR',
]);

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

function unitFamily(unit) {
  const normalized = normalizeUnit(unit);
  if (['kg', 'g', 'gram'].includes(normalized)) return 'mass';
  if (['litre', 'liter', 'l', 'ml', 'millilitre', 'milliliter'].includes(normalized)) return 'volume';
  return normalized;
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

function currentBusinessDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
}

function stockStatus(item) {
  if (Number(item.current_quantity || 0) <= 0) return 'OUT OF STOCK';
  if (Number(item.minimum_stock_level || 0) >= 0 && Number(item.current_quantity || 0) <= Number(item.minimum_stock_level || 0)) return 'LOW STOCK';
  return 'IN STOCK';
}

function isActiveOrderItem(item = {}) {
  return item.voidProcessed !== true && String(item.status || '').toUpperCase() !== 'VOIDED';
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
  const businessDate = payload.business_date || currentBusinessDate();
  const actor = req.user?.name || payload.posted_by || 'Accountant';

  if (!items.length) {
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
            actor,
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
        [quantity, unitCost, supplierId, await resolveLocationId(row.location_id || item.location_id || null, row.location_name || 'MAIN STORE'), actor, item.id]
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
          actor,
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
      postedBy: actor,
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
      [referenceNumber, Number(payload.source_location_id), Number(payload.destination_location_id), payload.notes || '', payload.business_date || currentBusinessDate(), req.user?.name || 'Accountant']
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
        [item.id, `${referenceNumber}-OUT-${item.id}`, quantity, unit, item.unit_cost || 0, quantity * Number(item.unit_cost || 0), Number(payload.source_location_id), Number(payload.destination_location_id), item.station || 'KITCHEN', payload.business_date || currentBusinessDate(), req.user?.name || 'Accountant', `Transfer out: ${item.item_name}`]
      );

      await client.query(
        `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
         VALUES ($1, $2, 'TRANSFER_IN', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [destinationItem.id, `${referenceNumber}-IN-${item.id}`, quantity, unit, item.unit_cost || 0, quantity * Number(item.unit_cost || 0), Number(payload.source_location_id), Number(payload.destination_location_id), item.station || 'KITCHEN', payload.business_date || currentBusinessDate(), req.user?.name || 'Accountant', `Transfer in: ${item.item_name}`]
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

router.get('/recipes', async (req, res) => {
  try {
    const station = requestedRecipeStation(req, req.query.station, res);
    if (res.headersSent) return;
    const result = await pool.query(
      `SELECT r.*, COALESCE((SELECT json_agg(row_to_json(ri)) FROM (
        SELECT ri.*, ii.item_name AS ingredient_name
        FROM public.recipe_ingredients ri
        LEFT JOIN public.inventory_items ii ON ii.id = ri.ingredient_item_id
        WHERE ri.recipe_id = r.id
      ) ri), '[]'::json) AS ingredients
       FROM public.inventory_recipes r
      WHERE ($1 = 'ALL' OR UPPER(r.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
       ORDER BY r.created_at DESC`
          , [station || 'ALL']
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
         ORDER BY r.version_number DESC, r.created_at DESC
         LIMIT 1
       ) recipe ON true
       WHERE m.published = true
         AND LOWER(TRIM(COALESCE(m.category, ''))) <> 'shisha'
         AND LOWER(TRIM(COALESCE(m.station, ''))) <> 'shisha'
         AND ($1 = 'ALL' OR UPPER(m.station) IN ($1, CASE WHEN $1 = 'BAR' THEN 'BARMAN' ELSE $1 END))
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
    if (!menuItem || !station) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Published menu item not found.' });
    }
    if (!canManageStation(req, station)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You can only configure recipes for your assigned department.' });
    }
    if (ingredients.some((ingredient) => {
      const quantity = Number(ingredient.quantity);
      return !Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(Number(ingredient.ingredient_item_id));
    })) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Each ingredient needs an existing inventory item and a quantity greater than zero.' });
    }

    const ingredientIds = [...new Set(ingredients.map((ingredient) => Number(ingredient.ingredient_item_id)))];
    const stockResult = await client.query(
      `SELECT ii.id, ii.item_name, ii.unit, ii.station, il.name AS location_name
       FROM public.inventory_items ii
       LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
       WHERE ii.id = ANY($1::int[]) AND ii.is_active = true`,
      [ingredientIds]
    );
    const stockItems = new Map(stockResult.rows.map((item) => [item.id, item]));
    for (const ingredient of ingredients) {
      const stockItem = stockItems.get(Number(ingredient.ingredient_item_id));
      const stockStation = normalizeStation(stockItem?.station);
      const isMainStore = String(stockItem?.location_name || '').trim().toUpperCase() === 'MAIN STORE';
      if (!stockItem || (stockStation && stockStation !== station && !isMainStore)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ingredient ${stockItem?.item_name || ingredient.ingredient_item_id} is not available to ${station}.` });
      }
      if (unitFamily(ingredient.unit || stockItem.unit) !== unitFamily(stockItem.unit)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ingredient unit ${ingredient.unit} is incompatible with ${stockItem.unit} stock for ${stockItem.item_name}.` });
      }
    }

    await client.query('SELECT pg_advisory_xact_lock($1)', [menuItemId]);
    const versionResult = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM public.inventory_recipes WHERE menu_item_id = $1 OR (menu_item_id IS NULL AND LOWER(menu_name) = LOWER($2) AND UPPER(station) IN ($3, CASE WHEN $3 = 'BAR' THEN 'BARMAN' ELSE $3 END))`,
      [menuItemId, menuItem.name, station]
    );
    const recipeResult = await client.query(
      `INSERT INTO public.inventory_recipes (menu_item_id, menu_name, station, version_number, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'DRAFT', $5, $5)
       RETURNING *`,
      [menuItem.id, menuItem.name, station, Number(versionResult.rows[0].next_version), req.inventoryActor.name]
    );

    for (const ingredient of ingredients) {
      const stockItem = stockItems.get(Number(ingredient.ingredient_item_id));
      await client.query(
        `INSERT INTO public.recipe_ingredients (recipe_id, ingredient_item_id, ingredient_name, quantity, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [recipeResult.rows[0].id, stockItem.id, stockItem.item_name, Number(ingredient.quantity), normalizeUnit(ingredient.unit || stockItem.unit)]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ recipe: recipeResult.rows[0], ingredients });
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
    if (currentRecipe.status !== 'DRAFT') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Submitted or active recipes are immutable. Save a new version instead.' });
    }
    if (!ingredients.length || ingredients.some((ingredient) => !Number.isInteger(Number(ingredient.ingredient_item_id)) || !Number.isFinite(Number(ingredient.quantity)) || Number(ingredient.quantity) <= 0)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Each draft recipe needs inventory ingredients with quantities greater than zero.' });
    }
    const ingredientIds = [...new Set(ingredients.map((ingredient) => Number(ingredient.ingredient_item_id)))];
    const stockResult = await client.query(
      `SELECT ii.id, ii.item_name, ii.unit, ii.station, il.name AS location_name
       FROM public.inventory_items ii
       LEFT JOIN public.inventory_locations il ON il.id = ii.location_id
       WHERE ii.id = ANY($1::int[]) AND ii.is_active = true`,
      [ingredientIds]
    );
    const stockItems = new Map(stockResult.rows.map((item) => [item.id, item]));
    for (const ingredient of ingredients) {
      const stockItem = stockItems.get(Number(ingredient.ingredient_item_id));
      const stockStation = normalizeStation(stockItem?.station);
      if (!stockItem || (stockStation && stockStation !== normalizeStation(currentRecipe.station) && String(stockItem.location_name || '').trim().toUpperCase() !== 'MAIN STORE')) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ingredient ${stockItem?.item_name || ingredient.ingredient_item_id} is not available to this department.` });
      }
      if (unitFamily(ingredient.unit || stockItem.unit) !== unitFamily(stockItem.unit)) {
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
        [Number(id), stockItem.id, stockItem.item_name, Number(ingredient.quantity), normalizeUnit(ingredient.unit || stockItem.unit)]
      );
    }
    const recipe = await client.query(`UPDATE public.inventory_recipes SET updated_at = NOW(), updated_by = $2 WHERE id = $1 RETURNING *`, [Number(id), req.inventoryActor.name]);
    await client.query('COMMIT');
    res.json(recipe.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post('/recipes/:id/submit', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query(`SELECT station FROM public.inventory_recipes WHERE id = $1`, [Number(id)]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });
    if (!canManageStation(req, existing.rows[0].station)) return res.status(403).json({ error: 'You can only submit recipes for your assigned department.' });
    const result = await pool.query(
      `UPDATE public.inventory_recipes SET status = 'SUBMITTED', updated_at = NOW(), updated_by = $2 WHERE id = $1 AND status = 'DRAFT' RETURNING *`,
      [Number(id), req.inventoryActor.name]
    );
    if (!result.rows[0]) return res.status(409).json({ error: 'Only draft recipes can be submitted.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recipes/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query(`SELECT station FROM public.inventory_recipes WHERE id = $1`, [Number(id)]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Recipe not found.' });
    if (HOD_STATION_ROLES[normalizeStation(existing.rows[0].station)] !== req.inventoryActor.role) {
      return res.status(403).json({ error: 'Only the department HOD can approve this recipe.' });
    }
    const result = await pool.query(
      `UPDATE public.inventory_recipes SET status = 'APPROVED', approved_by = $1, approved_at = NOW(), updated_at = NOW(), updated_by = $1 WHERE id = $2 AND status = 'SUBMITTED' RETURNING *`,
      [req.inventoryActor.name, Number(id)]
    );
    if (!result.rows[0]) return res.status(409).json({ error: 'Only submitted recipes can be approved.' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/recipes/:id/activate', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`SELECT * FROM public.inventory_recipes WHERE id = $1 FOR UPDATE`, [Number(id)]);
    const recipe = current.rows[0];
    if (!recipe) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recipe not found.' });
    }
    if (HOD_STATION_ROLES[normalizeStation(recipe.station)] !== req.inventoryActor.role) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the department HOD can activate this recipe.' });
    }
    if (recipe.status !== 'APPROVED') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only approved recipes can be activated.' });
    }
    await client.query(
      `UPDATE public.inventory_recipes SET status = 'INACTIVE', updated_at = NOW(), updated_by = $3
      WHERE menu_item_id = $1 AND UPPER(station) IN ($2, CASE WHEN $2 = 'BAR' THEN 'BARMAN' ELSE $2 END) AND status = 'ACTIVE'`,
      [recipe.menu_item_id, normalizeStation(recipe.station), req.inventoryActor.name]
    );
    const result = await client.query(
      `UPDATE public.inventory_recipes SET status = 'ACTIVE', updated_at = NOW(), updated_by = $2 WHERE id = $1 RETURNING *`,
      [Number(id), req.inventoryActor.name]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
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
    let totalCost = 0;
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
        cost = convertRecipeQuantity(Number(ingredient.quantity || 0), ingredient.unit || item.unit, item.unit || 'kg') * Number(item.unit_cost || 0);
      } catch {
        missingCostItems += 1;
        continue;
      }
      if (Number(item.unit_cost || 0) <= 0) missingCostItems += 1;
      totalCost += cost;
    }

    const sellingPrice = Number(recipe.rows[0].selling_price || 0);
    const grossProfit = sellingPrice - totalCost;
    const foodCostPercentage = sellingPrice > 0 ? ((totalCost / sellingPrice) * 100) : 0;

    res.json({ recipe: recipe.rows[0], total_cost: totalCost, selling_price: sellingPrice, gross_profit: grossProfit, food_cost_percentage: foodCostPercentage, cost_status: missingCostItems ? 'REVIEW_REQUIRED' : 'ESTIMATED', missing_cost_items: missingCostItems });
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
  const quantity = Number(payload.quantity || 0);
  const actor = req.inventoryActor.name;

  if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
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
    try {
      recordedQuantity = convertRecipeQuantity(quantity, payload.unit || item.unit || 'kg', item.unit || 'kg');
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: error.message });
    }

    const newCurrent = Number(item.current_quantity || 0) - recordedQuantity;
    if (newCurrent < 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Insufficient stock for ${item.item_name}. Available: ${item.current_quantity}.` });
    }

    wasteEntry = await client.query(
      `INSERT INTO public.inventory_waste (item_id, quantity, unit, station, reason, business_date, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [item.id, recordedQuantity, normalizeUnit(item.unit || 'kg'), station, payload.reason || 'Waste', businessDate, actor, payload.notes || '']
    );

    await client.query(
      `UPDATE public.inventory_items SET current_quantity = $1, inventory_value = $1 * unit_cost, updated_at = NOW() WHERE id = $2`,
      [newCurrent, item.id]
    );

    await client.query(
      `INSERT INTO public.inventory_transactions (item_id, reference_number, transaction_type, quantity, unit, unit_cost, total_value, source_location_id, destination_location_id, station, business_date, created_by, notes)
       VALUES ($1, $2, 'WASTE', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [item.id, `WASTE-${wasteEntry.rows[0].id}`, recordedQuantity, normalizeUnit(item.unit || 'kg'), Number(item.unit_cost || 0), recordedQuantity * Number(item.unit_cost || 0), item.location_id || null, null, station, businessDate, actor, Number(item.unit_cost || 0) > 0 ? (payload.notes || 'Waste entry') : `COST_REVIEW: missing unit cost for ${item.item_name}; ${payload.notes || 'Waste entry'}`]
    );

    const wasteCost = recordedQuantity * Number(item.unit_cost || 0);
    if (wasteCost > 0) {
      await createJournalEntry({
        queryable: client,
        entryDate: businessDate,
        description: `Waste for ${item.item_name}`,
        sourceTransaction: `WASTE-${wasteEntry.rows[0].id}`,
        postedBy: actor,
        reference: `WASTE-${wasteEntry.rows[0].id}`,
        lines: [
          { accountCode: '5009', accountName: 'Waste / Inventory Loss', debit: wasteCost },
          { accountCode: '1201', accountName: 'Inventory', credit: wasteCost },
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
       WHERE ii.is_active = true AND ii.current_quantity <= ii.minimum_stock_level
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
