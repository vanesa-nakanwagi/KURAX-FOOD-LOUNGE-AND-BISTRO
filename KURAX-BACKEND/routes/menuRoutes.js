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

// GET all menus
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM menus ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch menus" });
  }
});

// POST new menu
router.post('/', upload.single('image'), async (req, res) => {
  const { name, description, price, category, station, published } = req.body;
  
  // Store relative path instead of full URL
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
  
  try {
    const result = await pool.query(
      'INSERT INTO menus (name, description, price, category, station, image_url, published) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, description, price, category, station, imageUrl, published || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to save menu item" });
  }
});
// PUT update menu
router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, station, published } = req.body;
  try {
    let imageUrl = req.body.image_url;
    // If a new file is uploaded, update with relative path
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;

    const result = await pool.query(
      'UPDATE menus SET name=$1, description=$2, price=$3, category=$4, station=$5, published=$6, image_url=$7 WHERE id=$8 RETURNING *',
      [name, description, price, category, station, published, imageUrl, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Database error during update" });
  }
});

// DELETE menu & physical image
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
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;