import { getReservation } from '@/lib/server/store'
import { fail, ok } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params
  const reservation = getReservation(code)
  if (!reservation) return fail(404, 'not_found', 'No reservation with that code.')
  return ok({ reservation })
}
