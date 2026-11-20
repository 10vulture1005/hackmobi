/**
 * Deterministic seed generator.
 *
 * Writes /data/seed/*.json from the curated catalogue. Everything is driven by
 * a fixed RNG seed, so the demo is byte-for-byte reproducible: re-running this
 * never changes a price or a stock flag under the pitch.
 *
 *   npm run seed
 *
 * Real-world equivalents of each step live in /docs/data-sources.md:
 *   products   <- ingest_medicines.py + ingest_janaushadhi.py + ingest_nppa.py
 *   pharmacies <- ingest_pharmacies.py (OSM Overpass + Jan Aushadhi Kendra list)
 *   inventory  <- seed_inventory.py (SIMULATED — no public stock API exists)
 *   drug_info  <- ingest_drug_info.py (openFDA + MedlinePlus)
 */

import fs from 'node:fs'
import path from 'node:path'
import { CATALOG } from '../catalog'
import { PREBAKED, SOURCES } from '../drug_info'
import { canonicalKey, saltIdentityKey } from '../../lib/engine/canonical'
import { hasNarrowTherapeuticIndex, isRx, resolveSchedule } from '../../lib/engine/rx'
import type { InventoryRow, Pharmacy, Product } from '../../lib/engine/types'

const SEED = 20261120
const OUT = path.join(process.cwd(), 'data', 'seed')
/** Fixed "now" for the seed so freshness bands are reproducible. */
const NOW = new Date('2026-11-20T09:00:00.000Z').getTime()

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rnd = mulberry32(SEED)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- products

const products: Product[] = []
let pid = 0
const nextId = () => `p${String(++pid).padStart(4, '0')}`

for (const entry of CATALOG) {
  const rows: Array<{ brand: string; mfr: string; pack: number; mrp: number; ja: boolean }> = []
  if (entry.ja) {
    rows.push({ brand: entry.ja.name, mfr: 'PMBJP (Jan Aushadhi)', pack: entry.ja.pack, mrp: entry.ja.mrp, ja: true })
  }
  for (const b of entry.brands) {
    rows.push({ brand: b.name, mfr: b.mfr, pack: b.pack, mrp: b.mrp, ja: false })
  }

  for (const r of rows) {
    const { key, salts } = canonicalKey(entry.composition, entry.form, r.brand)
    const schedule = resolveSchedule(salts, entry.schedule)
    products.push({
      id: nextId(),
      brand_name: r.brand,
      manufacturer: r.mfr,
      composition_raw: entry.composition,
      salts,
      dosage_form: canonicalKey(entry.composition, entry.form, r.brand).form,
      canonical_key: key,
      pack_size: r.pack,
      unit_label: entry.unit_label,
      mrp: r.mrp,
      price_per_unit: round2(r.mrp / r.pack),
      is_generic: r.ja,
      is_jan_aushadhi: r.ja,
      is_rx: isRx(schedule),
      schedule,
      nppa_ceiling_per_unit: entry.nppa ?? null,
      source: r.ja ? 'PMBJP product list (demo extract)' : 'Indian medicine dataset (demo extract)',
    })
  }
}

// ---------------------------------------------------------------- pharmacies

/** Real Lucknow localities; coordinates are the locality centre. */
const AREAS: Array<[string, number, number]> = [
  ['Hazratganj', 26.8512, 80.9471],
  ['Gomti Nagar', 26.8575, 81.0016],
  ['Indira Nagar', 26.8905, 80.9772],
  ['Aliganj', 26.8903, 80.9402],
  ['Alambagh', 26.8042, 80.8893],
  ['Chowk', 26.8584, 80.9052],
  ['Charbagh', 26.8309, 80.9201],
  ['Rajajipuram', 26.8405, 80.8794],
  ['Jankipuram', 26.9101, 80.9318],
  ['Mahanagar', 26.8801, 80.9603],
  ['Telibagh', 26.7807, 80.9389],
  ['Chinhat', 26.9004, 81.0307],
  ['Ashiyana', 26.8003, 80.9169],
  ['Vikas Nagar', 26.8945, 80.9601],
  ['Kaiserbagh', 26.8532, 80.9303],
  ['Nishatganj', 26.8697, 80.9594],
  ['Faizabad Road', 26.8784, 81.0151],
  ['Sitapur Road', 26.9203, 80.9205],
  ['Amausi', 26.7692, 80.8842],
  ['Thakurganj', 26.8771, 80.8905],
]

const SHOP_PREFIX = [
  'Sharma', 'Awadh', 'Verma', 'Siddiqui', 'Gupta', 'Lucknow', 'Nishant', 'Shree',
  'Chaudhary', 'Anand', 'Khan', 'Yadav', 'Mishra', 'Sanjeevani', 'Arogya', 'Navjeevan',
  'Bajpai', 'Rastogi', 'Saxena', 'Tiwari', 'Pandey', 'Haider', 'Omkar', 'Vishal',
]
const SHOP_SUFFIX = [
  'Medical Store', 'Medicos', 'Medical Agency', 'Pharmacy', 'Chemist & Druggist',
  'Medical Hall', 'Dawa Ghar', 'Health Care', 'Drug House',
]
const HOURS = [
  'Mon-Sun 08:00-22:00',
  'Mon-Sat 09:00-21:00',
  'Mon-Sun 24 hours',
  'Mon-Sat 10:00-20:00; Sun 10:00-14:00',
  'Mon-Sun 07:30-23:00',
]

const pharmacies: Pharmacy[] = []
let phid = 0
const nextPh = () => `ph${String(++phid).padStart(3, '0')}`

/**
 * `--pharmacies-from-seed` keeps whatever ingest_pharmacies.py wrote (real
 * OpenStreetMap stores) and only regenerates the simulated inventory on top of
 * it. Without the flag, the demo locations below are generated.
 */
const useExistingPharmacies = process.argv.includes('--pharmacies-from-seed')
const existingPharmaciesPath = path.join(OUT, 'pharmacies.json')

function jitter(scale = 0.012) {
  return (rnd() - 0.5) * 2 * scale
}

if (useExistingPharmacies && fs.existsSync(existingPharmaciesPath)) {
  const real = JSON.parse(fs.readFileSync(existingPharmaciesPath, 'utf8')) as Pharmacy[]
  pharmacies.push(...real)
  console.log(`Using ${real.length} ingested pharmacies from data/seed/pharmacies.json`)
}

/** One Jan Aushadhi Kendra in most areas, as the real network is spread thin. */
const JA_AREAS = AREAS.filter((_, i) => i % 2 === 0)
for (const [area, lat, lng] of pharmacies.length ? [] : JA_AREAS) {
  const hoursAgo = pick([2, 5, 9, 20, 30, 50, 100, 200])
  pharmacies.push({
    id: nextPh(),
    name: `Jan Aushadhi Kendra — ${area}`,
    address: `${area}, Lucknow, Uttar Pradesh`,
    lat: round6(lat + jitter(0.006)),
    lng: round6(lng + jitter(0.006)),
    phone: `+91 522 4${String(100000 + Math.floor(rnd() * 899999)).slice(0, 6)}`,
    opening_hours: 'Mon-Sat 09:00-19:00',
    is_jan_aushadhi: true,
    osm_id: null,
    verified: true,
    licence_no: `UP-LKO-JA-${String(1000 + phid)}`,
    last_stock_update: new Date(NOW - hoursAgo * 3600_000).toISOString(),
  })
}

for (const [area, lat, lng] of useExistingPharmacies ? [] : AREAS) {
  const count = 3 + Math.floor(rnd() * 3)
  for (let i = 0; i < count; i++) {
    const verified = rnd() < 0.55
    // A quarter of private stores have never confirmed stock in the dashboard.
    const neverUpdated = rnd() < 0.25
    const hoursAgo = pick([1, 3, 6, 12, 18, 26, 40, 72, 120, 260, 400])
    pharmacies.push({
      id: nextPh(),
      name: `${pick(SHOP_PREFIX)} ${pick(SHOP_SUFFIX)}`,
      address: `${area}, Lucknow, Uttar Pradesh`,
      lat: round6(lat + jitter()),
      lng: round6(lng + jitter()),
      phone: rnd() < 0.8 ? `+91 9${String(100000000 + Math.floor(rnd() * 899999999)).slice(0, 9)}` : null,
      opening_hours: pick(HOURS),
      is_jan_aushadhi: false,
      osm_id: `node/${3000000000 + Math.floor(rnd() * 99999999)}`,
      verified,
      licence_no: verified ? `UP-LKO-${String(20000 + phid)}` : null,
      last_stock_update: neverUpdated ? null : new Date(NOW - hoursAgo * 3600_000).toISOString(),
    })
  }
}

function round6(n: number) {
  return Math.round(n * 1e6) / 1e6
}

// ---------------------------------------------------------------- inventory
// SIMULATED. No public API publishes per-pharmacy stock in India, so this is
// generated, flagged is_simulated, surfaced as "Demo stock" and treated as
// freshness 'unknown' everywhere in the UI.

const inventory: InventoryRow[] = []
const jaProducts = products.filter((p) => p.is_jan_aushadhi)
const brandProducts = products.filter((p) => !p.is_jan_aushadhi)

for (const ph of pharmacies) {
  if (ph.is_jan_aushadhi) {
    for (const p of jaProducts) {
      // Kendras carry the programme list almost completely, at the official MRP.
      const inStock = rnd() < 0.88
      inventory.push({
        pharmacy_id: ph.id,
        product_id: p.id,
        in_stock: inStock,
        price: p.mrp,
        updated_at: ph.last_stock_update ?? new Date(NOW).toISOString(),
        is_simulated: true,
      })
    }
    // Kendras also keep a few common branded items.
    for (const p of brandProducts) {
      if (rnd() < 0.12) {
        inventory.push({
          pharmacy_id: ph.id,
          product_id: p.id,
          in_stock: rnd() < 0.7,
          price: round2(p.mrp * (1 - rnd() * 0.05)),
          updated_at: ph.last_stock_update ?? new Date(NOW).toISOString(),
          is_simulated: true,
        })
      }
    }
  } else {
    for (const p of brandProducts) {
      // A private shop carries most but not all of the brand list.
      if (rnd() < 0.78) {
        const discount = rnd() * 0.1
        inventory.push({
          pharmacy_id: ph.id,
          product_id: p.id,
          in_stock: rnd() < 0.74,
          price: round2(p.mrp * (1 - discount)),
          updated_at: ph.last_stock_update ?? new Date(NOW).toISOString(),
          is_simulated: true,
        })
      }
    }
    // Some private shops stock a handful of unbranded generics too.
    for (const p of jaProducts) {
      if (rnd() < 0.08) {
        inventory.push({
          pharmacy_id: ph.id,
          product_id: p.id,
          in_stock: rnd() < 0.6,
          price: round2(p.mrp * (1 + rnd() * 0.15)),
          updated_at: ph.last_stock_update ?? new Date(NOW).toISOString(),
          is_simulated: true,
        })
      }
    }
  }
}

// ---------------------------------------------------------------- drug info

const drugInfo = SOURCES.map((s) => ({
  salt_key: s.salt_key,
  display_name: s.display_name,
  source_text: s.source_text,
  source_urls: s.source_urls,
  fetched_at: new Date(NOW).toISOString(),
}))

const drugInfoCache = Object.entries(PREBAKED).map(([k, content]) => {
  const [salt_key, language] = k.split('::')
  return { salt_key, language, content, generated_at: new Date(NOW).toISOString(), reviewed: true }
})

// ---------------------------------------------------------------- write

fs.mkdirSync(OUT, { recursive: true })
const write = (name: string, data: unknown) => {
  fs.writeFileSync(path.join(OUT, name), `${JSON.stringify(data, null, 0)}\n`)
}

write('products.json', products)
if (!useExistingPharmacies) write('pharmacies.json', pharmacies)
write('inventory.json', inventory)
write('drug_info.json', drugInfo)
write('drug_info_cache.json', drugInfoCache)

// ---------------------------------------------------------------- report

const withKey = products.filter((p) => p.canonical_key)
const keyGroups = new Map<string, Product[]>()
for (const p of withKey) {
  const g = keyGroups.get(p.canonical_key as string) ?? []
  g.push(p)
  keyGroups.set(p.canonical_key as string, g)
}
const substitutable = [...keyGroups.values()].filter((g) => g.length > 1)

console.log('--- Aushadhi seed ---')
console.log(`products            ${products.length}`)
console.log(`  jan aushadhi      ${products.filter((p) => p.is_jan_aushadhi).length}`)
console.log(`  rx (schedule!=OTC)${String(products.filter((p) => p.is_rx).length).padStart(4)}`)
console.log(`  H1/X              ${products.filter((p) => p.schedule === 'H1' || p.schedule === 'X').length}`)
console.log(`  narrow therapeutic${String(products.filter((p) => hasNarrowTherapeuticIndex(p.salts)).length).padStart(4)}`)
console.log(`  canonical key set ${withKey.length}/${products.length}`)
console.log(`canonical keys      ${keyGroups.size} (${substitutable.length} with a substitute)`)
console.log(`pharmacies          ${pharmacies.length} (${pharmacies.filter((p) => p.is_jan_aushadhi).length} Jan Aushadhi Kendras)`)
console.log(`inventory rows      ${inventory.length} (all is_simulated = true)`)
console.log(`drug info salts     ${drugInfo.length}; prebaked cache ${drugInfoCache.length}`)
console.log('')
console.log('Ten sample substitutions (branded -> cheapest same-key option):')
let shown = 0
for (const [k, group] of keyGroups) {
  if (shown >= 10) break
  const branded = group.filter((p) => !p.is_jan_aushadhi).sort((a, b) => b.price_per_unit - a.price_per_unit)[0]
  const cheapest = [...group].sort((a, b) => a.price_per_unit - b.price_per_unit)[0]
  if (!branded || cheapest.id === branded.id) continue
  const save = ((1 - cheapest.price_per_unit / branded.price_per_unit) * 100).toFixed(0)
  console.log(
    `  ${branded.brand_name.padEnd(26)} ₹${branded.price_per_unit.toFixed(2).padStart(7)}/${branded.unit_label.padEnd(7)} -> ${cheapest.brand_name.padEnd(46)} ₹${cheapest.price_per_unit.toFixed(2).padStart(6)}  (-${save}%)  [${k}]`,
  )
  shown++
}
