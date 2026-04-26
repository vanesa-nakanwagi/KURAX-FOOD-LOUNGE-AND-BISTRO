-- Clear all data from kurax_db except staff, menus, and events tables
-- This script handles foreign key constraints by deleting in the correct order

-- Disable foreign key constraints temporarily
SET session_replication_role = replica;

-- Delete from tables with foreign key dependencies (in order)
DELETE FROM credit_settlements;
DELETE FROM void_requests;
DELETE FROM chef_assignments;
DELETE FROM barista_assignments;
DELETE FROM barman_assignments;
DELETE FROM kitchen_tickets;
DELETE FROM barista_tickets;
DELETE FROM barman_tickets;
DELETE FROM credits;
DELETE FROM staff_order_goals;
DELETE FROM staff_shifts;
DELETE FROM shifts;
DELETE FROM cashier_queue;
DELETE FROM orders;
DELETE FROM daily_reconciliations;
DELETE FROM daily_summaries;
DELETE FROM daily_summary;
DELETE FROM day_closings;
DELETE FROM physical_counts;
DELETE FROM petty_cash_transactions;
DELETE FROM petty_cash;
DELETE FROM monthly_expenses;
DELETE FROM monthly_targets;
DELETE FROM business_targets;
DELETE FROM delivery_riders;
DELETE FROM riders;
DELETE FROM tables;
DELETE FROM activity_logs;
DELETE FROM site_visits;
DELETE FROM sms_log;

-- Re-enable foreign key constraints
SET session_replication_role = default;

-- Verify data was cleared (optional - shows row counts)
SELECT 
    'orders' as table_name, COUNT(*) as row_count FROM orders
UNION ALL SELECT 'credits', COUNT(*) FROM credits
UNION ALL SELECT 'staff', COUNT(*) FROM staff
UNION ALL SELECT 'menus', COUNT(*) FROM menus
UNION ALL SELECT 'events', COUNT(*) FROM events;
