-- ============================================================
--  Migration 011 — extend payments table
--
--  The payments component stores customer snapshot fields
--  directly on the payment row.
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_id   text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS mobile       text,
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS gstin        text,
  ADD COLUMN IF NOT EXISTS pan          text;
