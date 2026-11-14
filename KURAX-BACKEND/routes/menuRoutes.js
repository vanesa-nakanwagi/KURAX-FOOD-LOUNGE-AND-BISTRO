import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import path from 'path';
import fs from 'fs';
import { readSessionToken } from '../middleware/sessionTokens.js';
import { getEffectiveMenuPrice, parsePromotionSettings } from '../helpers/menuPromotions.js';
import logActivity from '../utils/logsActivity.js';

const router = express.Router();
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MIME_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const UPLOADS_DIRECTORY = path.resolve(process.cwd(), 'uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdir(UPLOADS_DIRECTORY, { recursive: true }, (error) => callback(error, UPLOADS_DIRECTORY));
    },
    filename: (_req, file, callback) => callback(
      null,
      `${Date.now()}-${randomBytes(12).toString('hex')}${MIME_EXTENSIONS[file.mimetype]}`
    ),
  }),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (_req, file, callback) => callback(
    Object.hasOwn(MIME_EXTENSIONS, file.mimetype) ? null : new Error('Menu images must be JPEG, PNG, or WebP.'),
    Object.hasOwn(MIME_EXTENSIONS, file.mimetype)
  ),
});

function parseWebsiteExtraFee(value) {
  const fee = Number(value ?? 0);
  return Number.isFinite(fee) && fee >= 0 ? fee : null;
}

function hasPromotionFields(body = {}) {
  return [
    'promotion_enabled',
    'promotion_discount_type',
    'promotion_discount_value',
    'promotion_discount_percent',
    'promotion_starts_at',
    'promotion_ends_at',
  ].some((key) => Object.hasOwn(body, key));
}

async function authorizePromotionEditor(req, res) {
  if (!hasPromotionFields(req.body)) return true;
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) {
    res.status(401).json({ error: 'Sign in as a Content Manager or Director to manage menu promotions.' });
    return false;
  }
  let session;
  try {
    session = readSessionToken(token);
  } catch {
    res.status(401).json({ error: 'Session expired. Sign in again.' });
    return false;
  }
  if (session.scope !== 'restaurant' || !Number.isInteger(Number(session.id))) {
    res.status(401).json({ error: 'A valid restaurant staff session is required.' });
    return false;
  }
  try {
    const result = await pool.query(
      'SELECT id, name, role, is_active FROM public.staff WHERE id = $1',
      [Number(session.id)]
    );
    const actor = result.rows[0];
    if (!actor || actor.is_active === false || actor.role !== session.role) {
      res.status(401).json({ error: 'Staff account is inactive or has changed.' });
      return false;
    }
    if (!['DIRECTOR', 'CONTENT_CREATOR', 'CONTENT MANAGER', 'CONTENT-MANAGER'].includes(String(actor.role).toUpperCase())) {
      res.status(403).json({ error: 'Only a Content Manager or Director may manage menu promotions.' });
      return false;
    }
    req.promotionActor = actor;
    return true;
  } catch (error) {
    console.error('Menu promotion authorization failed:', error.message);
    res.status(500).json({ error: 'Could not verify staff access.' });
    return false;
  }
}

function serializeMenu(menu) {
  const basePrice = Number(menu.price || 0);
  const promotion = getEffectiveMenuPrice(menu);
  const websiteExtraFee = Number(menu.website_extra_fee || 0);
  const websitePromotion = getEffectiveMenuPrice(menu, { basePrice: basePrice + websiteExtraFee });
  return {
    ...menu,
    list_price: basePrice,
    price: promotion?.effectivePrice ?? basePrice,
    effective_price: promotion?.effectivePrice ?? basePrice,
    promotion_active: promotion?.promotionActive ?? false,
    promotion_discount_amount: promotion?.discountAmount ?? 0,
    website_extra_fee: websiteExtraFee,
    website_published: menu.website_published ?? menu.published === true,
    website_list_price: basePrice + websiteExtraFee,
    website_price: websitePromotion?.effectivePrice ?? basePrice + websiteExtraFee,
  };
}

async function removeMenuImage(imageUrl) {
  if (!imageUrl) return;
  try {
    const parsedUrl = new URL(imageUrl, 'http://localhost');
    if (!parsedUrl.pathname.startsWith('/uploads/')) return;
    const filePath = path.join(UPLOADS_DIRECTORY, path.basename(decodeURIComponent(parsedUrl.pathname)));
    await fs.promises.unlink(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  } catch (error) {
    console.error('Menu image cleanup failed:', error.message);
  }
}

// --- GET ALL MENUS ---
router.get('/', async (req, res) => {
  try {
    // UPDATED: Added CASE mapping to provide the 'status' field for the frontend filter
    const query = `
      SELECT *,
      CASE WHEN published = true THEN 'live' ELSE 'draft' END as status 
      FROM public.menus
      WHERE LOWER(TRIM(COALESCE(category, ''))) <> 'shisha'
        AND LOWER(TRIM(COALESCE(station, ''))) <> 'shisha'
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows.map(serializeMenu));
  } catch (err) {
    console.error("❌ FETCH ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch menus" });
  }
});

// --- POST NEW MENU ---
router.post('/', upload.single('image'), async (req, res) => {
  const uploadedImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    if (!await authorizePromotionEditor(req, res)) {
      await removeMenuImage(uploadedImageUrl);
      return;
    }
    const { name, description, price, category, station, published, website_published, website_extra_fee } = req.body;
    const basePrice = Number(price);
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(400).json({ error: 'Menu price must be a non-negative amount.' });
    }
    const websiteExtraFee = parseWebsiteExtraFee(website_extra_fee);
    if (websiteExtraFee === null) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(400).json({ error: 'Website price addition must be a non-negative amount.' });
    }
    const promotion = parsePromotionSettings(req.body, { price: basePrice });
    if (promotion.error) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(400).json({ error: promotion.error });
    }
    const imageUrl = uploadedImageUrl || req.body.image_url || null;
    
    // Convert 'true'/'false' string from FormData to actual boolean
    const isPublished = published === 'true' || published === true;

    // UPDATED: Return 'status' string in the response
    const query = `
      INSERT INTO public.menus (
        name, description, price, category, station, image_url, published, customer_visible,
        website_published, website_extra_fee, promotion_enabled, promotion_discount_type,
        promotion_discount_value, promotion_discount_percent, promotion_starts_at, promotion_ends_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *, price + COALESCE(website_extra_fee, 0) AS website_price, (CASE WHEN $7 = true THEN 'live' ELSE 'draft' END) as status
    `;

    const result = await pool.query(query, [
      name, description, basePrice, category, station, imageUrl, isPublished,
      website_published === 'true' || website_published === true,
      website_published === 'true' || website_published === true,
      websiteExtraFee,
      promotion.promotion_enabled,
      promotion.promotion_discount_type,
      promotion.promotion_discount_value,
      promotion.promotion_discount_percent,
      promotion.promotion_starts_at,
      promotion.promotion_ends_at
    ]);
    if (req.promotionActor) {
      await logActivity(pool, {
        type: 'MENU_PROMOTION_CONFIGURED',
        actor: req.promotionActor.name,
        role: req.promotionActor.role,
        message: `Menu promotion configured for ${name}`,
        meta: { menu_id: result.rows[0].id, ...promotion, price: basePrice },
      });
    }
    res.status(201).json(serializeMenu(result.rows[0]));
  } catch (err) {
    await removeMenuImage(uploadedImageUrl);
    console.error("❌ SAVE ERROR:", err.message);
    res.status(500).json({ error: "Failed to save menu item" });
  }
});

// --- PUT UPDATE MENU ---
router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, station, published, website_published, website_extra_fee } = req.body;
  const uploadedImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    if (!await authorizePromotionEditor(req, res)) {
      await removeMenuImage(uploadedImageUrl);
      return;
    }
    const existingResult = await pool.query(
      'SELECT price, promotion_enabled, promotion_discount_type, promotion_discount_value, promotion_discount_percent, promotion_starts_at, promotion_ends_at FROM public.menus WHERE id = $1',
      [id]
    );
    const currentMenu = existingResult.rows[0];
    if (!currentMenu) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(404).json({ error: 'Item not found' });
    }
    const basePrice = Number(price);
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(400).json({ error: 'Menu price must be a non-negative amount.' });
    }
    const websiteExtraFee = parseWebsiteExtraFee(website_extra_fee);
    if (websiteExtraFee === null) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(400).json({ error: 'Website price addition must be a non-negative amount.' });
    }
    const promotion = parsePromotionSettings(req.body, { ...currentMenu, price: basePrice });
    if (promotion.error) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(400).json({ error: promotion.error });
    }
    const imageUrl = uploadedImageUrl || String(req.body.image_url || '').trim() || null;

    const isPublished = published === 'true' || published === true;

    // UPDATED: Return 'status' string in the response
    const query = `
      UPDATE public.menus
      SET name=$1, description=$2, price=$3, category=$4, station=$5, published=$6,
          image_url=COALESCE($7, image_url), customer_visible=$8, website_published=$9,
          website_extra_fee=$10, promotion_enabled=$11, promotion_discount_type=$12,
          promotion_discount_value=$13, promotion_discount_percent=$14,
          promotion_starts_at=$15, promotion_ends_at=$16, updated_at=NOW()
      WHERE id=$17
      RETURNING *, price + COALESCE(website_extra_fee, 0) AS website_price, (CASE WHEN published = true THEN 'live' ELSE 'draft' END) as status
    `;

    const result = await pool.query(query, [
      name, description, basePrice, category, station, isPublished, imageUrl,
      website_published === 'true' || website_published === true,
      website_published === 'true' || website_published === true,
      websiteExtraFee,
      promotion.promotion_enabled,
      promotion.promotion_discount_type,
      promotion.promotion_discount_value,
      promotion.promotion_discount_percent,
      promotion.promotion_starts_at,
      promotion.promotion_ends_at,
      id
    ]);
    if (result.rows.length === 0) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(404).json({ error: "Item not found" });
    }
    if (req.promotionActor) {
      await logActivity(pool, {
        type: 'MENU_PROMOTION_CONFIGURED',
        actor: req.promotionActor.name,
        role: req.promotionActor.role,
        message: `Menu promotion updated for ${name}`,
        meta: { menu_id: result.rows[0].id, ...promotion, price: basePrice },
      });
    }
    res.json(serializeMenu(result.rows[0]));
  } catch (err) {
    await removeMenuImage(uploadedImageUrl);
    console.error("❌ UPDATE ERROR:", err.message);
    res.status(500).json({ error: "Database error during update" });
  }
});

// --- DELETE ---
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT image_url FROM public.menus WHERE id = $1', [id]);
    await pool.query('DELETE FROM public.menus WHERE id = $1', [id]);
    if (result.rows[0]?.image_url) await removeMenuImage(result.rows[0].image_url);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err.message);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;