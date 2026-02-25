import express from 'express';
import pool from '../db.js';

const router = express.Router();

/**
 * 1. FETCH ALL ORDERS (For Director/Admin History)
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, s.name as staff_name 
      FROM orders o 
      JOIN staff s ON o.staff_id = s.id 
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch Orders Error:', err.message);
    res.status(500).json({ error: "Could not retrieve orders" });
  }
});

/**
 * 2. POST NEW ORDER (From Waiter Panel)
 */
router.post('/', async (req, res) => {
  const { staffId, items, total, paymentMethod } = req.body;

  try {
    // Check if the staff member exists and has permission
    const staffCheck = await pool.query(
      'SELECT role, is_permitted FROM staff WHERE id = $1', 
      [staffId]
    );
    
    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: "Staff member not found." });
    }

    const person = staffCheck.rows[0];

    // Security Logic: Only active waiters or permitted staff can order
    if (person.role !== 'WAITER' && !person.is_permitted) {
      return res.status(403).json({ error: "Access Denied. Please contact the Director." });
    }

    const newOrder = await pool.query(
      `INSERT INTO orders (staff_id, items, total, payment_method) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [staffId, JSON.stringify(items), total, paymentMethod]
    );

    res.status(201).json(newOrder.rows[0]);
  } catch (err) {
    console.error("Order Insert Error:", err.message);
    res.status(500).json({ error: "Order failed to save" });
  }
});

export default router;