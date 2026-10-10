// db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Only use SSL for remote (Neon) connections — local Postgres doesn't support/require it
const isLocalDb =
  process.env.DATABASE_URL?.includes('localhost') ||
  process.env.DATABASE_URL?.includes('127.0.0.1') ||
  process.env.DATABASE_URL?.includes('@database:');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

export async function ensureDatabaseSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS public.notification_devices (
      id SERIAL PRIMARY KEY,
      user_scope TEXT NOT NULL CHECK (user_scope IN ('restaurant', 'shisha')),
      user_id INTEGER NOT NULL,
      firebase_installation_id TEXT,
      installation_id TEXT,
      fcm_token TEXT NOT NULL,
      platform TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
      browser TEXT DEFAULT 'unknown',
      user_agent TEXT,
      is_pwa BOOLEAN NOT NULL DEFAULT false,
      permission_status TEXT NOT NULL DEFAULT 'default' CHECK (permission_status IN ('default', 'granted', 'denied')),
      notifications_enabled BOOLEAN NOT NULL DEFAULT true,
      is_active BOOLEAN NOT NULL DEFAULT true,
      active BOOLEAN NOT NULL DEFAULT true,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS firebase_installation_id TEXT;`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS installation_id TEXT;`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS browser TEXT DEFAULT 'unknown';`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS user_agent TEXT;`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS is_pwa BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS permission_status TEXT NOT NULL DEFAULT 'default';`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();`,
    `ALTER TABLE IF EXISTS public.notification_devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,
    `UPDATE public.notification_devices SET installation_id = firebase_installation_id WHERE installation_id IS NULL AND firebase_installation_id IS NOT NULL;`,
    `UPDATE public.notification_devices SET active = true WHERE active IS NULL;`,
    `UPDATE public.notification_devices SET is_active = active WHERE is_active IS NULL;`,
    `UPDATE public.notification_devices SET notifications_enabled = true WHERE notifications_enabled IS NULL;`,
    `UPDATE public.notification_devices SET permission_status = 'default' WHERE permission_status IS NULL;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS notification_devices_installation_id_unique
      ON public.notification_devices (installation_id) WHERE installation_id IS NOT NULL;`,
    `CREATE INDEX IF NOT EXISTS notification_devices_user_scope_user_active_idx
      ON public.notification_devices (user_scope, user_id) WHERE active = true OR is_active = true;`,

    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS credit_approved BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS original_order_ids JSONB DEFAULT '[]'::jsonb;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS sent_to_cashier BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS rider_id INTEGER;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS rider_name TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS rider_phone TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'Pending';`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'Dine-in';`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS client_name TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS client_phone TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS delivery_note TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS is_permitted BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS shift_cleared BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS day_cleared BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS staff_role TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS void_reason TEXT;`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';`,
    `ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;`,

    `ALTER TABLE IF EXISTS public.daily_summary ADD COLUMN IF NOT EXISTS total_settled_credits NUMERIC DEFAULT 0;`,
    `ALTER TABLE IF EXISTS public.daily_summary ADD COLUMN IF NOT EXISTS day_closed BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.daily_summary ADD COLUMN IF NOT EXISTS closed_by TEXT;`,
    `ALTER TABLE IF EXISTS public.daily_summary ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;`,
    `ALTER TABLE IF EXISTS public.daily_summary ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,

    `ALTER TABLE IF EXISTS public.cashier_queue ADD COLUMN IF NOT EXISTS shift_cleared BOOLEAN DEFAULT false;`,
    `ALTER TABLE IF EXISTS public.cashier_queue ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'dine-in';`,
    `ALTER TABLE IF EXISTS public.cashier_queue ADD COLUMN IF NOT EXISTS rider_name TEXT;`,
    `ALTER TABLE IF EXISTS public.cashier_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`,

    `ALTER TABLE IF EXISTS public.staff_shifts ADD COLUMN IF NOT EXISTS petty_cash_spent NUMERIC DEFAULT 0;`,
    `ALTER TABLE IF EXISTS public.staff_shifts ADD COLUMN IF NOT EXISTS credit_approved_amt NUMERIC DEFAULT 0;`,
    `ALTER TABLE IF EXISTS public.staff_shifts ADD COLUMN IF NOT EXISTS credit_approved INTEGER DEFAULT 0;`,
    `ALTER TABLE IF EXISTS public.staff_shifts ADD COLUMN IF NOT EXISTS credit_rejected INTEGER DEFAULT 0;`,

    `CREATE TABLE IF NOT EXISTS public.daily_summary (
      id SERIAL PRIMARY KEY,
      summary_date DATE NOT NULL UNIQUE,
      total_gross NUMERIC DEFAULT 0,
      total_cash NUMERIC DEFAULT 0,
      total_card NUMERIC DEFAULT 0,
      total_mtn NUMERIC DEFAULT 0,
      total_airtel NUMERIC DEFAULT 0,
      total_credit NUMERIC DEFAULT 0,
      total_mixed NUMERIC DEFAULT 0,
      total_settled_credits NUMERIC DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      day_closed BOOLEAN DEFAULT false,
      closed_by TEXT,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.daily_summaries (
      id SERIAL PRIMARY KEY,
      summary_date DATE NOT NULL UNIQUE,
      total_gross NUMERIC DEFAULT 0,
      total_cash NUMERIC DEFAULT 0,
      total_card NUMERIC DEFAULT 0,
      total_mtn NUMERIC DEFAULT 0,
      total_airtel NUMERIC DEFAULT 0,
      total_credit NUMERIC DEFAULT 0,
      total_mixed NUMERIC DEFAULT 0,
      total_settled_credits NUMERIC DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.cashier_queue (
      id SERIAL PRIMARY KEY,
      order_ids JSONB,
      table_name TEXT,
      label TEXT,
      amount NUMERIC DEFAULT 0,
      method TEXT DEFAULT 'Cash',
      status TEXT DEFAULT 'Pending',
      requested_by TEXT,
      staff_id INTEGER,
      confirmed_by TEXT,
      confirmed_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      reject_reason TEXT,
      transaction_id TEXT,
      is_item BOOLEAN DEFAULT false,
      item JSONB,
      credit_name TEXT,
      credit_phone TEXT,
      credit_pay_by TEXT,
      order_type TEXT DEFAULT 'dine-in',
      rider_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      shift_cleared BOOLEAN DEFAULT false
    );`,

    `CREATE TABLE IF NOT EXISTS public.credits (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES public.orders(id) ON DELETE SET NULL,
      cashier_queue_id INTEGER,
      table_name TEXT,
      label TEXT,
      client_name TEXT,
      client_phone TEXT,
      pay_by DATE,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(12,2) DEFAULT 0,
      balance NUMERIC(12,2) DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PendingCashier',
      waiter_name TEXT,
      forwarded_by TEXT,
      approved_by TEXT,
      rejected_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      forwarded_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      reject_reason TEXT
    );`,

    `CREATE TABLE IF NOT EXISTS public.credit_settlements (
      id SERIAL PRIMARY KEY,
      credit_id INTEGER NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
      amount_paid NUMERIC(12,2) NOT NULL,
      method TEXT NOT NULL,
      transaction_id TEXT,
      notes TEXT,
      settled_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.staff_shifts (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER,
      staff_name TEXT,
      role TEXT,
      shift_date DATE DEFAULT CURRENT_DATE,
      total_cash NUMERIC DEFAULT 0,
      total_mtn NUMERIC DEFAULT 0,
      total_airtel NUMERIC DEFAULT 0,
      total_card NUMERIC DEFAULT 0,
      gross_total NUMERIC DEFAULT 0,
      petty_cash_spent NUMERIC DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      credit_approved INTEGER DEFAULT 0,
      credit_rejected INTEGER DEFAULT 0,
      credit_approved_amt NUMERIC DEFAULT 0,
      ended_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.day_closings (
      id SERIAL PRIMARY KEY,
      closing_date DATE NOT NULL UNIQUE,
      recorded_by TEXT NOT NULL,
      gross NUMERIC DEFAULT 0,
      cash NUMERIC DEFAULT 0,
      mtn NUMERIC DEFAULT 0,
      airtel NUMERIC DEFAULT 0,
      card NUMERIC DEFAULT 0,
      credit NUMERIC DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      closed_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.physical_counts (
      id SERIAL PRIMARY KEY,
      count_date DATE NOT NULL UNIQUE,
      cash NUMERIC DEFAULT 0,
      momo_mtn NUMERIC DEFAULT 0,
      momo_airtel NUMERIC DEFAULT 0,
      card NUMERIC DEFAULT 0,
      notes TEXT,
      submitted_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.daily_reconciliations (
      id SERIAL PRIMARY KEY,
      recon_date DATE NOT NULL UNIQUE,
      system_cash NUMERIC DEFAULT 0,
      system_mtn NUMERIC DEFAULT 0,
      system_airtel NUMERIC DEFAULT 0,
      system_card NUMERIC DEFAULT 0,
      physical_cash NUMERIC DEFAULT 0,
      physical_mtn NUMERIC DEFAULT 0,
      physical_airtel NUMERIC DEFAULT 0,
      physical_card NUMERIC DEFAULT 0,
      variance NUMERIC DEFAULT 0,
      notes TEXT,
      reconciled_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.petty_cash (
      id SERIAL PRIMARY KEY,
      entry_date DATE NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      direction TEXT NOT NULL DEFAULT 'OUT' CHECK (direction = 'OUT'),
      category TEXT NOT NULL DEFAULT 'General',
      description TEXT NOT NULL,
      logged_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.purchases (
      id SERIAL PRIMARY KEY,
      purchase_date DATE NOT NULL,
      supplier TEXT,
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      invoice_number TEXT,
      notes TEXT,
      created_by TEXT DEFAULT 'Accountant',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_snapshots (
      id SERIAL PRIMARY KEY,
      snapshot_date DATE NOT NULL,
      total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_by TEXT DEFAULT 'Accountant',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.petty_cash'::regclass AND conname = 'petty_cash_expense_only'
      ) THEN
        ALTER TABLE public.petty_cash
        ADD CONSTRAINT petty_cash_expense_only CHECK (direction = 'OUT') NOT VALID;
      END IF;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS public.monthly_expenses (
      id SERIAL PRIMARY KEY,
      month TEXT NOT NULL,
      category TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      description TEXT,
      entered_by TEXT,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (month, category)
    );`,
    `ALTER TABLE public.monthly_expenses ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'Cash';`,

    `CREATE TABLE IF NOT EXISTS public.monthly_targets (
      id SERIAL PRIMARY KEY,
      month TEXT NOT NULL UNIQUE,
      revenue NUMERIC DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      set_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.business_targets (
      id SERIAL PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_value NUMERIC NOT NULL DEFAULT 0,
      period TEXT,
      set_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.staff_order_goals (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER,
      daily_order_target INTEGER DEFAULT 0,
      monthly_income_target NUMERIC DEFAULT 0,
      set_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (staff_id)
    );`,

    `CREATE TABLE IF NOT EXISTS public.shifts (
      id SERIAL PRIMARY KEY,
      staff_id INTEGER,
      staff_name TEXT,
      role TEXT,
      shift_date DATE DEFAULT CURRENT_DATE,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.delivery_riders (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      status TEXT DEFAULT 'available',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.events (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      event_date DATE,
      event_time TEXT,
      image_url TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.site_visits (
      id SERIAL PRIMARY KEY,
      page TEXT,
      ip TEXT,
      user_agent TEXT,
      visited_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.sms_log (
      id SERIAL PRIMARY KEY,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      provider TEXT,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.activity_logs (
      id SERIAL PRIMARY KEY,
      type TEXT,
      actor TEXT,
      role TEXT,
      message TEXT,
      meta JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
      account_type TEXT NOT NULL,
      normal_balance TEXT NOT NULL CHECK (normal_balance IN ('Debit', 'Credit')),
      is_active BOOLEAN DEFAULT true,
      parent_code TEXT,
      description TEXT,
      created_by TEXT DEFAULT 'System',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.inventory_locations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'STORE',
      parent_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.suppliers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_items (
      id SERIAL PRIMARY KEY,
      item_name TEXT NOT NULL,
      sku TEXT,
      category TEXT,
      unit TEXT NOT NULL DEFAULT 'kg',
      base_unit TEXT NOT NULL DEFAULT 'g',
      minimum_stock_level NUMERIC(12,3) NOT NULL DEFAULT 0,
      current_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      inventory_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      supplier_id INTEGER REFERENCES public.suppliers(id) ON DELETE SET NULL,
      location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      station TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_transactions (
      id SERIAL PRIMARY KEY,
      item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      reference_number TEXT,
      transaction_type TEXT NOT NULL CHECK (transaction_type IN ('PURCHASE','CONSUMPTION','TRANSFER_IN','TRANSFER_OUT','WASTE','ADJUSTMENT_IN','ADJUSTMENT_OUT','RETURN_TO_SUPPLIER','STOCK_COUNT','REVERSAL')),
      quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',
      unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
      source_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      destination_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      station TEXT,
      order_id INTEGER,
      recipe_id INTEGER,
      recipe_version TEXT,
      supplier_id INTEGER REFERENCES public.suppliers(id) ON DELETE SET NULL,
      business_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_by TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_transfers (
      id SERIAL PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      source_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      destination_location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','REVERSED')),
      notes TEXT,
      business_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
      id SERIAL PRIMARY KEY,
      transfer_id INTEGER REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.purchase_receipts (
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES public.suppliers(id) ON DELETE SET NULL,
      receipt_number TEXT,
      payment_method TEXT DEFAULT 'Cash',
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      business_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.purchase_receipt_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER REFERENCES public.purchase_receipts(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit TEXT DEFAULT 'kg',
      unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
      location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_recipes (
      id SERIAL PRIMARY KEY,
      menu_item_id INTEGER,
      menu_name TEXT NOT NULL,
      station TEXT NOT NULL,
      version_number INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','ACTIVE','INACTIVE')),
      created_by TEXT,
      approved_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
      id SERIAL PRIMARY KEY,
      recipe_id INTEGER NOT NULL REFERENCES public.inventory_recipes(id) ON DELETE CASCADE,
      ingredient_item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE SET NULL,
      ingredient_name TEXT NOT NULL,
      quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'g',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_consumptions (
      id SERIAL PRIMARY KEY,
      order_id INTEGER,
      order_item_id TEXT,
      recipe_id INTEGER REFERENCES public.inventory_recipes(id) ON DELETE SET NULL,
      recipe_version TEXT,
      item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'g',
      station TEXT,
      business_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_by TEXT,
      reference_number TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_waste (
      id SERIAL PRIMARY KEY,
      item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',
      station TEXT,
      reason TEXT,
      business_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_by TEXT,
      approved_by TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.stock_counts (
      id SERIAL PRIMARY KEY,
      item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      system_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      physical_quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      variance NUMERIC(12,3) NOT NULL DEFAULT 0,
      reason TEXT,
      business_date DATE NOT NULL DEFAULT CURRENT_DATE,
      counted_by TEXT,
      approved_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
      id SERIAL PRIMARY KEY,
      item_id INTEGER REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      location_id INTEGER REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
      adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('ADJUSTMENT_IN','ADJUSTMENT_OUT')),
      quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
      reason TEXT,
      business_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS public.accounting_periods (
      id SERIAL PRIMARY KEY,
      period_name TEXT NOT NULL UNIQUE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
      created_by TEXT DEFAULT 'System',
      closed_by TEXT,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.journal_entries (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      entry_date DATE NOT NULL,
      description TEXT NOT NULL,
      source_transaction TEXT,
      posted_by TEXT NOT NULL DEFAULT 'System',
      approved_by TEXT,
      approved_at TIMESTAMPTZ,
      reversal_of INTEGER REFERENCES public.journal_entries(id),
      reversal_reason TEXT,
      business_time TIME,
      posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'Posted' CHECK (status IN ('Draft', 'Posted', 'Reversed', 'Voided')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.general_ledger (
      id SERIAL PRIMARY KEY,
      journal_entry_id INTEGER NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
      account_code TEXT NOT NULL,
      account_name TEXT NOT NULL,
      debit NUMERIC(12,2) DEFAULT 0,
      credit NUMERIC(12,2) DEFAULT 0,
      entry_date DATE NOT NULL,
      business_time TIME,
      description TEXT,
      source_transaction TEXT,
      posted_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.accounting_audit_log (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      actor TEXT,
      details JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.accounts_receivable (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL,
      customer_name TEXT,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
      outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Outstanding' CHECK (status IN ('Outstanding', 'Partially Paid', 'Fully Settled')),
      payment_method TEXT,
      settlement_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    `CREATE TABLE IF NOT EXISTS public.accounts_payable (
      id SERIAL PRIMARY KEY,
      reference TEXT NOT NULL,
      supplier_name TEXT,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
      outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Fully Paid')),
      due_date DATE,
      payment_method TEXT,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`
  ];

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (error) {
      console.error('Schema bootstrap warning:', error.message);
    }
  }

  const defaultLocations = [
    ['MAIN STORE', 'STORE', null],
    ['KITCHEN', 'STATION', null],
    ['BAR', 'STATION', null],
    ['BARISTA', 'STATION', null],
  ];

  for (const [name, type, parentId] of defaultLocations) {
    await pool.query(
      `INSERT INTO public.inventory_locations (name, type, parent_id) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO NOTHING`,
      [name, type, parentId]
    );
  }

  await pool.query(
    `INSERT INTO public.suppliers (name, contact_person, email, is_active)
     VALUES ('KURAX PRIMARY SUPPLIER', 'Operations', 'ops@kurax.local', true)
     ON CONFLICT (name) DO NOTHING`
  );
}

//  Listen for idle client errors to prevent Node from crashing
pool.on('error', (err, client) => {
  console.error('Unexpected idle client error:', err.message);
});

// 🔹 Optional: Test connection at startup
(async () => {
  try {
    const client = await pool.connect();
    console.log(
      isLocalDb
        ? 'Database connected successfully to local Postgres'
        : 'Database connected successfully to Neon'
    );
    client.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Error code:', err.code);
    console.error('Error detail:', err);
    console.error(
      'DATABASE_URL is',
      process.env.DATABASE_URL ? 'Set' : 'NOT SET'
    );
  }
})();

export default pool;