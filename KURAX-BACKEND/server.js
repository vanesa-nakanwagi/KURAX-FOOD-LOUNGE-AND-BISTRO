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

dotenv.config();
const app = express();
const allowedOrigins = [
  'http://localhost:5173',                   // Local Development
  'https://kurax-food-lounge-and-bis-git-717fb4-nakanwagi-vanesas-projects.vercel.app',    // Your main Vercel Production URL
  /\.vercel\.app$/                           // Optional: Allows all Vercel preview deployments
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("CORS Blocked for Origin:", origin); // Helpful for debugging
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 2. MIDDLEWARE
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false, 
}));
app.use(express.json());

// Serving the uploads folder
app.use('/uploads', express.static('uploads'));

// 3. ROUTES
app.use('/api/visits', siteVisits);
app.use('/api/menus', menuRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/overview', overviewRoutes);
app.use("/api/overview", weeklyRevenueRoutes);
app.use("/api/orders", sendToCashierRoute);

// 4. DATABASE VERIFICATION
const verifyDB = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected to Neon');
  } catch (err) {
    console.error('❌ DB Error:', err.message);
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend working' });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  verifyDB();
});
