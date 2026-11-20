/** Wires the pure engine to the seed-data loader. Server only. */

import { db, inventoryRowsForProduct, isStockConfirmed, lastStockUpdate } from '@/lib/data/db'
import {
  buildBasket,
  buildOffers,
  type EngineDeps,
  type OfferRow,
  type RequestedItem,
} from '@/lib/engine/alternatives'
import { search } from '@/lib/engine/match'
import { distanceKm, freshnessOf, ageLabelHours, freshnessPenaltyKm } from '@/lib/engine/freshness'
import type { Product } from '@/lib/engine/types'

export function deps(): EngineDeps {
  const d = db()
  return {
    productById: (id) => d.productById.get(id),
    productsByKey: (key) => d.productsByKey.get(key) ?? [],
    offersFor: (productId) => {
      const out: OfferRow[] = []
      for (const row of inventoryRowsForProduct(productId)) {
        const pharmacy = d.pharmacyById.get(row.pharmacy_id)
        if (!pharmacy) continue
        out.push({ pharmacy, row, last_stock_update: lastStockUpdate(pharmacy) })
      }
      return out
    },
  }
}

export function searchProducts(q: string, limit = 8) {
  return search(db().products, q, limit)
}

export function basket(
  items: RequestedItem[],
  opts: { lat?: number; lng?: number; radius_km?: number } = {},
) {
  return buildBasket(items, deps(), opts)
}

export function productOffers(
  productId: string,
  opts: { lat?: number; lng?: number; radius_km?: number } = {},
) {
  const p = db().productById.get(productId)
  if (!p) return []
  return buildOffers(p, deps(), opts.lat, opts.lng, opts.radius_km ?? 5)
}

export interface NearbyPharmacy {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  phone: string | null
  opening_hours: string | null
  is_jan_aushadhi: boolean
  verified: boolean
  licence_no: string | null
  last_stock_update: string | null
  stock_freshness: ReturnType<typeof freshnessOf>
  stock_age_hours: number | null
  distance_km: number | null
  /** Present only when the query named a product. */
  product?: {
    product_id: string
    brand_name: string
    in_stock: boolean
    price: number
    price_per_unit: number
    is_simulated: boolean
  }
  rank_score: number
}

export function nearbyPharmacies(opts: {
  lat?: number
  lng?: number
  radius_km?: number
  product_id?: string
  limit?: number
  jan_aushadhi_only?: boolean
}): NearbyPharmacy[] {
  const d = db()
  const radius = opts.radius_km ?? 5
  const hasLoc = typeof opts.lat === 'number' && typeof opts.lng === 'number'
  const product: Product | undefined = opts.product_id
    ? d.productById.get(opts.product_id)
    : undefined

  const rowsByPharmacy = new Map<string, { in_stock: boolean; price: number; is_simulated: boolean }>()
  if (product) {
    for (const row of inventoryRowsForProduct(product.id)) {
      rowsByPharmacy.set(row.pharmacy_id, {
        in_stock: row.in_stock,
        price: row.price,
        is_simulated: row.is_simulated,
      })
    }
  }

  const out: NearbyPharmacy[] = []
  for (const ph of d.pharmacies) {
    if (opts.jan_aushadhi_only && !ph.is_jan_aushadhi) continue
    const dist = hasLoc
      ? distanceKm(opts.lat as number, opts.lng as number, ph.lat, ph.lng)
      : null
    if (dist !== null && dist > radius) continue

    const inv = product ? rowsByPharmacy.get(ph.id) : undefined
    if (product && !inv) continue

    const updated = lastStockUpdate(ph)
    // With no product named there is no inventory row to read, so fall back to
    // whether this pharmacy has confirmed its stock at all.
    const simulated = inv ? inv.is_simulated : !isStockConfirmed(ph.id)
    const freshness = freshnessOf(updated, simulated)
    const priceGapPenalty = inv ? inv.price / Math.max(1, product?.mrp ?? 1) - 1 : 0

    out.push({
      id: ph.id,
      name: ph.name,
      address: ph.address,
      lat: ph.lat,
      lng: ph.lng,
      phone: ph.phone,
      opening_hours: ph.opening_hours,
      is_jan_aushadhi: ph.is_jan_aushadhi,
      verified: ph.verified,
      licence_no: ph.licence_no,
      last_stock_update: updated,
      stock_freshness: freshness,
      stock_age_hours: ageLabelHours(updated),
      distance_km: dist === null ? null : Math.round(dist * 100) / 100,
      product: inv
        ? {
            product_id: (product as Product).id,
            brand_name: (product as Product).brand_name,
            in_stock: inv.in_stock,
            price: inv.price,
            price_per_unit: Math.round((inv.price / (product as Product).pack_size) * 100) / 100,
            is_simulated: inv.is_simulated,
          }
        : undefined,
      rank_score:
        (dist ?? 2) +
        freshnessPenaltyKm(freshness) +
        priceGapPenalty * 1.5 +
        (inv && !inv.in_stock ? 1000 : 0),
    })
  }

  out.sort((a, b) => a.rank_score - b.rank_score)
  return out.slice(0, opts.limit ?? 40)
}
