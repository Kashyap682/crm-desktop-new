-- ============================================================
--  Migration 009 — simple orders table
--
--  The orders component (orders.component.ts) tracks a lighter-
--  weight "order" concept with status offers|ongoing|completed.
--  Separate from the richer sales_orders table.
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  order_ref    text,
  order_date   date,
  delivery_date date,
  customer_id  uuid REFERENCES customers(id),
  customer_name text,
  inquiry_ref  text,
  salesman     text,
  items        jsonb,
  amount       numeric NOT NULL DEFAULT 0,
  gst_percent  numeric NOT NULL DEFAULT 18,
  grand_total  numeric NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'offers',
  remarks      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_org    ON orders(org_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
