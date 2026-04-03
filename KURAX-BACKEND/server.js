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

dotenv.config();
const app = express();

// 1. CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174', // <--- Add this line
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

// 4. STATIC FILES — with explicit CORP header ✅
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static('uploads'));

// 5. ROUTES
app.use('/api/visits', siteVisits);
app.use('/api/menus', menuRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cashier-ops', sendToCashierRoute); // Change this prefix      // ✅ Same prefix is fine if paths differ
app.use('/api/events', eventRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/overview', weeklyRevenueRoutes);    // ✅ Same prefix is fine if paths differ
app.use('/api/summaries', summaryRoutes);
app.use('/api/accountant', accountantRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/barista', baristaRoutes);
app.use('/api/barman', barmanRoutes);
app.use('/api/waiter', waiterRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/delivery', deliveryRoutes);
// ❌ Removed duplicate: app.use('/api/accountant', waiterRoutes)

// 6. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend working' });
});

// 7. DATABASE VERIFICATION
const verifyDB = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected to Neon');
  } catch (err) {
    console.error('❌ DB Error:', err.message);
  }
};

const PORT = process.env.PORT || 5010;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  verifyDB();
});