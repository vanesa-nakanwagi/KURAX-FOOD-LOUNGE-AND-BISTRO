-- Clear all data from kurax_db while preserving only:
-- public.menus
-- public.events
-- public.monthly_targets
-- public.staff

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN ('menus', 'events', 'monthly_targets', 'staff')
    LOOP
        EXECUTE format('TRUNCATE TABLE %I.%I CASCADE', r.table_schema, r.table_name);
    END LOOP;
END $$;

SELECT
    'menus' AS table_name, COUNT(*) AS row_count FROM public.menus
UNION ALL
SELECT 'events', COUNT(*) FROM public.events
UNION ALL
SELECT 'monthly_targets', COUNT(*) FROM public.monthly_targets
UNION ALL
SELECT 'staff', COUNT(*) FROM public.staff;
