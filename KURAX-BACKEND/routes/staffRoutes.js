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
 * Updated to include 'is_requesting' for the Director's dashboard alerts.
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, is_permitted, is_requesting FROM staff ORDER BY name ASC'
    );
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

  if (!name || !email || !pin || !role) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const checkUser = await pool.query('SELECT email FROM staff WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const defaultPermission = (role === 'WAITER' || role === 'DIRECTOR');
    
    const newStaff = await pool.query(
      'INSERT INTO staff (name, email, pin, role, is_permitted) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, is_permitted',
      [name, email, pin, role, defaultPermission]
    );

    res.status(201).json({ message: "✅ Account activated!", staff: newStaff.rows[0] });

    // Background Email
    transporter.sendMail({
      from: `"Kurax Lounge & Bistro" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to the Team',
      html: `<h1 style="color: #eab308;">Welcome, ${name}!</h1><p>Your PIN: <b>${pin}</b></p>`
    }).catch(err => console.error("Mail Error:", err.message));

  } catch (err) {
    res.status(500).json({ error: "System error: Could not save staff." });
  }
});

/**
 * 3. STAFF LOGIN
 */
/**
 * 3. STAFF LOGIN
 */
router.post('/login', async (req, res) => {
  const { email, pin } = req.body;
  
  console.log('🔐 Login attempt received');
  console.log('📧 Email:', email);
  console.log('🔑 PIN:', pin);
  console.log('📦 Full request body:', req.body);
  
  try {
    if (!email || !pin) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ error: "Email and PIN are required" });
    }

    console.log('🔍 Querying database...');
    const userResult = await pool.query('SELECT * FROM staff WHERE email = $1', [email]);
    
    console.log('📊 Query returned:', userResult.rows.length, 'rows');
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return res.status(401).json({ error: "User not found" });
    }

    const foundUser = userResult.rows[0];
    console.log('👤 Found user:', foundUser.name, '| Role:', foundUser.role);
    console.log('🔑 Stored PIN:', foundUser.pin, '| Type:', typeof foundUser.pin);
    console.log('🔑 Input PIN:', pin, '| Type:', typeof pin);

    const inputPin = String(pin).trim();
    const storedPin = String(foundUser.pin).trim();
    
    console.log('🔄 After conversion:');
    console.log('   Input:', inputPin);
    console.log('   Stored:', storedPin);
    console.log('   Match:', inputPin === storedPin);

    if (inputPin === storedPin) {
      console.log('✅ Login successful!');
      return res.json({
        message: "Login successful",
        user: { 
          id: foundUser.id, 
          name: foundUser.name, 
          role: foundUser.role, 
          is_permitted: foundUser.is_permitted 
        }
      });
    } else {
      console.log('❌ PIN mismatch');
      return res.status(401).json({ error: "Invalid PIN" });
    }
  } catch (err) {
    console.error('🚨 ERROR CAUGHT:', err.message);
    console.error('🚨 ERROR STACK:', err.stack);
    console.error('🚨 ERROR CODE:', err.code);
    return res.status(500).json({ error: "Server error during login" });
  }
});

/**
 * 4. TOGGLE PERMISSION & RESET REQUEST
 * Crucial: Resets is_requesting to false when the Director takes action.
 */
router.patch('/toggle-permission/:id', async (req, res) => {
  const { id } = req.params;
  const { is_permitted } = req.body;
  try {
    await pool.query(
      'UPDATE staff SET is_permitted = $1, is_requesting = FALSE WHERE id = $2',
      [is_permitted, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update permission" });
  }
});

/**
 * 5. REQUEST ORDERING POWER
 */
router.post('/request-permission', async (req, res) => {
  const { staffId, staffName } = req.body;
  try {
    await pool.query('UPDATE staff SET is_requesting = TRUE WHERE id = $1', [staffId]);
    
    console.log(`\n[PERMISSION REQUEST] 🔔 from ${staffName} (ID: ${staffId})`);

    res.status(200).json({ success: true, message: "Request logged." });
  } catch (err) {
    console.error('Request Permission Error:', err.message);
    res.status(500).json({ error: "Failed to send request." });
  }
});

/**
 * 6. TERMINATE STAFF
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

/**
 * 7. LIVE PERMISSION SYNC (For Frontend polling)
 */
router.get('/permission/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT is_permitted FROM staff WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ is_granted: result.rows[0].is_permitted });
  } catch (err) {
    res.status(500).json({ error: "Sync error" });
  }
});

export default router;