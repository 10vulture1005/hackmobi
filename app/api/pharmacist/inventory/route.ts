import { db, inventoryRowsForPharmacy, lastStockUpdate, setInventory } from '@/lib/data/db'
import { freshnessOf } from '@/lib/engine/freshness'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/**
 * Pharmacist inventory. In production this is behind Supabase Auth with RLS so
 * a pharmacist can only touch their own pharmacy's rows; the demo takes the
 * pharmacy id directly and says so in the README.
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const pharmacyId = p.get('pharmacy_id')
  if (!pharmacyId) return fail(400, 'missing_pharmacy', 'pharmacy_id is required.')
  const d = db()
  const pharmacy = d.pharmacyById.get(pharmacyId)
  if (!pharmacy) return fail(404, 'unknown_pharmacy', 'No such pharmacy.')

  const q = (p.get('q') ?? '').toLowerCase()
  const filter = p.get('filter') ?? 'all'

  const rows = inventoryRowsForPharmacy(pharmacyId)
    .map((row) => {
      const product = d.productById.get(row.product_id)
      if (!product) return null
      return {
        product_id: product.id,
        brand_name: product.brand_name,
        composition_raw: product.composition_raw,
        manufacturer: product.manufacturer,
        pack_size: product.pack_size,
        unit_label: product.unit_label,
        mrp: product.mrp,
        schedule: product.schedule,
        is_rx: product.is_rx,
        is_jan_aushadhi: product.is_jan_aushadhi,
        in_stock: row.in_stock,
        price: row.price,
        price_per_unit: Math.round((row.price / product.pack_size) * 100) / 100,
        is_simulated: row.is_simulated,
        updated_at: row.updated_at,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .filter((r) => !q || r.brand_name.toLowerCase().includes(q) || r.composition_raw.toLowerCase().includes(q))
    .filter((r) => (filter === 'out_of_stock' ? !r.in_stock : filter === 'rx' ? r.is_rx : true))
    .sort((a, b) => a.brand_name.localeCompare(b.brand_name))

  const updated = lastStockUpdate(pharmacy)
  return ok({
    pharmacy: {
      id: pharmacy.id,
      name: pharmacy.name,
      address: pharmacy.address,
      is_jan_aushadhi: pharmacy.is_jan_aushadhi,
      verified: pharmacy.verified,
      licence_no: pharmacy.licence_no,
      last_stock_update: updated,
      stock_freshness: freshnessOf(updated, false),
    },
    rows,
    total: rows.length,
    stock_is_simulated: true,
  })
}

export async function PUT(req: Request) {
  const limited = rateLimit(req, 'inventory_write', 120)
  if (limited) return limited

  let body: {
    pharmacy_id?: string
    updates?: Array<{ product_id: string; in_stock?: boolean; price?: number }>
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, 'bad_json', 'Could not read the request body.')
  }
  if (!body.pharmacy_id) return fail(400, 'missing_pharmacy', 'pharmacy_id is required.')
  if (!body.updates?.length) return fail(400, 'no_updates', 'Send at least one update.')

  for (const u of body.updates.slice(0, 500)) {
    if (!u.product_id) continue
    const patch: { in_stock?: boolean; price?: number } = {}
    if (typeof u.in_stock === 'boolean') patch.in_stock = u.in_stock
    if (typeof u.price === 'number' && u.price >= 0) patch.price = Math.round(u.price * 100) / 100
    setInventory(body.pharmacy_id, u.product_id, patch)
  }

  return ok({ updated: body.updates.length, last_stock_update: new Date().toISOString() })
}
