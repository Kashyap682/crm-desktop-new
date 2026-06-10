-- ============================================================
--  Migration 003 — extend customers table with JSONB blobs
--
--  The existing scalar columns (company_name, pan, msme, etc.)
--  are kept.  All complex nested data (addresses, contacts,
--  materials, file blobs) is stored as JSONB so the Angular
--  component can read/write the full object in one round-trip.
--
--  The separate child tables (customer_addresses, etc.) remain
--  and can be populated for reporting/search in a later pass.
-- ============================================================

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS email              text,
  ADD COLUMN IF NOT EXISTS mobile             text,
  ADD COLUMN IF NOT EXISTS logo               jsonb,
  ADD COLUMN IF NOT EXISTS pan_file           jsonb,
  ADD COLUMN IF NOT EXISTS msme_file          jsonb,
  ADD COLUMN IF NOT EXISTS office_address     jsonb,
  ADD COLUMN IF NOT EXISTS billing            jsonb,
  ADD COLUMN IF NOT EXISTS billing2           jsonb,
  ADD COLUMN IF NOT EXISTS shipping_addresses jsonb,
  ADD COLUMN IF NOT EXISTS primary_contact    jsonb,
  ADD COLUMN IF NOT EXISTS secondary_contact  jsonb,
  ADD COLUMN IF NOT EXISTS product_materials  jsonb;
