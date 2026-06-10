-- ============================================================
--  Migration 012 — extend reminders table
--
--  The reminders component stores human-readable reference
--  numbers and payment-specific fields on the reminder row.
-- ============================================================

ALTER TABLE reminders
  ADD COLUMN IF NOT EXISTS reference_no  text,
  ADD COLUMN IF NOT EXISTS invoice_no    text,
  ADD COLUMN IF NOT EXISTS invoice_date  date,
  ADD COLUMN IF NOT EXISTS due_date      date,
  ADD COLUMN IF NOT EXISTS credit_days   int,
  ADD COLUMN IF NOT EXISTS amount        numeric,
  ADD COLUMN IF NOT EXISTS overdue_days  int,
  ADD COLUMN IF NOT EXISTS completed_at  timestamptz;
