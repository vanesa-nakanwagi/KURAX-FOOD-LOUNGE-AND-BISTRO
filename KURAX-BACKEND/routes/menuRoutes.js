import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import path from 'path';
import fs from 'fs';

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
    res.json(result.rows.map((menu) => {
      const websiteExtraFee = Number(menu.website_extra_fee || 0);
      return {
        ...menu,
        website_extra_fee: websiteExtraFee,
        website_published: menu.website_published ?? menu.published === true,
        website_price: Number(menu.price || 0) + websiteExtraFee,
      };
    }));
  } catch (err) {
    console.error("❌ FETCH ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch menus" });
  }
});

// --- POST NEW MENU ---
router.post('/', upload.single('image'), async (req, res) => {
  const uploadedImageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const { name, description, price, category, station, published, website_published, website_extra_fee } = req.body;
    const websiteExtraFee = parseWebsiteExtraFee(website_extra_fee);
    if (websiteExtraFee === null) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(400).json({ error: 'Website price addition must be a non-negative amount.' });
    }
    const imageUrl = uploadedImageUrl || req.body.image_url || null;
    
    // Convert 'true'/'false' string from FormData to actual boolean
    const isPublished = published === 'true' || published === true;

    // UPDATED: Return 'status' string in the response
    const query = `
      INSERT INTO public.menus (name, description, price, category, station, image_url, published, customer_visible, website_published, website_extra_fee)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *, price + COALESCE(website_extra_fee, 0) AS website_price, (CASE WHEN $7 = true THEN 'live' ELSE 'draft' END) as status
    `;

    const result = await pool.query(query, [
      name, description, price, category, station, imageUrl, isPublished,
      website_published === 'true' || website_published === true,
      website_published === 'true' || website_published === true,
      websiteExtraFee
    ]);
    
    res.status(201).json(result.rows[0]);
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
    const websiteExtraFee = parseWebsiteExtraFee(website_extra_fee);
    if (websiteExtraFee === null) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(400).json({ error: 'Website price addition must be a non-negative amount.' });
    }
    const imageUrl = uploadedImageUrl || String(req.body.image_url || '').trim() || null;

    const isPublished = published === 'true' || published === true;

    // UPDATED: Return 'status' string in the response
    const query = `
      UPDATE public.menus
      SET name=$1, description=$2, price=$3, category=$4, station=$5, published=$6, image_url=COALESCE($7, image_url), customer_visible=$8, website_published=$9, website_extra_fee=$10
      WHERE id=$11
      RETURNING *, price + COALESCE(website_extra_fee, 0) AS website_price, (CASE WHEN published = true THEN 'live' ELSE 'draft' END) as status
    `;

    const result = await pool.query(query, [
      name, description, price, category, station, isPublished, imageUrl,
      website_published === 'true' || website_published === true,
      website_published === 'true' || website_published === true,
      websiteExtraFee,
      id
    ]);
    if (result.rows.length === 0) {
      await removeMenuImage(uploadedImageUrl);
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(result.rows[0]);
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