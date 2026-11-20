import { searchProducts } from '@/lib/server/engine'
import { recordSearch } from '@/lib/server/events'
import { fail, num, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const limited = rateLimit(req, 'search', 120)
  if (limited) return limited

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return fail(400, 'query_too_short', 'Type at least two letters.')
  const limit = Math.min(num(url.searchParams.get('limit')) ?? 8, 25)

  const result = searchProducts(q, limit)
  recordSearch({
    query: q,
    canonical_key: result.best?.product.canonical_key ?? null,
    lat: num(url.searchParams.get('lat')),
    lng: num(url.searchParams.get('lng')),
    language: url.searchParams.get('language') ?? 'en',
  })

  return ok({
    query: result.query,
    confident: result.confident,
    best: result.best
      ? { product: result.best.product, score: Math.round(result.best.score * 100) / 100 }
      : null,
    // Below the confidence threshold the client must show "Did you mean…?"
    candidates: result.candidates.map((c) => ({
      product: c.product,
      score: Math.round(c.score * 100) / 100,
      matched_on: c.matched_on,
    })),
  })
}
