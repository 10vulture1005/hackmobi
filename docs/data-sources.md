# Data sources

Every row in this app is one of three things, and the UI always says which:

1. **Real, checked in** — government scheme content, drug-label text, Lucknow locality coordinates.
2. **Representative demo data** — the medicine catalogue and its prices: hand-curated to match the
   shape and the realistic price range of the public datasets below, so the demo is reproducible
   and needs no 500 MB download.
3. **Simulated** — per-pharmacy stock, which no public API in India publishes. Always labelled
   "Demo stock", always reported as unconfirmed freshness.

## 1. Medicine master (brand → composition → price)

| | |
|---|---|
| Source | Kaggle, "A-Z Medicine Dataset of India" (~11k rows: name, price, manufacturer, pack size, composition 1/2) and the larger Indian medicines/substitutes dataset (~250k rows) |
| Licence | per the Kaggle dataset page; download manually |
| Script | `data/scripts/ingest_medicines.py` |
| Status here | representative extract in `data/catalog.ts` (50 canonical medicines, 149 products) |

```bash
# put the CSV in data/raw/ first
python3 data/scripts/ingest_medicines.py data/raw/az_medicine_dataset_of_india.csv \
  --limit 15000 --out data/seed/products.json
```

The script normalises names, parses composition into `(salt, strength, unit)`, computes the canonical
key with the same rules as the TypeScript engine, derives `schedule`, and writes the same JSON shape
the app already reads. On the free Postgres tier, ingest the top ~15k products by availability plus
every product that shares a canonical key with a Jan Aushadhi item — otherwise the substitution graph
has holes exactly where it matters.

**Schedule classification** is the one field the dataset cannot be trusted on alone. It is resolved
as `stricter(dataset Rx label, lists in data/schemes/rx_schedule.json)`, and anything still unknown
is treated as prescription-only. Failing closed is the only acceptable direction.

## 2. Jan Aushadhi generics

| | |
|---|---|
| Source | PMBJP product list (drug code, generic name, strength, unit size, MRP) — <https://janaushadhi.gov.in/> |
| Script | `ingest_janaushadhi.py` (same normaliser, writes `is_jan_aushadhi = true`) |
| Status here | 41 representative products, priced in the band the official list publishes |

The programme's own price list is the single most useful public dataset for this problem: it is the
reference point every "you could save ₹X" number in the app is anchored to.

## 3. NPPA ceiling prices

| | |
|---|---|
| Source | NPPA ceiling-price notifications for NLEM medicines — <https://www.nppaindia.nic.in/> |
| Script | `ingest_nppa.py`, mapped by canonical key to `nppa_ceiling_per_unit` |
| Status here | representative values on NLEM salts in the catalogue |

Used only to flag a listing above the notified ceiling. The demo includes one deliberately
overpriced row (`Fevago 650`, a fictional brand from a fictional manufacturer) so the flag is
visible without making a claim about a real company's pricing.

## 4. Pharmacies

| | |
|---|---|
| Source | OpenStreetMap Overpass API — `amenity=pharmacy` and `healthcare=pharmacy` |
| Licence | ODbL, © OpenStreetMap contributors — attribution required, and present on the map |
| Script | `data/scripts/ingest_pharmacies.py` — **runnable right now, no download needed** |

```bash
python3 data/scripts/ingest_pharmacies.py                  # Lucknow bbox, writes data/seed/pharmacies.json
python3 data/scripts/ingest_pharmacies.py --bbox 19.0,72.8,19.3,73.0 --city Mumbai
```

It queries Overpass, keeps rows that have a usable name and location, dedupes by name+proximity,
and writes the same shape the app reads. Jan Aushadhi Kendras come from the official store locator
or the data.gov.in dataset; where only an address is published, geocode through Nominatim at
**1 request per second** with a persisted cache — the script's `--nominatim` path does exactly that,
and the cache means a re-run costs nothing.

Verified against the live API while building this: the Hazratganj–Mahanagar box returns a handful of
real named stores, Jan Aushadhi among them. **OSM pharmacy coverage in Lucknow is thin** — a few
dozen mapped shops against the few thousand that exist — which is why the demo ships generated
locations across 20 real localities instead, and says so. In a city with better coverage (Mumbai,
Bengaluru, Delhi) the real path is the better one; `--bbox` is all you change.

Tiles come from the OSM tile servers, which is acceptable at demo scale with attribution under the
[tile usage policy](https://operations.osmfoundation.org/policies/tiles/). A real deployment should
move to OpenFreeMap or its own cache before any traffic.

## 5. Per-pharmacy stock — simulated

`data/scripts/seed_all.ts`, fixed seed `20261120`:

- **Jan Aushadhi Kendras** stock the programme list at the official MRP; ~88% in stock; a few branded
  items as well.
- **Private pharmacies** stock ~78% of the brand list at 0–10% below MRP; ~26% of their rows are out
  of stock; a handful carry unbranded generics at a small markup.
- `last_stock_update` is spread across the freshness bands, and a quarter of private shops have never
  confirmed stock at all — which is what the stale/unconfirmed chips in the UI are showing.
- Every row carries `is_simulated = true`.

Re-running `npm run seed` reproduces it byte for byte, so a rehearsed demo cannot shift under you.

## 6. Drug information (OTC "Before you buy")

| | |
|---|---|
| Sources | openFDA drug label API (<https://open.fda.gov/apis/drug/label/>), MedlinePlus drug pages, WHO Essential Medicines list for cross-checking |
| Licence | US federal government, public domain |
| Script | `ingest_drug_info.py` — fetches `indications_and_usage`, `adverse_reactions`, `warnings`, `stop_use` per salt |
| Status here | 13 OTC salts checked in verbatim as source text, with URLs |

Keyed by **salt**, not brand, so one entry covers every brand with the same composition. Combinations
with no source show "Information not available — ask your pharmacist" rather than a guess.

> These are **US** labels. Indian labelling and approved indications can differ, which is why every
> sheet carries a disclaimer and links its source. Dose and frequency are never extracted, never
> generated and never displayed — an output validator rejects dose-shaped text in all three
> languages before it can reach a user.

Hindi, English and Awadhi summaries for the most-used salts are pre-generated and marked
`reviewed = true`, so the sheet opens instantly, spends no quota, and works offline.

## 7. Government schemes

17 entries in `data/schemes/schemes.json`, each with eligibility, documents, how to claim, coverage,
scope and an **official source URL**. Hand-curated from the programme pages: janaushadhi.gov.in,
pmjay.gov.in, nhm.gov.in, main.mohfw.gov.in, tbcindia.gov.in, nikshay.in, esic.gov.in, pmnrf.gov.in,
sachis.in, hllnetwork.com/amrit.

Scheme rules change. The file carries a `last_reviewed` date, every card links its source, and the
assistant may not state anything outside the file.

## 8. Narrow therapeutic index and Rx schedules

`data/schemes/narrow_therapeutic_index.json` — 14 salts where brand-to-brand variation can matter
clinically (levothyroxine, warfarin, phenytoin, carbamazepine, valproate, lithium, digoxin,
ciclosporin, tacrolimus, theophylline, …), curated from standard clinical references. These never
lose their "ask your doctor before switching" warning.

`data/schemes/rx_schedule.json` — salts by schedule under the Drugs and Cosmetics Rules, 1945, with
`default_when_unknown: "H"`. Both files are small, auditable and version-controlled on purpose: a
pharmacist can read them and tell you if they are wrong.
