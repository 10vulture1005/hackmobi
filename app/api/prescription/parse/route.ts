import { parsePrescription } from '@/lib/ai/ocr'
import { searchProducts } from '@/lib/server/engine'
import { ensureDemoPrescriptions, getPrescription, savePrescription } from '@/lib/server/store'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BYTES = 6 * 1024 * 1024

/**
 * Reads a prescription image into structured items, then attaches our own
 * match candidates for each line. Nothing is searched until the citizen
 * confirms the lines on the review screen — a misread name must be correctable
 * before it becomes a price comparison.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'ocr', 20)
  if (limited) return limited

  const contentType = req.headers.get('content-type') ?? ''
  let image: { mime: string; data: string } | undefined
  let demoSlug: string | undefined
  let imageUrl: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('image')
    demoSlug = (form.get('demo_slug') as string | null) ?? undefined
    if (file instanceof File) {
      if (file.size > MAX_BYTES) {
        return fail(413, 'image_too_large', 'Please upload an image under 6 MB.')
      }
      const buf = Buffer.from(await file.arrayBuffer())
      image = { mime: file.type || 'image/jpeg', data: buf.toString('base64') }
    }
  } else {
    try {
      const body = (await req.json()) as { demo_slug?: string; image_base64?: string; mime?: string }
      demoSlug = body.demo_slug
      if (body.image_base64) {
        image = { mime: body.mime ?? 'image/jpeg', data: body.image_base64 }
      }
    } catch {
      /* an empty body means "give me the demo prescription" */
    }
  }

  const parsed = await parsePrescription({ image, demo_slug: demoSlug })

  // The demo prescriptions keep their stable ids so their validation is cached.
  let record
  if (parsed.via === 'demo_fixture' && parsed.demo_slug) {
    ensureDemoPrescriptions()
    const { DEMO_PRESCRIPTIONS } = await import('@/lib/ai/demo')
    const demo = DEMO_PRESCRIPTIONS.find((d) => d.slug === parsed.demo_slug)
    record = demo ? getPrescription(demo.id) : undefined
    imageUrl = demo?.image ?? null
  }
  if (!record) {
    record = savePrescription(parsed.extracted, {
      image_url: imageUrl,
      source: parsed.via === 'demo_fixture' ? 'demo' : 'upload',
    })
  }

  const items = parsed.extracted.items.map((item) => {
    // Only add the strength when the written name does not already carry it,
    // so "Glycomet 500" does not become "Glycomet 500 500mg".
    const name = item.brand_or_generic_name ?? ''
    const strengthNumber = item.strength?.match(/\d+(?:\.\d+)?/)?.[0]
    const needsStrength = !!strengthNumber && !name.includes(strengthNumber)
    const query = [name, needsStrength ? item.strength : null].filter(Boolean).join(' ')
    const match = searchProducts(query, 3)
    return {
      ...item,
      match: {
        confident: match.confident,
        best: match.best ? { product: match.best.product, score: Math.round(match.best.score * 100) / 100 } : null,
        candidates: match.candidates.map((c) => ({
          product: c.product,
          score: Math.round(c.score * 100) / 100,
        })),
      },
    }
  })

  return ok({
    prescription_id: record.id,
    image_url: record.image_url,
    via: parsed.via,
    extracted: { ...parsed.extracted, items },
    retention_note: 'Prescription images are deleted after 30 days.',
  })
}
