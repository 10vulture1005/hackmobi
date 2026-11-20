/**
 * Stock freshness.
 *
 * Simulated demo stock is always 'unknown' — we never imply we know what is on
 * a shelf. Real pharmacist-confirmed stock ages into fresh / stale / old, and
 * the ranking penalty pushes stale and old stores below fresh ones.
 */

import type { StockFreshness } from './types'

const HOUR = 3600_000

export function freshnessOf(
  lastStockUpdate: string | null | undefined,
  isSimulated: boolean,
  now: number = Date.now(),
): StockFreshness {
  if (isSimulated || !lastStockUpdate) return 'unknown'
  const age = now - new Date(lastStockUpdate).getTime()
  if (!Number.isFinite(age) || age < 0) return 'unknown'
  if (age < 24 * HOUR) return 'fresh'
  if (age < 7 * 24 * HOUR) return 'stale'
  return 'old'
}

/** Added to the effective distance (km) used for ranking. Never shown as distance. */
export function freshnessPenaltyKm(f: StockFreshness): number {
  switch (f) {
    case 'fresh':
      return 0
    case 'unknown':
      return 0.6
    case 'stale':
      return 1.2
    case 'old':
      return 3
  }
}

export function ageLabelHours(lastStockUpdate: string | null | undefined, now = Date.now()): number | null {
  if (!lastStockUpdate) return null
  const age = now - new Date(lastStockUpdate).getTime()
  if (!Number.isFinite(age) || age < 0) return null
  return Math.floor(age / HOUR)
}

/** Haversine distance in kilometres. */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const lat1 = (aLat * Math.PI) / 180
  const lat2 = (bLat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
