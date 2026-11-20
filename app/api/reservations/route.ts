import {
  ReservationError,
  createReservation,
  ensureDemoPrescriptions,
  listReservations,
} from '@/lib/server/store'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  return ok({ reservations: listReservations() })
}

/**
 * The Rx gate lives here, in the API — not in the UI. A prescription-only item
 * without a prescription that covers it is a 422, whatever the client sends.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'reservations', 30)
  if (limited) return limited
  ensureDemoPrescriptions()

  let body: {
    pharmacy_id?: string
    items?: Array<{ product_id: string; qty?: number }>
    customer_name?: string
    customer_phone?: string
    prescription_id?: string
    estimated_savings?: number
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, 'bad_json', 'Could not read the request body.')
  }

  if (!body.pharmacy_id) return fail(400, 'missing_pharmacy', 'pharmacy_id is required.')
  if (!body.items?.length) return fail(400, 'no_items', 'Send at least one medicine.')

  try {
    const reservation = createReservation({
      pharmacy_id: body.pharmacy_id,
      items: body.items.slice(0, 20),
      customer_name: body.customer_name ?? '',
      customer_phone: body.customer_phone ?? null,
      prescription_id: body.prescription_id ?? null,
      estimated_savings: body.estimated_savings,
    })
    return ok({ reservation }, { status: 201 })
  } catch (e) {
    if (e instanceof ReservationError) {
      const rxCodes = ['prescription_required', 'prescription_rejected', 'prescription_not_found']
      const status = rxCodes.includes(e.code) ? 422 : 400
      return fail(status, e.code, e.message, e.details)
    }
    return fail(500, 'reservation_failed', 'Could not create that reservation.')
  }
}
