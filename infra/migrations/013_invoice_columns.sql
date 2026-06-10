-- ============================================================
--  Migration 013 — extend invoices table
--
--  The invoices component stores line items as JSONB and
--  needs a credit_days field for payment-reminder syncing.
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS items        jsonb,
  ADD COLUMN IF NOT EXISTS credit_days  int,
  ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();
