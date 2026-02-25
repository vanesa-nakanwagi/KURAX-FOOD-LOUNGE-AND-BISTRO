import pool from '../db.js';
import express from 'express';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// --- GET ALL EVENTS ---
// Updated to ensure the frontend can filter by "status"
router.get('/', async (req, res) => {
    try {
        // We select everything, but we ensure 'published' maps to a 'status' string
        // This makes it compatible with your frontend .filter(e => e.status === 'live')
        const query = `
            SELECT *, 
            CASE WHEN published = true THEN 'live' ELSE 'draft' END as status 
            FROM events 
            ORDER BY date DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ GET ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- CREATE EVENT ---
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { name, description, location, date, time, published, tags } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // Ensure boolean conversion
        const isPublished = published === 'true' || published === true;

        let tagsData;
        try {
            tagsData = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
        } catch (e) {
            tagsData = [];
        }

        const query = `
            INSERT INTO events (name, description, location, date, time, image_url, published, tags)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *, (CASE WHEN $7 = true THEN 'live' ELSE 'draft' END) as status;
        `;

        const values = [name, description || '', location, date, time, imageUrl, isPublished, JSON.stringify(tagsData)];
        
        const newEvent = await pool.query(query, values);
        res.status(201).json(newEvent.rows[0]);

    } catch (err) {
        console.error("❌ DATABASE INSERT ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- UPDATE EVENT ---
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, location, date, time, published, tags } = req.body;
        
        let imageUrl = req.body.image_url; 
        if (req.file) {
            imageUrl = `/uploads/${req.file.filename}`;
        }

        const isPublished = published === 'true' || published === true;
        let tagsData = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);

        const query = `
            UPDATE events 
            SET name = $1, description = $2, location = $3, date = $4, 
                time = $5, image_url = $6, published = $7, tags = $8
            WHERE id = $9
            RETURNING *, (CASE WHEN published = true THEN 'live' ELSE 'draft' END) as status;
        `;

        const values = [name, description || '', location, date, time, imageUrl, isPublished, JSON.stringify(tagsData), id];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });

        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ UPDATE ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- DELETE ---
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Event not found" });
        res.json({ message: "Event deleted successfully" });
    } catch (err) {
        console.error("❌ DELETE ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;