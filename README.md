# Sasta Dawa (सस्ता दवा)

**Same medicine. Lower price. Near you.**

A citizen can type, say, photograph a prescription or photograph a medicine strip, and get:
the same salt at a lower price, which pharmacy nearby has it, whether a prescription is
required, grounded over-the-counter information, and the government schemes that may apply —
in Hindi, English or Awadhi, on a cheap Android phone, offline for anything already seen.

```bash
npm install
npm run seed      # regenerates /data/seed from the curated catalogue (idempotent)
npm run dev       # http://localhost:3100
npm test          # 101 engine tests
```

No API keys. No database. No account. The whole thing runs on free tiers, and the demo runs
with no network at all once the page is loaded.

---

## What this is, and what it is not

> **Read this section before judging the data.** It is deliberately blunt about what is real.

| Layer | In this build | In production |
|---|---|---|
| Medicine catalogue (brands, salts, pack sizes, MRPs) | **Representative demo data** — 50 canonical medicines, 149 products, hand-curated from the shape and price range of the public datasets below | `data/scripts/ingest_medicines.py` over the Kaggle A–Z Indian medicine dataset |
| Jan Aushadhi generics | **Representative demo data** — 41 products priced in the range the PMBJP list publishes | `ingest_janaushadhi.py` over the official PMBJP product list |
| NPPA ceiling prices | **Representative demo data** on NLEM salts | `ingest_nppa.py` over the NPPA ceiling-price notifications |
| Pharmacy locations | **Demo locations** on 20 real Lucknow localities; `ingest_pharmacies.py` fetches the **real** ones from OpenStreetMap with one command | Same script, plus the Jan Aushadhi Kendra list |
| **Per-pharmacy stock** | **Simulated, and labelled "Demo stock" everywhere it appears** | Pharmacist dashboard, WhatsApp updates, billing-software integration (see below) |
| Drug information (uses, side effects, when to see a doctor) | **Real source text**, checked in: extracts of openFDA label sections and MedlinePlus, with source URLs | `ingest_drug_info.py` against the live openFDA API |
| Government schemes | **Real schemes**, hand-curated, each with its official source URL | Same file, reviewed on a schedule |
| Prescriptions in the demo | **Synthetic documents** — fictional clinic, fictional prescriber, visible DEMO watermark | Real uploads |

**There is no public API for what is on a pharmacy shelf in India.** That is the one thing no
hackathon can source, so it is generated — with a fixed seed, so the demo is reproducible — and
every surface that shows it says "Demo stock" and reports its freshness as unconfirmed. The
moment a pharmacist confirms stock in the dashboard, those rows stop being simulated and start
ageing through the real freshness bands, which is exactly how the production path works.

In production, real stock arrives three ways, in this order of realism:
1. **Pharmacist dashboard** — the one in this build: toggles, inline price edit, CSV import, and
   a one-tap "Confirm stock is current" that lifts the shop up the rankings.
2. **WhatsApp updates** — a shop replies to a daily template with what has run out; a webhook
   writes it to `inventory`.
3. **Billing-software integration** — Marg, Vyapar and similar already hold live stock; a nightly
   push is the end state, and the only one that makes delivery promises safe.

---

## The safety rules, and where they are enforced

These are not UI copy. Each one is deterministic server-side code with tests.

| Rule | Where | Test |
|---|---|---|
| A substitute must match salts, strengths **and** dosage form exactly | `lib/engine/canonical.ts` — a byte-identical canonical key | 58 parser/matcher tests |
| Extended release is never substituted for immediate release | `tablet_er` is a different form | `separates immediate release from extended release` |
| A product we cannot parse confidently gets **no** substitutes | `canonical_key = null` | `withholds the key when…` ×3 |
| The LLM never chooses a substitute, a price or an Rx decision | engine and `lib/engine/rx.ts` have no model calls at all | — |
| A prescription-only item cannot be reserved without a prescription that covers it | `createReservation()` → **HTTP 422** | `refuses an Rx item with no prescription` |
| Unclassifiable salts are treated as prescription-only (fail closed) | `scheduleFromSalts()` returns `H` | `fails closed for an unknown salt` |
| Schedule H1/X are never cleared by software | always `needs_pharmacist_review` | `refuses an H1 item even with a matching prescription` |
| An Rx item cannot be marked collected until the pharmacist verifies | `updateReservation('collected')` → 409 | `blocks collection…until the pharmacist verifies` |
| Narrow-therapeutic-index medicines carry an "ask your doctor" warning | `narrow_therapeutic_index.json` | `warns before switching…` |
| Two basket items sharing a salt always warn | canonical salt names only — not an interaction checker | `warns when two basket items share a salt` |
| Medicine information is shown for OTC only, from retrieved source text only | `/api/medicines/[id]/info` → 403 for Rx | `Rx product info -> 403` (e2e) |
| No dosage content ever reaches the user | output validator rejects dose-shaped text in every language | `containsDosageAdvice()` |

**Prescription validation** (`POST /api/prescription/validate`) is deterministic too: it checks that
the medicine is actually on the page, that the date exists, is not in the future and is inside the
schedule's validity window (180 days, 30 for H1), that a prescriber is named, and that the page was
legible. OCR is an aid; the result is `verified`, `needs_pharmacist_review` or `rejected`, and the
pharmacist verifies the paper at the counter in every case.

---

## AI, and how it is kept honest

Everything AI-shaped has a deterministic path that runs with no key, no quota and no network.
Set `GEMINI_API_KEY` and unset `DEMO_MODE` to route the same features through Gemini
(`gemini-2.5-flash`), with Groq as a text-only fallback.

| Feature | Model's job | Guardrail |
|---|---|---|
| Prescription OCR | transcribe text into a fixed schema | every line is shown in an editable review list; nothing is searched until the citizen confirms; low confidence is flagged, never auto-accepted |
| Strip/box scan | read the pack | same review step; identification only, the Rx gate still applies |
| Result summary | rephrase the engine's own numbers | the template is the primary path; a live answer that drops the savings figure or contains dose-shaped text is discarded |
| OTC information | translate and simplify retrieved label text | bullets must map to a source; dose-shaped output is stripped; Hindi/English/Awadhi are pre-generated and marked reviewed |
| Scheme assistant | answer from 17 curated entries | must cite scheme ids; ids outside the shortlist are dropped; cards show the official source link |
| Voice in | — | browser Web Speech API on-device; Groq Whisper only as a fallback endpoint |
| Voice out | — | browser `speechSynthesis` |

The retrieval for schemes is a keyword/tag match over 17 entries, small enough to fit in a prompt.
That is the whole "RAG" story, and it is deliberately not a vector database.

---

## Architecture

```
app/                    Next.js 15 App Router — citizen screens, dashboards, /api routes
  api/                  the API surface (same shape as the FastAPI plan in docs/architecture.md)
components/             design system + screen components
lib/
  engine/               deterministic core: canonical key, matching, alternatives, Rx gate, freshness
  ai/                   provider (Gemini/Groq + demo fallback), OCR, explain, drug info, schemes
  server/               engine wiring, prescription + reservation store, events, http helpers
  client/               typed API client, IndexedDB, speech, formatting
  i18n/                 en / hi / mr dictionaries
data/
  catalog.ts            the curated medicine catalogue
  drug_info.ts          retrieved label text + reviewed translations
  schemes/              schemes.json, rx_schedule.json, narrow_therapeutic_index.json
  seed/                 generated JSON (npm run seed)
  scripts/              seed_all.ts, make_demo_images.py, ingest_pharmacies.py, ingest_medicines.py
tests/                  101 tests
docs/                   architecture.md, data-sources.md, demo-script.md
```

The engine is pure TypeScript with no I/O: `buildBasket(items, deps)` takes product lookups and an
offers function. `lib/server/engine.ts` wires it to the seed loader. Swapping that one module for
SQLAlchemy queries is the only change a Postgres backend needs — the table shapes in
`docs/architecture.md` are the ones the loader already returns.

### Why a single Next.js app instead of Next + FastAPI

The spec's two-service split is the right production shape, and `docs/architecture.md` keeps the
Postgres schema and the FastAPI route map intact. For a demo, one service means no cold-start
tax on a free tier, no CORS, one deploy, and a typed client that cannot drift from the server.
The engine is deliberately I/O-free so the port is mechanical.

---

## Accessibility and offline

- **Large text + high contrast**: 20px base, AAA tokens, simplified cards. Persisted on device.
- **Voice guidance**: one spoken prompt per screen; results read in a fixed order — medicine,
  cheaper option, saving, nearest shop.
- 48px touch targets, visible focus rings, screen-reader labels on every icon button,
  `prefers-reduced-motion` respected, dark mode, three languages (Hindi, English, Awadhi).
- **Offline**: the service worker caches the app shell and the last results; the last ten full
  result payloads and "My medicines" live in IndexedDB. An offline result is labelled with the date
  it was saved, and Reserve is withheld because stock may have changed.

## Privacy

- Citizens have no account and no server-side row. "My medicines", saved results and accessibility
  settings are IndexedDB on the device, with Export and Clear all.
- `search_events` stores a query, a canonical key, a language, a saving and coordinates rounded to
  ~1 km. No name, no phone, no prescription content.
- Prescription images are retained 30 days (stated in the UI); in production they live in a private
  Supabase Storage bucket with signed URLs readable only by the target pharmacy.
- Reservation name/phone are visible only to the fulfilling pharmacy.

## Known limits

- Pharmacist auth is a shop picker; production is a Supabase magic link with row-level security.
- The pharmacist and impact dashboards are English only — they are tools for shop owners, not the
  low-literacy citizen path. The citizen path is fully trilingual.
- Drug information is extracted from **US** label sources (openFDA, MedlinePlus). Indian labelling
  can differ, which is why every sheet carries a disclaimer and a source link.
- Reservations and prescriptions are in-memory for the demo; a restart clears them.
- Home delivery is designed but not built — see §12 of the brief and `docs/architecture.md`. Rules for
  online medicine sale in India are still evolving, and H1/X would be excluded from delivery entirely.

## Environment

Everything is optional; the demo needs none of it.

```
GEMINI_API_KEY=     # live OCR / explanations / info / schemes
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=       # text + Whisper fallback
DEMO_MODE=1         # force the cached path even with a key present
DEMO_CITY_BBOX=26.72,80.82,26.95,81.05
```

Deploy: Vercel for the app, `GET /api/health` as the keep-warm cron target (free tiers sleep).

## Licences and attribution

OpenStreetMap data © OpenStreetMap contributors (ODbL); tiles from the OSM tile servers, used at
demo scale with attribution per the tile usage policy — a production deploy should move to
OpenFreeMap or its own tile cache. openFDA and MedlinePlus are US public-domain government sources.
Scheme content is summarised from the Government of India and Government of Uttar Pradesh pages
linked on each card. Brand names belong to their manufacturers and appear here as price-comparison
reference data.
