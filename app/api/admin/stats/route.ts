import { db } from '@/lib/data/db'
import { allEvents, includesDemoActivity, seedDemoEvents } from '@/lib/server/events'
import { listReservations } from '@/lib/server/store'
import { distanceKm } from '@/lib/engine/freshness'
import { ok } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/** Aggregates for /impact. Anonymous: nothing here identifies a person. */
export async function GET() {
  const d = db()
  seedDemoEvents()
  const events = allEvents()
  const reservations = listReservations()

  // Group case-insensitively, but display the spelling people actually typed.
  const byQuery = new Map<string, { label: string; count: number; savings: number }>()
  for (const e of events) {
    const k = e.query.toLowerCase()
    const cur = byQuery.get(k) ?? { label: e.query, count: 0, savings: 0 }
    cur.count += 1
    cur.savings += e.savings_amount
    byQuery.set(k, cur)
  }

  const kendras = d.pharmacies.filter((p) => p.is_jan_aushadhi)
  // Areas with no Jan Aushadhi Kendra within 3 km, by locality.
  const byArea = new Map<string, { lat: number; lng: number; n: number }>()
  for (const p of d.pharmacies) {
    const area = p.address.split(',')[0].trim()
    const cur = byArea.get(area) ?? { lat: 0, lng: 0, n: 0 }
    cur.lat += p.lat
    cur.lng += p.lng
    cur.n += 1
    byArea.set(area, cur)
  }
  const gaps: Array<{ area: string; nearest_kendra_km: number }> = []
  for (const [area, agg] of byArea) {
    const lat = agg.lat / agg.n
    const lng = agg.lng / agg.n
    const nearest = Math.min(...kendras.map((k) => distanceKm(lat, lng, k.lat, k.lng)))
    if (nearest > 3) gaps.push({ area, nearest_kendra_km: Math.round(nearest * 100) / 100 })
  }
  gaps.sort((a, b) => b.nearest_kendra_km - a.nearest_kendra_km)

  const janAushadhiShare = (() => {
    const keys = [...d.productsByKey.entries()]
    const withJa = keys.filter(([, group]) => group.some((p) => p.is_jan_aushadhi)).length
    return keys.length ? Math.round((withJa / keys.length) * 100) : 0
  })()

  return ok({
    includes_demo_activity: includesDemoActivity(),
    searches: events.length,
    savings_generated: Math.round(events.reduce((s, e) => s + e.savings_amount, 0) * 100) / 100,
    reservations: reservations.length,
    reservations_by_status: reservations.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {}),
    top_searches: [...byQuery.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([, v]) => ({ query: v.label, count: v.count, savings: Math.round(v.savings * 100) / 100 })),
    search_heat: events
      .filter((e) => e.lat_bucket !== null)
      .map((e) => ({ lat: e.lat_bucket, lng: e.lng_bucket, savings: e.savings_amount })),
    generic_gap_areas: gaps.slice(0, 8),
    catalogue: {
      products: d.products.length,
      canonical_keys: d.productsByKey.size,
      jan_aushadhi_products: d.products.filter((p) => p.is_jan_aushadhi).length,
      jan_aushadhi_coverage_pct: janAushadhiShare,
      pharmacies: d.pharmacies.length,
      kendras: kendras.length,
    },
  })
}
