// db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Create a pool with SSL (Neon requires it)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// 🔥 Listen for idle client errors to prevent Node from crashing
pool.on('error', (err, client) => {
  console.error('❌ Unexpected idle client error:', err.message);
});

// 🔹 Optional: Test connection at startup
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully to Neon');
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error(
      '❌ DATABASE_URL is',
      process.env.DATABASE_URL ? 'Set' : 'NOT SET'
    );
  }
})();

export default pool;