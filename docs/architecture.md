# Architecture

## Shape of the system

```
 citizen phone (PWA)                       pharmacist desktop
 ┌──────────────────────────┐              ┌──────────────────────────┐
 │ Home · Review · Results  │              │ Queue · Inventory · CSV  │
 │ Map · Schemes · Mine     │              │ Prescription verify      │
 └───────────┬──────────────┘              └───────────┬──────────────┘
             │  typed client (lib/client/api.ts)                │
 ┌───────────▼───────────────────────────────────────────────────▼──────┐
 │  /api  — route handlers, Pydantic-equivalent typed bodies, slowapi-  │
 │          equivalent rate limiting, uniform error envelope           │
 ├──────────────────────────┬───────────────────────────────────────────┤
 │  deterministic engine    │  AI layer                                 │
 │  canonical key           │  OCR / strip scan   (Gemini vision)       │
 │  matching                │  explanation        (template first)      │
 │  alternatives + savings  │  OTC info           (grounded + validated)│
 │  Rx gate                 │  scheme assistant   (17-entry retrieval)  │
 │  duplicate salt          │                                           │
 │  freshness + ranking     │  every one has a no-key fallback path     │
 ├──────────────────────────┴───────────────────────────────────────────┤
 │  data access (lib/data/db.ts)  ← swap this one module for Postgres   │
 └──────────────────────────────────────────────────────────────────────┘
```

The engine never calls the AI layer, and the AI layer never writes to the engine's outputs. That
separation is the safety property: a model can describe a result but cannot create one.

## Data model

The seed loader returns exactly these shapes, so the Postgres schema below is a drop-in.

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm;

create type schedule_t as enum ('OTC','H','H1','X','unknown');

create table products (
  id                     text primary key,
  brand_name             text not null,
  manufacturer           text,
  composition_raw        text not null,
  salts                  jsonb not null,          -- [{salt,strength,unit}]
  dosage_form            text not null,           -- tablet | tablet_er | capsule | …
  canonical_key          text,                    -- null ⇒ never substituted
  pack_size              integer not null,
  unit_label             text not null,           -- tablet | ml | g | dose
  mrp                    numeric(10,2) not null,
  price_per_unit         numeric(10,4) not null,
  is_generic             boolean not null default false,
  is_jan_aushadhi        boolean not null default false,
  is_rx                  boolean not null,
  schedule               schedule_t not null default 'unknown',
  nppa_ceiling_per_unit  numeric(10,4),
  source                 text
);
create index products_brand_trgm on products using gin (brand_name gin_trgm_ops);
create index products_canonical  on products (canonical_key);
create index products_salts      on products using gin (salts);

create table pharmacies (
  id                 text primary key,
  name               text not null,
  address            text,
  geom               geography(Point,4326) not null,
  phone              text,
  opening_hours      text,
  is_jan_aushadhi    boolean not null default false,
  osm_id             text,
  owner_id           uuid references auth.users,
  verified           boolean not null default false,
  licence_no         text,
  last_stock_update  timestamptz
);
create index pharmacies_geom on pharmacies using gist (geom);

create table inventory (
  pharmacy_id  text references pharmacies(id) on delete cascade,
  product_id   text references products(id)   on delete cascade,
  in_stock     boolean not null default true,
  price        numeric(10,2) not null,
  updated_at   timestamptz not null default now(),
  is_simulated boolean not null default false,
  primary key (pharmacy_id, product_id)
);

create type validation_t as enum ('verified','needs_pharmacist_review','rejected');

create table prescriptions (
  id                text primary key,
  image_url         text,                -- private bucket path, signed on read
  extracted         jsonb not null,
  validation_status validation_t,
  reasons           jsonb not null default '[]',
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null  -- created_at + 30 days, then deleted
);

create type reservation_t as enum
  ('pending','confirmed','rejected','collected','expired',
   'packed','out_for_delivery','delivered','cancelled');   -- last four: phase 2

create table reservations (
  id                        text primary key,
  code                      text unique not null,
  pharmacy_id               text references pharmacies(id),
  items                     jsonb not null,
  status                    reservation_t not null default 'pending',
  customer_name             text not null,
  customer_phone            text,
  created_at                timestamptz not null default now(),
  expires_at                timestamptz not null,
  prescription_id           text references prescriptions(id),
  requires_rx               boolean not null default false,
  rx_verified_by_pharmacist boolean not null default false,
  rx_verified_at            timestamptz,
  fulfilment_type           text not null default 'pickup'   -- phase 2: delivery
);

create table schemes (
  id text primary key, title text, summary text, eligibility jsonb,
  documents jsonb, how_to_claim text, covers jsonb, scope text, source_url text
);

create table drug_info (
  salt_key    text primary key,
  source_text jsonb not null,
  source_urls jsonb not null,
  fetched_at  timestamptz not null default now()
);

create table drug_info_cache (
  salt_key     text not null,
  language     text not null,
  content      jsonb not null,
  generated_at timestamptz not null default now(),
  reviewed     boolean not null default false,
  primary key (salt_key, language)
);

create table search_events (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  query          text,
  canonical_key  text,
  lat_bucket     numeric(6,2),   -- ~1 km grid
  lng_bucket     numeric(6,2),
  language       text,
  savings_amount numeric(10,2)
);
```

### Row-level security

```sql
alter table inventory     enable row level security;
alter table reservations  enable row level security;
alter table prescriptions enable row level security;

-- a pharmacist touches only their own pharmacy's stock
create policy inv_own on inventory using (
  exists (select 1 from pharmacies p
          where p.id = inventory.pharmacy_id and p.owner_id = auth.uid()));

-- and sees only reservations addressed to their pharmacy
create policy res_own on reservations for select using (
  exists (select 1 from pharmacies p
          where p.id = reservations.pharmacy_id and p.owner_id = auth.uid()));

-- a prescription image is readable only through a reservation at that pharmacy
create policy rx_own on prescriptions for select using (
  exists (select 1 from reservations r join pharmacies p on p.id = r.pharmacy_id
          where r.prescription_id = prescriptions.id and p.owner_id = auth.uid()));
```

Citizens have no rows at all: "My medicines", saved results and settings are IndexedDB on the
device, so there is nothing to leak and nothing to log in to.

## The engine

### Canonical key

`lib/engine/canonical.ts` turns a composition string into `salt:strength|salt:strength|form` with
salts sorted alphabetically, e.g. `caffeine:65mg|paracetamol:500mg|tablet`.

- Salt-form suffixes (hydrochloride, besylate, sodium) are resolved **only** through an explicit
  synonym table — never by a generic rule, because some suffixes change the molecule. Metoprolol
  succinate and metoprolol tartrate deliberately stay distinct.
- `g → mg`; mcg and IU are never merged into mg.
- Extended release is a separate form (`tablet_er`), so an SR tablet is never swapped for a plain one.
- Confidence below 0.75, a missing strength, or an unrecognised form ⇒ `canonical_key = null` ⇒ the
  product is shown but never gets a substitute.

### Matching

Exact normalised name → trigram similarity (pg_trgm's `similarity()` in production) re-ranked by an
edit-distance ratio (rapidfuzz in production) → salt search. Two real-world query shapes are handled
explicitly: a strength written twice ("Glycomet 500 500mg") and a pack photo that includes the whole
composition ("Augmentin 625 Duo 500mg + 125mg"). Below the confidence threshold the API returns the
top three as "Did you mean…?" and the UI never auto-picks.

### Alternatives, savings and ranking

Alternatives are every product with the identical canonical key. They are ranked Jan Aushadhi first,
then cheapest per unit, then in stock nearby. Savings compare **price per unit**, never pack price:
`savings = (original_ppu − alternative_ppu) × qty`. A prescription total sums the best collectible
option per item.

Pharmacy ranking is an effective-distance score:

```
rank = distance_km + freshness_penalty + 1.5 × (price − cheapest_nearby)/cheapest_nearby
       + 1000 if out of stock
freshness_penalty: fresh 0 · unconfirmed 0.6 · stale 1.2 · old 3.0
```

So a shop that keeps its stock current outranks a slightly closer shop that does not — the incentive
the pharmacist dashboard needs to be worth using.

## API surface

Implemented here as Next route handlers; the names and bodies are the FastAPI plan.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | counts + `demo_mode`; keep-warm cron target |
| GET | `/api/medicines/search` | `confident` flag + candidates |
| POST | `/api/prescription/parse` | multipart image or `{demo_slug}`; returns items **with match candidates** |
| POST | `/api/prescription/validate` | deterministic; `verified` / `needs_pharmacist_review` / `rejected` |
| POST | `/api/scan/strip` | identification only |
| POST | `/api/alternatives` | basket, savings, warnings, `duplicate_salt_warnings` |
| GET | `/api/pharmacies/nearby` | freshness, licence, rank |
| POST | `/api/reservations` | **422** when an Rx item has no covering prescription |
| GET | `/api/reservations/{code}` | polled every 5 s by the status screen |
| POST | `/api/medicines/{id}/info` | **403** for anything not `OTC` |
| POST | `/api/explain` | recomputes the basket server-side so the numbers are the engine's |
| POST | `/api/schemes/ask` | GET lists all schemes |
| POST | `/api/voice/transcribe` | fallback only; 501 without a Groq key |
| GET/PUT | `/api/pharmacist/inventory` | |
| POST | `/api/pharmacist/inventory/import` | CSV preview, then commit |
| POST | `/api/pharmacist/inventory/confirm-current` | one tap; flips freshness to fresh |
| GET | `/api/pharmacist/reservations` | includes the prescription for own reservations only |
| PATCH | `/api/pharmacist/reservations/{code}` | `confirm` `reject` `collected` `verify_prescription` `reject_prescription` |
| GET | `/api/admin/stats` | anonymous aggregates for `/impact` |

Errors are always `{"error": {"code", "message", "details"}}`. No stack traces, no raw JSON reaches
a citizen screen.

## Phase 2: fulfilment (designed, not built)

Pickup upgrades first — slots, a QR code the pharmacist scans to mark collected, an expiry reminder
and an "extend by an hour" request. Then pharmacy-run delivery, cash on delivery only, so no payment
gateway is needed:

```sql
alter table pharmacies add column offers_delivery boolean default false,
  add column delivery_radius_km numeric(4,1) default 3,
  add column delivery_fee numeric(6,2), add column free_delivery_above numeric(8,2),
  add column delivery_hours jsonb, add column pickup_slots jsonb;
alter table reservations add column delivery_address text,
  add column delivery_geom geography(Point,4326), add column delivery_fee numeric(6,2),
  add column payment_mode text default 'cod';
```

Hard rules carried into delivery: an Rx item cannot go "out for delivery" until the pharmacist has
verified the prescription; Schedule H1 and X are excluded from delivery entirely (counter only);
only `verified = true` pharmacies can switch delivery on, and the licence number is shown on the
order; the delivery fee is displayed separately so the "you save ₹X" figure stays honest. Online
medicine-sale rules in India are still evolving — this needs a legal check before any real launch.
