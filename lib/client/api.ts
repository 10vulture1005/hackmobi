import type { BasketResult, Offer } from '@/lib/engine/alternatives'
import type { Product, Scheme } from '@/lib/engine/types'
import type { NearbyPharmacy } from '@/lib/server/engine'
import type { ExtractedItem, ExtractedPrescription, ReservationRecord, ValidationResult } from '@/lib/server/store'
import type { DrugInfoContent } from '@/data/drug_info'

export type { BasketResult, NearbyPharmacy, Offer, Product, ReservationRecord, Scheme, ValidationResult }

export interface ApiError {
  error: { code: string; message: string; details?: unknown }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : { 'content-type': 'application/json', ...init?.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (body as ApiError | null)?.error
    const e = new Error(err?.message ?? 'Request failed') as Error & { code?: string; details?: unknown; status: number }
    e.code = err?.code
    e.details = err?.details
    e.status = res.status
    throw e
  }
  return body as T
}

export interface MatchBlock {
  confident: boolean
  best: { product: Product; score: number } | null
  candidates: Array<{ product: Product; score: number; matched_on?: string }>
}

export const api = {
  search: (q: string, extra: Record<string, string | number | undefined> = {}) => {
    const p = new URLSearchParams({ q })
    for (const [k, v] of Object.entries(extra)) if (v !== undefined) p.set(k, String(v))
    return call<{ query: string } & MatchBlock>(`/api/medicines/search?${p}`)
  },

  alternatives: (body: {
    items: Array<{ product_id: string; qty?: number }>
    lat?: number
    lng?: number
    radius_km?: number
    language?: string
  }) => call<BasketResult>('/api/alternatives', { method: 'POST', body: JSON.stringify(body) }),

  nearby: (p: {
    lat?: number
    lng?: number
    radius_km?: number
    product_id?: string
    jan_aushadhi_only?: boolean
    limit?: number
  }) => {
    const q = new URLSearchParams()
    if (p.lat !== undefined) q.set('lat', String(p.lat))
    if (p.lng !== undefined) q.set('lng', String(p.lng))
    if (p.radius_km !== undefined) q.set('radius_km', String(p.radius_km))
    if (p.product_id) q.set('product_id', p.product_id)
    if (p.jan_aushadhi_only) q.set('jan_aushadhi_only', '1')
    if (p.limit) q.set('limit', String(p.limit))
    return call<{ pharmacies: NearbyPharmacy[]; stock_is_simulated: boolean }>(`/api/pharmacies/nearby?${q}`)
  },

  parsePrescription: (input: { demo_slug?: string; file?: File }) => {
    if (input.file) {
      const form = new FormData()
      form.append('image', input.file)
      return call<ParsePrescriptionResponse>('/api/prescription/parse', { method: 'POST', body: form })
    }
    return call<ParsePrescriptionResponse>('/api/prescription/parse', {
      method: 'POST',
      body: JSON.stringify({ demo_slug: input.demo_slug }),
    })
  },

  scanStrip: (input: { demo_key?: string; file?: File }) => {
    if (input.file) {
      const form = new FormData()
      form.append('image', input.file)
      return call<{ via: string; scan: StripScan; match: MatchBlock }>('/api/scan/strip', { method: 'POST', body: form })
    }
    return call<{ via: string; scan: StripScan; match: MatchBlock }>('/api/scan/strip', {
      method: 'POST',
      body: JSON.stringify({ demo_key: input.demo_key }),
    })
  },

  validatePrescription: (prescription_id: string, product_ids: string[]) =>
    call<ValidationResult>('/api/prescription/validate', {
      method: 'POST',
      body: JSON.stringify({ prescription_id, product_ids }),
    }),

  explain: (body: {
    items: Array<{ product_id: string; qty?: number }>
    language: string
    lat?: number
    lng?: number
    radius_km?: number
  }) => call<{ lines: string[]; spoken: string; via: string }>('/api/explain', { method: 'POST', body: JSON.stringify(body) }),

  drugInfo: (productId: string, language: string) =>
    call<{
      product_id: string
      brand_name: string
      display_name: string
      content: DrugInfoContent
      source_urls: string[]
      reviewed: boolean
      translation_notice: boolean
      via: string
      disclaimer: string
    }>(`/api/medicines/${productId}/info`, { method: 'POST', body: JSON.stringify({ language }) }),

  reserve: (body: {
    pharmacy_id: string
    items: Array<{ product_id: string; qty?: number }>
    customer_name: string
    customer_phone?: string | null
    prescription_id?: string | null
    estimated_savings?: number
  }) => call<{ reservation: ReservationRecord }>('/api/reservations', { method: 'POST', body: JSON.stringify(body) }),

  reservation: (code: string) => call<{ reservation: ReservationRecord }>(`/api/reservations/${code}`),

  schemes: () => call<{ schemes: Scheme[] }>('/api/schemes/ask'),

  askSchemes: (body: {
    question?: string
    age?: number | null
    state?: string | null
    ration_card?: string | null
    income_band?: string | null
    condition?: string | null
    language: string
  }) =>
    call<{
      answer: string
      scheme_ids: string[]
      schemes: Scheme[]
      missing_info_questions: string[]
      via: string
    }>('/api/schemes/ask', { method: 'POST', body: JSON.stringify(body) }),

  demoPrescriptions: () =>
    call<{
      prescriptions: Array<{
        id: string
        slug: string
        label: string
        image: string
        demonstrates: string[]
        item_count: number
      }>
    }>('/api/demo/prescriptions'),

  stats: () => call<AdminStats>('/api/admin/stats'),

  pharmacistInventory: (pharmacy_id: string, q = '', filter = 'all') =>
    call<PharmacistInventory>(
      `/api/pharmacist/inventory?pharmacy_id=${pharmacy_id}&q=${encodeURIComponent(q)}&filter=${filter}`,
    ),

  pharmacistUpdate: (pharmacy_id: string, updates: Array<{ product_id: string; in_stock?: boolean; price?: number }>) =>
    call<{ updated: number; last_stock_update: string }>('/api/pharmacist/inventory', {
      method: 'PUT',
      body: JSON.stringify({ pharmacy_id, updates }),
    }),

  pharmacistConfirmStock: (pharmacy_id: string) =>
    call<{ last_stock_update: string }>('/api/pharmacist/inventory/confirm-current', {
      method: 'POST',
      body: JSON.stringify({ pharmacy_id }),
    }),

  pharmacistImport: (pharmacy_id: string, csv: string, commit: boolean) =>
    call<ImportResult>('/api/pharmacist/inventory/import', {
      method: 'POST',
      body: JSON.stringify({ pharmacy_id, csv, commit }),
    }),

  pharmacistReservations: (pharmacy_id: string) =>
    call<{ reservations: PharmacistReservation[] }>(`/api/pharmacist/reservations?pharmacy_id=${pharmacy_id}`),

  pharmacistAction: (code: string, action: string, reason?: string) =>
    call<{ reservation: ReservationRecord }>(`/api/pharmacist/reservations/${code}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, reason }),
    }),
}

export interface StripScan {
  brand_name: string
  salt_text: string
  strength: string | null
  manufacturer: string | null
  confidence: number
}

export interface ReviewItem extends ExtractedItem {
  match: MatchBlock
}

export interface ParsePrescriptionResponse {
  prescription_id: string
  image_url: string | null
  via: string
  extracted: Omit<ExtractedPrescription, 'items'> & { items: ReviewItem[] }
  retention_note: string
}

export interface AdminStats {
  /** True when the aggregates include seeded demo activity, not just this session. */
  includes_demo_activity: boolean
  searches: number
  savings_generated: number
  reservations: number
  reservations_by_status: Record<string, number>
  top_searches: Array<{ query: string; count: number; savings: number }>
  search_heat: Array<{ lat: number | null; lng: number | null; savings: number }>
  generic_gap_areas: Array<{ area: string; nearest_kendra_km: number }>
  catalogue: {
    products: number
    canonical_keys: number
    jan_aushadhi_products: number
    jan_aushadhi_coverage_pct: number
    pharmacies: number
    kendras: number
  }
}

export interface PharmacistInventoryRow {
  product_id: string
  brand_name: string
  composition_raw: string
  manufacturer: string
  pack_size: number
  unit_label: string
  mrp: number
  schedule: string
  is_rx: boolean
  is_jan_aushadhi: boolean
  in_stock: boolean
  price: number
  price_per_unit: number
  is_simulated: boolean
  updated_at: string
}

export interface PharmacistInventory {
  pharmacy: {
    id: string
    name: string
    address: string
    is_jan_aushadhi: boolean
    verified: boolean
    licence_no: string | null
    last_stock_update: string | null
    stock_freshness: string
  }
  rows: PharmacistInventoryRow[]
  total: number
  stock_is_simulated: boolean
}

export interface ImportResult {
  pharmacy_id: string
  committed: boolean
  applied: number
  summary: { total: number; ok: number; needs_review: number; unmatched: number; invalid: number }
  rows: Array<{
    line: number
    input: string
    matched_product_id: string | null
    matched_name: string | null
    score: number
    price: number | null
    in_stock: boolean | null
    status: 'ok' | 'needs_review' | 'unmatched' | 'invalid'
    message?: string
  }>
}

export interface PharmacistReservation extends ReservationRecord {
  prescription: {
    id: string
    image_url: string | null
    validation_status: string | null
    doctor_name: string | null
    registration_no: string | null
    clinic_or_hospital: string | null
    prescription_date: string | null
    legibility_score: number
    items: string[]
  } | null
}
