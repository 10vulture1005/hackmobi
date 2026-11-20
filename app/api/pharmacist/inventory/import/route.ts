import { db, setInventory } from '@/lib/data/db'
import { searchProducts } from '@/lib/server/engine'
import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'

/**
 * CSV import with a dry-run preview. Columns, in any order, case-insensitive:
 *   medicine | brand | name   (required)
 *   price | mrp                (optional, pack price)
 *   in_stock | stock           (optional: yes/no/1/0/true/false)
 * Unmatched rows are reported, never guessed into the wrong product.
 */
interface PreviewRow {
  line: number
  input: string
  matched_product_id: string | null
  matched_name: string | null
  score: number
  price: number | null
  in_stock: boolean | null
  status: 'ok' | 'needs_review' | 'unmatched' | 'invalid'
  message?: string
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

const TRUTHY = new Set(['1', 'yes', 'y', 'true', 'in stock', 'instock', 'available', 'haan'])
const FALSY = new Set(['0', 'no', 'n', 'false', 'out of stock', 'outofstock', 'nil', 'nahi'])

export async function POST(req: Request) {
  const limited = rateLimit(req, 'import', 20)
  if (limited) return limited

  const contentType = req.headers.get('content-type') ?? ''
  let csv = ''
  let pharmacyId = ''
  let commit = false

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    pharmacyId = (form.get('pharmacy_id') as string | null) ?? ''
    commit = form.get('commit') === '1'
    if (file instanceof File) csv = await file.text()
  } else {
    try {
      const body = (await req.json()) as { csv?: string; pharmacy_id?: string; commit?: boolean }
      csv = body.csv ?? ''
      pharmacyId = body.pharmacy_id ?? ''
      commit = !!body.commit
    } catch {
      return fail(400, 'bad_json', 'Could not read the request body.')
    }
  }

  if (!pharmacyId) return fail(400, 'missing_pharmacy', 'pharmacy_id is required.')
  if (!db().pharmacyById.get(pharmacyId)) return fail(404, 'unknown_pharmacy', 'No such pharmacy.')
  if (!csv.trim()) return fail(400, 'empty_csv', 'The file had no rows.')

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase())
  const nameIdx = header.findIndex((h) => ['medicine', 'brand', 'name', 'product', 'item'].includes(h))
  const priceIdx = header.findIndex((h) => ['price', 'mrp', 'rate', 'amount'].includes(h))
  const stockIdx = header.findIndex((h) => ['in_stock', 'stock', 'available', 'qty', 'quantity'].includes(h))
  if (nameIdx === -1) {
    return fail(
      400,
      'missing_name_column',
      'The file needs a medicine name column (medicine, brand, name, product or item).',
    )
  }

  const rows: PreviewRow[] = []
  for (let i = 1; i < Math.min(lines.length, 2001); i++) {
    const cells = splitCsvLine(lines[i])
    const input = cells[nameIdx] ?? ''
    if (!input) {
      rows.push({ line: i + 1, input, matched_product_id: null, matched_name: null, score: 0, price: null, in_stock: null, status: 'invalid', message: 'No medicine name' })
      continue
    }

    const priceRaw = priceIdx >= 0 ? cells[priceIdx] : ''
    const price = priceRaw ? Number(priceRaw.replace(/[^0-9.]/g, '')) : null
    const stockRaw = (stockIdx >= 0 ? cells[stockIdx] : '').toLowerCase()
    let inStock: boolean | null = null
    if (stockRaw) {
      if (TRUTHY.has(stockRaw)) inStock = true
      else if (FALSY.has(stockRaw)) inStock = false
      else if (/^\d+$/.test(stockRaw)) inStock = Number(stockRaw) > 0
    }

    const match = searchProducts(input, 1)
    const best = match.candidates[0]
    if (!best || best.score < 0.6) {
      rows.push({ line: i + 1, input, matched_product_id: null, matched_name: null, score: best ? Math.round(best.score * 100) / 100 : 0, price, in_stock: inStock, status: 'unmatched', message: 'No confident match — fix the name or add it manually' })
      continue
    }

    rows.push({
      line: i + 1,
      input,
      matched_product_id: best.product.id,
      matched_name: best.product.brand_name,
      score: Math.round(best.score * 100) / 100,
      price: price !== null && Number.isFinite(price) ? price : null,
      in_stock: inStock,
      status: match.confident ? 'ok' : 'needs_review',
    })
  }

  let applied = 0
  if (commit) {
    for (const r of rows) {
      if (r.status === 'unmatched' || r.status === 'invalid' || !r.matched_product_id) continue
      const patch: { in_stock?: boolean; price?: number } = {}
      if (r.in_stock !== null) patch.in_stock = r.in_stock
      if (r.price !== null) patch.price = r.price
      if (Object.keys(patch).length === 0) continue
      setInventory(pharmacyId, r.matched_product_id, patch)
      applied++
    }
  }

  return ok({
    pharmacy_id: pharmacyId,
    committed: commit,
    applied,
    summary: {
      total: rows.length,
      ok: rows.filter((r) => r.status === 'ok').length,
      needs_review: rows.filter((r) => r.status === 'needs_review').length,
      unmatched: rows.filter((r) => r.status === 'unmatched').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
    },
    rows,
  })
}
