ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_visible BOOLEAN DEFAULT false;

UPDATE menus
SET customer_visible = false
WHERE category = 'Shisha' AND customer_visible IS NULL;
