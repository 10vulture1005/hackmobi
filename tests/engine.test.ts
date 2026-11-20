import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/data/db'
import { basket, nearbyPharmacies, searchProducts } from '@/lib/server/engine'
import {
  ReservationError,
  createReservation,
  ensureDemoPrescriptions,
  getReservation,
  savePrescription,
  updateReservation,
  validatePrescription,
} from '@/lib/server/store'
import { freshnessOf, freshnessPenaltyKm } from '@/lib/engine/freshness'
import { isRx, requiresCounterVerification, resolveSchedule, scheduleFromSalts } from '@/lib/engine/rx'

/** Hazratganj, Lucknow — the demo's default location. */
const LKO = { lat: 26.8512, lng: 80.9471, radius_km: 5 }

const byName = (name: string) => {
  const p = db().products.find((x) => x.brand_name === name)
  if (!p) throw new Error(`fixture missing: ${name}`)
  return p
}

beforeAll(() => ensureDemoPrescriptions())

describe('seed integrity', () => {
  it('loads products, pharmacies and inventory', () => {
    expect(db().products.length).toBeGreaterThan(100)
    expect(db().pharmacies.length).toBeGreaterThan(50)
    expect(db().inventory.length).toBeGreaterThan(1000)
  })
  it('flags every inventory row as simulated', () => {
    expect(db().inventory.every((r) => r.is_simulated)).toBe(true)
  })
  it('gives every Jan Aushadhi product a canonical key', () => {
    const ja = db().products.filter((p) => p.is_jan_aushadhi)
    expect(ja.length).toBeGreaterThan(20)
    expect(ja.every((p) => p.canonical_key)).toBe(true)
  })
})

describe('search', () => {
  it('finds a brand by exact name', () => {
    const r = searchProducts('Dolo 650')
    expect(r.confident).toBe(true)
    expect(r.best?.product.brand_name).toBe('Dolo 650')
  })
  it('finds brands from a misspelling', () => {
    const r = searchProducts('augmentine 625')
    expect(r.candidates.some((c) => c.product.brand_name === 'Augmentin 625 Duo')).toBe(true)
  })
  it('searches by salt and strength', () => {
    const r = searchProducts('paracetamol 500')
    expect(r.candidates.length).toBeGreaterThan(1)
    expect(
      r.candidates.every((c) => c.product.salts.some((s) => s.salt === 'paracetamol')),
    ).toBe(true)
  })
  it('does not auto-pick when nothing is close', () => {
    const r = searchProducts('zzzqqq')
    expect(r.best).toBeNull()
  })
})

describe('alternatives', () => {
  it('only offers products with an identical canonical key', () => {
    const original = byName('Augmentin 625 Duo')
    const result = basket([{ product_id: original.id, qty: 10 }], LKO)
    const item = result.items[0]
    expect(item.alternatives.length).toBeGreaterThan(0)
    for (const alt of item.alternatives) {
      const p = db().productById.get(alt.product_id)!
      expect(p.canonical_key).toBe(original.canonical_key)
    }
  })

  it('never offers a different strength or form as an alternative', () => {
    const dolo = byName('Dolo 650')
    const result = basket([{ product_id: dolo.id, qty: 10 }], LKO)
    const names = result.items[0].alternatives.map((a) => a.brand_name)
    expect(names.join(' ')).not.toContain('500')
  })

  it('ranks the Jan Aushadhi generic first', () => {
    const result = basket([{ product_id: byName('Atorva 10').id, qty: 30 }], LKO)
    expect(result.items[0].alternatives[0].is_jan_aushadhi).toBe(true)
  })

  it('computes savings as a price-per-unit difference times quantity', () => {
    const result = basket([{ product_id: byName('Alerid 10').id, qty: 10 }], LKO)
    const item = result.items[0]
    const expected =
      Math.round((item.original.price_per_unit - item.best.price_per_unit) * 10 * 100) / 100
    expect(item.best.savings_total).toBeCloseTo(expected, 2)
    expect(result.savings_total).toBeGreaterThan(0)
  })

  it('totals a prescription across items', () => {
    const items = [
      { product_id: byName('Glycomet 500').id, qty: 60 },
      { product_id: byName('Amlopres 5').id, qty: 30 },
      { product_id: byName('Atorva 10').id, qty: 30 },
    ]
    const result = basket(items, LKO)
    expect(result.items).toHaveLength(3)
    expect(result.best_total).toBeLessThan(result.original_total)
    expect(result.savings_total).toBeCloseTo(
      Math.round((result.original_total - result.best_total) * 100) / 100,
      2,
    )
    expect(result.savings_pct).toBeGreaterThan(20)
  })

  it('flags a price above the NPPA ceiling', () => {
    const result = basket([{ product_id: byName('Fevago 650').id, qty: 10 }], LKO)
    expect(result.items[0].original.above_nppa_ceiling).toBe(true)
    expect(result.items[0].warnings.some((w) => w.code === 'above_ceiling')).toBe(true)
  })

  it('does not flag a price under the ceiling', () => {
    const result = basket([{ product_id: byName('Paracetamol 650mg Tablet').id, qty: 10 }], LKO)
    expect(result.items[0].original.above_nppa_ceiling).toBe(false)
  })

  it('marks stock as simulated in every basket', () => {
    const result = basket([{ product_id: byName('Dolo 650').id }], LKO)
    expect(result.stock_is_simulated).toBe(true)
  })
})

describe('safety warnings', () => {
  it('warns before switching a narrow-therapeutic-index medicine', () => {
    const result = basket([{ product_id: byName('Thyronorm 50').id, qty: 30 }], LKO)
    expect(result.items[0].narrow_therapeutic_index).toBe(true)
    expect(result.items[0].warnings.some((w) => w.code === 'nti_switch')).toBe(true)
  })

  it('warns when two basket items share a salt', () => {
    const result = basket(
      [
        { product_id: byName('Combiflam').id, qty: 10 },
        { product_id: byName('Dolo 650').id, qty: 10 },
      ],
      LKO,
    )
    const dup = result.duplicate_salt_warnings
    expect(dup).toHaveLength(1)
    expect(dup[0].params.salt).toBe('paracetamol')
    expect(dup[0].product_ids).toHaveLength(2)
  })

  it('does not warn when salts differ', () => {
    const result = basket(
      [
        { product_id: byName('Amlopres 5').id, qty: 30 },
        { product_id: byName('Atorva 10').id, qty: 30 },
      ],
      LKO,
    )
    expect(result.duplicate_salt_warnings).toHaveLength(0)
  })

  it('tags every Rx item as Rx required', () => {
    const result = basket([{ product_id: byName('Pan 40').id, qty: 10 }], LKO)
    expect(result.items[0].original.rx_required).toBe(true)
    for (const alt of result.items[0].alternatives) expect(alt.rx_required).toBe(true)
  })
})

describe('Rx schedule classification', () => {
  it('derives H for an antibiotic', () => {
    expect(scheduleFromSalts([{ salt: 'amoxicillin', strength: 500, unit: 'mg' }])).toBe('H')
  })
  it('derives H1 for alprazolam', () => {
    expect(scheduleFromSalts([{ salt: 'alprazolam', strength: 0.5, unit: 'mg' }])).toBe('H1')
  })
  it('derives OTC for paracetamol', () => {
    expect(scheduleFromSalts([{ salt: 'paracetamol', strength: 500, unit: 'mg' }])).toBe('OTC')
  })
  it('fails closed for an unknown salt', () => {
    expect(scheduleFromSalts([{ salt: 'mysterycillin', strength: 1, unit: 'mg' }])).toBe('H')
  })
  it('fails closed for an empty salt list', () => {
    expect(scheduleFromSalts([])).toBe('H')
  })
  it('takes the stricter of the declared and derived schedules', () => {
    expect(resolveSchedule([{ salt: 'paracetamol', strength: 500, unit: 'mg' }], 'H')).toBe('H')
    expect(resolveSchedule([{ salt: 'alprazolam', strength: 0.5, unit: 'mg' }], 'OTC')).toBe('H1')
  })
  it('treats a combination as Rx when any salt is Rx', () => {
    expect(
      scheduleFromSalts([
        { salt: 'paracetamol', strength: 325, unit: 'mg' },
        { salt: 'tramadol', strength: 37.5, unit: 'mg' },
      ]),
    ).toBe('H1')
  })
  it('requires counter verification only for H1 and X', () => {
    expect(requiresCounterVerification('H1')).toBe(true)
    expect(requiresCounterVerification('X')).toBe(true)
    expect(requiresCounterVerification('H')).toBe(false)
    expect(isRx('OTC')).toBe(false)
  })
})

describe('the Rx gate on reservations', () => {
  const pharmacy = () => db().pharmacies.find((p) => p.is_jan_aushadhi)!

  it('lets an OTC item be reserved with no prescription', () => {
    const r = createReservation({
      pharmacy_id: pharmacy().id,
      items: [{ product_id: byName('Paracetamol 500mg Tablet').id, qty: 10 }],
      customer_name: 'Test Citizen',
    })
    expect(r.requires_rx).toBe(false)
    expect(r.status).toBe('pending')
  })

  it('refuses an Rx item with no prescription', () => {
    expect(() =>
      createReservation({
        pharmacy_id: pharmacy().id,
        items: [{ product_id: byName('Metformin 500mg Tablet').id, qty: 30 }],
        customer_name: 'Test Citizen',
      }),
    ).toThrowError(ReservationError)
  })

  it('refuses every Rx item in a mixed basket', () => {
    try {
      createReservation({
        pharmacy_id: pharmacy().id,
        items: [
          { product_id: byName('Paracetamol 500mg Tablet').id, qty: 10 },
          { product_id: byName('Pan 40').id, qty: 10 },
        ],
        customer_name: 'Test Citizen',
      })
      throw new Error('should have refused')
    } catch (e) {
      expect(e).toBeInstanceOf(ReservationError)
      expect((e as ReservationError).code).toBe('prescription_required')
    }
  })

  it('refuses an H1 item even with a matching prescription', () => {
    const rx = savePrescription({
      doctor_name: 'Dr. Demo',
      registration_no: 'X/1',
      clinic_or_hospital: 'Demo',
      prescription_date: new Date().toISOString().slice(0, 10),
      patient_name_present: true,
      signature_or_stamp_present: true,
      legibility_score: 0.9,
      items: [
        {
          raw_text: 'Tab Alprax 0.5',
          brand_or_generic_name: 'Alprax 0.5',
          strength: '0.5mg',
          form: 'Tablet',
          quantity: 10,
          frequency: '0-0-1',
          confidence: 0.9,
          matched_product_id: byName('Alprax 0.5').id,
        },
      ],
    })
    const validation = validatePrescription(rx.id, [byName('Alprax 0.5').id])!
    expect(validation.status).toBe('needs_pharmacist_review')
    expect(validation.items[0].reason_code).toBe('counter_verification_required')
  })

  it('accepts an Rx item covered by the demo prescription', () => {
    const r = createReservation({
      pharmacy_id: pharmacy().id,
      items: [{ product_id: byName('Metformin 500mg Tablet').id, qty: 60 }],
      customer_name: 'Ramesh Yadav',
      prescription_id: 'rx_demo_chronic',
    })
    expect(r.requires_rx).toBe(true)
    expect(r.rx_verified_by_pharmacist).toBe(false)
  })

  it('refuses a medicine that is not on the prescription', () => {
    try {
      createReservation({
        pharmacy_id: pharmacy().id,
        items: [{ product_id: byName('Azithral 500').id, qty: 3 }],
        customer_name: 'Ramesh Yadav',
        prescription_id: 'rx_demo_chronic',
      })
      throw new Error('should have refused')
    } catch (e) {
      expect((e as ReservationError).code).toBe('prescription_rejected')
    }
  })

  it('refuses an out-of-date prescription', () => {
    const old = new Date()
    old.setDate(old.getDate() - 400)
    const rx = savePrescription({
      doctor_name: 'Dr. Demo',
      registration_no: 'X/2',
      clinic_or_hospital: 'Demo',
      prescription_date: old.toISOString().slice(0, 10),
      patient_name_present: true,
      signature_or_stamp_present: true,
      legibility_score: 0.9,
      items: [
        {
          raw_text: 'Tab Glycomet 500',
          brand_or_generic_name: 'Glycomet 500',
          strength: '500mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '1-0-1',
          confidence: 0.9,
          matched_product_id: byName('Glycomet 500').id,
        },
      ],
    })
    const v = validatePrescription(rx.id, [byName('Glycomet 500').id])!
    expect(v.status).toBe('rejected')
    expect(v.items[0].reason_code).toBe('prescription_too_old')
  })

  it('sends an illegible prescription to the pharmacist', () => {
    const rx = savePrescription({
      doctor_name: 'Dr. Demo',
      registration_no: null,
      clinic_or_hospital: null,
      prescription_date: new Date().toISOString().slice(0, 10),
      patient_name_present: true,
      signature_or_stamp_present: false,
      legibility_score: 0.3,
      items: [
        {
          raw_text: 'illegible',
          brand_or_generic_name: 'Glycomet 500',
          strength: '500mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '?',
          confidence: 0.4,
          matched_product_id: byName('Glycomet 500').id,
        },
      ],
    })
    const v = validatePrescription(rx.id, [byName('Glycomet 500').id])!
    expect(v.status).toBe('needs_pharmacist_review')
    expect(v.items[0].reason_code).toBe('illegible')
  })

  it('blocks collection of an Rx item until the pharmacist verifies', () => {
    const r = createReservation({
      pharmacy_id: pharmacy().id,
      items: [{ product_id: byName('Metformin 500mg Tablet').id, qty: 60 }],
      customer_name: 'Ramesh Yadav',
      prescription_id: 'rx_demo_chronic',
    })
    expect(() => updateReservation(r.code, 'collected')).toThrowError(ReservationError)
    updateReservation(r.code, 'verify_prescription')
    const collected = updateReservation(r.code, 'collected')
    expect(collected.status).toBe('collected')
    expect(getReservation(r.code)?.rx_verified_at).toBeTruthy()
  })
})

describe('stock freshness', () => {
  const now = new Date('2026-11-20T12:00:00Z').getTime()
  const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString()

  it('calls simulated stock unknown', () => {
    expect(freshnessOf(hoursAgo(1), true, now)).toBe('unknown')
  })
  it('bands real stock by age', () => {
    expect(freshnessOf(hoursAgo(3), false, now)).toBe('fresh')
    expect(freshnessOf(hoursAgo(50), false, now)).toBe('stale')
    expect(freshnessOf(hoursAgo(300), false, now)).toBe('old')
    expect(freshnessOf(null, false, now)).toBe('unknown')
  })
  it('penalises stale stock more than fresh', () => {
    expect(freshnessPenaltyKm('fresh')).toBeLessThan(freshnessPenaltyKm('unknown'))
    expect(freshnessPenaltyKm('unknown')).toBeLessThan(freshnessPenaltyKm('stale'))
    expect(freshnessPenaltyKm('stale')).toBeLessThan(freshnessPenaltyKm('old'))
  })
})

describe('nearby pharmacies', () => {
  it('stays inside the radius and sorts by rank', () => {
    const rows = nearbyPharmacies({ ...LKO, radius_km: 3 })
    expect(rows.length).toBeGreaterThan(3)
    expect(rows.every((r) => (r.distance_km ?? 0) <= 3)).toBe(true)
    const scores = rows.map((r) => r.rank_score)
    expect([...scores].sort((a, b) => a - b)).toEqual(scores)
  })
  it('only lists stores that carry the product when one is named', () => {
    const p = byName('Paracetamol 500mg Tablet')
    const rows = nearbyPharmacies({ ...LKO, product_id: p.id })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.product?.product_id === p.id)).toBe(true)
  })
  it('ranks out-of-stock stores last', () => {
    const p = byName('Dolo 650')
    const rows = nearbyPharmacies({ ...LKO, product_id: p.id, radius_km: 8 })
    const firstOut = rows.findIndex((r) => r.product && !r.product.in_stock)
    if (firstOut >= 0) {
      expect(rows.slice(firstOut).every((r) => r.product && !r.product.in_stock)).toBe(true)
    }
  })
  it('exposes the licence number and freshness for trust signals', () => {
    const rows = nearbyPharmacies({ ...LKO, jan_aushadhi_only: true })
    expect(rows[0].licence_no).toBeTruthy()
    expect(rows[0].stock_freshness).toBe('unknown')
  })
})
