import { confirmStockCurrent, db } from '@/lib/data/db'
import { fail, ok } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/** One tap: "everything you see is what I have right now." Refreshes freshness. */
export async function POST(req: Request) {
  let body: { pharmacy_id?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, 'bad_json', 'Could not read the request body.')
  }
  if (!body.pharmacy_id) return fail(400, 'missing_pharmacy', 'pharmacy_id is required.')
  if (!db().pharmacyById.get(body.pharmacy_id)) {
    return fail(404, 'unknown_pharmacy', 'No such pharmacy.')
  }
  const at = new Date().toISOString()
  confirmStockCurrent(body.pharmacy_id, at)
  return ok({ pharmacy_id: body.pharmacy_id, last_stock_update: at, stock_freshness: 'fresh' })
}
