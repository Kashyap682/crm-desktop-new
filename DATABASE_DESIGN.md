# PostgreSQL / PostgREST Database Design Proposal

## Overview

The goal is to move from a local IndexedDB (single-device, single-user) to a shared
PostgreSQL database exposed via PostgREST, enabling multiple users across multiple
devices to work on the same data in real time.

---

## Multi-Tenancy Model

The app is built for **one company (Navbharat)** right now, but the schema below is
designed as **multi-tenant from day one** using an `org_id` column on every business
table. This costs almost nothing to add now and means you can onboard other companies
later without restructuring anything.

Every user belongs to exactly one organisation. Every row in every business table
belongs to exactly one organisation. RLS enforces this automatically.

---

## User & Auth Layer

PostgREST delegates authentication to JWTs. The recommended path is **Supabase Auth**
(which sits in front of PostgREST and issues JWTs) or a lightweight custom auth
service. Either way, each JWT carries `user_id` and `org_id` as claims.

### `organizations`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | company display name |
| created_at | timestamptz | |

### `users`
Managed by Supabase Auth (or your auth service). The relevant columns PostgREST cares
about are `id` (uuid) and the JWT claims.

### `organization_users`
Links a user to an org and assigns their role.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| user_id | uuid FK → auth.users | |
| role | text | `admin` / `sales` / `viewer` |
| created_at | timestamptz | |

**Roles:**
- `admin` — full read/write/delete across all tables, can manage users
- `sales` — read/write everything except user management and settings
- `viewer` — read-only everywhere

---

## Business Schema

### `customers`
Mirrors the `getEmptyCustomer()` shape. Addresses and contacts are broken out into
separate tables (one-to-many) rather than nested JSON, so they can be queried and
filtered independently.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| customer_ref | text | human-readable ID e.g. CUST-001 |
| customer_type | text | |
| company_name | text | |
| website | text | |
| pan | text | |
| msme | text | |
| created_by | uuid FK → users | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

> **Documents (logo, PAN file, MSME file):** stored as base64 in IndexedDB today.
> In Postgres, these should move to **object storage** (S3 / Supabase Storage) and
> only the URL/path stored in the DB. Keeping large blobs in Postgres is a known
> performance killer.

### `customer_addresses`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| customer_id | uuid FK → customers | |
| address_type | text | `office` / `billing` / `billing2` / `shipping` |
| line1 | text | |
| line2 | text | |
| city | text | |
| state | text | |
| pincode | text | |
| country | text | |
| gstin | text | |
| sort_order | int | for multiple shipping addresses |

### `customer_contacts`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| customer_id | uuid FK → customers | |
| contact_type | text | `primary` / `secondary` |
| title | text | |
| first_name | text | |
| last_name | text | |
| mobile | text | |
| mobile_country_code | text | ISO e.g. `in` |
| email | text | |
| remarks | text | |

### `customer_materials`
Products/materials of interest per customer.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| customer_id | uuid FK → customers | |
| material | text | |
| make | text | |

---

### `vendors`
Mirrors the `Vendor` interface.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| vendor_ref | text | human-readable ID |
| vendor_vertical | text | |
| vendor_type | text | Manufacturer / Dealer / Trader |
| vendor_category | text | |
| company_name | text | |
| brand_name | text | |
| website | text | |
| email | text | |
| mobile | text | |
| pan | text | |
| msme | text | |
| payment_terms | text | |
| bank_ifsc | text | |
| created_by | uuid FK → users | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `vendor_addresses`
Same structure as `customer_addresses`, with `vendor_id` instead.

### `vendor_contacts`
Same structure as `customer_contacts`, with `vendor_id` instead.

### `vendor_products`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| vendor_id | uuid FK → vendors | |
| product_name | text | |

---

### `inventory`
The item/product master. Currently keyed by `name` in IndexedDB — in Postgres use a
proper UUID PK and put a unique index on `(org_id, name)`.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| name | text | unique per org |
| category | text | |
| hsn | text | |
| uom | text | |
| description | text | |
| stock_qty | numeric | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

### `inquiries`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| inquiry_ref | text | INQ-XXXX |
| date | date | |
| customer_id | uuid FK → customers | nullable (new customer flow) |
| customer_name | text | denormalised for display |
| company_name | text | |
| customer_phone | text | |
| customer_phone_code | text | |
| email | text | |
| inquiry_type | text | |
| notes | text | |
| status | text | `open` / `closed` |
| decision | text | Under Negotiation / Order Received / Order Lost / Rejected |
| rejection_reason | text | |
| lost_reason | text | |
| lost_remarks | text | |
| lost_date | date | |
| created_by | uuid FK → users | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `inquiry_items`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| inquiry_id | uuid FK → inquiries | |
| product_name | text | |
| make | text | |
| hsn | text | |
| form | text | |
| density | text | |
| thickness | text | |
| size | text | |
| grade | text | |
| qty | numeric | |
| uom | text | |
| stock | text | |
| lead_time | text | |
| sort_order | int | |

### `inquiry_followups`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| inquiry_id | uuid FK → inquiries | |
| date | date | |
| note | text | |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

---

### `offers`
One offer per inquiry. History versions tracked in `offer_history`.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| offer_ref | text | |
| inquiry_id | uuid FK → inquiries | |
| customer_id | uuid FK → customers | |
| date | date | |
| subject | text | |
| address | text | |
| intro_text | text | |
| delivery_terms | text | |
| payment_terms | text | |
| validity | text | |
| taxes | text | |
| freight | text | |
| status | text | pending / under_negotiation / order_received / order_lost / rejected |
| created_by | uuid FK → users | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `offer_items`
The line items (material, density, thickness, size, qty, rate etc.)

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| offer_id | uuid FK → offers | |
| material | text | |
| density | text | |
| thickness | text | |
| size | text | |
| quantity | text | |
| rate | text | |
| sort_order | int | |

### `offer_history`
Snapshot of an offer every time it is revised, so you can view what was sent at each
stage.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| offer_id | uuid FK → offers | |
| snapshot | jsonb | full offer + items at point of revision |
| revised_by | uuid FK → users | |
| revised_at | timestamptz | |

> Using `jsonb` for the snapshot is intentional here — it's an immutable audit record,
> not a live queryable structure.

---

### `rfqs`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| rfq_ref | text | RFQ-XXXX |
| rfq_date | date | |
| inquiry_id | uuid FK → inquiries | |
| vendor_id | uuid FK → vendors | |
| vendor_name | text | denormalised |
| contact_title | text | |
| contact_first_name | text | |
| contact_last_name | text | |
| mobile | text | |
| email | text | |
| notes | text | |
| other_terms | text | |
| status | text | DRAFT / SENT |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

### `rfq_items`
Same spec fields as `inquiry_items` plus `fsk`, `alloy`, `temper`, `nb`, `max_temp`,
`color`.

### `rfq_shipping_address`
Single row per RFQ (can inline as columns on `rfqs` since it's always one address).

---

### `sales_orders`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| order_ref | text | SO-XXXX |
| order_date | date | |
| customer_id | uuid FK → customers | |
| customer_name | text | denormalised |
| inquiry_id | uuid FK → inquiries | nullable |
| offer_id | uuid FK → offers | nullable |
| bill_addr | text | |
| ship_addr | text | |
| gst_no | text | |
| contact_person | text | |
| contact_no | text | |
| payment_terms | text | |
| credit_days | int | |
| po_no | text | customer's PO number |
| po_date | date | |
| freight_charges | numeric | |
| advance_received | numeric | |
| expected_delivery_date | date | |
| delivery_terms | text | |
| transporter_name | text | |
| transport_mode | text | |
| gst_type | text | cgst_sgst / igst |
| status | text | DRAFT / SUBMITTED / APPROVED |
| created_by | uuid FK → users | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `sales_order_items`
Standard line-item table with product, qty, rate, HSN, GST%, discount, total.

---

### `purchase_orders`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| po_ref | text | PO-XXXX |
| po_date | date | |
| vendor_id | uuid FK → vendors | |
| vendor_name | text | denormalised |
| inquiry_ref | text | |
| offer_ref | text | |
| billing_address | text | |
| delivery_address | text | |
| vendor_gst | text | |
| contact_person | text | |
| contact_info | text | |
| payment_terms | text | |
| credit_days | int | |
| freight_charges | numeric | |
| advance_received | numeric | |
| expected_delivery_date | date | |
| delivery_terms | text | |
| transport_mode | text | |
| status | text | DRAFT / SUBMITTED / APPROVED |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

### `purchase_order_items`
Same structure as `sales_order_items`.

---

### `proformas`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| proforma_ref | text | PI-XXXX |
| date | date | |
| customer_id | uuid FK → customers | |
| sales_order_id | uuid FK → sales_orders | nullable |
| bill_to | jsonb | snapshot of billing party at time of creation |
| ship_to | jsonb | snapshot of shipping party |
| freight_charges | numeric | |
| packing_charges | numeric | |
| other_charges | numeric | |
| payment_terms | text | |
| validity | text | |
| status | text | Draft / Sent / Accepted |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

### `proforma_items`
Standard line-item table.

---

### `invoices`
Mirrors `InvoiceModel`.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| invoice_no | text | |
| invoice_date | date | |
| due_date | date | |
| order_ref_no | text | |
| internal_ref_no | text | |
| eway_bill_no | text | |
| supply_type | text | GST / IGST |
| supply_state_code | text | |
| place_of_supply | text | |
| customer_id | uuid FK → customers | nullable |
| bill_to | jsonb | snapshot of billing party |
| ship_to | jsonb | snapshot of shipping party |
| sub_total_1 | numeric | |
| packing_charges | numeric | |
| freight_charges | numeric | |
| other_charges | numeric | |
| cgst | numeric | |
| sgst | numeric | |
| igst | numeric | |
| sub_total_2 | numeric | |
| round_off | numeric | |
| grand_total | numeric | |
| amount_in_words | text | |
| transport | jsonb | transport details snapshot |
| payment_terms | text | |
| remarks | text | |
| status | text | Pending / Paid |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

### `invoice_items`
Standard line-item table (particulars, HSN, UOM, qty, rate, amount).

> **Why jsonb for bill_to / ship_to / transport?**
> These are point-in-time snapshots. The customer's address might change after the
> invoice is raised; the invoice must always reflect what it said when it was issued.

---

### `payments`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| payment_ref | text | PAY/YYYY/XXXX |
| customer_id | uuid FK → customers | |
| customer_name | text | denormalised |
| invoice_id | uuid FK → invoices | |
| invoice_no | text | denormalised |
| invoice_amount | numeric | |
| amount | numeric | amount of this payment |
| outstanding_before | numeric | |
| outstanding_after | numeric | |
| date | date | |
| status | text | Pending / Success / Failed |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

---

### `reminders`

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| date | date | |
| time | text | HH:MM |
| type | text | offer / inquiry / order / proforma / invoice / call / payment / general |
| name | text | contact name |
| mobile | text | |
| reference_id | uuid | nullable — points to the relevant record |
| reference_type | text | e.g. `invoice`, `offer` — tells you which table |
| note | text | |
| source | text | system / manual |
| status | text | pending / completed / dismissed |
| created_by | uuid FK → users | |
| created_at | timestamptz | |

### `reminder_history`
Log of status changes on reminders (who dismissed/completed it and when).

---

### `documents`
The document library.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK | |
| name | text | |
| category | text | Datasheet / MSDS / Test Certificate / Drawing / Brochure / Other |
| material | text | |
| tags | text | |
| file_name | text | original filename |
| file_type | text | MIME type |
| file_size | int | bytes |
| storage_path | text | path in object storage (not base64) |
| uploaded_by | uuid FK → users | |
| uploaded_at | timestamptz | |

> Currently the app stores files as base64 strings directly in IndexedDB. In Postgres
> this would bloat the DB and make every query slow. Files should go to object storage
> (Supabase Storage / S3) and only the path lives here.

---

## Row Level Security (RLS)

Every table has RLS enabled. The core idea is simple: **a user can only see rows that
belong to their organisation**, and within that, their role controls what they can
write.

### How org_id is resolved

The JWT issued at login contains the user's `org_id` as a claim. PostgREST exposes
this via `current_setting('request.jwt.claims')`. A helper function extracts it:

```
get_my_org_id() → reads jwt claim → returns uuid
get_my_role()   → reads jwt claim → returns text
```

These functions are used inside every RLS policy so you write the logic once.

### Policy patterns (described, not SQL)

**SELECT — all roles**
A user can read any row where `org_id` matches their org. No exceptions.

**INSERT — admin and sales**
A user can insert rows into their own org (org_id is set to their org automatically,
they cannot insert into another org). Viewers cannot insert.

**UPDATE — admin and sales**
Same org check. Additionally:
- On `invoices` and `payments`: only `admin` can update once status is `Paid` /
  `Success` (financial records should not be silently edited)
- On `users` / `organization_users`: only `admin`

**DELETE — admin only**
Only admins can delete. Sales and viewers cannot delete any records. This protects
against accidental data loss; soft-delete (an `archived_at` column) is worth
considering instead of hard delete.

### Table-specific RLS notes

| table | special rule |
|---|---|
| `organizations` | Users can only read their own org row, never update or delete |
| `organization_users` | Only admins can insert/update/delete (user management) |
| `invoices` | Once `status = Paid`, only admin can modify |
| `payments` | Once `status = Success`, only admin can modify |
| `offer_history` | INSERT only (no UPDATE or DELETE — it's an audit log) |
| `reminder_history` | INSERT only |
| `documents` | Any sales/admin user can upload; only uploader or admin can delete |

---

## Key Design Decisions

### Denormalised name columns
Many tables store `customer_name`, `vendor_name` etc. alongside the FK. This is
intentional — if a company renames itself, historical records should still show what
the name was at the time, and it avoids expensive joins in list views.

### JSONB for snapshots vs. normalised for live data
- **Live, queryable data** (customers, vendors, inventory) → fully normalised tables
- **Point-in-time snapshots** (bill_to/ship_to on invoices, proformas; offer history
  snapshots) → `jsonb`, because these must never change after creation

### Line-item tables vs. JSONB arrays
Line items (invoice_items, sales_order_items etc.) are in their own tables rather than
a JSONB array. This makes it possible to query "which product appears most in
invoices" or "total qty of product X ordered this month" without unpacking JSON.

### `reference_id` / `reference_type` on reminders
Rather than separate FK columns for every possible entity, reminders use a polymorphic
reference (id + type string). This keeps the table simple as new entity types are
added.

### No soft-delete today, but plan for it
Adding an `archived_at timestamptz` column to customers, vendors, and inventory is
strongly recommended before going live. It lets you "delete" records from the UI
without losing them, and RLS can filter `WHERE archived_at IS NULL` by default.

---

## Migration Path from IndexedDB

1. Stand up Postgres + PostgREST (or Supabase project)
2. Run schema migrations to create all tables above
3. Write a one-time export script that reads the current IndexedDB data and POSTs it
   to PostgREST endpoints (the existing `exportAllData()` in `db.service.ts` gives you
   the JSON already)
4. Replace `DBService` in Angular with a new `ApiService` that calls PostgREST
   endpoints instead of IndexedDB — the method signatures (`getAll`, `add`, `put`,
   `delete`) can stay identical to minimise changes in components

---

## What's Not Covered Here

- **Conflict resolution** — if two users edit the same record simultaneously,
  last-write-wins by default. Optimistic locking (a `version` column) can be added if
  this becomes an issue.
- **Real-time sync** — PostgREST alone is request/response. For live updates across
  devices, Supabase Realtime (built on Postgres logical replication) or a WebSocket
  layer would be needed.
- **Offline support** — the current IndexedDB could act as a local cache with a sync
  queue for offline-first behaviour, but that's a significant separate design effort.
