-- Clear every public table except staff, menus, events, combos, and monthly_targets.
-- Related tables such as combo_items are cleared; no CASCADE is used so preserved
-- table data cannot be removed indirectly.
DO $$
DECLARE
    tables_to_clear TEXT;
BEGIN
    SELECT string_agg(format('%I.%I', table_schema, table_name), ', ' ORDER BY table_name)
    INTO tables_to_clear
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('staff', 'menus', 'events', 'combos', 'monthly_targets');

    IF tables_to_clear IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || tables_to_clear || ' RESTART IDENTITY';
    END IF;
END $$;

SELECT 'staff' AS table_name, COUNT(*) AS row_count FROM public.staff
UNION ALL
SELECT 'menus', COUNT(*) FROM public.menus
UNION ALL
SELECT 'events', COUNT(*) FROM public.events
UNION ALL
SELECT 'combos', COUNT(*) FROM public.combos
UNION ALL
SELECT 'monthly_targets', COUNT(*) FROM public.monthly_targets;
