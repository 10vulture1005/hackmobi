import { explain } from '@/lib/ai/explain'
import { isLanguage } from '@/lib/ai/provider'
import { basket } from '@/lib/server/engine'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/**
 * Accepts either a basket request (recomputed server-side, so the numbers in
 * the summary are the engine's own) or nothing at all.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'explain', 60)
  if (limited) return limited

  let body: {
    language?: string
    items?: Array<{ product_id: string; qty?: number }>
    lat?: number
    lng?: number
    radius_km?: number
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, 'bad_json', 'Could not read the request body.')
  }

  const language = isLanguage(body.language) ? body.language : 'en'
  if (!body.items?.length) return fail(400, 'no_items', 'Send the basket items to explain.')

  const result = basket(body.items.slice(0, 20), {
    lat: body.lat,
    lng: body.lng,
    radius_km: body.radius_km,
  })
  const explanation = await explain(result, language)
  return ok(explanation)
}
