import { ReservationError, updateReservation, type PharmacistAction } from '@/lib/server/store'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

const ACTIONS: PharmacistAction[] = [
  'confirm',
  'reject',
  'collected',
  'verify_prescription',
  'reject_prescription',
]

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const limited = rateLimit(req, 'pharmacist_actions', 120)
  if (limited) return limited
  const { code } = await ctx.params

  let body: { action?: string; reason?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, 'bad_json', 'Could not read the request body.')
  }

  const action = body.action as PharmacistAction
  if (!ACTIONS.includes(action)) {
    return fail(400, 'bad_action', `action must be one of: ${ACTIONS.join(', ')}`)
  }

  try {
    const reservation = updateReservation(code, action, body.reason)
    return ok({ reservation })
  } catch (e) {
    if (e instanceof ReservationError) {
      return fail(e.code === 'not_found' ? 404 : 409, e.code, e.message, e.details)
    }
    return fail(500, 'update_failed', 'Could not update that reservation.')
  }
}
