import express from 'express';
import pool from '../db.js';
import nodemailer from 'nodemailer';

const router = express.Router();

/**
 * EMAIL CONFIGURATION
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * 1. FETCH ALL STAFF
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM staff ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch Staff Error:', err.message);
    res.status(500).json({ error: "Could not retrieve staff list" });
  }
});

/**
 * 2. STAFF ACTIVATION
 */
router.post('/activate', async (req, res) => {
  const { name, email, pin, role } = req.body;

  try {
    const checkUser = await pool.query('SELECT email FROM staff WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const defaultPermission = (role === 'WAITER');
    const newStaff = await pool.query(
      'INSERT INTO staff (name, email, pin, role, is_permitted) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, pin, role, defaultPermission]
    );

    const savedStaff = newStaff.rows[0];

    res.status(201).json({ 
      message: "✅ Account activated!", 
      staff: savedStaff 
    });

    // Email logic
    transporter.sendMail({
      from: '"Kurax Lounge & Bistro" <hello@kurax.ug>',
      to: email,
      subject: 'Welcome to the Team',
      html: `<div style="font-family: Arial; padding: 20px; background: #000; color: #fff;">
               <h1 style="color: #eab308;">Welcome, ${name}!</h1>
               <p>Your PIN: <strong>${pin}</strong></p>
             </div>`
    }).catch(err => console.error("Mail Error:", err.message));

  } catch (err) {
    res.status(500).json({ error: "System error: Could not save staff." });
  }
});

/**
 * 3. STAFF LOGIN
 */
router.post('/login', async (req, res) => {
  const { email, pin } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM staff WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const foundUser = userResult.rows[0];

    if (String(foundUser.pin) === String(pin)) {
      // Security Alert Email (Background)
      transporter.sendMail({
        from: '"Kurax Security"',
        to: foundUser.email,
        subject: 'Security Alert: New Login',
        html: `<p>New login detected for ${foundUser.name} at ${new Date().toLocaleString()}</p>`
      }).catch(err => console.error('Alert Email Failed:', err.message));

      res.json({
        message: "Login successful",
        user: {
          id: foundUser.id,
          name: foundUser.name,
          role: foundUser.role,
          is_permitted: foundUser.is_permitted
        }
      });
    } else {
      res.status(401).json({ error: "Invalid PIN" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error during login" });
  }
});

/**
 * 4. TOGGLE PERMISSION
 */
router.patch('/toggle-permission/:id', async (req, res) => {
  const { id } = req.params;
  const { is_permitted } = req.body;

  try {
    await pool.query(
      'UPDATE staff SET is_permitted = $1 WHERE id = $2',
      [is_permitted, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update permission" });
  }
});

/**
 * 5. TERMINATE STAFF
 */
router.delete('/terminate/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM staff WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

export default router;