-- ============================================================
--  Migration 005 — extend inquiries table
--
--  Adds the columns that the component tracks but the initial
--  schema didn't include, plus JSONB blobs for nested arrays
--  (items, follow-ups) and address objects.
-- ============================================================

ALTER TABLE inquiries
  ADD COLUMN IF NOT EXISTS inquiry_type_custom    text,
  ADD COLUMN IF NOT EXISTS customer_phone_code_iso text,
  ADD COLUMN IF NOT EXISTS mobile                 text,
  ADD COLUMN IF NOT EXISTS office_address         text,
  ADD COLUMN IF NOT EXISTS billing                jsonb,
  ADD COLUMN IF NOT EXISTS shipping               jsonb,
  ADD COLUMN IF NOT EXISTS items                  jsonb,
  ADD COLUMN IF NOT EXISTS follow_ups             jsonb;
