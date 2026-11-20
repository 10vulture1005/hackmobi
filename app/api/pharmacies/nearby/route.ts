import { nearbyPharmacies } from '@/lib/server/engine'
import { num, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const limited = rateLimit(req, 'nearby', 120)
  if (limited) return limited
  const p = new URL(req.url).searchParams

  const rows = nearbyPharmacies({
    lat: num(p.get('lat')),
    lng: num(p.get('lng')),
    radius_km: Math.min(num(p.get('radius_km')) ?? 5, 25),
    product_id: p.get('product_id') ?? undefined,
    jan_aushadhi_only: p.get('jan_aushadhi_only') === '1',
    limit: Math.min(num(p.get('limit')) ?? 40, 200),
  })

  return ok({
    pharmacies: rows,
    stock_is_simulated: true,
    note: 'Per-pharmacy stock is demo data. Freshness is reported as unknown for simulated rows.',
  })
}
