import express from 'express';
import pool from '../db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// --- GET ALL MENUS ---
router.get('/', async (req, res) => {
  try {
    // UPDATED: Added CASE mapping to provide the 'status' field for the frontend filter
    const query = `
      SELECT *, 
      CASE WHEN published = true THEN 'live' ELSE 'draft' END as status 
      FROM menus 
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
  try {
    const { name, description, price, category, station, published } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
    
    // Convert 'true'/'false' string from FormData to actual boolean
    const isPublished = published === 'true' || published === true;

    // UPDATED: Return 'status' string in the response
    const query = `
      INSERT INTO menus (name, description, price, category, station, image_url, published) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *, (CASE WHEN $7 = true THEN 'live' ELSE 'draft' END) as status
    `;

    const result = await pool.query(query, [
      name, description, price, category, station, imageUrl, isPublished
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ SAVE ERROR:", err.message);
    res.status(500).json({ error: "Failed to save menu item" });
  }
});

// --- PUT UPDATE MENU ---
router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, station, published } = req.body;
  
  try {
    let imageUrl = req.body.image_url;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;

    const isPublished = published === 'true' || published === true;

    // UPDATED: Return 'status' string in the response
    const query = `
      UPDATE menus 
      SET name=$1, description=$2, price=$3, category=$4, station=$5, published=$6, image_url=$7 
      WHERE id=$8 
      RETURNING *, (CASE WHEN published = true THEN 'live' ELSE 'draft' END) as status
    `;

    const result = await pool.query(query, [
      name, description, price, category, station, isPublished, imageUrl, id
    ]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: "Item not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ UPDATE ERROR:", err.message);
    res.status(500).json({ error: "Database error during update" });
  }
});

// --- DELETE ---
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT image_url FROM menus WHERE id = $1', [id]);
    if (result.rows.length > 0 && result.rows[0].image_url) {
      const filename = result.rows[0].image_url.split('/').pop();
      const filePath = path.join(process.cwd(), 'uploads', filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await pool.query('DELETE FROM menus WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE ERROR:", err.message);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;