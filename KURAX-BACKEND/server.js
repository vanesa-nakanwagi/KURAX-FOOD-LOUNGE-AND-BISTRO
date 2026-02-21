import express from 'express';
import cors from 'cors';
import pool from './db.js';
import dotenv from 'dotenv';
import helmet from 'helmet';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

/**
 * DATABASE CONNECTION VERIFICATION
 * This runs when the server starts to confirm the backend can talk to Postgres
 */
const verifyDB = async () => {
  try {
    // We attempt a simple query to check connectivity
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log(`🕒 Database Time: ${res.rows[0].now}`);
  } catch (err) {
    console.error('❌ Database connection error!');
    console.error(`Reason: ${err.message}`);
    console.log('💡 Tip: Check if PostgreSQL is running on the port defined in your .env (likely 5433)');
  }
};

/**
 * STAFF LOGIN ROUTE
 */
app.post('/api/login', async (req, res) => {
  const { email, pin } = req.body;

  try {
    // 1. Check if user exists
    const userResult = await pool.query('SELECT * FROM staff WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const foundUser = userResult.rows[0];

    /**
     * 2. PIN MATCH CHECK
     * Note: If your DB column is named 'pin', use foundUser.pin. 
     * If it is named 'pin_hash', use foundUser.pin_hash.
     */
    const storedPin = foundUser.pin || foundUser.pin_hash;

    if (String(storedPin) === String(pin)) {
      // 3. Success response
      res.json({
        message: "Login successful",
        user: {
          id: foundUser.id,
          name: foundUser.name,
          role: foundUser.role
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
 * TEST ROUTE
 * Visit http://localhost:5000/test-db in your browser to check status manually
 */
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()'); 
    res.json({
      message: "Database connected!",
      time: result.rows[0].now 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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