-- ═══════════════════════════════════════════════════════════════════════════════
--  KURAX FOOD LOUNGE & BISTRO — Complete Database Schema
--  Reconstructed from full conversation history
--  Run in order — dependencies are respected
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── EXTENSIONS ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. STAFF
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS staff (
  id                    SERIAL PRIMARY KEY,
  name                  TEXT        NOT NULL,
  email                 TEXT        UNIQUE,
  phone                 TEXT,
  role                  TEXT        NOT NULL DEFAULT 'WAITER',
  -- roles: WAITER, SUPERVISOR, MANAGER, DIRECTOR, ACCOUNTANT, CASHIER, CHEF, BARISTA, BARMAN
  password_hash         TEXT,
  is_active             BOOLEAN     DEFAULT true,
  is_permitted          BOOLEAN     DEFAULT false,   -- supervisor permission flag
  daily_order_target    INTEGER     DEFAULT 0,
  monthly_income_target NUMERIC     DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. MENUS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS menus (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC     NOT NULL DEFAULT 0,
  category    TEXT,
  station     TEXT,       -- kitchen | barista | barman
  image_url   TEXT,
  is_available BOOLEAN    DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ORDERS
-- Core order table. items stored as JSONB array.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  table_name      TEXT,
  staff_name      TEXT,
  staff_id        INTEGER     REFERENCES staff(id) ON DELETE SET NULL,
  staff_role      TEXT,
  items           JSONB       DEFAULT '[]',
  -- each item: { name, price, quantity, station, category, note,
  --              voidProcessed, voidRejected, voidRequested, voidReason, status,
  --              assignedTo, assignedAt }
  total           NUMERIC     DEFAULT 0,
  status          TEXT        DEFAULT 'Pending',
  -- statuses: Pending, Preparing, Ready, Delayed, Served, Paid, Mixed, Credit, Voided
  payment_method  TEXT        DEFAULT 'Cash',
  is_paid         BOOLEAN     DEFAULT false,
  sent_to_cashier BOOLEAN     DEFAULT false,
  shift_cleared   BOOLEAN     DEFAULT false,  -- waiter end-of-shift
  day_cleared     BOOLEAN     DEFAULT false,  -- accountant end-of-day
  void_reason     TEXT,
  timestamp       TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_day_cleared  ON orders (day_cleared);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp     ON orders (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_staff_id      ON orders (staff_id);
CREATE INDEX IF NOT EXISTS idx_orders_table_name    ON orders (table_name);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. VOID REQUESTS
-- Waiter submits → accountant approves/rejects
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS void_requests (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER     REFERENCES orders(id) ON DELETE CASCADE,
  item_name     TEXT        NOT NULL,
  reason        TEXT,
  table_name    TEXT,
  waiter_name   TEXT,
  requested_by  TEXT,
  status        TEXT        DEFAULT 'Pending',
  -- statuses: Pending, Approved, Rejected, Expired
  approved_by   TEXT,
  rejected_by   TEXT,
  resolved_by   TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_void_requests_order_id ON void_requests (order_id);
CREATE INDEX IF NOT EXISTS idx_void_requests_status   ON void_requests (status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. CASHIER QUEUE
-- Waiter sends payment request → cashier confirms
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cashier_queue (
  id             SERIAL PRIMARY KEY,
  order_ids      JSONB,        -- array of order ids being paid
  table_name     TEXT,
  label          TEXT,         -- display label e.g. item name or "Full Table"
  amount         NUMERIC       NOT NULL DEFAULT 0,
  method         TEXT          NOT NULL DEFAULT 'Cash',
  -- methods: Cash, Card, Momo-MTN, Momo-Airtel, Credit
  status         TEXT          DEFAULT 'Pending',
  -- statuses: Pending, Confirmed, Rejected, PendingManagerApproval
  requested_by   TEXT,
  staff_id       INTEGER       REFERENCES staff(id) ON DELETE SET NULL,
  confirmed_by   TEXT,
  confirmed_at   TIMESTAMPTZ,
  rejected_at    TIMESTAMPTZ,
  reject_reason  TEXT,
  transaction_id TEXT,         -- for Momo
  is_item        BOOLEAN       DEFAULT false,
  item           JSONB,        -- single item details if is_item = true
  -- credit fields
  credit_name    TEXT,
  credit_phone   TEXT,
  credit_pay_by  TEXT,
  order_type     TEXT          DEFAULT 'dine-in',  -- dine-in | delivery
  rider_name     TEXT,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashier_queue_status       ON cashier_queue (status);
CREATE INDEX IF NOT EXISTS idx_cashier_queue_requested_by ON cashier_queue (requested_by);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. CREDITS
-- Approved credit orders — cashier settles when client pays back
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS credits (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER     REFERENCES orders(id) ON DELETE SET NULL,
  cashier_queue_id INTEGER    REFERENCES cashier_queue(id) ON DELETE SET NULL,
  table_name      TEXT,
  client_name     TEXT,
  client_phone    TEXT,
  pay_by          TEXT,        -- expected pay date / note
  amount          NUMERIC      NOT NULL DEFAULT 0,
  amount_paid     NUMERIC      DEFAULT 0,
  approved_by     TEXT,
  requested_by    TEXT,        -- waiter name
  waiter_name     TEXT,
  paid            BOOLEAN      DEFAULT false,
  paid_at         TIMESTAMPTZ,
  settled         BOOLEAN      DEFAULT false,
  settle_method   TEXT,        -- Cash, Card, Momo-MTN, Momo-Airtel
  settle_txn      TEXT,
  settle_notes    TEXT,
  settled_by      TEXT,
  status          TEXT         DEFAULT 'outstanding',  -- outstanding | settled
  label           TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_paid       ON credits (paid);
CREATE INDEX IF NOT EXISTS idx_credits_table_name ON credits (table_name);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. KITCHEN TICKETS
-- One ticket per order_id on the kitchen board
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS kitchen_tickets (
  id                 SERIAL PRIMARY KEY,
  order_id           INTEGER      REFERENCES orders(id) ON DELETE CASCADE,
  table_name         TEXT,
  staff_name         TEXT,
  staff_role         TEXT,
  items              JSONB        DEFAULT '[]',
  total              NUMERIC      DEFAULT 0,
  status             TEXT         DEFAULT 'Pending',
  -- statuses: Pending, Preparing, Ready, Served, Paid
  ticket_date        DATE         DEFAULT CURRENT_DATE,
  ready_at           TIMESTAMPTZ,
  cleared_by_kitchen BOOLEAN      DEFAULT false,
  cleared_by         TEXT,
  cleared_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_ticket_date        ON kitchen_tickets (ticket_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_cleared_by_kitchen ON kitchen_tickets (cleared_by_kitchen);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. CHEF ASSIGNMENTS
-- Tracks which chef is assigned to which item
-- FK → kitchen_tickets (ticket_id), NOT → orders
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chef_assignments (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER      REFERENCES orders(id)          ON DELETE CASCADE,
  ticket_id   INTEGER      REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
  item_name   TEXT         NOT NULL,
  assigned_to TEXT         NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chef_assignments_order_id ON chef_assignments (order_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. BARISTA TICKETS  (mirrors kitchen_tickets for the barista station)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS barista_tickets (
  id                 SERIAL PRIMARY KEY,
  order_id           INTEGER      REFERENCES orders(id) ON DELETE CASCADE,
  table_name         TEXT,
  staff_name         TEXT,
  staff_role         TEXT,
  items              JSONB        DEFAULT '[]',
  total              NUMERIC      DEFAULT 0,
  status             TEXT         DEFAULT 'Pending',
  ticket_date        DATE         DEFAULT CURRENT_DATE,
  ready_at           TIMESTAMPTZ,
  cleared_by_kitchen BOOLEAN      DEFAULT false,
  cleared_by         TEXT,
  cleared_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_barista_tickets_ticket_date ON barista_tickets (ticket_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. BARISTA ASSIGNMENTS  (mirrors chef_assignments for barista station)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS barista_assignments (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER      REFERENCES orders(id)         ON DELETE CASCADE,
  ticket_id   INTEGER      REFERENCES barista_tickets(id) ON DELETE CASCADE,
  item_name   TEXT         NOT NULL,
  assigned_to TEXT         NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. BARMAN TICKETS  (mirrors kitchen_tickets for the bar station)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS barman_tickets (
  id                 SERIAL PRIMARY KEY,
  order_id           INTEGER      REFERENCES orders(id) ON DELETE CASCADE,
  table_name         TEXT,
  staff_name         TEXT,
  staff_role         TEXT,
  items              JSONB        DEFAULT '[]',
  total              NUMERIC      DEFAULT 0,
  status             TEXT         DEFAULT 'Pending',
  ticket_date        DATE         DEFAULT CURRENT_DATE,
  ready_at           TIMESTAMPTZ,
  cleared_by_kitchen BOOLEAN      DEFAULT false,
  cleared_by         TEXT,
  cleared_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_barman_tickets_ticket_date ON barman_tickets (ticket_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. BARMAN ASSIGNMENTS  (mirrors chef_assignments for bar station)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS barman_assignments (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER      REFERENCES orders(id)        ON DELETE CASCADE,
  ticket_id   INTEGER      REFERENCES barman_tickets(id) ON DELETE CASCADE,
  item_name   TEXT         NOT NULL,
  assigned_to TEXT         NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. DAILY SUMMARY
-- Written by the cashier/accountant flow — one row per calendar date
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_summary (
  id            SERIAL PRIMARY KEY,
  summary_date  DATE        NOT NULL UNIQUE,
  total_gross   NUMERIC     DEFAULT 0,
  total_cash    NUMERIC     DEFAULT 0,
  total_card    NUMERIC     DEFAULT 0,
  total_mtn     NUMERIC     DEFAULT 0,
  total_airtel  NUMERIC     DEFAULT 0,
  total_credit  NUMERIC     DEFAULT 0,
  total_mixed   NUMERIC     DEFAULT 0,
  order_count   INTEGER     DEFAULT 0,
  day_closed    BOOLEAN     DEFAULT false,   -- set true by accountant finalize-day
  closed_by     TEXT,
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 14. DAILY SUMMARIES  (legacy table name — same shape, kept for compatibility)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_summaries (
  id            SERIAL PRIMARY KEY,
  summary_date  DATE        NOT NULL UNIQUE,
  total_gross   NUMERIC     DEFAULT 0,
  total_cash    NUMERIC     DEFAULT 0,
  total_card    NUMERIC     DEFAULT 0,
  total_mtn     NUMERIC     DEFAULT 0,
  total_airtel  NUMERIC     DEFAULT 0,
  total_credit  NUMERIC     DEFAULT 0,
  total_mixed   NUMERIC     DEFAULT 0,
  order_count   INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 15. DAY CLOSINGS  — permanent audit trail of every accountant close-day action
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS day_closings (
  id           SERIAL PRIMARY KEY,
  closing_date DATE        NOT NULL UNIQUE,
  recorded_by  TEXT        NOT NULL,
  gross        NUMERIC     DEFAULT 0,
  cash         NUMERIC     DEFAULT 0,
  mtn          NUMERIC     DEFAULT 0,
  airtel       NUMERIC     DEFAULT 0,
  card         NUMERIC     DEFAULT 0,
  credit       NUMERIC     DEFAULT 0,
  order_count  INTEGER     DEFAULT 0,
  closed_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 16. PHYSICAL COUNTS  — accountant physical cash count per day
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS physical_counts (
  id           SERIAL PRIMARY KEY,
  count_date   DATE        NOT NULL UNIQUE,
  cash         NUMERIC     DEFAULT 0,
  momo_mtn     NUMERIC     DEFAULT 0,
  momo_airtel  NUMERIC     DEFAULT 0,
  card         NUMERIC     DEFAULT 0,
  notes        TEXT,
  submitted_by TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 17. DAILY RECONCILIATIONS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_reconciliations (
  id              SERIAL PRIMARY KEY,
  recon_date      DATE        NOT NULL UNIQUE,
  system_cash     NUMERIC     DEFAULT 0,
  system_mtn      NUMERIC     DEFAULT 0,
  system_airtel   NUMERIC     DEFAULT 0,
  system_card     NUMERIC     DEFAULT 0,
  physical_cash   NUMERIC     DEFAULT 0,
  physical_mtn    NUMERIC     DEFAULT 0,
  physical_airtel NUMERIC     DEFAULT 0,
  physical_card   NUMERIC     DEFAULT 0,
  variance        NUMERIC     DEFAULT 0,
  notes           TEXT,
  reconciled_by   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 18. PETTY CASH
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS petty_cash (
  id          SERIAL PRIMARY KEY,
  entry_date  DATE        NOT NULL,
  amount      NUMERIC     NOT NULL DEFAULT 0,
  direction   TEXT        NOT NULL DEFAULT 'OUT',   -- IN | OUT
  category    TEXT        NOT NULL DEFAULT 'General',
  description TEXT        NOT NULL,
  logged_by   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_entry_date ON petty_cash (entry_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 19. MONTHLY EXPENSES
-- Fixed monthly costs (rent, wages, stock, etc.) — entered by director
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS monthly_expenses (
  id          SERIAL PRIMARY KEY,
  month       TEXT        NOT NULL,   -- format: YYYY-MM
  category    TEXT        NOT NULL,
  amount      NUMERIC     NOT NULL DEFAULT 0,
  description TEXT,
  entered_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month, category)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 20. MONTHLY TARGETS  — director sets revenue targets per month
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS monthly_targets (
  id          SERIAL PRIMARY KEY,
  month       TEXT        NOT NULL UNIQUE,   -- format: YYYY-MM
  revenue     NUMERIC     DEFAULT 0,
  order_count INTEGER     DEFAULT 0,
  set_by      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 21. BUSINESS TARGETS  — general targets (used alongside monthly_targets)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS business_targets (
  id           SERIAL PRIMARY KEY,
  target_type  TEXT        NOT NULL,   -- daily | weekly | monthly
  target_value NUMERIC     NOT NULL DEFAULT 0,
  period       TEXT,                   -- YYYY-MM or YYYY-WW or YYYY-MM-DD
  set_by       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 22. STAFF ORDER GOALS  — per-staff daily order targets
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS staff_order_goals (
  id                    SERIAL PRIMARY KEY,
  staff_id              INTEGER     REFERENCES staff(id) ON DELETE CASCADE,
  daily_order_target    INTEGER     DEFAULT 0,
  monthly_income_target NUMERIC     DEFAULT 0,
  set_by                TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 23. SHIFTS  — general shift tracking
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS shifts (
  id           SERIAL PRIMARY KEY,
  staff_id     INTEGER     REFERENCES staff(id) ON DELETE SET NULL,
  staff_name   TEXT,
  role         TEXT,
  shift_date   DATE        DEFAULT CURRENT_DATE,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  is_active    BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 24. STAFF SHIFTS  — per-waiter end-of-shift archive (finer grained)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS staff_shifts (
  id            SERIAL PRIMARY KEY,
  staff_id      INTEGER     REFERENCES staff(id) ON DELETE SET NULL,
  staff_name    TEXT,
  role          TEXT,
  shift_date    DATE        DEFAULT CURRENT_DATE,
  total_cash    NUMERIC     DEFAULT 0,
  total_mtn     NUMERIC     DEFAULT 0,
  total_airtel  NUMERIC     DEFAULT 0,
  total_card    NUMERIC     DEFAULT 0,
  gross_total   NUMERIC     DEFAULT 0,
  petty_cash_spent NUMERIC  DEFAULT 0,
  order_count   INTEGER     DEFAULT 0,
  ended_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 25. DELIVERY RIDERS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS delivery_riders (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  phone       TEXT,
  status      TEXT        DEFAULT 'available',  -- available | out | off
  is_active   BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 26. EVENTS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT,
  event_date  DATE,
  event_time  TEXT,
  image_url   TEXT,
  is_active   BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 27. SITE VISITS  — customer-facing page visit analytics
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS site_visits (
  id          SERIAL PRIMARY KEY,
  page        TEXT,
  ip          TEXT,
  user_agent  TEXT,
  visited_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 28. SMS LOG
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sms_log (
  id          SERIAL PRIMARY KEY,
  recipient   TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  status      TEXT        DEFAULT 'sent',
  provider    TEXT,
  sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 29. ACTIVITY LOGS  — system-wide audit trail
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS activity_logs (
  id         SERIAL PRIMARY KEY,
  type       TEXT,          -- ORDER, SHIFT, STAFF, PETTY, DAY_CLOSED, etc.
  actor      TEXT,
  role       TEXT,
  message    TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type       ON activity_logs (type);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════════
