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

let demoSeeded = false

export function includesDemoActivity(): boolean {
  return demoSeeded
}

/**
 * The impact page is a pitch artifact, and a cold process has no history to
 * aggregate. This seeds a few days of plausible activity so the charts mean
 * something on first load. It is labelled as seeded in the API response and on
 * the page itself, and real searches land alongside it.
 */
export function seedDemoEvents() {
  if (demoSeeded || events.length > 0) return
  demoSeeded = true

  const queries: Array<[string, number]> = [
    ['Dolo 650', 10], ['Paracetamol 500', 9], ['Metformin 500', 18], ['Amlopres 5', 16],
    ['Atorva 10', 37], ['Augmentin 625 Duo', 127], ['Alerid 10', 26], ['Pan 40', 88],
    ['Thyronorm 50', 32], ['Shelcal 500', 36], ['Combiflam', 12], ['Azithral 500', 44],
    ['Montair 10', 39], ['Telma 40', 65], ['Glycomet 500', 106],
  ]
  // The demo city's localities, so the search grid matches the map.
  const places: Array<[number, number]> = [
    [26.85, 80.95], [26.86, 81.0], [26.89, 80.98], [26.89, 80.94], [26.8, 80.89],
    [26.86, 80.91], [26.84, 80.88], [26.91, 80.93], [26.78, 80.94], [26.9, 81.03],
  ]
  const languages = ['hi', 'hi', 'hi', 'en', 'awa']

  // Deterministic: the same numbers every time the process starts.
  let seed = 7
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }

  for (let i = 0; i < 48; i++) {
    const [query, saving] = queries[Math.floor(rnd() * queries.length)]
    const [lat, lng] = places[Math.floor(rnd() * places.length)]
    events.push({
      id: ++id,
      created_at: new Date(Date.now() - Math.floor(rnd() * 6 * 86400_000)).toISOString(),
      query,
      canonical_key: null,
      lat_bucket: Math.round((lat + (rnd() - 0.5) * 0.02) * 100) / 100,
      lng_bucket: Math.round((lng + (rnd() - 0.5) * 0.02) * 100) / 100,
      language: languages[Math.floor(rnd() * languages.length)],
      savings_amount: Math.round(saving * (0.8 + rnd() * 0.6) * 100) / 100,
    })
  }
}
