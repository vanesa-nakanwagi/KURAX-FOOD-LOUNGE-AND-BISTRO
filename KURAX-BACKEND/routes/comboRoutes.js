import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import pool from '../db.js';
import { calculateComboBreakdown, validateComboPayload } from '../helpers/comboPricing.js';

const router = express.Router();
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MIME_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (_req, file, callback) => callback(
      null,
      `${Date.now()}-${randomBytes(12).toString('hex')}${MIME_EXTENSIONS[file.mimetype]}`
    ),
  }),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, callback) => callback(
    Object.hasOwn(MIME_EXTENSIONS, file.mimetype) ? null : new Error('Combo images must be JPEG, PNG, or WebP.'),
    Object.hasOwn(MIME_EXTENSIONS, file.mimetype)
  ),
});

function removeComboImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  const imagePath = path.join('uploads', path.basename(imageUrl));
  try {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  } catch (error) {
    console.error('Combo image cleanup failed:', error.message);
  }
}

function parsePayload(body = {}) {
  const payload = { ...body };
  if (typeof payload.components === 'string') payload.components = JSON.parse(payload.components);
  return payload;
}

function parseBoolean(value, fallback) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function serializeCombo(row) {
  const components = Array.isArray(row.components) ? row.components : [];
  const normalized = components.map((component) => ({
    ...component,
    quantity: Number(component.quantity || 0),
    unit_price: Number(component.unit_price || 0),
  }));

  return {
    ...row,
    price: Number(row.price || 0),
    regular_total: Number(row.regular_total || 0),
    discount_amount: Number(row.discount_amount || 0),
    discount_percentage: Number(row.discount_percentage || 0),
    total_cost: Number(row.total_cost || 0),
    gross_profit: Number(row.gross_profit || 0),
    margin_percentage: Number(row.margin_percentage || 0),
    is_available: row.is_available !== false,
    published: row.published === true,
    customer_visible: row.customer_visible !== false,
    components: normalized,
  };
}

router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'menu_item_id', ci.menu_item_id,
            'quantity', ci.quantity,
            'name', m.name,
            'unit_price', m.price,
            'image_url', m.image_url,
            'category', m.category,
            'station', m.station
          )
          ORDER BY ci.id
        ) AS components
      FROM public.combos c
      LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
      LEFT JOIN public.menus m ON m.id = ci.menu_item_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json(result.rows.map(serializeCombo));
  } catch (error) {
    console.error('Combo fetch error:', error.message);
    res.status(500).json({ error: 'Failed to load combos.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'menu_item_id', ci.menu_item_id,
            'quantity', ci.quantity,
            'name', m.name,
            'unit_price', m.price,
            'image_url', m.image_url,
            'category', m.category,
            'station', m.station
          )
          ORDER BY ci.id
        ) AS components
      FROM public.combos c
      LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
      LEFT JOIN public.menus m ON m.id = ci.menu_item_id
      WHERE c.id = $1
      GROUP BY c.id
      LIMIT 1
    `, [req.params.id]);

    if (!result.rows[0]) return res.status(404).json({ error: 'Combo not found.' });
    res.json(serializeCombo(result.rows[0]));
  } catch (error) {
    console.error('Combo fetch by ID error:', error.message);
    res.status(500).json({ error: 'Failed to load combo details.' });
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  const uploadedImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const { name, description, price, category, station, image_url, published, is_available, customer_visible, components } = parsePayload(req.body);
    const menuRows = await pool.query('SELECT id, name, price, category, station FROM public.menus WHERE is_active IS NOT FALSE OR published = true OR customer_visible = true');
    const validation = validateComboPayload({
      name,
      price,
      components,
    }, menuRows.rows);

    if (!validation.valid) {
      removeComboImage(uploadedImageUrl);
      return res.status(400).json({ error: validation.errors[0] || 'Invalid combo data.' });
    }

    const normalizedComponents = (components || []).map((component) => ({
      menu_item_id: Number(component.menu_item_id ?? component.menuId ?? component.id),
      quantity: Number(component.quantity || 1),
      unit_price: Number(component.unit_price ?? component.price ?? 0),
    }));

    const breakdown = calculateComboBreakdown({
      price,
      components: normalizedComponents,
    });

    const imageUrl = uploadedImageUrl || image_url || null;

    const result = await pool.query(`
      INSERT INTO public.combos (
        name, description, price, category, station, image_url, is_available, published,
        customer_visible, regular_total, discount_amount, discount_percentage, total_cost,
        gross_profit, margin_percentage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      String(name || '').trim(),
      description || '',
      Number(price || 0),
      category || 'Starters',
      station || 'Kitchen',
      imageUrl,
      parseBoolean(is_available, true),
      parseBoolean(published, false),
      parseBoolean(customer_visible, true),
      breakdown.regular_total,
      breakdown.discount_amount,
      breakdown.discount_percentage,
      breakdown.total_cost,
      breakdown.gross_profit,
      breakdown.margin_percentage,
    ]);

    const combo = result.rows[0];
    for (const component of normalizedComponents) {
      await pool.query(
        `INSERT INTO public.combo_items (combo_id, menu_item_id, quantity) VALUES ($1, $2, $3)`,
        [combo.id, component.menu_item_id, component.quantity]
      );
    }

    const created = await pool.query(`
      SELECT c.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'menu_item_id', ci.menu_item_id,
            'quantity', ci.quantity,
            'name', m.name,
            'unit_price', m.price,
            'image_url', m.image_url,
            'category', m.category,
            'station', m.station
          )
          ORDER BY ci.id
        ) AS components
      FROM public.combos c
      LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
      LEFT JOIN public.menus m ON m.id = ci.menu_item_id
      WHERE c.id = $1
      GROUP BY c.id
      LIMIT 1
    `, [combo.id]);

    res.status(201).json(serializeCombo(created.rows[0]));
  } catch (error) {
    removeComboImage(uploadedImageUrl);
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Combo components must be valid JSON.' });
    console.error('Combo create error:', error.message);
    res.status(500).json({ error: 'Unable to save combo.' });
  }
});

router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const uploadedImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const { name, description, price, category, station, image_url, published, is_available, customer_visible, components } = parsePayload(req.body);
    const menuRows = await pool.query('SELECT id, name, price, category, station FROM public.menus');
    const validation = validateComboPayload({ name, price, components }, menuRows.rows);
    if (!validation.valid) {
      removeComboImage(uploadedImageUrl);
      return res.status(400).json({ error: validation.errors[0] || 'Invalid combo data.' });
    }

    const normalizedComponents = (components || []).map((component) => ({
      menu_item_id: Number(component.menu_item_id ?? component.menuId ?? component.id),
      quantity: Number(component.quantity || 1),
      unit_price: Number(component.unit_price ?? component.price ?? 0),
    }));

    const breakdown = calculateComboBreakdown({ price, components: normalizedComponents });

    const existing = await pool.query('SELECT id, image_url FROM public.combos WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Combo not found.' });

    const imageUrl = uploadedImageUrl || image_url || existing.rows[0].image_url || null;

    await pool.query('DELETE FROM public.combo_items WHERE combo_id = $1', [id]);

    const result = await pool.query(`
      UPDATE public.combos
      SET name = $1,
          description = $2,
          price = $3,
          category = $4,
          station = $5,
          image_url = $6,
          is_available = $7,
          published = $8,
          customer_visible = $9,
          regular_total = $10,
          discount_amount = $11,
          discount_percentage = $12,
          total_cost = $13,
          gross_profit = $14,
          margin_percentage = $15,
          updated_at = NOW()
      WHERE id = $16
      RETURNING *
    `, [
      String(name || '').trim(),
      description || '',
      Number(price || 0),
      category || 'Starters',
      station || 'Kitchen',
      imageUrl,
      parseBoolean(is_available, true),
      parseBoolean(published, false),
      parseBoolean(customer_visible, true),
      breakdown.regular_total,
      breakdown.discount_amount,
      breakdown.discount_percentage,
      breakdown.total_cost,
      breakdown.gross_profit,
      breakdown.margin_percentage,
      id,
    ]);

    for (const component of normalizedComponents) {
      await pool.query(
        `INSERT INTO public.combo_items (combo_id, menu_item_id, quantity) VALUES ($1, $2, $3)`,
        [id, component.menu_item_id, component.quantity]
      );
    }

    const updated = await pool.query(`
      SELECT c.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'menu_item_id', ci.menu_item_id,
            'quantity', ci.quantity,
            'name', m.name,
            'unit_price', m.price,
            'image_url', m.image_url,
            'category', m.category,
            'station', m.station
          )
          ORDER BY ci.id
        ) AS components
      FROM public.combos c
      LEFT JOIN public.combo_items ci ON ci.combo_id = c.id
      LEFT JOIN public.menus m ON m.id = ci.menu_item_id
      WHERE c.id = $1
      GROUP BY c.id
      LIMIT 1
    `, [id]);

    if (uploadedImageUrl) removeComboImage(existing.rows[0].image_url);
    res.json(serializeCombo(updated.rows[0]));
  } catch (error) {
    removeComboImage(uploadedImageUrl);
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'Combo components must be valid JSON.' });
    console.error('Combo update error:', error.message);
    res.status(500).json({ error: 'Unable to update combo.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM public.combo_items WHERE combo_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM public.combos WHERE id = $1 RETURNING id, image_url', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Combo not found.' });
    removeComboImage(result.rows[0].image_url);
    res.json({ success: true });
  } catch (error) {
    console.error('Combo delete error:', error.message);
    res.status(500).json({ error: 'Unable to remove combo.' });
  }
});

export default router;
