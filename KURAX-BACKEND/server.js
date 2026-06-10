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
import sendToCashierRoutes from "./routes/sendToCashierRoutes.js";   // ✅ FIXED: matches actual filename
import summaryRoutes from './routes/summaryRoutes.js';
import accountantRoutes from './routes/accountantRoutes.js';
import kitchenRoutes from "./routes/kitchenRoutes.js";
import baristaRoutes from "./routes/baristaRoutes.js";
import barmanRoutes from "./routes/barmanRoutes.js";
import waiterRoutes from './routes/waiterRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import dayClosureRoutes from './routes/dayClosureRoutes.js';
import creditRoutes, { initCreditTables } from './routes/creditRoutes.js';

dotenv.config();
const app = express();

// 1. CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:42107',
  'http://10.10.162.91:3000',
  'http://10.137.60.94:41013',
  /^http:\/\/10\.137\.60\.94:\d+$/,
  /^http:\/\/10\.10\.162\.91:\d+$/,
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
      console.log("⚠️ CORS Request from Origin:", origin);
      callback(null, true); // allow all for testing
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
}));

// 2. HELMET
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
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
app.use('/api/cashier-ops', sendToCashierRoutes);      // ✅ now correctly mounted
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
app.use('/api/day-closure', dayClosureRoutes);
app.use('/api/credits', creditRoutes);

// 6. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend working' });
});

// 7. DATABASE VERIFICATION
const verifyDB = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected to Neon');
    await initCreditTables();
    console.log('✅ Credit tables verified/initialized');
  } catch (err) {
    console.error('❌ DB/Init Error:', err.message);
  }
};

const PORT = process.env.PORT || 5010;

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, '\nReason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  verifyDB();
});