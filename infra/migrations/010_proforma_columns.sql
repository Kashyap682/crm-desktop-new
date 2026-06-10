-- ============================================================
--  Migration 010 — extend proformas table
--
--  The proforma-invoice component stores buyer, ship-to,
--  tax breakdown, bank details and items as a rich form blob.
-- ============================================================

ALTER TABLE proformas
  ADD COLUMN IF NOT EXISTS proforma_number  text,
  ADD COLUMN IF NOT EXISTS buyer_name       text,
  ADD COLUMN IF NOT EXISTS buyer_address    text,
  ADD COLUMN IF NOT EXISTS buyer_gst        text,
  ADD COLUMN IF NOT EXISTS buyer_pan        text,
  ADD COLUMN IF NOT EXISTS buyer_id         text,
  ADD COLUMN IF NOT EXISTS ship_to_name     text,
  ADD COLUMN IF NOT EXISTS ship_to_address  text,
  ADD COLUMN IF NOT EXISTS ship_to_gst      text,
  ADD COLUMN IF NOT EXISTS ship_to_pan      text,
  ADD COLUMN IF NOT EXISTS inquiry_ref      text,
  ADD COLUMN IF NOT EXISTS ref_no           text,
  ADD COLUMN IF NOT EXISTS items            jsonb,
  ADD COLUMN IF NOT EXISTS sub_total        numeric,
  ADD COLUMN IF NOT EXISTS cgst             numeric,
  ADD COLUMN IF NOT EXISTS sgst             numeric,
  ADD COLUMN IF NOT EXISTS igst             numeric,
  ADD COLUMN IF NOT EXISTS grand_total      numeric,
  ADD COLUMN IF NOT EXISTS round_off        numeric,
  ADD COLUMN IF NOT EXISTS total_receivable numeric,
  ADD COLUMN IF NOT EXISTS advance          numeric,
  ADD COLUMN IF NOT EXISTS gst_type         text,
  ADD COLUMN IF NOT EXISTS bank_key         text,
  ADD COLUMN IF NOT EXISTS bank_details     jsonb,
  ADD COLUMN IF NOT EXISTS prepared_by      text,
  ADD COLUMN IF NOT EXISTS linked_offer_id  uuid REFERENCES offers(id);
