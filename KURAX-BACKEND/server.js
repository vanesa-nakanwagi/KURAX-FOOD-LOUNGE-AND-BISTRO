import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pool, { ensureDatabaseSchema } from './db.js';
import { isValidShishaPinEncryptionKey } from './helpers/shishaPinEncryption.js';

// ROUTE IMPORTS
import menuRoutes from './routes/menuRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import orderRoutes, { initComplimentaryTables } from './routes/orderRoutes.js';
import discountRoutes from './routes/discountRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import siteVisits from './routes/siteVisits.js';
import managerRoutes from './routes/managerRoutes.js';
import overviewRoutes from './routes/overviewRoutes.js';
import weeklyRevenueRoutes from "./routes/weeklyRevenueRoutes.js";
import sendToCashierRoutes from "./routes/sendToCashierRoutes.js";
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
import shishaRoutes, { initShishaTables } from './routes/shishaRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import { ensureAccountingDataModel } from './helpers/accounting.js';
import notificationRoutes from './routes/notificationRoutes.js';
import cashierExpenseRoutes from './routes/cashierExpenseRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import comboRoutes from './routes/comboRoutes.js';
import publicOrderRoutes from './routes/publicOrderRoutes.js';
import productionRoutes, { initProductionTables } from './routes/productionRoutes.js';
import smtpRoutes from './routes/smtpRoutes.js';
import { ensureSmtpSettingsTable } from './helpers/smtp.js';
import systemBusinessDateRoutes from './routes/systemBusinessDateRoutes.js';
import { getSystemBusinessContext } from './helpers/systemBusinessDate.js';

if (!isValidShishaPinEncryptionKey()) {
  console.warn('Shisha PIN encryption is disabled: configure SHISHA_PIN_ENCRYPTION_KEY as 64 hexadecimal characters.');
}

const app = express();

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// 1. CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:8080',
  'http://localhost:42107',
  'http://10.10.162.91:3000',
  'http://10.137.60.94:41013',
  /^http:\/\/10\.137\.60\.94:\d+$/,
  /^http:\/\/10\.10\.162\.91:\d+$/,
  'https://kurax-food-lounge-and-bis-git-717fb4-nakanwagi-vanesas-projects.vercel.app',
  /\.vercel\.app$/,
  ...configuredOrigins
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
      console.log(' CORS Request from Origin:', origin);
      callback(null, true); // allow all for testing without breaking existing clients
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

const dateAwareApiPrefixes = [
  '/accountant',
  '/barman',
  '/barista',
  '/cashier-ops',
  '/day-closure',
  '/departments',
  '/delivery',
  '/history',
  '/kitchen',
  '/manager',
  '/overview',
  '/orders',
  '/summaries',
  '/waiter',
];

app.use('/api', async (req, res, next) => {
  if (
    req.path === '/health'
    || req.path === '/shisha'
    || req.path.startsWith('/shisha/')
    || req.path === '/system/business-date'
    || req.path.startsWith('/system/business-date/')
  ) {
    return next();
  }

  try {
    const { businessDate, mode } = await getSystemBusinessContext();
    req.businessDate = businessDate;
    const isWriteRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (
      mode === 'HISTORICAL'
      && isWriteRequest
      && req.path !== '/day-closure/reopen-day'
    ) {
      const closureResult = await pool.query(
        'SELECT day_closed FROM public.daily_summary WHERE summary_date = $1',
        [businessDate]
      );
      if (closureResult.rows[0]?.day_closed) {
        return res.status(409).json({
          error: `Business date ${businessDate} is closed. Reopen it before making further changes.`,
        });
      }
    }

    const isDateAwareApi = dateAwareApiPrefixes.some((prefix) => (
      req.path === prefix || req.path.startsWith(`${prefix}/`)
    ));
    const preserveLiveDefault = mode === 'LIVE'
      && req.method === 'GET'
      && ['/history', '/orders'].includes(req.path)
      && !req.query.date;
    if (isDateAwareApi && !preserveLiveDefault && !req.query.date) {
      const queryIndex = req.url.indexOf('?');
      const requestPath = queryIndex < 0 ? req.url : req.url.slice(0, queryIndex);
      const query = new URLSearchParams(queryIndex < 0 ? '' : req.url.slice(queryIndex + 1));
      query.set('date', businessDate);
      req.url = `${requestPath}?${query.toString()}`;
    }
    if (
      (req.path === '/inventory' || req.path.startsWith('/inventory/'))
      && ['POST', 'PUT', 'PATCH'].includes(req.method)
      && req.body
      && typeof req.body === 'object'
      && !Array.isArray(req.body)
    ) {
      req.body.business_date = businessDate;
    }
    res.setHeader('X-Kurax-Business-Date', businessDate);
    return next();
  } catch (error) {
    console.error('System business-date middleware failed:', error.message);
    return res.status(503).json({ error: 'Could not resolve the system business date.' });
  }
});

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
app.use('/api/discounts', discountRoutes);
app.use('/api/cashier-ops', sendToCashierRoutes);
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
app.use('/api/shisha', shishaRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cashier-expenses', cashierExpenseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/public-orders', publicOrderRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/settings/smtp', smtpRoutes);
app.use('/api/system/business-date', systemBusinessDateRoutes);

// 6. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend working' });
});

const PORT = Number(process.env.PORT || 5010);

process.on('unhandledRejection', (reason, promise) => {
  console.error(' Unhandled Rejection at:', promise, '\nReason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error(' Uncaught Exception:', err);
});

async function startServer() {
  await pool.query('SELECT NOW()');
  console.log('Database connected');
  await ensureDatabaseSchema();
  console.log('Database schema verified/bootstrapped');
  await initProductionTables();
  console.log('Staff PIN and production tracking schema verified/initialized');
  await initCreditTables();
  console.log('Credit tables verified/initialized');
  await initShishaTables();
  console.log('Shisha department tables verified/initialized');
  await ensureAccountingDataModel();
  console.log('Accounting schema verified/initialized');
  await initComplimentaryTables();
  console.log('Complimentary item correction schema verified/initialized');
  await ensureSmtpSettingsTable();
  console.log('SMTP settings table verified and initialized');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} on 0.0.0.0`);
  });
}

startServer().catch(async (error) => {
  console.error('Database or schema initialization failed:', error.message);
  await pool.end().catch((closeError) => {
    console.error('Database pool shutdown failed:', closeError.message);
  });
  process.exitCode = 1;
});