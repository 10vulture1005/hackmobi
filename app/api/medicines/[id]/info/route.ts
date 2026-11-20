import { db } from '@/lib/data/db'
import { drugInfo } from '@/lib/ai/info'
import { isLanguage } from '@/lib/ai/provider'
import { saltInfoKey } from '@/lib/engine/canonical'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/** Grounded OTC information. Rx products get nothing but their Rx tag. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 'info', 90)
  if (limited) return limited

  const { id } = await ctx.params
  const product = db().productById.get(id)
  if (!product) return fail(404, 'unknown_product', 'That medicine is not in our list.')

  let language = 'en'
  try {
    const body = (await req.json()) as { language?: string }
    if (isLanguage(body.language)) language = body.language
  } catch {
    /* default to English */
  }

  if (product.schedule !== 'OTC') {
    return fail(
      403,
      'rx_only',
      'Information sheets are shown for over-the-counter medicines only. Ask your pharmacist or doctor about this one.',
    )
  }

  const result = await drugInfo(saltInfoKey(product.salts), language as 'en' | 'hi' | 'awa', {
    schedule: product.schedule,
  })

  if ('error' in result) {
    return fail(
      404,
      result.error,
      result.error === 'rx_only'
        ? 'Prescription-only medicine.'
        : 'Information not available — ask your pharmacist.',
    )
  }

  return ok({
    product_id: product.id,
    brand_name: product.brand_name,
    ...result,
    disclaimer: 'General information only, not medical advice. No dosage information is shown.',
  })
}
