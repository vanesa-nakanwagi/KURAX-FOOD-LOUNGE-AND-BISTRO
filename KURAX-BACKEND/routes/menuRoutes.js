import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const MENU_IMAGE_BUCKET = process.env.MENU_IMAGE_BUCKET || 'menu-images';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MIME_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
let storageClient;
let bucketSetup;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: (req, file, callback) => callback(
    Object.hasOwn(MIME_EXTENSIONS, file.mimetype) ? null : new Error('Menu images must be JPEG, PNG, or WebP.'),
    Object.hasOwn(MIME_EXTENSIONS, file.mimetype)
  ),
});

function getStorageClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw Object.assign(
      new Error('Persistent menu image storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the backend.'),
      { httpStatus: 503 }
    );
  }
  if (!storageClient) storageClient = createClient(url, serviceRoleKey);
  return storageClient;
}

async function ensureMenuBucket(client) {
  if (!bucketSetup) {
    bucketSetup = (async () => {
      const { data, error } = await client.storage.getBucket(MENU_IMAGE_BUCKET);
      if (error) {
        const { error: createError } = await client.storage.createBucket(MENU_IMAGE_BUCKET, {
          public: true,
          fileSizeLimit: '5MB',
          allowedMimeTypes: Object.keys(MIME_EXTENSIONS),
        });
        if (createError && !/already exists/i.test(createError.message || '')) throw createError;
        return;
      }
      if (!data.public) {
        const { error: updateError } = await client.storage.updateBucket(MENU_IMAGE_BUCKET, {
          public: true,
          fileSizeLimit: '5MB',
          allowedMimeTypes: Object.keys(MIME_EXTENSIONS),
        });
        if (updateError) throw updateError;
      }
    })();
  }
  try {
    await bucketSetup;
  } catch (error) {
    bucketSetup = null;
    throw error;
  }
}

async function storeMenuImage(file) {
  const client = getStorageClient();
  await ensureMenuBucket(client);
  const objectPath = `menu/${Date.now()}-${randomBytes(12).toString('hex')}${MIME_EXTENSIONS[file.mimetype]}`;
  const { error } = await client.storage.from(MENU_IMAGE_BUCKET).upload(objectPath, file.buffer, {
    cacheControl: '31536000',
    contentType: file.mimetype,
    upsert: false,
  });
  if (error) throw error;
  const { data } = client.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(objectPath);
  return { objectPath, publicUrl: data.publicUrl };
}

async function removeMenuImage(imageUrl) {
  if (!imageUrl) return;
  try {
    const parsedUrl = new URL(imageUrl, 'http://localhost');
    const publicPath = `/storage/v1/object/public/${MENU_IMAGE_BUCKET}/`;
    const bucketIndex = parsedUrl.pathname.indexOf(publicPath);
    if (bucketIndex >= 0) {
      const objectPath = decodeURIComponent(parsedUrl.pathname.slice(bucketIndex + publicPath.length));
      const { error } = await getStorageClient().storage.from(MENU_IMAGE_BUCKET).remove([objectPath]);
      if (error) console.error('Menu image storage cleanup failed:', error.message);
      return;
    }
    if (parsedUrl.pathname.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), 'uploads', path.basename(parsedUrl.pathname));
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    }
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
      FROM menus 
      WHERE LOWER(TRIM(COALESCE(category, ''))) <> 'shisha'
        AND LOWER(TRIM(COALESCE(station, ''))) <> 'shisha'
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ FETCH ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch menus" });
  }
});

// --- POST NEW MENU ---
router.post('/', upload.single('image'), async (req, res) => {
  let uploadedObjectPath;
  try {
    const { name, description, price, category, station, published, customer_visible } = req.body;
    const storedImage = req.file ? await storeMenuImage(req.file) : null;
    uploadedObjectPath = storedImage?.objectPath;
    const imageUrl = storedImage?.publicUrl || req.body.image_url || null;
    
    // Convert 'true'/'false' string from FormData to actual boolean
    const isPublished = published === 'true' || published === true;

    // UPDATED: Return 'status' string in the response
    const query = `
      INSERT INTO menus (name, description, price, category, station, image_url, published, customer_visible)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *, (CASE WHEN $7 = true THEN 'live' ELSE 'draft' END) as status
    `;

    const result = await pool.query(query, [
      name, description, price, category, station, imageUrl, isPublished,
      customer_visible === 'true' || customer_visible === true
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (uploadedObjectPath) await removeMenuImage(`${process.env.SUPABASE_URL}/storage/v1/object/public/${MENU_IMAGE_BUCKET}/${uploadedObjectPath}`);
    if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
    console.error("❌ SAVE ERROR:", err.message);
    res.status(500).json({ error: "Failed to save menu item" });
  }
});

// --- PUT UPDATE MENU ---
router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, station, published, customer_visible } = req.body;
  let uploadedObjectPath;
  try {
    const storedImage = req.file ? await storeMenuImage(req.file) : null;
    uploadedObjectPath = storedImage?.objectPath;
    const imageUrl = storedImage?.publicUrl || String(req.body.image_url || '').trim() || null;

    const isPublished = published === 'true' || published === true;

    // UPDATED: Return 'status' string in the response
    const query = `
      UPDATE menus 
      SET name=$1, description=$2, price=$3, category=$4, station=$5, published=$6, image_url=COALESCE($7, image_url), customer_visible=$8
      WHERE id=$9
      RETURNING *, (CASE WHEN published = true THEN 'live' ELSE 'draft' END) as status
    `;

    const result = await pool.query(query, [
      name, description, price, category, station, isPublished, imageUrl,
      customer_visible === 'true' || customer_visible === true, id
    ]);
    
    if (result.rows.length === 0) {
      if (uploadedObjectPath) await removeMenuImage(`${process.env.SUPABASE_URL}/storage/v1/object/public/${MENU_IMAGE_BUCKET}/${uploadedObjectPath}`);
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (uploadedObjectPath) await removeMenuImage(`${process.env.SUPABASE_URL}/storage/v1/object/public/${MENU_IMAGE_BUCKET}/${uploadedObjectPath}`);
    if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
    console.error("❌ UPDATE ERROR:", err.message);
    res.status(500).json({ error: "Database error during update" });
  }
});

// --- DELETE ---
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT image_url FROM menus WHERE id = $1', [id]);
    await pool.query('DELETE FROM menus WHERE id = $1', [id]);
    if (result.rows[0]?.image_url) await removeMenuImage(result.rows[0].image_url);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err.message);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;