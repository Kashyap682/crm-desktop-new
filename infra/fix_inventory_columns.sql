-- ============================================================
--  Fix inventory column names: snake_case → camelCase
--  PostgREST returns column names exactly as stored in Postgres.
--  The Angular component reads camelCase, so columns must match.
-- ============================================================

-- Step 1: rename snake_case columns to quoted camelCase
ALTER TABLE inventory RENAME COLUMN display_name    TO "displayName";
ALTER TABLE inventory RENAME COLUMN purchase_rate   TO "purchaseRate";
ALTER TABLE inventory RENAME COLUMN number_of_units TO "numberOfUnits";
ALTER TABLE inventory RENAME COLUMN product_make    TO "productMake";
ALTER TABLE inventory RENAME COLUMN vendor_name     TO "vendorName";
ALTER TABLE inventory RENAME COLUMN product_id      TO "productId";
ALTER TABLE inventory RENAME COLUMN attachment_name TO "attachmentName";
ALTER TABLE inventory RENAME COLUMN attachment_type TO "attachmentType";

-- Step 2: add remaining fields the app uses but weren't in the schema
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS unit           text,
  ADD COLUMN IF NOT EXISTS stock          numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "group"        text,
  ADD COLUMN IF NOT EXISTS specifications jsonb;

-- Step 3: backfill unit from uom for existing rows
UPDATE inventory SET unit = uom WHERE unit IS NULL AND uom IS NOT NULL;
