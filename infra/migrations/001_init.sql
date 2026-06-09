-- ============================================================
--  CRM Database Schema
--  Migration 001 — initial tables, no RLS
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  ROLES  (PostgREST needs a role to connect as)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO web_anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO web_anon;

-- ============================================================
--  ORGANIZATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed a default org so foreign keys work immediately
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Navbharat')
ON CONFLICT DO NOTHING;

-- ============================================================
--  CUSTOMERS
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  customer_ref    text,
  customer_type   text,
  company_name    text NOT NULL,
  name            text,
  website         text,
  pan             text,
  msme            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address_type    text NOT NULL,  -- office / billing / billing2 / shipping
  line1           text,
  line2           text,
  city            text,
  state           text,
  pincode         text,
  country         text,
  gstin           text,
  sort_order      int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_type    text NOT NULL,  -- primary / secondary
  title           text,
  first_name      text,
  last_name       text,
  mobile          text,
  mobile_country_code text,
  email           text,
  remarks         text
);

CREATE TABLE IF NOT EXISTS customer_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  material        text,
  make            text
);

-- ============================================================
--  VENDORS
-- ============================================================

CREATE TABLE IF NOT EXISTS vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  vendor_ref      text,
  vendor_vertical text,
  vendor_type     text,
  vendor_category text,
  company_name    text NOT NULL,
  brand_name      text,
  website         text,
  email           text,
  mobile          text,
  pan             text,
  msme            text,
  payment_terms   text,
  bank_ifsc       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_addresses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  vendor_id       uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  address_type    text NOT NULL,  -- office / office2 / billing / billing2
  line1           text,
  line2           text,
  city            text,
  state           text,
  pincode         text,
  country         text,
  gstin           text,
  contact_person  text,
  email           text,
  mobile          text,
  department      text
);

CREATE TABLE IF NOT EXISTS vendor_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  vendor_id       uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title           text,
  first_name      text,
  last_name       text,
  mobile          text,
  mobile_country_code text,
  email           text,
  location        text,
  remarks         text
);

CREATE TABLE IF NOT EXISTS vendor_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  vendor_id       uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_name    text
);

-- ============================================================
--  INVENTORY
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  category        text,
  hsn             text,
  uom             text,
  description     text,
  stock_qty       numeric NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

-- ============================================================
--  INQUIRIES
-- ============================================================

CREATE TABLE IF NOT EXISTS inquiries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id),
  inquiry_ref           text,
  date                  date NOT NULL,
  customer_id           uuid REFERENCES customers(id),
  customer_name         text,
  company_name          text,
  customer_phone        text,
  customer_phone_code   text,
  email                 text,
  inquiry_type          text,
  notes                 text,
  status                text NOT NULL DEFAULT 'open',
  decision              text,
  rejection_reason      text,
  lost_reason           text,
  lost_remarks          text,
  lost_date             date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inquiry_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  inquiry_id      uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  product_name    text,
  make            text,
  hsn             text,
  form            text,
  density         text,
  thickness       text,
  size            text,
  grade           text,
  alloy           text,
  temper          text,
  nb              text,
  max_temp        text,
  color           text,
  fsk             text,
  qty             numeric,
  uom             text,
  stock           text,
  lead_time       text,
  sort_order      int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inquiry_followups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  inquiry_id      uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  date            date NOT NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  OFFERS
-- ============================================================

CREATE TABLE IF NOT EXISTS offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  offer_ref       text,
  inquiry_id      uuid REFERENCES inquiries(id),
  customer_id     uuid REFERENCES customers(id),
  date            date,
  subject         text,
  address         text,
  intro_text      text,
  delivery_terms  text,
  payment_terms   text,
  validity        text,
  taxes           text,
  freight         text,
  inspection      text,
  packing         text,
  loading         text,
  closing_text    text,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offer_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  offer_id        uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  material        text,
  density         text,
  thickness       text,
  size            text,
  quantity        text,
  rate            text,
  sort_order      int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS offer_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  offer_id        uuid NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  snapshot        jsonb NOT NULL,
  revised_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  RFQs
-- ============================================================

CREATE TABLE IF NOT EXISTS rfqs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  rfq_ref             text,
  rfq_date            date,
  inquiry_id          uuid REFERENCES inquiries(id),
  vendor_id           uuid REFERENCES vendors(id),
  vendor_name         text,
  vendor_address      text,
  contact_title       text,
  contact_first_name  text,
  contact_last_name   text,
  mobile              text,
  email               text,
  shipping_line1      text,
  shipping_line2      text,
  shipping_city       text,
  shipping_state      text,
  shipping_pincode    text,
  shipping_country    text,
  notes               text,
  other_terms         text,
  status              text NOT NULL DEFAULT 'DRAFT',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfq_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  rfq_id          uuid NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  product         text,
  form            text,
  make            text,
  density         text,
  thickness       text,
  size            text,
  fsk             text,
  grade           text,
  alloy           text,
  temper          text,
  nb              text,
  max_temp        text,
  color           text,
  qty             numeric,
  uom             text,
  sort_order      int NOT NULL DEFAULT 0
);

-- ============================================================
--  SALES ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id),
  order_ref               text,
  order_date              date,
  customer_id             uuid REFERENCES customers(id),
  customer_name           text,
  inquiry_id              uuid REFERENCES inquiries(id),
  offer_id                uuid REFERENCES offers(id),
  bill_addr               text,
  ship_addr               text,
  gst_no                  text,
  contact_person          text,
  contact_no              text,
  payment_terms           text,
  credit_days             int,
  po_no                   text,
  po_date                 date,
  freight_charges         numeric NOT NULL DEFAULT 0,
  advance_received        numeric NOT NULL DEFAULT 0,
  expected_delivery_date  date,
  delivery_terms          text,
  transporter_name        text,
  transport_mode          text,
  gst_type                text,
  status                  text NOT NULL DEFAULT 'DRAFT',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  order_id        uuid NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_name    text,
  hsn             text,
  uom             text,
  qty             numeric,
  rate            numeric,
  discount        numeric NOT NULL DEFAULT 0,
  discount_type   text,
  gst_pct         numeric,
  total           numeric,
  sort_order      int NOT NULL DEFAULT 0
);

-- ============================================================
--  PURCHASE ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id),
  po_ref                  text,
  po_date                 date,
  vendor_id               uuid REFERENCES vendors(id),
  vendor_name             text,
  inquiry_ref             text,
  offer_ref               text,
  billing_address         text,
  delivery_address        text,
  vendor_gst              text,
  contact_person          text,
  contact_info            text,
  payment_terms           text,
  credit_days             int,
  freight_charges         numeric NOT NULL DEFAULT 0,
  advance_received        numeric NOT NULL DEFAULT 0,
  expected_delivery_date  date,
  delivery_terms          text,
  transport_mode          text,
  delivery_location       text,
  status                  text NOT NULL DEFAULT 'DRAFT',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  po_id           uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_name    text,
  hsn             text,
  uom             text,
  qty             numeric,
  rate            numeric,
  discount        numeric NOT NULL DEFAULT 0,
  discount_type   text,
  gst_pct         numeric,
  total           numeric,
  sort_order      int NOT NULL DEFAULT 0
);

-- ============================================================
--  PROFORMAS
-- ============================================================

CREATE TABLE IF NOT EXISTS proformas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  proforma_ref    text,
  date            date,
  customer_id     uuid REFERENCES customers(id),
  sales_order_id  uuid REFERENCES sales_orders(id),
  bill_to         jsonb,
  ship_to         jsonb,
  freight_charges numeric NOT NULL DEFAULT 0,
  packing_charges numeric NOT NULL DEFAULT 0,
  other_charges   numeric NOT NULL DEFAULT 0,
  payment_terms   text,
  validity        text,
  status          text NOT NULL DEFAULT 'Draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proforma_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  proforma_id     uuid NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
  particulars     text,
  hsn             text,
  uom             text,
  qty             numeric,
  rate            numeric,
  amount          numeric,
  sort_order      int NOT NULL DEFAULT 0
);

-- ============================================================
--  INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  invoice_no          text,
  invoice_date        date,
  due_date            date,
  order_ref_no        text,
  internal_ref_no     text,
  eway_bill_no        text,
  supply_type         text,
  supply_state_code   text,
  place_of_supply     text,
  customer_id         uuid REFERENCES customers(id),
  bill_to             jsonb,
  ship_to             jsonb,
  sub_total_1         numeric NOT NULL DEFAULT 0,
  packing_charges     numeric NOT NULL DEFAULT 0,
  freight_charges     numeric NOT NULL DEFAULT 0,
  other_charges       numeric NOT NULL DEFAULT 0,
  cgst                numeric NOT NULL DEFAULT 0,
  sgst                numeric NOT NULL DEFAULT 0,
  igst                numeric NOT NULL DEFAULT 0,
  sub_total_2         numeric NOT NULL DEFAULT 0,
  round_off           numeric NOT NULL DEFAULT 0,
  grand_total         numeric NOT NULL DEFAULT 0,
  amount_in_words     text,
  transport           jsonb,
  payment_terms       text,
  remarks             text,
  status              text NOT NULL DEFAULT 'Pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  invoice_id      uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  sr_no           int,
  particulars     text,
  hsn             text,
  uom             text,
  qty             numeric,
  rate            numeric,
  amount          numeric,
  sort_order      int NOT NULL DEFAULT 0
);

-- ============================================================
--  PAYMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  payment_ref         text,
  customer_id         uuid REFERENCES customers(id),
  customer_name       text,
  invoice_id          uuid REFERENCES invoices(id),
  invoice_no          text,
  invoice_amount      numeric NOT NULL DEFAULT 0,
  amount              numeric NOT NULL DEFAULT 0,
  outstanding_before  numeric NOT NULL DEFAULT 0,
  outstanding_after   numeric NOT NULL DEFAULT 0,
  date                date,
  status              text NOT NULL DEFAULT 'Pending',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  REMINDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  date            date NOT NULL,
  time            text,
  type            text NOT NULL,
  name            text,
  mobile          text,
  reference_id    uuid,
  reference_type  text,
  note            text,
  source          text NOT NULL DEFAULT 'manual',
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminder_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  reminder_id     uuid NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  old_status      text,
  new_status      text,
  note            text,
  changed_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  DOCUMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  category        text,
  material        text,
  tags            text,
  file_name       text,
  file_type       text,
  file_size       int,
  file_data       text,  -- base64 for now; migrate to storage_path later
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
--  INDEXES  (most useful ones for list/search queries)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_customers_org        ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org          ON vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_org        ON inquiries(org_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_customer   ON inquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_offers_inquiry       ON offers(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_offers_org           ON offers(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_org     ON sales_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_cust    ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org  ON purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org         ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer    ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_org         ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice     ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_org        ON reminders(org_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date       ON reminders(date);
CREATE INDEX IF NOT EXISTS idx_documents_org        ON documents(org_id);
