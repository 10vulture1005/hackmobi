import { basket } from '@/lib/server/engine'
import { recordSearch } from '@/lib/server/events'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

interface Body {
  items?: Array<{ product_id?: string; qty?: number }>
  lat?: number
  lng?: number
  radius_km?: number
  language?: string
}

export async function POST(req: Request) {
  const limited = rateLimit(req, 'alternatives', 90)
  if (limited) return limited

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return fail(400, 'bad_json', 'Could not read the request body.')
  }

  const items = (body.items ?? [])
    .filter((i): i is { product_id: string; qty?: number } => typeof i.product_id === 'string')
    .slice(0, 20)
  if (items.length === 0) return fail(400, 'no_items', 'Send at least one medicine.')

  const result = basket(items, {
    lat: body.lat,
    lng: body.lng,
    radius_km: Math.min(body.radius_km ?? 5, 25),
  })

  recordSearch({
    query: result.items.map((i) => i.original.brand_name).join(' + ').slice(0, 64),
    canonical_key: result.items[0]?.canonical_key ?? null,
    lat: body.lat,
    lng: body.lng,
    language: body.language ?? 'en',
    savings_amount: result.savings_total,
  })

  return ok(result)
}
