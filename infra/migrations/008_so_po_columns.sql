-- ============================================================
--  Migration 008 — extend sales_orders and purchase_orders
--
--  The components store items as JSONB blobs and track a few
--  extra scalar fields not in the initial schema.
-- ============================================================

ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS items        jsonb,
  ADD COLUMN IF NOT EXISTS grand_total  numeric,
  ADD COLUMN IF NOT EXISTS inquiry_ref  text,
  ADD COLUMN IF NOT EXISTS company_name text;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS items            jsonb,
  ADD COLUMN IF NOT EXISTS grand_total      numeric,
  ADD COLUMN IF NOT EXISTS transporter_name text,
  ADD COLUMN IF NOT EXISTS vendor_ref       text;
