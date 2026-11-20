import { scanStrip } from '@/lib/ai/ocr'
import { searchProducts } from '@/lib/server/engine'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BYTES = 6 * 1024 * 1024

/**
 * Identifies a medicine from a photo of its strip or box. Identification only:
 * if the medicine turns out to be prescription-only, the Rx gate applies
 * exactly as it does everywhere else.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'ocr', 20)
  if (limited) return limited

  const contentType = req.headers.get('content-type') ?? ''
  let image: { mime: string; data: string } | undefined
  let demoKey: string | undefined

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('image')
    demoKey = (form.get('demo_key') as string | null) ?? undefined
    if (file instanceof File) {
      if (file.size > MAX_BYTES) return fail(413, 'image_too_large', 'Please upload an image under 6 MB.')
      const buf = Buffer.from(await file.arrayBuffer())
      image = { mime: file.type || 'image/jpeg', data: buf.toString('base64') }
    }
  } else {
    try {
      const body = (await req.json()) as { demo_key?: string; image_base64?: string; mime?: string }
      demoKey = body.demo_key
      if (body.image_base64) image = { mime: body.mime ?? 'image/jpeg', data: body.image_base64 }
    } catch {
      /* no body: serve the demo strip */
    }
  }

  const { result, via } = await scanStrip({ image, demo_key: demoKey })
  // As in the prescription route: do not repeat a strength the pack name
  // already carries ("Dolo 650" + "650mg").
  const strengthNumber = result.strength?.match(/\d+(?:\.\d+)?/)?.[0]
  const needsStrength = !!strengthNumber && !result.brand_name.includes(strengthNumber)
  const query =
    [result.brand_name, needsStrength ? result.strength : null].filter(Boolean).join(' ') ||
    result.salt_text
  const match = query ? searchProducts(query, 3) : null

  return ok({
    via,
    scan: result,
    match: match
      ? {
          confident: match.confident && result.confidence >= 0.6,
          best: match.best ? { product: match.best.product, score: Math.round(match.best.score * 100) / 100 } : null,
          candidates: match.candidates.map((c) => ({
            product: c.product,
            score: Math.round(c.score * 100) / 100,
          })),
        }
      : { confident: false, best: null, candidates: [] },
  })
}
