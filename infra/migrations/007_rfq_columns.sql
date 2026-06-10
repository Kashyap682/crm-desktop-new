-- ============================================================
--  Migration 007 — extend rfqs table
--
--  The component stores items as an in-memory array and
--  attachments as base64 blobs.  Both are kept as JSONB on
--  the parent row (rfq_items child table kept for reporting).
--  inquiry_ref stores the human-readable "INQ-001" display
--  string (the UUID FK inquiry_id is kept for future joins).
-- ============================================================

ALTER TABLE rfqs
  ADD COLUMN IF NOT EXISTS inquiry_ref text,
  ADD COLUMN IF NOT EXISTS items       jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb;
