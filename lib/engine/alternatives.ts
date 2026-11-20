/**
 * Alternatives, savings and the basket.
 *
 * Substitution rule, and there is only one: same canonical key. Same salts,
 * same strengths, same dosage form. No salt swaps, no strength swaps, no
 * "close enough". A product without a canonical key gets no alternatives at
 * all. Everything here is arithmetic — the LLM never touches it.
 */

import { freshnessPenaltyKm, freshnessOf, ageLabelHours, distanceKm } from './freshness'
import { hasNarrowTherapeuticIndex, isRx, requiresCounterVerification } from './rx'
import { saltIdentityKey } from './canonical'
import type { InventoryRow, Pharmacy, Product, StockFreshness } from './types'

export interface OfferRow {
  pharmacy: Pharmacy
  row: InventoryRow
  /** Pharmacist-confirmed timestamp, which may be newer than the seed value. */
  last_stock_update: string | null
}

export interface EngineDeps {
  productById: (id: string) => Product | undefined
  productsByKey: (key: string) => Product[]
  offersFor: (productId: string) => OfferRow[]
  now?: number
}

export interface Offer {
  pharmacy_id: string
  pharmacy_name: string
  is_jan_aushadhi: boolean
  verified: boolean
  licence_no: string | null
  lat: number
  lng: number
  phone: string | null
  opening_hours: string | null
  price: number
  price_per_unit: number
  in_stock: boolean
  is_simulated: boolean
  distance_km: number | null
  freshness: StockFreshness
  stock_age_hours: number | null
  last_stock_update: string | null
  rank_score: number
}

export interface Option {
  product_id: string
  brand_name: string
  manufacturer: string
  composition_raw: string
  dosage_form: string
  pack_size: number
  unit_label: string
  mrp: number
  is_jan_aushadhi: boolean
  is_generic: boolean
  schedule: string
  rx_required: boolean
  counter_verification: boolean
  /** Price we quote: the best in-stock nearby offer, else the pack MRP. */
  price_per_unit: number
  pack_price: number
  price_source: 'nearby_offer' | 'mrp'
  best_offer: Offer | null
  offers_in_radius: number
  in_stock_nearby: boolean
  above_nppa_ceiling: boolean
  nppa_ceiling_per_unit: number | null
  savings_per_unit: number
  savings_total: number
  savings_pct: number
}

export type WarningCode =
  | 'nti_switch'
  | 'duplicate_salt'
  | 'no_substitute'
  | 'rx_required'
  | 'counter_verification'
  | 'above_ceiling'
  | 'no_stock_nearby'

export interface EngineWarning {
  code: WarningCode
  severity: 'info' | 'warn' | 'danger'
  /** Values the UI interpolates into the translated string. */
  params: Record<string, string | number>
  product_ids: string[]
}

export interface ItemResult {
  product_id: string
  qty: number
  salt_key: string
  canonical_key: string | null
  original: Option
  alternatives: Option[]
  best: Option
  /** True when `best` is cheaper than what was prescribed. */
  switchable: boolean
  narrow_therapeutic_index: boolean
  warnings: EngineWarning[]
}

export interface BasketResult {
  items: ItemResult[]
  original_total: number
  best_total: number
  savings_total: number
  savings_pct: number
  duplicate_salt_warnings: EngineWarning[]
  warnings: EngineWarning[]
  /** Demo stock is simulated — the UI must say so wherever stock is shown. */
  stock_is_simulated: boolean
  radius_km: number
  has_location: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

function buildOffers(
  product: Product,
  deps: EngineDeps,
  lat?: number,
  lng?: number,
  radiusKm = 5,
): Offer[] {
  const now = deps.now ?? Date.now()
  const hasLoc = typeof lat === 'number' && typeof lng === 'number'
  const rows = deps.offersFor(product.id)

  const offers: Offer[] = []
  for (const { pharmacy, row, last_stock_update } of rows) {
    const d = hasLoc ? distanceKm(lat as number, lng as number, pharmacy.lat, pharmacy.lng) : null
    if (d !== null && d > radiusKm) continue
    const freshness = freshnessOf(last_stock_update, row.is_simulated, now)
    offers.push({
      pharmacy_id: pharmacy.id,
      pharmacy_name: pharmacy.name,
      is_jan_aushadhi: pharmacy.is_jan_aushadhi,
      verified: pharmacy.verified,
      licence_no: pharmacy.licence_no,
      lat: pharmacy.lat,
      lng: pharmacy.lng,
      phone: pharmacy.phone,
      opening_hours: pharmacy.opening_hours,
      price: row.price,
      price_per_unit: round2(row.price / product.pack_size),
      in_stock: row.in_stock,
      is_simulated: row.is_simulated,
      distance_km: d === null ? null : Math.round(d * 100) / 100,
      freshness,
      stock_age_hours: ageLabelHours(last_stock_update, now),
      last_stock_update,
      rank_score: 0,
    })
  }

  // Ranking: distance, then a freshness penalty, then how far above the
  // cheapest nearby price this store is. Out of stock always sinks.
  const inStockPrices = offers.filter((o) => o.in_stock).map((o) => o.price)
  const minPrice = inStockPrices.length ? Math.min(...inStockPrices) : 0
  for (const o of offers) {
    const priceGap = minPrice > 0 ? (o.price - minPrice) / minPrice : 0
    o.rank_score =
      (o.distance_km ?? 2) +
      freshnessPenaltyKm(o.freshness) +
      priceGap * 1.5 +
      (o.in_stock ? 0 : 1000)
    o.rank_score = Math.round(o.rank_score * 1000) / 1000
  }
  offers.sort((a, b) => a.rank_score - b.rank_score)
  return offers
}

function toOption(
  product: Product,
  offers: Offer[],
  qty: number,
  referencePricePerUnit: number | null,
): Option {
  const inStock = offers.filter((o) => o.in_stock)
  const best = inStock[0] ?? null
  const pricePerUnit = best ? best.price_per_unit : round2(product.mrp / product.pack_size)
  const packPrice = best ? best.price : product.mrp
  const ref = referencePricePerUnit
  const savingsPerUnit = ref === null ? 0 : round2(Math.max(0, ref - pricePerUnit))

  return {
    product_id: product.id,
    brand_name: product.brand_name,
    manufacturer: product.manufacturer,
    composition_raw: product.composition_raw,
    dosage_form: product.dosage_form,
    pack_size: product.pack_size,
    unit_label: product.unit_label,
    mrp: product.mrp,
    is_jan_aushadhi: product.is_jan_aushadhi,
    is_generic: product.is_generic,
    schedule: product.schedule,
    rx_required: isRx(product.schedule),
    counter_verification: requiresCounterVerification(product.schedule),
    price_per_unit: pricePerUnit,
    pack_price: packPrice,
    price_source: best ? 'nearby_offer' : 'mrp',
    best_offer: best,
    offers_in_radius: offers.length,
    in_stock_nearby: inStock.length > 0,
    above_nppa_ceiling:
      product.nppa_ceiling_per_unit !== null && pricePerUnit > product.nppa_ceiling_per_unit,
    nppa_ceiling_per_unit: product.nppa_ceiling_per_unit,
    savings_per_unit: savingsPerUnit,
    savings_total: round2(savingsPerUnit * qty),
    savings_pct: ref && ref > 0 ? Math.round((savingsPerUnit / ref) * 100) : 0,
  }
}

export interface RequestedItem {
  product_id: string
  qty?: number
}

export function buildBasket(
  requested: RequestedItem[],
  deps: EngineDeps,
  opts: { lat?: number; lng?: number; radius_km?: number } = {},
): BasketResult {
  const radius = opts.radius_km ?? 5
  const hasLoc = typeof opts.lat === 'number' && typeof opts.lng === 'number'
  const items: ItemResult[] = []
  const warnings: EngineWarning[] = []

  for (const req of requested) {
    const product = deps.productById(req.product_id)
    if (!product) continue
    const qty = req.qty && req.qty > 0 ? req.qty : product.pack_size

    const originalOffers = buildOffers(product, deps, opts.lat, opts.lng, radius)
    const original = toOption(product, originalOffers, qty, null)

    const siblings = product.canonical_key
      ? deps.productsByKey(product.canonical_key).filter((p) => p.id !== product.id)
      : []

    const alternatives = siblings
      .map((p) => toOption(p, buildOffers(p, deps, opts.lat, opts.lng, radius), qty, original.price_per_unit))
      // Rank: Jan Aushadhi first, then cheapest per unit, then in stock nearby.
      .sort((a, b) => {
        if (a.is_jan_aushadhi !== b.is_jan_aushadhi) return a.is_jan_aushadhi ? -1 : 1
        if (a.price_per_unit !== b.price_per_unit) return a.price_per_unit - b.price_per_unit
        if (a.in_stock_nearby !== b.in_stock_nearby) return a.in_stock_nearby ? -1 : 1
        return 0
      })

    // The basket takes the cheapest option that someone can actually collect
    // nearby; if nothing nearby has stock, it falls back to the cheapest at MRP.
    const collectible = alternatives.filter((a) => a.in_stock_nearby)
    const pool = collectible.length ? collectible : alternatives
    const cheapest = [...pool].sort((a, b) => a.price_per_unit - b.price_per_unit)[0]
    const best = cheapest && cheapest.price_per_unit < original.price_per_unit ? cheapest : original

    const itemWarnings: EngineWarning[] = []
    const nti = hasNarrowTherapeuticIndex(product.salts)
    if (nti && alternatives.length > 0) {
      itemWarnings.push({
        code: 'nti_switch',
        severity: 'danger',
        params: { salt: product.salts.map((s) => s.salt).join(' + ') },
        product_ids: [product.id],
      })
    }
    if (!product.canonical_key) {
      itemWarnings.push({ code: 'no_substitute', severity: 'info', params: {}, product_ids: [product.id] })
    }
    if (original.rx_required) {
      itemWarnings.push({
        code: original.counter_verification ? 'counter_verification' : 'rx_required',
        severity: 'warn',
        params: { schedule: product.schedule },
        product_ids: [product.id],
      })
    }
    if (original.above_nppa_ceiling) {
      itemWarnings.push({
        code: 'above_ceiling',
        severity: 'warn',
        params: {
          price: original.price_per_unit,
          ceiling: product.nppa_ceiling_per_unit as number,
          unit: product.unit_label,
        },
        product_ids: [product.id],
      })
    }
    if (hasLoc && !original.in_stock_nearby && !best.in_stock_nearby) {
      itemWarnings.push({
        code: 'no_stock_nearby',
        severity: 'info',
        params: { radius },
        product_ids: [product.id],
      })
    }

    items.push({
      product_id: product.id,
      qty,
      salt_key: saltIdentityKey(product.salts),
      canonical_key: product.canonical_key,
      original,
      alternatives,
      best,
      switchable: best.product_id !== original.product_id,
      narrow_therapeutic_index: nti,
      warnings: itemWarnings,
    })
  }

  // Duplicate-salt check: two basket items that share a salt, compared on
  // canonical salt names only. A combination product counts — taking Combiflam
  // and Dolo together is two doses of paracetamol. This is NOT an interaction
  // checker and does not pretend to be one.
  const duplicate: EngineWarning[] = []
  const bySalt = new Map<string, ItemResult[]>()
  for (const it of items) {
    const product = deps.productById(it.product_id)
    for (const s of product?.salts ?? []) {
      const g = bySalt.get(s.salt) ?? []
      if (!g.some((x) => x.product_id === it.product_id)) g.push(it)
      bySalt.set(s.salt, g)
    }
  }
  for (const [salt, group] of bySalt) {
    if (group.length < 2) continue
    duplicate.push({
      code: 'duplicate_salt',
      severity: 'danger',
      params: {
        salt,
        names: group.map((g) => g.original.brand_name).join(', '),
      },
      product_ids: group.map((g) => g.product_id),
    })
  }

  const originalTotal = round2(
    items.reduce((sum, it) => sum + it.original.price_per_unit * it.qty, 0),
  )
  const bestTotal = round2(items.reduce((sum, it) => sum + it.best.price_per_unit * it.qty, 0))
  const savings = round2(Math.max(0, originalTotal - bestTotal))

  return {
    items,
    original_total: originalTotal,
    best_total: bestTotal,
    savings_total: savings,
    savings_pct: originalTotal > 0 ? Math.round((savings / originalTotal) * 100) : 0,
    duplicate_salt_warnings: duplicate,
    warnings,
    stock_is_simulated: true,
    radius_km: radius,
    has_location: hasLoc,
  }
}

export { buildOffers }
