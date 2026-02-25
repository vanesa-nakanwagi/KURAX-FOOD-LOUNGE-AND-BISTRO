import pool from '../db.js'; // Assuming you have a db config
import express from 'express';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { name, description, location, date, time, published, tags } = req.body;
        
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        // FIX 1: Convert 'true'/'false' strings from FormData back to Booleans
        const isPublished = published === 'true' || published === true;

        // FIX 2: Ensure tags are a valid JSON object/array for the JSONB column
        // FormData sends it as a string, so we parse it if it's a string.
        let tagsData;
        try {
            tagsData = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
        } catch (e) {
            tagsData = [];
        }

        const query = `
            INSERT INTO events (name, description, location, date, time, image_url, published, tags)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;

        // Pass tagsData as a stringified JSON for the JSONB column
        const values = [
            name, 
            description || '', 
            location, 
            date, 
            time, 
            imageUrl, 
            isPublished, 
            JSON.stringify(tagsData) 
        ];
        
        const newEvent = await pool.query(query, values);
        
        // Success: Return the actual row from the DB
        res.status(201).json(newEvent.rows[0]);

    } catch (err) {
        // FIX 3: Log the specific error to your terminal so you can see it
        console.error("❌ DATABASE INSERT ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// Add this to handle the "Reload" and show saved events
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM events ORDER BY date DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("❌ GET ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});


// 1. UPDATE (PUT) - Handles Editing
router.put('/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, location, date, time, published, tags } = req.body;
        
        // Handle image: If a new one is uploaded, use it. Otherwise, keep the old one logic.
        let imageUrl = req.body.image_url; // Default to existing URL
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
            RETURNING *;
        `;

        const values = [
            name, description || '', location, date, time, 
            imageUrl, isPublished, JSON.stringify(tagsData), id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ UPDATE ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. DELETE - Handles Removing
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        res.json({ message: "Event deleted successfully" });
    } catch (err) {
        console.error("❌ DELETE ERROR:", err.message);
        res.status(500).json({ error: err.message });
    }
});


export default router;