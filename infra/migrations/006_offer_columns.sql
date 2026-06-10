-- ============================================================
--  Migration 006 — extend offers table
--
--  The initial schema had only the offer-letter fields.
--  The component stores the full offer object (items, totals,
--  status tracking, versioning, attachments, etc.) as flat
--  columns or JSONB blobs.
-- ============================================================

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS inquiry_no          int,
  ADD COLUMN IF NOT EXISTS customer_name       text,
  ADD COLUMN IF NOT EXISTS customer_snapshot   jsonb,
  ADD COLUMN IF NOT EXISTS business_vertical   text,
  ADD COLUMN IF NOT EXISTS terms               text,
  ADD COLUMN IF NOT EXISTS freight_charges     numeric,
  ADD COLUMN IF NOT EXISTS subtotal            numeric,
  ADD COLUMN IF NOT EXISTS gst                 numeric,
  ADD COLUMN IF NOT EXISTS cgst                numeric,
  ADD COLUMN IF NOT EXISTS sgst                numeric,
  ADD COLUMN IF NOT EXISTS igst                numeric,
  ADD COLUMN IF NOT EXISTS gst_type            text,
  ADD COLUMN IF NOT EXISTS grand_total         numeric,
  ADD COLUMN IF NOT EXISTS offer_status        text,
  ADD COLUMN IF NOT EXISTS previous_version_id uuid REFERENCES offers(id),
  ADD COLUMN IF NOT EXISTS original_item_rates jsonb,
  ADD COLUMN IF NOT EXISTS items               jsonb,
  ADD COLUMN IF NOT EXISTS follow_ups          jsonb,
  ADD COLUMN IF NOT EXISTS payment_details     jsonb,
  ADD COLUMN IF NOT EXISTS lost_details        jsonb,
  ADD COLUMN IF NOT EXISTS regret_remarks      text,
  ADD COLUMN IF NOT EXISTS sent_at             timestamptz,
  ADD COLUMN IF NOT EXISTS attachments         jsonb,
  ADD COLUMN IF NOT EXISTS po_copy_attachments jsonb,
  ADD COLUMN IF NOT EXISTS material            text,
  ADD COLUMN IF NOT EXISTS density             text,
  ADD COLUMN IF NOT EXISTS thickness           text,
  ADD COLUMN IF NOT EXISTS size                text,
  ADD COLUMN IF NOT EXISTS quantity            text,
  ADD COLUMN IF NOT EXISTS rate                text,
  ADD COLUMN IF NOT EXISTS date                date;
