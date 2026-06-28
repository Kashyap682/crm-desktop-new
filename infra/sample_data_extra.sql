-- ============================================================
--  Extra Test Data — comprehensive coverage of all modules
-- ============================================================

DO $$
DECLARE
  org  uuid := '00000000-0000-0000-0000-000000000001';

  -- Additional customers
  c4   uuid := gen_random_uuid();
  c5   uuid := gen_random_uuid();
  c6   uuid := gen_random_uuid();
  c7   uuid := gen_random_uuid();
  c8   uuid := gen_random_uuid();

  -- Additional vendors
  v3   uuid := gen_random_uuid();
  v4   uuid := gen_random_uuid();
  v5   uuid := gen_random_uuid();

  -- Existing customers (re-declare to use in FKs)
  c1   uuid;
  c2   uuid;
  c3   uuid;
  v1   uuid;
  v2   uuid;

  -- Inquiries
  inq2 uuid := gen_random_uuid();
  inq3 uuid := gen_random_uuid();
  inq4 uuid := gen_random_uuid();
  inq5 uuid := gen_random_uuid();
  inq6 uuid := gen_random_uuid();

  -- Offers
  off1 uuid := gen_random_uuid();
  off2 uuid := gen_random_uuid();
  off3 uuid := gen_random_uuid();

  -- Sales orders
  so2  uuid := gen_random_uuid();
  so3  uuid := gen_random_uuid();
  so4  uuid := gen_random_uuid();

  -- Purchase orders
  po1  uuid := gen_random_uuid();
  po2  uuid := gen_random_uuid();

  -- Proformas
  pf1  uuid := gen_random_uuid();
  pf2  uuid := gen_random_uuid();

  -- Invoices
  inv1 uuid := gen_random_uuid();
  inv2 uuid := gen_random_uuid();
  inv3 uuid := gen_random_uuid();

  -- RFQs
  rfq1 uuid := gen_random_uuid();
  rfq2 uuid := gen_random_uuid();

BEGIN

-- Resolve existing customer/vendor IDs
SELECT id INTO c1 FROM customers WHERE customer_ref = 'CUST-001' LIMIT 1;
SELECT id INTO c2 FROM customers WHERE customer_ref = 'CUST-002' LIMIT 1;
SELECT id INTO c3 FROM customers WHERE customer_ref = 'CUST-003' LIMIT 1;
SELECT id INTO v1 FROM vendors WHERE vendor_ref = 'VEND-001' LIMIT 1;
SELECT id INTO v2 FROM vendors WHERE vendor_ref = 'VEND-002' LIMIT 1;

-- ============================================================
--  CUSTOMERS (5 more)
-- ============================================================

INSERT INTO customers (id, org_id, customer_ref, customer_type, company_name, name, email, mobile,
  pan, msme, office_address, billing, shipping_addresses, primary_contact, secondary_contact, product_materials)
VALUES
(
  c4, org, 'CUST-004', 'Domestic', 'Bharat Heavy Electricals Ltd', 'BHEL',
  'procurement@bhel.in', '+91-9112233445',
  'AAACB1534F', NULL,
  '{"line1":"BHEL House, Siri Fort","city":"New Delhi","state":"Delhi","pincode":"110049","country":"India","gstin":"07AAACB1534F1ZI","gstVerified":true}'::jsonb,
  '{"line1":"BHEL House, Siri Fort","city":"New Delhi","state":"Delhi","pincode":"110049","country":"India","gstin":"07AAACB1534F1ZI"}'::jsonb,
  '[{"line1":"Plot 25, BHEL Complex","city":"Haridwar","state":"Uttarakhand","pincode":"249403","country":"India","gstin":"05AAACB1534F2ZH"}]'::jsonb,
  '{"title":"Mr","firstName":"Vinod","lastName":"Kapoor","mobile":"+91-9112233445","email":"vinod.kapoor@bhel.in"}'::jsonb,
  '{"title":"Ms","firstName":"Sunita","lastName":"Rao","mobile":"+91-9223344556","email":"sunita.rao@bhel.in"}'::jsonb,
  '[{"material":"Copper Bus Bar","make":"Hindalco"},{"material":"SS Plate","make":"Jindal"}]'::jsonb
),(
  c5, org, 'CUST-005', 'Domestic', 'Reliance Industries Ltd', 'Reliance',
  'buy@ril.com', '+91-9334455667',
  'AAACR0541M', 'UDYAM-GJ-02-0098765',
  '{"line1":"Maker Chambers IV, Nariman Point","city":"Mumbai","state":"Maharashtra","pincode":"400021","country":"India","gstin":"27AAACR0541M1ZO","gstVerified":true}'::jsonb,
  '{"line1":"Maker Chambers IV, Nariman Point","city":"Mumbai","state":"Maharashtra","pincode":"400021","country":"India","gstin":"27AAACR0541M1ZO"}'::jsonb,
  NULL,
  '{"title":"Mr","firstName":"Amit","lastName":"Patel","mobile":"+91-9334455667","email":"amit.patel@ril.com"}'::jsonb,
  NULL,
  '[{"material":"Pipeline Grade MS","make":"SAIL"},{"material":"Insulation Sheet","make":"Rockwool"}]'::jsonb
),(
  c6, org, 'CUST-006', 'Export', 'Al Futtaim Engineering', 'Al Futtaim',
  'sourcing@alfuttaim.ae', '+971-502345678',
  NULL, NULL,
  '{"line1":"Festival City, Al Rashidiya","city":"Dubai","state":"Dubai","pincode":"00000","country":"UAE","gstin":"","gstVerified":false}'::jsonb,
  '{"line1":"Festival City, Al Rashidiya","city":"Dubai","country":"UAE"}'::jsonb,
  NULL,
  '{"title":"Mr","firstName":"Khalid","lastName":"Al Futtaim","mobile":"+971-502345678","email":"khalid@alfuttaim.ae"}'::jsonb,
  NULL,
  '[{"material":"Stainless Steel Sheet","make":"Jindal"},{"material":"Aluminium Extrusion","make":"Hindalco"}]'::jsonb
),(
  c7, org, 'CUST-007', 'Domestic', 'Indian Oil Corporation Ltd', 'IOCL',
  'mm@iocl.com', '+91-9445566778',
  'AAACI1679L', NULL,
  '{"line1":"IndianOil Bhavan, Yusuf Sarai","city":"New Delhi","state":"Delhi","pincode":"110016","country":"India","gstin":"07AAACI1679L1ZR","gstVerified":true}'::jsonb,
  '{"line1":"IndianOil Bhavan, Yusuf Sarai","city":"New Delhi","state":"Delhi","pincode":"110016","country":"India","gstin":"07AAACI1679L1ZR"}'::jsonb,
  NULL,
  '{"title":"Mr","firstName":"Ramesh","lastName":"Nair","mobile":"+91-9445566778","email":"ramesh.nair@iocl.com"}'::jsonb,
  NULL,
  '[{"material":"CS Pipe","make":"APL Apollo"},{"material":"MS Flange","make":"SAIL"}]'::jsonb
),(
  c8, org, 'CUST-008', 'Domestic', 'Adani Ports & SEZ Ltd', 'Adani Ports',
  'procurement@adaniports.com', '+91-9556677889',
  'AAACA5745C', 'UDYAM-GJ-05-0011223',
  '{"line1":"Adani Corporate House, Shantigram","city":"Ahmedabad","state":"Gujarat","pincode":"382421","country":"India","gstin":"24AAACA5745C1Z4","gstVerified":true}'::jsonb,
  '{"line1":"Adani Corporate House, Shantigram","city":"Ahmedabad","state":"Gujarat","pincode":"382421","country":"India","gstin":"24AAACA5745C1Z4"}'::jsonb,
  NULL,
  '{"title":"Ms","firstName":"Meera","lastName":"Shah","mobile":"+91-9556677889","email":"meera.shah@adaniports.com"}'::jsonb,
  NULL,
  '[{"material":"MS Plate","make":"SAIL"},{"material":"Chequered Plate","make":"Jindal"}]'::jsonb
);

-- ============================================================
--  VENDORS (3 more)
-- ============================================================

INSERT INTO vendors (id, org_id, vendor_ref, vendor_vertical, vendor_type, company_name, brand_name,
  email, mobile, pan, payment_terms, gst, location,
  office_address, primary_contact, products)
VALUES
(
  v3, org, 'VEND-003', 'Steel', 'Distributor', 'SAIL Steel Authority of India', 'SAIL',
  'sales@sail.in', '+91-9312345678',
  'AAACS4398N', 'Net 60', '07AAACS4398N1ZF', 'Delhi',
  '{"line1":"Ispat Bhavan, Lodhi Road","city":"New Delhi","state":"Delhi","pincode":"110003","country":"India","gstin":"07AAACS4398N1ZF","contactPerson":"Mohan Verma","mobile":"+91-9312345678"}'::jsonb,
  '{"title":"Mr","firstName":"Mohan","lastName":"Verma","mobile":"+91-9312345678","email":"mohan@sail.in","location":"Delhi"}'::jsonb,
  '["MS Plate","HR Coil","Chequered Plate","Structural Steel","Angle Iron"]'::jsonb
),(
  v4, org, 'VEND-004', 'Pipe & Fittings', 'Manufacturer', 'APL Apollo Tubes Ltd', 'APL Apollo',
  'sales@aplacollc.com', '+91-9423456789',
  'AAACD0406C', 'Net 30', '07AAACD0406C1ZM', 'Ghaziabad',
  '{"line1":"37 KM, Delhi-Meerut Expressway","city":"Ghaziabad","state":"Uttar Pradesh","pincode":"201003","country":"India","gstin":"09AAACD0406C1ZM","contactPerson":"Deepak Singh","mobile":"+91-9423456789"}'::jsonb,
  '{"title":"Mr","firstName":"Deepak","lastName":"Singh","mobile":"+91-9423456789","email":"deepak@apoll.com","location":"Ghaziabad"}'::jsonb,
  '["CS Pipe","MS Hollow Section","Square Tube","Rectangular Tube","Round Tube"]'::jsonb
),(
  v5, org, 'VEND-005', 'Insulation', 'Distributor', 'Rockwool India Pvt Ltd', 'Rockwool',
  'info@rockwool.in', '+91-9534567890',
  'AAACR2658P', 'Advance', '27AAACR2658P1ZK', 'Mumbai',
  '{"line1":"Marathon Futurex, NM Joshi Marg","city":"Mumbai","state":"Maharashtra","pincode":"400013","country":"India","gstin":"27AAACR2658P1ZK","contactPerson":"Kavita Joshi","mobile":"+91-9534567890"}'::jsonb,
  '{"title":"Ms","firstName":"Kavita","lastName":"Joshi","mobile":"+91-9534567890","email":"kavita@rockwool.in","location":"Mumbai"}'::jsonb,
  '["Rockwool Slab","Mineral Wool Blanket","Pipe Section Insulation","Acoustic Panel"]'::jsonb
);

-- ============================================================
--  INVENTORY (10 more items)
-- ============================================================

INSERT INTO inventory (id, org_id, name, display_name, category, hsn, uom, location, quantity,
  purchase_rate, price, gst, size, thickness, vendor_name, product_make, stock_qty)
VALUES
  (gen_random_uuid(), org, 'warehouse_gp sheet_nosize',       'GP Sheet',           'Steel',          '7210', 'MT',  'Warehouse',  6.5,  68000,  72000, 18, '4x8 ft',  '0.5mm', 'Jindal',    'Jindal',    6.5),
  (gen_random_uuid(), org, 'warehouse_chequered plate_nosize','Chequered Plate',    'Steel',          '7208', 'MT',  'Warehouse',  3.8,  72000,  78000, 18, '4x8 ft',  '5mm',   'SAIL',      'SAIL',      3.8),
  (gen_random_uuid(), org, 'warehouse_angle iron_nosize',     'Angle Iron',         'Steel',          '7216', 'MT',  'Warehouse', 12.0,  55000,  60000, 18, '40x40mm', '5mm',   'SAIL',      'SAIL',     12.0),
  (gen_random_uuid(), org, 'yard_cs pipe_nosize',             'CS Pipe',            'Pipe & Fittings','7304', 'NOS', 'Yard',       80,    1200,   1400, 18, '6m',      '4mm',   'APL Apollo','APL Apollo', 80),
  (gen_random_uuid(), org, 'yard_ms hollow section_nosize',   'MS Hollow Section',  'Pipe & Fittings','7306', 'NOS', 'Yard',       60,     850,    980, 18, '6m 50x50','2.5mm', 'APL Apollo','APL Apollo', 60),
  (gen_random_uuid(), org, 'store_copper busbar_nosize',      'Copper Bus Bar',     'Non-Ferrous',    '7407', 'KG',  'Store',     200,    700,    820, 18, '6m',      '6mm',   'Hindalco',  'Hindalco',  200),
  (gen_random_uuid(), org, 'store_aluminium coil_nosize',     'Aluminium Coil',     'Aluminium',      '7607', 'MT',  'Store',      4.2, 195000, 210000, 18, '1000mm',  '1mm',   'Hindalco',  'Hindalco',   4.2),
  (gen_random_uuid(), org, 'store_rockwool slab_nosize',      'Rockwool Slab',      'Insulation',     '6806', 'SQM', 'Store',     500,     280,    350, 18, '1200x600','50mm',  'Rockwool',  'Rockwool',  500),
  (gen_random_uuid(), org, 'warehouse_ss sheet_nosize',       'SS Sheet 304',       'Stainless Steel','7219', 'MT',  'Warehouse',  2.5, 250000, 275000, 18, '4x8 ft',  '2mm',   'Jindal',    'Jindal',     2.5),
  (gen_random_uuid(), org, 'store_ms flange_nosize',          'MS Flange',          'Pipe & Fittings','7307', 'NOS', 'Store',     150,     450,    550, 18, 'DN50',    '12mm',  'SAIL',      'SAIL',      150);

-- ============================================================
--  INQUIRIES (5 more — varied statuses)
-- ============================================================

INSERT INTO inquiries (id, org_id, inquiry_ref, date, customer_id, customer_name, company_name,
  customer_phone, email, inquiry_type, status, items, notes, follow_ups)
VALUES
(
  inq2, org, 'INQ-002', CURRENT_DATE - 12, c2, 'Priya Mehta', 'Larsen & Toubro Ltd',
  '+91-9988776655', 'purchase@lnt.com', 'Material Requirement', 'open',
  '[{"productName":"SS Pipe","make":"Jindal","hsn":"7304","qty":50,"uom":"NOS","thickness":"2mm","size":"20 ft"},{"productName":"Aluminium Sheet","make":"Hindalco","hsn":"7606","qty":3,"uom":"MT","thickness":"1.5mm","size":"4x8 ft"}]'::jsonb,
  'For Navi Mumbai plant expansion',
  jsonb_build_array(
    jsonb_build_object('date', TO_CHAR(CURRENT_DATE - 8, 'DD/MM/YYYY'), 'note', 'Customer confirmed requirement, awaiting PO'),
    jsonb_build_object('date', TO_CHAR(CURRENT_DATE - 3, 'DD/MM/YYYY'), 'note', 'Follow-up done, PO expected by end of week')
  )
),(
  inq3, org, 'INQ-003', CURRENT_DATE - 20, c4, 'Vinod Kapoor', 'Bharat Heavy Electricals Ltd',
  '+91-9112233445', 'procurement@bhel.in', 'Spot Purchase', 'open',
  '[{"productName":"Copper Bus Bar","make":"Hindalco","hsn":"7407","qty":150,"uom":"KG"},{"productName":"SS Plate","make":"Jindal","hsn":"7219","qty":1.5,"uom":"MT","thickness":"2mm"}]'::jsonb,
  'Urgent requirement for transformer manufacturing',
  jsonb_build_array(
    jsonb_build_object('date', TO_CHAR(CURRENT_DATE - 15, 'DD/MM/YYYY'), 'note', 'Initial discussion done'),
    jsonb_build_object('date', TO_CHAR(CURRENT_DATE - 7, 'DD/MM/YYYY'), 'note', 'Samples approved, finalising qty')
  )
),(
  inq4, org, 'INQ-004', CURRENT_DATE - 30, c5, 'Amit Patel', 'Reliance Industries Ltd',
  '+91-9334455667', 'buy@ril.com', 'Annual Rate Contract', 'open',
  '[{"productName":"CS Pipe","make":"APL Apollo","hsn":"7304","qty":200,"uom":"NOS","size":"6m"},{"productName":"MS Flange","make":"SAIL","hsn":"7307","qty":400,"uom":"NOS","size":"DN50"}]'::jsonb,
  'Annual supply contract for Jamnagar refinery',
  NULL
),(
  inq5, org, 'INQ-005', CURRENT_DATE - 45, c7, 'Ramesh Nair', 'Indian Oil Corporation Ltd',
  '+91-9445566778', 'mm@iocl.com', 'Material Requirement', 'lost',
  '[{"productName":"MS Plate","make":"SAIL","hsn":"7208","qty":50,"uom":"MT","thickness":"6mm"}]'::jsonb,
  'Panipat refinery maintenance',
  NULL
),(
  inq6, org, 'INQ-006', CURRENT_DATE - 8, c6, 'Khalid Al Futtaim', 'Al Futtaim Engineering',
  '+971-502345678', 'sourcing@alfuttaim.ae', 'Export Inquiry', 'open',
  '[{"productName":"SS Sheet 304","make":"Jindal","hsn":"7219","qty":2,"uom":"MT","thickness":"2mm","size":"4x8 ft"},{"productName":"Aluminium Extrusion","make":"Hindalco","hsn":"7607","qty":500,"uom":"KG"}]'::jsonb,
  'For hotel fit-out project in Dubai Mall',
  NULL
);

-- Mark INQ-005 as lost
UPDATE inquiries SET
  status = 'lost',
  decision = 'lost',
  lost_reason = 'Price',
  lost_remarks = 'Competitor quoted 8% lower — unable to match',
  lost_date = CURRENT_DATE - 38
WHERE id = inq5;

-- ============================================================
--  OFFERS (3)
-- ============================================================

INSERT INTO offers (id, org_id, offer_ref, inquiry_id, customer_id, date, subject,
  delivery_terms, payment_terms, validity, taxes, freight, status, items)
VALUES
(
  off1, org, 'OFF-001', inq2, c2, CURRENT_DATE - 10,
  'Offer for SS Pipe & Aluminium Sheet — L&T Navi Mumbai',
  'Ex-Works Mumbai', 'Net 30 days', '15 Days', 'GST 18% extra', 'Extra at actuals', 'active',
  '[{"material":"SS Pipe 2mm 20ft","density":"","thickness":"2mm","size":"20 ft","quantity":"50 NOS","rate":"₹950/NOS"},{"material":"Aluminium Sheet 1.5mm 4x8ft","density":"","thickness":"1.5mm","size":"4x8 ft","quantity":"3 MT","rate":"₹1,95,000/MT"}]'::jsonb
),(
  off2, org, 'OFF-002', inq3, c4, CURRENT_DATE - 18,
  'Offer for Copper Bus Bar & SS Plate — BHEL',
  'Delivered Haridwar', 'Advance 50%, balance on delivery', '10 Days', 'GST 18% extra', 'Included', 'active',
  '[{"material":"Copper Bus Bar 6mm","density":"","thickness":"6mm","size":"6m","quantity":"150 KG","rate":"₹820/KG"},{"material":"SS Plate 304 2mm","density":"","thickness":"2mm","size":"4x8 ft","quantity":"1.5 MT","rate":"₹2,75,000/MT"}]'::jsonb
),(
  off3, org, 'OFF-003', inq4, c5, CURRENT_DATE - 25,
  'Annual Rate Contract — CS Pipe & MS Flange — RIL Jamnagar',
  'Delivered Jamnagar', 'Net 45 days', '30 Days', 'GST 18% extra', 'Extra at actuals', 'pending',
  '[{"material":"CS Pipe 4mm 6m","density":"","thickness":"4mm","size":"6m","quantity":"200 NOS","rate":"₹1,400/NOS"},{"material":"MS Flange DN50","density":"","thickness":"12mm","size":"DN50","quantity":"400 NOS","rate":"₹550/NOS"}]'::jsonb
);

-- ============================================================
--  RFQs (2)
-- ============================================================

INSERT INTO rfqs (id, org_id, rfq_ref, rfq_date, inquiry_id, vendor_id, vendor_name,
  contact_first_name, contact_last_name, mobile, email, status, items)
VALUES
(
  rfq1, org, 'RFQ-001', CURRENT_DATE - 11, inq2, v1, 'Jindal Steel & Power Ltd',
  'Suresh', 'Kumar', '+91-9123456780', 'suresh@jindal.com', 'SENT',
  '[{"product":"SS Pipe","form":"Pipe","make":"Jindal","thickness":"2mm","size":"20 ft","qty":50,"uom":"NOS"},{"product":"Aluminium Sheet","form":"Sheet","make":"Hindalco","thickness":"1.5mm","size":"4x8 ft","qty":3,"uom":"MT"}]'::jsonb
),(
  rfq2, org, 'RFQ-002', CURRENT_DATE - 17, inq3, v2, 'Hindalco Industries Ltd',
  'Anita', 'Desai', '+91-9234567891', 'anita@hindalco.com', 'DRAFT',
  '[{"product":"Copper Bus Bar","form":"Bar","make":"Hindalco","thickness":"6mm","size":"6m","qty":150,"uom":"KG"}]'::jsonb
);

-- ============================================================
--  SALES ORDERS (3 more — different statuses)
-- ============================================================

INSERT INTO sales_orders (id, org_id, order_ref, order_date, customer_id, customer_name, company_name,
  bill_addr, ship_addr, gst_no, contact_person, contact_no, payment_terms, credit_days,
  po_no, po_date, expected_delivery_date, delivery_terms, gst_type, status, items, grand_total)
VALUES
(
  so2, org, 'SO-002', CURRENT_DATE - 8, c2, 'Priya Mehta', 'Larsen & Toubro Ltd',
  'L&T House, Ballard Estate, Mumbai - 400001',
  'L&T Plant, Mahape, Navi Mumbai - 400709',
  '27AAACL0406C1ZM', 'Priya Mehta', '+91-9988776655',
  'Net 30', 30, 'PO-LT-2024-445', CURRENT_DATE - 9,
  CURRENT_DATE + 10, 'Delivered', 'IGST', 'SUBMITTED',
  '[{"productName":"SS Pipe","hsn":"7304","uom":"NOS","qty":50,"rate":950,"gstPct":18,"total":47500},{"productName":"Aluminium Sheet","hsn":"7606","uom":"MT","qty":3,"rate":195000,"gstPct":18,"total":585000}]'::jsonb,
  743450
),(
  so3, org, 'SO-003', CURRENT_DATE - 3, c4, 'Vinod Kapoor', 'Bharat Heavy Electricals Ltd',
  'BHEL House, Siri Fort, New Delhi - 110049',
  'BHEL Plant, Haridwar - 249403',
  '07AAACB1534F1ZI', 'Vinod Kapoor', '+91-9112233445',
  'Advance 50%, balance on delivery', 0, 'PO-BHEL-2024-1123', CURRENT_DATE - 4,
  CURRENT_DATE + 7, 'Delivered Haridwar', 'IGST', 'APPROVED',
  '[{"productName":"Copper Bus Bar","hsn":"7407","uom":"KG","qty":150,"rate":820,"gstPct":18,"total":123000},{"productName":"SS Sheet 304","hsn":"7219","uom":"MT","qty":1.5,"rate":275000,"gstPct":18,"total":412500}]'::jsonb,
  630270
),(
  so4, org, 'SO-004', CURRENT_DATE, c8, 'Meera Shah', 'Adani Ports & SEZ Ltd',
  'Adani Corporate House, Ahmedabad - 382421',
  'Mundra Port, Kutch - 370421',
  '24AAACA5745C1Z4', 'Meera Shah', '+91-9556677889',
  'Net 45', 45, NULL, NULL,
  CURRENT_DATE + 21, 'Ex-Works', 'IGST', 'DRAFT',
  '[{"productName":"MS Plate","hsn":"7208","uom":"MT","qty":20,"rate":62000,"gstPct":18,"total":1240000},{"productName":"Chequered Plate","hsn":"7208","uom":"MT","qty":5,"rate":78000,"gstPct":18,"total":390000}]'::jsonb,
  1921200
);

-- ============================================================
--  PURCHASE ORDERS (2)
-- ============================================================

INSERT INTO purchase_orders (id, org_id, po_ref, po_date, vendor_id, vendor_name,
  billing_address, delivery_address, contact_person, contact_info, payment_terms, credit_days,
  expected_delivery_date, delivery_terms, status, items, grand_total)
VALUES
(
  po1, org, 'PO-001', CURRENT_DATE - 6, v1, 'Jindal Steel & Power Ltd',
  'Navbharat Group, Mumbai',
  'Warehouse, MIDC Andheri, Mumbai - 400093',
  'Suresh Kumar', '+91-9123456780', 'Net 30', 30,
  CURRENT_DATE + 14, 'Ex-Works Delhi', 'APPROVED',
  '[{"productName":"SS Pipe 2mm","hsn":"7304","uom":"NOS","qty":50,"rate":850,"gstPct":18,"total":42500},{"productName":"HR Coil 3mm","hsn":"7208","uom":"MT","qty":10,"rate":52000,"gstPct":18,"total":520000}]'::jsonb,
  662050
),(
  po2, org, 'PO-002', CURRENT_DATE - 1, v2, 'Hindalco Industries Ltd',
  'Navbharat Group, Mumbai',
  'Warehouse, MIDC Andheri, Mumbai - 400093',
  'Anita Desai', '+91-9234567891', 'Net 45', 45,
  CURRENT_DATE + 20, 'Delivered Mumbai', 'DRAFT',
  '[{"productName":"Aluminium Sheet 1.5mm","hsn":"7606","uom":"MT","qty":3,"rate":185000,"gstPct":18,"total":555000},{"productName":"Copper Bus Bar","hsn":"7407","uom":"KG","qty":100,"rate":700,"gstPct":18,"total":70000}]'::jsonb,
  737450
);

-- ============================================================
--  PROFORMA INVOICES (2)
-- ============================================================

INSERT INTO proformas (id, org_id, proforma_ref, date, customer_id, status,
  bill_to, ship_to, freight_charges, payment_terms, validity, items)
VALUES
(
  pf1, org, 'PI-001', CURRENT_DATE - 5, c1, 'Sent',
  '{"name":"Tata Steel Ltd","address":"Bombay House, 24 Homi Mody St, Mumbai 400001","gstin":"27AAACT2727Q1ZV"}'::jsonb,
  '{"name":"Tata Steel Ltd","address":"Bombay House, 24 Homi Mody St, Mumbai 400001","gstin":"27AAACT2727Q1ZV"}'::jsonb,
  2500,
  'Net 30 days',
  '15 Days',
  '[{"particulars":"HR Coil 3mm 4x8ft","hsn":"7208","uom":"MT","qty":10,"rate":55000,"amount":550000},{"particulars":"CR Sheet 2mm 4x8ft","hsn":"7209","uom":"MT","qty":5,"rate":65000,"amount":325000}]'::jsonb
),(
  pf2, org, 'PI-002', CURRENT_DATE - 2, c4, 'Draft',
  '{"name":"BHEL","address":"BHEL House, Siri Fort, New Delhi 110049","gstin":"07AAACB1534F1ZI"}'::jsonb,
  '{"name":"BHEL Plant","address":"BHEL Complex, Haridwar 249403","gstin":"05AAACB1534F2ZH"}'::jsonb,
  3500,
  'Advance 50%, balance on delivery',
  '10 Days',
  '[{"particulars":"Copper Bus Bar 6mm","hsn":"7407","uom":"KG","qty":150,"rate":820,"amount":123000},{"particulars":"SS Sheet 304 2mm","hsn":"7219","uom":"MT","qty":1.5,"rate":275000,"amount":412500}]'::jsonb
);

-- ============================================================
--  INVOICES (3)
-- ============================================================

INSERT INTO invoices (id, org_id, invoice_no, invoice_date, due_date, customer_id,
  supply_type, place_of_supply,
  bill_to, ship_to,
  sub_total_1, igst, sub_total_2, grand_total, round_off,
  payment_terms, status, items)
VALUES
(
  inv1, org, 'INV-001', CURRENT_DATE - 15, CURRENT_DATE + 15, c1,
  'Outward', 'Maharashtra',
  '{"name":"Tata Steel Ltd","address":"Bombay House, 24 Homi Mody St, Mumbai 400001","gstin":"27AAACT2727Q1ZV"}'::jsonb,
  '{"name":"Tata Steel Ltd","address":"Bombay House, 24 Homi Mody St, Mumbai 400001","gstin":"27AAACT2727Q1ZV"}'::jsonb,
  875000, 157500, 1032500, 1035000, 500,
  'Net 30', 'Pending',
  '[{"srNo":1,"particulars":"HR Coil 3mm 4x8ft","hsn":"7208","uom":"MT","qty":10,"rate":55000,"amount":550000},{"srNo":2,"particulars":"CR Sheet 2mm 4x8ft","hsn":"7209","uom":"MT","qty":5,"rate":65000,"amount":325000}]'::jsonb
),(
  inv2, org, 'INV-002', CURRENT_DATE - 35, CURRENT_DATE - 5, c2,
  'Outward', 'Maharashtra',
  '{"name":"Larsen & Toubro Ltd","address":"L&T House, Ballard Estate, Mumbai 400001","gstin":"27AAACL0406C1ZM"}'::jsonb,
  '{"name":"L&T Plant","address":"Mahape, Navi Mumbai 400709","gstin":"27AAACL0406C1ZM"}'::jsonb,
  230000, 41400, 271400, 271400, 0,
  'Net 30', 'Overdue',
  '[{"srNo":1,"particulars":"MS Plate 6mm 10x4ft","hsn":"7208","uom":"MT","qty":3,"rate":62000,"amount":186000},{"srNo":2,"particulars":"GI Wire 2mm","hsn":"7217","uom":"KG","qty":200,"rate":110,"amount":22000}]'::jsonb
),(
  inv3, org, 'INV-003', CURRENT_DATE - 25, CURRENT_DATE + 5, c4,
  'Outward', 'Delhi',
  '{"name":"BHEL","address":"BHEL House, Siri Fort, New Delhi 110049","gstin":"07AAACB1534F1ZI"}'::jsonb,
  '{"name":"BHEL Plant","address":"Haridwar 249403","gstin":"05AAACB1534F2ZH"}'::jsonb,
  535500, 96390, 631890, 631890, 0,
  'Advance 50%, balance on delivery', 'Paid',
  '[{"srNo":1,"particulars":"Copper Bus Bar 6mm","hsn":"7407","uom":"KG","qty":150,"rate":820,"amount":123000},{"srNo":2,"particulars":"SS Sheet 304 2mm","hsn":"7219","uom":"MT","qty":1.5,"rate":275000,"amount":412500}]'::jsonb
);

-- ============================================================
--  PAYMENTS (2)
-- ============================================================

INSERT INTO payments (id, org_id, payment_ref, customer_id, customer_name,
  invoice_id, invoice_no, invoice_amount, amount,
  outstanding_before, outstanding_after, date, status)
VALUES
(
  gen_random_uuid(), org, 'PAY-001', c4, 'Bharat Heavy Electricals Ltd',
  inv3, 'INV-003', 631890, 631890,
  631890, 0, CURRENT_DATE - 10, 'Received'
),(
  gen_random_uuid(), org, 'PAY-002', c1, 'Tata Steel Ltd',
  inv1, 'INV-001', 1035000, 500000,
  1035000, 535000, CURRENT_DATE - 5, 'Partial'
);

-- ============================================================
--  REMINDERS (4)
-- ============================================================

INSERT INTO reminders (id, org_id, date, time, type, name, mobile,
  reference_type, note, source, status)
VALUES
(
  gen_random_uuid(), org, CURRENT_DATE + 1, '10:00', 'Follow Up', 'Priya Mehta', '+91-9988776655',
  'inquiry', 'Follow up on INQ-002 — L&T awaiting PO confirmation', 'manual', 'pending'
),(
  gen_random_uuid(), org, CURRENT_DATE + 2, '11:30', 'Payment', 'Tata Steel Ltd', '+91-9876543210',
  'invoice', 'INV-001 partial payment outstanding — ₹5,35,000 due', 'manual', 'pending'
),(
  gen_random_uuid(), org, CURRENT_DATE + 3, '14:00', 'Follow Up', 'Khalid Al Futtaim', '+971-502345678',
  'inquiry', 'Follow up on INQ-006 — Dubai hotel project offer pending', 'manual', 'pending'
),(
  gen_random_uuid(), org, CURRENT_DATE - 1, '09:00', 'Payment', 'Larsen & Toubro Ltd', '+91-9988776655',
  'invoice', 'INV-002 overdue — ₹2,71,400 not received', 'manual', 'pending'
);

-- ============================================================
--  ORDERS (simple orders table — 3 records)
-- ============================================================

INSERT INTO orders (id, org_id, order_ref, order_date, delivery_date, customer_id, customer_name,
  salesman, items, amount, gst_percent, grand_total, status, remarks)
VALUES
(
  gen_random_uuid(), org, 'ORD-001', CURRENT_DATE - 10, CURRENT_DATE + 5, c5, 'Reliance Industries Ltd',
  'Arun Kumar',
  '[{"name":"CS Pipe 4mm","qty":200,"rate":1400,"total":280000},{"name":"MS Flange DN50","qty":400,"rate":550,"total":220000}]'::jsonb,
  500000, 18, 590000, 'ongoing', 'Jamnagar annual supply — first batch'
),(
  gen_random_uuid(), org, 'ORD-002', CURRENT_DATE - 20, CURRENT_DATE - 5, c3, 'Gulf Industries LLC',
  'Arun Kumar',
  '[{"name":"MS Plate 6mm","qty":10,"rate":62000,"total":620000}]'::jsonb,
  620000, 0, 620000, 'completed', 'Export — no GST applicable'
),(
  gen_random_uuid(), org, 'ORD-003', CURRENT_DATE - 1, CURRENT_DATE + 14, c8, 'Adani Ports & SEZ Ltd',
  'Ravi Shah',
  '[{"name":"MS Plate 6mm","qty":20,"rate":62000,"total":1240000},{"name":"Chequered Plate 5mm","qty":5,"rate":78000,"total":390000}]'::jsonb,
  1630000, 18, 1923400, 'offers', 'Mundra port expansion — under negotiation'
);

END $$;
