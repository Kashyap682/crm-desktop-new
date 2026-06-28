-- ============================================================
--  Sample Data for CRM Testing
-- ============================================================

-- Fix: inventory table is missing columns the app uses
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS location        text,
  ADD COLUMN IF NOT EXISTS display_name    text,
  ADD COLUMN IF NOT EXISTS quantity        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_rate   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price           numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst             numeric NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS weight          numeric,
  ADD COLUMN IF NOT EXISTS packing         text,
  ADD COLUMN IF NOT EXISTS number_of_units numeric,
  ADD COLUMN IF NOT EXISTS product_make    text,
  ADD COLUMN IF NOT EXISTS vendor_name     text,
  ADD COLUMN IF NOT EXISTS thickness       text,
  ADD COLUMN IF NOT EXISTS density         text,
  ADD COLUMN IF NOT EXISTS fsk             text,
  ADD COLUMN IF NOT EXISTS alloy           text,
  ADD COLUMN IF NOT EXISTS size            text,
  ADD COLUMN IF NOT EXISTS product_id      text,
  ADD COLUMN IF NOT EXISTS attachment      text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

DO $$
DECLARE
  org  uuid := '00000000-0000-0000-0000-000000000001';
  c1   uuid := gen_random_uuid();
  c2   uuid := gen_random_uuid();
  c3   uuid := gen_random_uuid();
  v1   uuid := gen_random_uuid();
  v2   uuid := gen_random_uuid();
  inq1 uuid := gen_random_uuid();
  so1  uuid := gen_random_uuid();
BEGIN

-- ============================================================
--  CUSTOMERS
-- ============================================================

INSERT INTO customers (id, org_id, customer_ref, customer_type, company_name, name, email, mobile,
  pan, msme, office_address, billing, primary_contact, product_materials)
VALUES (
  c1, org, 'CUST-001', 'Domestic', 'Tata Steel Ltd', 'Tata Steel',
  'procurement@tatasteel.com', '+91-9876543210',
  'AAACT2727Q', 'UDYAM-MH-12-0012345',
  '{"line1":"Bombay House, 24 Homi Mody St","city":"Mumbai","state":"Maharashtra","pincode":"400001","country":"India","gstin":"27AAACT2727Q1ZV","gstVerified":true}'::jsonb,
  '{"line1":"Bombay House, 24 Homi Mody St","city":"Mumbai","state":"Maharashtra","pincode":"400001","country":"India","gstin":"27AAACT2727Q1ZV"}'::jsonb,
  '{"title":"Mr","firstName":"Rajesh","lastName":"Sharma","mobile":"+91-9876543210","email":"rajesh.sharma@tatasteel.com"}'::jsonb,
  '[{"material":"HR Coil","make":"Tata"},{"material":"CR Sheet","make":"Tata"}]'::jsonb
),(
  c2, org, 'CUST-002', 'Domestic', 'Larsen & Toubro Ltd', 'L&T',
  'purchase@lnt.com', '+91-9988776655',
  'AAACL0406C', 'UDYAM-GJ-01-0054321',
  '{"line1":"L&T House, Ballard Estate","city":"Mumbai","state":"Maharashtra","pincode":"400001","country":"India","gstin":"27AAACL0406C1ZM","gstVerified":true}'::jsonb,
  '{"line1":"L&T House, Ballard Estate","city":"Mumbai","state":"Maharashtra","pincode":"400001","country":"India","gstin":"27AAACL0406C1ZM"}'::jsonb,
  '{"title":"Ms","firstName":"Priya","lastName":"Mehta","mobile":"+91-9988776655","email":"priya.mehta@lnt.com"}'::jsonb,
  '[{"material":"Stainless Steel Pipe","make":"Jindal"},{"material":"Aluminium Sheet","make":"Hindalco"}]'::jsonb
),(
  c3, org, 'CUST-003', 'Export', 'Gulf Industries LLC', 'Gulf Industries',
  'orders@gulfindustries.ae', '+971-501234567',
  NULL, NULL,
  '{"line1":"Plot 12, JAFZA","city":"Dubai","state":"Dubai","pincode":"00000","country":"UAE","gstin":"","gstVerified":false}'::jsonb,
  '{"line1":"Plot 12, JAFZA","city":"Dubai","country":"UAE"}'::jsonb,
  '{"title":"Mr","firstName":"Ahmed","lastName":"Al Rashid","mobile":"+971-501234567","email":"ahmed@gulfindustries.ae"}'::jsonb,
  '[{"material":"MS Plate","make":"SAIL"}]'::jsonb
);

-- ============================================================
--  VENDORS
-- ============================================================

INSERT INTO vendors (id, org_id, vendor_ref, vendor_vertical, vendor_type, company_name, brand_name,
  email, mobile, pan, payment_terms, gst, location,
  office_address, primary_contact, products)
VALUES (
  v1, org, 'VEND-001', 'Steel', 'Manufacturer', 'Jindal Steel & Power Ltd', 'Jindal',
  'sales@jindal.com', '+91-9123456780',
  'AAACJ4549L', 'Net 30', '27AAACJ4549L1ZA', 'Mumbai',
  '{"line1":"Jindal Centre, 12 Bhikaiji Cama Place","city":"New Delhi","state":"Delhi","pincode":"110066","country":"India","gstin":"07AAACJ4549L1ZA","contactPerson":"Suresh Kumar","mobile":"+91-9123456780"}'::jsonb,
  '{"title":"Mr","firstName":"Suresh","lastName":"Kumar","mobile":"+91-9123456780","email":"suresh@jindal.com","location":"Delhi"}'::jsonb,
  '["HR Coil","CR Sheet","GP Sheet","GC Sheet","Plates"]'::jsonb
),(
  v2, org, 'VEND-002', 'Aluminium', 'Distributor', 'Hindalco Industries Ltd', 'Hindalco',
  'trade@hindalco.com', '+91-9234567891',
  'AAACH0892R', 'Net 45', '27AAACH0892R1ZP', 'Pune',
  '{"line1":"Century Bhavan, Dr Annie Besant Rd","city":"Mumbai","state":"Maharashtra","pincode":"400030","country":"India","gstin":"27AAACH0892R1ZP","contactPerson":"Anita Desai","mobile":"+91-9234567891"}'::jsonb,
  '{"title":"Ms","firstName":"Anita","lastName":"Desai","mobile":"+91-9234567891","email":"anita@hindalco.com","location":"Mumbai"}'::jsonb,
  '["Aluminium Sheet","Aluminium Coil","Aluminium Plate","Aluminium Extrusion"]'::jsonb
);

-- ============================================================
--  INVENTORY
-- ============================================================

INSERT INTO inventory (id, org_id, name, display_name, category, hsn, uom, location, quantity,
  purchase_rate, price, gst, size, thickness, vendor_name, product_make, stock_qty)
VALUES
  (gen_random_uuid(), org, 'warehouse_hr coil_4x8',      'HR Coil',         'Steel',          '7208', 'MT',  'Warehouse', 15.5,  52000,  55000,  18, '4x8 ft',  '3mm',   'Jindal',   'Jindal',   15.5),
  (gen_random_uuid(), org, 'warehouse_cr sheet_4x8',     'CR Sheet',        'Steel',          '7209', 'MT',  'Warehouse',  8.2,  61000,  65000,  18, '4x8 ft',  '2mm',   'Jindal',   'Jindal',    8.2),
  (gen_random_uuid(), org, 'warehouse_ms plate_nosize',  'MS Plate',        'Steel',          '7208', 'MT',  'Warehouse', 22.0,  58000,  62000,  18, '10x4 ft', '6mm',   'SAIL',     'SAIL',     22.0),
  (gen_random_uuid(), org, 'yard_aluminium sheet_nosize','Aluminium Sheet', 'Aluminium',      '7606', 'MT',  'Yard',       5.0, 185000, 195000,  18, '4x8 ft',  '1.5mm', 'Hindalco', 'Hindalco',  5.0),
  (gen_random_uuid(), org, 'yard_ss pipe_nosize',        'SS Pipe',         'Stainless Steel','7304', 'NOS', 'Yard',     120,      850,    950,  18, '20 ft',   '2mm',   'Jindal',   'Jindal',  120),
  (gen_random_uuid(), org, 'store_gi wire_nosize',       'GI Wire',         'Steel',          '7217', 'KG',  'Store',    500,       95,    110,  18, NULL,      '2mm',   'Jindal',   'Jindal',  500);

-- ============================================================
--  INQUIRY
-- ============================================================

INSERT INTO inquiries (id, org_id, inquiry_ref, date, customer_id, customer_name, company_name,
  customer_phone, email, inquiry_type, status, items, notes)
VALUES (
  inq1, org, 'INQ-001', CURRENT_DATE - 5, c1, 'Rajesh Sharma', 'Tata Steel Ltd',
  '+91-9876543210', 'procurement@tatasteel.com', 'Material Requirement', 'open',
  '[{"productName":"HR Coil","make":"Jindal","hsn":"7208","qty":10,"uom":"MT","thickness":"3mm","size":"4x8 ft"},{"productName":"CR Sheet","make":"Jindal","hsn":"7209","qty":5,"uom":"MT","thickness":"2mm","size":"4x8 ft"}]'::jsonb,
  'Urgent requirement for Q3 production schedule'
);

-- ============================================================
--  SALES ORDER
-- ============================================================

INSERT INTO sales_orders (id, org_id, order_ref, order_date, customer_id, customer_name, company_name,
  inquiry_id, bill_addr, ship_addr, gst_no, contact_person, contact_no, payment_terms, credit_days,
  po_no, po_date, expected_delivery_date, delivery_terms, gst_type, status, items, grand_total)
VALUES (
  so1, org, 'SO-001', CURRENT_DATE - 2, c1, 'Rajesh Sharma', 'Tata Steel Ltd',
  inq1,
  'Bombay House, 24 Homi Mody St, Mumbai - 400001',
  'Bombay House, 24 Homi Mody St, Mumbai - 400001',
  '27AAACT2727Q1ZV', 'Rajesh Sharma', '+91-9876543210',
  'Net 30', 30, 'PO-TS-2024-892', CURRENT_DATE - 3,
  CURRENT_DATE + 15, 'Ex-Works', 'IGST', 'APPROVED',
  '[{"productName":"HR Coil","hsn":"7208","uom":"MT","qty":10,"rate":55000,"gstPct":18,"total":550000},{"productName":"CR Sheet","hsn":"7209","uom":"MT","qty":5,"rate":65000,"gstPct":18,"total":325000}]'::jsonb,
  1035750
);

END $$;
