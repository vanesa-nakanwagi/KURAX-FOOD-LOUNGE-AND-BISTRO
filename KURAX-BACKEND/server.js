import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
// Removed: import path from 'path'; (Since it wasn't being used below)

import pool from './db.js';

// 1. ROUTE IMPORTS (Make sure these files exist in your /routes folder)
import menuRoutes from './routes/menuRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import siteVisits from './routes/siteVisits.js';

dotenv.config();
const app = express();

// 2. MIDDLEWARE
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false, // Add this line to stop the black-box effect
}));
app.use(cors());
app.use(express.json());

// Serving the uploads folder as a static route
app.use('/uploads', express.static('uploads'));

app.use('/api/visits', siteVisits);

// 3. DATABASE VERIFICATION
const verifyDB = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ DB Error:', err.message);
  }
};

// 4. ROUTE REDIRECTS
app.use('/api/menus', menuRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/events', eventRoutes);

// 5. START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('-------------------------------------------');
  console.log(`🚀 Kurax Server: http://localhost:${PORT}`);
  verifyDB();
  console.log('-------------------------------------------');
});