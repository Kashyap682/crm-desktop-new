-- ============================================================
--  Migration 004 — extend vendors table with JSONB blobs
--
--  Adds the remaining scalar fields that were in the component
--  but not the initial schema, plus JSONB blobs for every
--  complex nested object (addresses, contacts, files, etc.).
-- ============================================================

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS gst                   text,
  ADD COLUMN IF NOT EXISTS location              text,
  ADD COLUMN IF NOT EXISTS contact_person        text,
  ADD COLUMN IF NOT EXISTS category              text,
  ADD COLUMN IF NOT EXISTS gst_file              jsonb,
  ADD COLUMN IF NOT EXISTS pan_file              jsonb,
  ADD COLUMN IF NOT EXISTS msme_file             jsonb,
  ADD COLUMN IF NOT EXISTS cancelled_cheque_file jsonb,
  ADD COLUMN IF NOT EXISTS office_address        jsonb,
  ADD COLUMN IF NOT EXISTS office_address2       jsonb,
  ADD COLUMN IF NOT EXISTS billing               jsonb,
  ADD COLUMN IF NOT EXISTS billing2              jsonb,
  ADD COLUMN IF NOT EXISTS shipping              jsonb,
  ADD COLUMN IF NOT EXISTS primary_contact       jsonb,
  ADD COLUMN IF NOT EXISTS datasheets            jsonb,
  ADD COLUMN IF NOT EXISTS products              jsonb;
