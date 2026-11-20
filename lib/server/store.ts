/**
 * Prescriptions and reservations.
 *
 * In-memory for the demo; the table shapes are in /docs/architecture.md. The
 * two things that matter here are both deterministic server-side code, not
 * model output:
 *   - validatePrescription(): does this paper actually cover this medicine?
 *   - createReservation():    an Rx item without a valid prescription is 422.
 */

import { db } from '@/lib/data/db'
import { searchProducts } from '@/lib/server/engine'
import { prescriptionValidityDays, requiresCounterVerification } from '@/lib/engine/rx'
import type { ReservationStatus, ValidationStatus } from '@/lib/engine/types'
import { DEMO_PRESCRIPTIONS } from '@/lib/ai/demo'

export interface ExtractedItem {
  raw_text: string
  brand_or_generic_name: string
  strength: string | null
  form: string | null
  quantity: number | null
  frequency: string | null
  confidence: number
  /** Set once the citizen confirms the item on the review screen. */
  matched_product_id?: string | null
}

export interface ExtractedPrescription {
  doctor_name: string | null
  registration_no: string | null
  clinic_or_hospital: string | null
  prescription_date: string | null
  patient_name_present: boolean
  signature_or_stamp_present: boolean
  legibility_score: number
  items: ExtractedItem[]
}

export interface PrescriptionRecord {
  id: string
  image_url: string | null
  extracted: ExtractedPrescription
  validation_status: ValidationStatus | null
  reasons: string[]
  created_at: string
  expires_at: string
  source: 'demo' | 'upload'
}

export interface ReservationItem {
  product_id: string
  brand_name: string
  qty: number
  price_per_unit: number
  requires_rx: boolean
  counter_verification: boolean
}

export interface ReservationRecord {
  id: string
  code: string
  pharmacy_id: string
  pharmacy_name: string
  items: ReservationItem[]
  status: ReservationStatus
  customer_name: string
  customer_phone: string | null
  created_at: string
  expires_at: string
  prescription_id: string | null
  requires_rx: boolean
  rx_verified_by_pharmacist: boolean
  rx_verified_at: string | null
  rejection_reason: string | null
  fulfilment_type: 'pickup'
  estimated_savings: number
}

/**
 * Dev-mode note: Next compiles each route segment into its own module graph, so
 * plain module-level state is not shared between route handlers. These stores
 * hang off globalThis so a reservation created by POST /api/reservations is the
 * same row PATCH /api/pharmacist/reservations/[code] updates.
 */
const globalStore = globalThis as typeof globalThis & {
  __sd_prescriptions?: Map<string, PrescriptionRecord>
  __sd_reservations?: Map<string, ReservationRecord>
  __sd_seq?: { n: number }
}

const prescriptions = (globalStore.__sd_prescriptions ??= new Map<string, PrescriptionRecord>())
const reservations = (globalStore.__sd_reservations ??= new Map<string, ReservationRecord>())
const counter = (globalStore.__sd_seq ??= { n: 0 })

const RESERVATION_HOLD_HOURS = 2
const PRESCRIPTION_RETENTION_DAYS = 30
const LEGIBILITY_THRESHOLD = 0.5

const CODE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY2346789'

function newCode(): string {
  let out = ''
  for (let i = 0; i < 5; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return `SD-${out}`
}

export function savePrescription(
  extracted: ExtractedPrescription,
  opts: { image_url?: string | null; source?: 'demo' | 'upload'; id?: string } = {},
): PrescriptionRecord {
  const id = opts.id ?? `rx_${Date.now().toString(36)}_${++counter.n}`
  const now = new Date()
  const record: PrescriptionRecord = {
    id,
    image_url: opts.image_url ?? null,
    extracted,
    validation_status: null,
    reasons: [],
    created_at: now.toISOString(),
    // Images are deleted after 30 days — stated in the README and the UI.
    expires_at: new Date(now.getTime() + PRESCRIPTION_RETENTION_DAYS * 86400_000).toISOString(),
    source: opts.source ?? 'upload',
  }
  prescriptions.set(id, record)
  return record
}

export function getPrescription(id: string): PrescriptionRecord | undefined {
  return prescriptions.get(id)
}

export interface ItemValidation {
  product_id: string
  brand_name: string
  allowed: boolean
  /** Machine-readable so the UI can translate it. */
  reason_code:
    | 'ok'
    | 'otc_no_prescription_needed'
    | 'not_on_prescription'
    | 'prescription_too_old'
    | 'prescription_date_missing'
    | 'prescription_date_in_future'
    | 'prescriber_missing'
    | 'illegible'
    | 'counter_verification_required'
  params: Record<string, string | number>
}

export interface ValidationResult {
  prescription_id: string
  status: ValidationStatus
  items: ItemValidation[]
  reasons: string[]
}

/** Canonical keys the prescription actually covers. */
function coveredKeys(record: PrescriptionRecord): { keys: Set<string>; ids: Set<string> } {
  const d = db()
  const keys = new Set<string>()
  const ids = new Set<string>()
  for (const item of record.extracted.items) {
    if (item.matched_product_id) {
      const p = d.productById.get(item.matched_product_id)
      if (p) {
        ids.add(p.id)
        if (p.canonical_key) keys.add(p.canonical_key)
        continue
      }
    }
    const name = item.brand_or_generic_name ?? ''
    const strengthNumber = item.strength?.match(/\d+(?:\.\d+)?/)?.[0]
    const query = [name, strengthNumber && !name.includes(strengthNumber) ? item.strength : null]
      .filter(Boolean)
      .join(' ')
    const result = searchProducts(query, 3)
    const hit = result.best ?? result.candidates[0]
    if (hit && hit.score >= 0.7) {
      ids.add(hit.product.id)
      if (hit.product.canonical_key) keys.add(hit.product.canonical_key)
    }
  }
  return { keys, ids }
}

/**
 * Deterministic prescription validation. OCR is an aid, never the authority —
 * anything short of a clean pass goes to the pharmacist, and the pharmacist
 * verifies the paper at pickup in every case.
 */
export function validatePrescription(
  prescriptionId: string,
  productIds: string[],
  now = new Date(),
): ValidationResult | null {
  const record = prescriptions.get(prescriptionId)
  if (!record) return null
  const d = db()
  const ex = record.extracted
  const { keys, ids } = coveredKeys(record)

  const reasons: string[] = []
  const hasPrescriber = !!(ex.doctor_name || ex.registration_no)
  if (!hasPrescriber) reasons.push('prescriber_missing')
  if (ex.legibility_score < LEGIBILITY_THRESHOLD) reasons.push('illegible')

  const dateStr = ex.prescription_date
  const date = dateStr ? new Date(dateStr) : null
  const dateValid = !!date && !Number.isNaN(date.getTime())
  if (!dateValid) reasons.push('prescription_date_missing')
  else if ((date as Date).getTime() > now.getTime() + 86400_000) {
    reasons.push('prescription_date_in_future')
  }

  const items: ItemValidation[] = []
  let anyBlocked = false
  let anyNeedsReview = false

  for (const productId of productIds) {
    const product = d.productById.get(productId)
    if (!product) continue
    const brand_name = product.brand_name

    if (!product.is_rx) {
      items.push({
        product_id: productId,
        brand_name,
        allowed: true,
        reason_code: 'otc_no_prescription_needed',
        params: {},
      })
      continue
    }

    const covered = ids.has(productId) || (product.canonical_key ? keys.has(product.canonical_key) : false)
    if (!covered) {
      anyBlocked = true
      items.push({
        product_id: productId,
        brand_name,
        allowed: false,
        reason_code: 'not_on_prescription',
        params: {},
      })
      continue
    }

    if (!dateValid) {
      anyBlocked = true
      items.push({ product_id: productId, brand_name, allowed: false, reason_code: 'prescription_date_missing', params: {} })
      continue
    }
    if ((date as Date).getTime() > now.getTime() + 86400_000) {
      anyBlocked = true
      items.push({ product_id: productId, brand_name, allowed: false, reason_code: 'prescription_date_in_future', params: {} })
      continue
    }

    const maxDays = prescriptionValidityDays(product.schedule)
    const ageDays = Math.floor((now.getTime() - (date as Date).getTime()) / 86400_000)
    if (ageDays > maxDays) {
      anyBlocked = true
      items.push({
        product_id: productId,
        brand_name,
        allowed: false,
        reason_code: 'prescription_too_old',
        params: { age_days: ageDays, max_days: maxDays, schedule: product.schedule },
      })
      continue
    }

    if (!hasPrescriber) {
      anyNeedsReview = true
      items.push({ product_id: productId, brand_name, allowed: false, reason_code: 'prescriber_missing', params: {} })
      continue
    }
    if (ex.legibility_score < LEGIBILITY_THRESHOLD) {
      anyNeedsReview = true
      items.push({ product_id: productId, brand_name, allowed: false, reason_code: 'illegible', params: {} })
      continue
    }
    if (requiresCounterVerification(product.schedule)) {
      // H1 and X are never cleared by software. The pharmacist records the sale.
      anyNeedsReview = true
      items.push({
        product_id: productId,
        brand_name,
        allowed: false,
        reason_code: 'counter_verification_required',
        params: { schedule: product.schedule },
      })
      continue
    }

    items.push({ product_id: productId, brand_name, allowed: true, reason_code: 'ok', params: {} })
  }

  const rxItems = items.filter((i) => i.reason_code !== 'otc_no_prescription_needed')
  let status: ValidationStatus
  if (rxItems.length === 0) status = 'verified'
  else if (anyBlocked) status = 'rejected'
  else if (anyNeedsReview) status = 'needs_pharmacist_review'
  else status = 'verified'

  record.validation_status = status
  record.reasons = reasons
  return { prescription_id: prescriptionId, status, items, reasons }
}

export class ReservationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: unknown = null,
  ) {
    super(message)
  }
}

export function createReservation(input: {
  pharmacy_id: string
  items: Array<{ product_id: string; qty?: number }>
  customer_name: string
  customer_phone?: string | null
  prescription_id?: string | null
  estimated_savings?: number
}): ReservationRecord {
  const d = db()
  const pharmacy = d.pharmacyById.get(input.pharmacy_id)
  if (!pharmacy) throw new ReservationError('Unknown pharmacy', 'unknown_pharmacy')
  if (!input.items?.length) throw new ReservationError('No items to reserve', 'no_items')
  if (!input.customer_name?.trim()) throw new ReservationError('A name is required', 'name_required')

  const items: ReservationItem[] = []
  for (const req of input.items) {
    const p = d.productById.get(req.product_id)
    if (!p) throw new ReservationError(`Unknown product ${req.product_id}`, 'unknown_product')
    const qty = req.qty && req.qty > 0 ? req.qty : p.pack_size
    items.push({
      product_id: p.id,
      brand_name: p.brand_name,
      qty,
      price_per_unit: p.price_per_unit,
      requires_rx: p.is_rx,
      counter_verification: requiresCounterVerification(p.schedule),
    })
  }

  const rxItems = items.filter((i) => i.requires_rx)
  const requiresRx = rxItems.length > 0

  // ---- the Rx gate. Server-side, not a UI rule. ----
  if (requiresRx) {
    if (!input.prescription_id) {
      throw new ReservationError(
        'A prescription is required for one or more of these medicines.',
        'prescription_required',
        { product_ids: rxItems.map((i) => i.product_id) },
      )
    }
    const validation = validatePrescription(
      input.prescription_id,
      rxItems.map((i) => i.product_id),
    )
    if (!validation) {
      throw new ReservationError('Prescription not found', 'prescription_not_found')
    }
    if (validation.status === 'rejected') {
      throw new ReservationError(
        'This prescription does not cover these medicines.',
        'prescription_rejected',
        validation,
      )
    }
  }

  const now = new Date()
  const record: ReservationRecord = {
    id: `res_${now.getTime().toString(36)}_${++counter.n}`,
    code: newCode(),
    pharmacy_id: pharmacy.id,
    pharmacy_name: pharmacy.name,
    items,
    status: 'pending',
    customer_name: input.customer_name.trim(),
    customer_phone: input.customer_phone?.trim() || null,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + RESERVATION_HOLD_HOURS * 3600_000).toISOString(),
    prescription_id: input.prescription_id ?? null,
    requires_rx: requiresRx,
    rx_verified_by_pharmacist: false,
    rx_verified_at: null,
    rejection_reason: null,
    fulfilment_type: 'pickup',
    estimated_savings: input.estimated_savings ?? 0,
  }
  reservations.set(record.code, record)
  return record
}

export function getReservation(code: string): ReservationRecord | undefined {
  const r = reservations.get(code.toUpperCase())
  if (r && r.status === 'pending' && new Date(r.expires_at).getTime() < Date.now()) {
    r.status = 'expired'
  }
  return r
}

export function listReservations(pharmacyId?: string): ReservationRecord[] {
  return [...reservations.values()]
    .filter((r) => !pharmacyId || r.pharmacy_id === pharmacyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export type PharmacistAction =
  | 'confirm'
  | 'reject'
  | 'collected'
  | 'verify_prescription'
  | 'reject_prescription'

export function updateReservation(
  code: string,
  action: PharmacistAction,
  reason?: string,
): ReservationRecord {
  const r = getReservation(code)
  if (!r) throw new ReservationError('Reservation not found', 'not_found')

  switch (action) {
    case 'confirm':
      r.status = 'confirmed'
      break
    case 'reject':
      r.status = 'rejected'
      r.rejection_reason = reason ?? null
      break
    case 'collected':
      // Rx items cannot be handed over until the pharmacist has verified.
      if (r.requires_rx && !r.rx_verified_by_pharmacist) {
        throw new ReservationError(
          'Verify the prescription before marking this collected.',
          'rx_not_verified',
        )
      }
      r.status = 'collected'
      break
    case 'verify_prescription':
      r.rx_verified_by_pharmacist = true
      r.rx_verified_at = new Date().toISOString()
      if (r.status === 'pending') r.status = 'confirmed'
      break
    case 'reject_prescription':
      r.rx_verified_by_pharmacist = false
      r.status = 'rejected'
      r.rejection_reason = reason ?? 'Prescription not accepted'
      break
  }
  return r
}

/**
 * Demo helper: a pharmacist opening a dashboard with an empty queue has nothing
 * to show, so the first time a given pharmacy is opened we seed two waiting
 * requests for it — one over-the-counter, one prescription-only and unverified,
 * which is the pair that demonstrates the counter rule.
 */
export function seedDemoReservations(pharmacyId: string) {
  const existing = [...reservations.values()].some((r) => r.pharmacy_id === pharmacyId)
  if (existing) return
  const d = db()
  const pharmacy = d.pharmacyById.get(pharmacyId)
  if (!pharmacy) return

  const stocked = new Set(
    (d.inventoryByPharmacy.get(pharmacyId) ?? []).filter((r) => r.in_stock).map((r) => r.product_id),
  )
  const pick = (predicate: (p: (typeof d.products)[number]) => boolean) =>
    d.products.find((p) => stocked.has(p.id) && predicate(p)) ?? d.products.find(predicate)

  const otc = pick((p) => !p.is_rx && p.dosage_form === 'tablet')
  const rx = pick((p) => p.schedule === 'H' && p.salts.some((s) => s.salt === 'metformin'))
  if (!otc || !rx) return

  const now = Date.now()
  const make = (
    suffix: string,
    product: typeof otc,
    qty: number,
    customer: string,
    phone: string,
    minutesAgo: number,
    savings: number,
    prescriptionId: string | null,
  ): ReservationRecord => ({
    id: `res_demo_${pharmacyId}_${suffix}`,
    code: `SD-${pharmacyId.toUpperCase().slice(-3)}${suffix}`,
    pharmacy_id: pharmacyId,
    pharmacy_name: pharmacy.name,
    items: [
      {
        product_id: product.id,
        brand_name: product.brand_name,
        qty,
        price_per_unit: product.price_per_unit,
        requires_rx: product.is_rx,
        counter_verification: requiresCounterVerification(product.schedule),
      },
    ],
    status: 'pending',
    customer_name: customer,
    customer_phone: phone,
    created_at: new Date(now - minutesAgo * 60_000).toISOString(),
    expires_at: new Date(now + (120 - minutesAgo) * 60_000).toISOString(),
    prescription_id: prescriptionId,
    requires_rx: product.is_rx,
    rx_verified_by_pharmacist: false,
    rx_verified_at: null,
    rejection_reason: null,
    fulfilment_type: 'pickup',
    estimated_savings: savings,
  })

  for (const r of [
    make('1', otc, 10, 'Sunita Devi', '+91 98XXXXXX21', 11, 21.5, null),
    make('2', rx, 60, 'Ramesh Yadav', '+91 97XXXXXX04', 4, 106.2, 'rx_demo_chronic'),
  ]) {
    reservations.set(r.code, r)
  }
}

/** Registers the checked-in demo prescriptions so they can be validated. */
export function ensureDemoPrescriptions() {
  for (const demo of DEMO_PRESCRIPTIONS) {
    if (prescriptions.has(demo.id)) continue
    savePrescription(demo.extracted, { id: demo.id, image_url: demo.image, source: 'demo' })
  }
}
