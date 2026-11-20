import { DEMO_PRESCRIPTIONS } from '@/lib/ai/demo'
import { ok } from '@/lib/server/http'

export async function GET() {
  return ok({
    prescriptions: DEMO_PRESCRIPTIONS.map((d) => ({
      id: d.id,
      slug: d.slug,
      label: d.label,
      image: d.image,
      demonstrates: d.demonstrates,
      item_count: d.extracted.items.length,
    })),
  })
}
