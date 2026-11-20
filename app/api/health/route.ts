import { db } from '@/lib/data/db'
import { demoMode } from '@/lib/ai/provider'
import { ok } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/** Also the keep-warm target for the free-tier cron ping. */
export async function GET() {
  const d = db()
  return ok({
    status: 'ok',
    service: 'aushadhi-api',
    demo_mode: demoMode(),
    stock_data: 'simulated',
    counts: {
      products: d.products.length,
      pharmacies: d.pharmacies.length,
      inventory: d.inventory.length,
      schemes: d.schemes.length,
      drug_info_salts: d.drugInfo.size,
    },
    time: new Date().toISOString(),
  })
}
