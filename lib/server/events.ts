/**
 * Anonymous search events, for the /impact page.
 *
 * No personal data, ever: no name, no phone, no prescription content, and
 * coordinates rounded to roughly a kilometre so a search cannot be traced to a
 * household.
 */

export interface SearchEvent {
  id: number
  created_at: string
  query: string
  canonical_key: string | null
  lat_bucket: number | null
  lng_bucket: number | null
  language: string
  savings_amount: number
}

const events: SearchEvent[] = []
let id = 0

const bucket = (n: number | undefined | null) =>
  typeof n === 'number' ? Math.round(n * 100) / 100 : null

export function recordSearch(e: {
  query: string
  canonical_key?: string | null
  lat?: number
  lng?: number
  language?: string
  savings_amount?: number
}) {
  events.push({
    id: ++id,
    created_at: new Date().toISOString(),
    query: e.query.slice(0, 64),
    canonical_key: e.canonical_key ?? null,
    lat_bucket: bucket(e.lat),
    lng_bucket: bucket(e.lng),
    language: e.language ?? 'en',
    savings_amount: Math.round((e.savings_amount ?? 0) * 100) / 100,
  })
  if (events.length > 5000) events.splice(0, events.length - 5000)
}

export function allEvents(): SearchEvent[] {
  return events
}
