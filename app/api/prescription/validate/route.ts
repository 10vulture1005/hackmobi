import { ensureDemoPrescriptions, validatePrescription } from '@/lib/server/store'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/**
 * Deterministic prescription check. The model is not involved: this compares
 * the extracted items against the medicines being reserved, checks the date
 * against the schedule's validity window, checks that a prescriber is named
 * and that the page was legible. The pharmacist still verifies at pickup.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'validate', 60)
  if (limited) return limited
  ensureDemoPrescriptions()

  let body: { prescription_id?: string; product_ids?: string[] }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, 'bad_json', 'Could not read the request body.')
  }
  if (!body.prescription_id) return fail(400, 'missing_prescription', 'prescription_id is required.')
  if (!body.product_ids?.length) return fail(400, 'missing_products', 'product_ids is required.')

  const result = validatePrescription(body.prescription_id, body.product_ids.slice(0, 20))
  if (!result) return fail(404, 'prescription_not_found', 'That prescription is no longer available.')
  return ok(result)
}
