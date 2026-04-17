import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import pool from './db.js';

// ROUTE IMPORTS
import menuRoutes from './routes/menuRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import siteVisits from './routes/siteVisits.js';
import managerRoutes from './routes/managerRoutes.js';
import overviewRoutes from './routes/overviewRoutes.js';
import weeklyRevenueRoutes from "./routes/weeklyRevenueRoutes.js";
import sendToCashierRoute from "./routes/sendToCashierRoutes.js";
import summaryRoutes from './routes/summaryRoutes.js';
import accountantRoutes from './routes/accountantRoutes.js';
import kitchenRoutes from "./routes/kitchenRoutes.js";
import baristaRoutes from "./routes/baristaRoutes.js";
import barmanRoutes from "./routes/barmanRoutes.js";
import waiterRoutes from './routes/waiterRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';

// --- NEW CREDIT ROUTE IMPORT ---
import creditRoutes, { initCreditTables } from './routes/creditRoutes.js';

dotenv.config();
const app = express();

// 1. CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://kurax-food-lounge-and-bis-git-717fb4-nakanwagi-vanesas-projects.vercel.app',
  /\.vercel\.app$/
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some((allowed) =>
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("CORS Blocked for Origin:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 2. HELMET
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// 3. BODY PARSER
app.use(express.json());

// 4. STATIC FILES
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('uploads'));

// 5. ROUTES
app.use('/api/visits', siteVisits);
app.use('/api/menus', menuRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cashier-ops', sendToCashierRoute);
app.use('/api/events', eventRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/overview', weeklyRevenueRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/accountant', accountantRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/barista', baristaRoutes);
app.use('/api/barman', barmanRoutes);
app.use('/api/waiter', waiterRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/delivery', deliveryRoutes);

// --- REGISTER CREDIT ROUTES ---
app.use('/api/credits', creditRoutes);

// 6. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend working' });
});

// 7. DATABASE VERIFICATION & INITIALIZATION
const verifyDB = async () => {
  try {
    // Check connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected to Neon');

    // Run Credit Table Setup
    await initCreditTables();
    console.log('✅ Credit tables verified/initialized');

  } catch (err) {
    console.error('❌ DB/Init Error:', err.message);
  }
};

const PORT = process.env.PORT || 5010;

// ERROR HANDLING
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, '\nReason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('SIGTERM', () => {
  console.warn('⚠️ Received SIGTERM, shutting down gracefully.');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.warn('⚠️ Received SIGINT, shutting down gracefully.');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  verifyDB();
});