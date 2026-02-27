import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('❌ DATABASE_URL is:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
  } else {
    console.log('✅ Database connected successfully to Neon');
    release();
  }
});

export default pool;