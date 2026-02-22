import express from 'express';
import cors from 'cors';
import pool from './db.js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import nodemailer from 'nodemailer';
dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

/**
 * DATABASE CONNECTION VERIFICATION
 */
const verifyDB = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log(`🕒 Database Time: ${res.rows[0].now}`);
  } catch (err) {
    console.error('❌ Database connection error!');
    console.error(`Reason: ${err.message}`);
  }
};

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
 * 1. STAFF ACTIVATION ROUTE
 * Fixed: Added defaultPermission logic and full 'staff' object response
 */
app.post('/api/staff/activate', async (req, res) => {
  const { name, email, pin, role } = req.body;

  try {
    // Check if email exists
    const checkUser = await pool.query('SELECT email FROM staff WHERE email = $1', [email]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    // FIX: Define defaultPermission (Waiters allowed by default, others manual toggle)
    const defaultPermission = (role === 'WAITER');

    // Save to Postgres
    const newStaff = await pool.query(
      'INSERT INTO staff (name, email, pin, role, is_permitted) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, pin, role, defaultPermission]
    );

    
    const savedStaff = newStaff.rows[0];

    // Prepare Email
    const mailOptions = {
      from: '"Kurax Lounge & Bistro" <hello@kurax.ug>',
      to: email,
      subject: 'Welcome to the Team - Your Staff Access Portal',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #000; color: #fff; padding: 40px; border-radius: 10px;">
          <h1 style="color: #eab308; text-transform: uppercase;">Welcome to Kurax, ${name}!</h1>
          <p>Your staff account has been officially activated by the Director.</p>
          <div style="background-color: #111; border: 1px solid #eab308; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 5px;">Your Security PIN</p>
            <h2 style="font-size: 32px; letter-spacing: 10px; color: #eab308; margin: 0;">${pin}</h2>
          </div>
          <p>Use this PIN and your email to access the Staff Portal.</p>
        </div>
      `
    };

    // 🚀 STEP 4: RESPOND TO FRONTEND IMMEDIATELY
    // FIX: We send the full 'staff' object so the frontend UI can update without crashing
    // ... after the INSERT query


// Ensure the keys here match exactly what StaffCard uses
res.status(201).json({ 
  message: "✅ Account activated!", 
  staff: {
    id: savedStaff.id,
    name: savedStaff.name,    // Must be 'name'
    email: savedStaff.email,  // Must be 'email'
    role: savedStaff.role,    // Must be 'role'
    is_permitted: savedStaff.is_permitted
  }
});

    // 🚀 STEP 5: SEND EMAIL IN BACKGROUND
    transporter.sendMail(mailOptions).catch(mailErr => {
        console.error("❌ Background Mail Error:", mailErr.message);
    });

  } catch (err) {
    console.error('Database Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "System error: Could not save staff to database." });
    }
  }
});


/**
 * FETCH ALL STAFF
 * Combined version: Includes full data, alphabetical sorting, and error handling
 */
// --- ADD THIS TO YOUR server.js ---
app.get('/api/staff', async (req, res) => {
  try {
    // 1. Pull all staff from Postgres
    // 2. Sort them A-Z by name
    const result = await pool.query('SELECT * FROM staff ORDER BY name ASC');
    
    // 3. Send the data to the Director Dashboard
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch Staff Error:', err.message);
    res.status(500).json({ error: "Could not retrieve staff list from database" });
  }
});
/**
 * 2. STAFF LOGIN ROUTE
 */
app.post('/api/login', async (req, res) => {
  const { email, pin } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM staff WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const foundUser = userResult.rows[0];
    const storedPin = foundUser.pin;

    if (String(storedPin) === String(pin)) {
      // Background Login Alert
      const loginAlert = {
        from: '"Kurax Security" <security@kurax.ug>',
        to: foundUser.email,
        subject: 'Security Alert: New Login Detected',
        html: `<p>New login detected for ${foundUser.name} at ${new Date().toLocaleString()}</p>`
      };
      transporter.sendMail(loginAlert).catch(err => console.error('Alert Email Failed:', err.message));

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
    console.error('Login Error:', err.message);
    res.status(500).json({ error: "Server error during login" });
  }
});

/**
 * 3. TOGGLE PERMISSION ROUTE
 */
app.patch('/api/staff/toggle-permission/:id', async (req, res) => {
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
 * 4. TERMINATE STAFF ROUTE
 */
app.delete('/api/staff/terminate/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM staff WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('-------------------------------------------');
  console.log(`🚀 Kurax Server running on http://localhost:${PORT}`);
  verifyDB(); 
  console.log('-------------------------------------------');
});