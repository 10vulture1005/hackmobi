/**
 * Prescription OCR and medicine-strip scanning.
 *
 * The model's only job is to read text off the image into a fixed schema. It
 * never decides what a medicine is, whether it needs a prescription, or what
 * can be substituted — that all happens afterwards in deterministic code, and
 * the citizen sees and corrects every extracted line before anything is
 * searched.
 */

import { DEMO_PRESCRIPTIONS, DEMO_STRIP_SCANS, type StripScanResult } from './demo'
import { llmJson } from './provider'
import type { ExtractedPrescription } from '@/lib/server/store'

const RX_SYSTEM = `You transcribe Indian handwritten and printed medical prescriptions.
Rules:
- Transcribe only what is written. Never guess a medicine that is not on the page.
- Do not correct, substitute or complete a drug name you cannot read: copy what you see and give a low confidence.
- confidence is 0 to 1 per item. legibility_score is 0 to 1 for the whole page.
- Dates must be ISO (YYYY-MM-DD). Use null for anything absent.
- Never output advice, dosage recommendations or diagnosis.`

const RX_SCHEMA = `{
  "doctor_name": "string|null", "registration_no": "string|null",
  "clinic_or_hospital": "string|null", "prescription_date": "YYYY-MM-DD|null",
  "patient_name_present": true, "signature_or_stamp_present": true,
  "legibility_score": 0.0,
  "items": [{"raw_text":"string","brand_or_generic_name":"string","strength":"string|null",
             "form":"string|null","quantity":0,"frequency":"string|null","confidence":0.0}]
}`

export interface ParseResult {
  extracted: ExtractedPrescription
  via: string
  demo_slug?: string
}

export async function parsePrescription(opts: {
  image?: { mime: string; data: string }
  demo_slug?: string
}): Promise<ParseResult> {
  // Demo path: a checked-in OCR result. Deterministic, instant, no quota.
  if (!opts.image) {
    const demo =
      DEMO_PRESCRIPTIONS.find((d) => d.slug === opts.demo_slug) ?? DEMO_PRESCRIPTIONS[0]
    return { extracted: demo.extracted, via: 'demo_fixture', demo_slug: demo.slug }
  }

  const live = await llmJson<ExtractedPrescription>({
    system: RX_SYSTEM,
    user: 'Transcribe this prescription into the schema. Copy names exactly as written.',
    image: opts.image,
    schemaHint: RX_SCHEMA,
  })

  if (live.ok && Array.isArray(live.data.items)) {
    const ex = live.data
    return {
      extracted: {
        doctor_name: ex.doctor_name ?? null,
        registration_no: ex.registration_no ?? null,
        clinic_or_hospital: ex.clinic_or_hospital ?? null,
        prescription_date: ex.prescription_date ?? null,
        patient_name_present: !!ex.patient_name_present,
        signature_or_stamp_present: !!ex.signature_or_stamp_present,
        legibility_score: typeof ex.legibility_score === 'number' ? ex.legibility_score : 0.4,
        items: ex.items.map((i) => ({
          raw_text: i.raw_text ?? '',
          brand_or_generic_name: i.brand_or_generic_name ?? '',
          strength: i.strength ?? null,
          form: i.form ?? null,
          quantity: typeof i.quantity === 'number' ? i.quantity : null,
          frequency: i.frequency ?? null,
          confidence: typeof i.confidence === 'number' ? i.confidence : 0.4,
        })),
      },
      via: live.via,
    }
  }

  // An upload we could not read is reported as unreadable, never as a guess.
  return {
    extracted: {
      doctor_name: null,
      registration_no: null,
      clinic_or_hospital: null,
      prescription_date: null,
      patient_name_present: false,
      signature_or_stamp_present: false,
      legibility_score: 0,
      items: [],
    },
    via: live.ok ? 'empty' : `unavailable:${live.error}`,
  }
}

const STRIP_SYSTEM = `You read the printed text off a medicine strip, box or bottle photo.
Rules:
- Report only text you can actually see on the pack.
- salt_text is the composition line as printed.
- confidence is 0 to 1. If the pack is blurred or partly hidden, say so with a low confidence.
- Never guess a brand from a logo you are unsure about, and never give advice.`

export async function scanStrip(opts: {
  image?: { mime: string; data: string }
  demo_key?: string
}): Promise<{ result: StripScanResult; via: string }> {
  if (!opts.image) {
    const result = DEMO_STRIP_SCANS[opts.demo_key ?? 'default'] ?? DEMO_STRIP_SCANS.default
    return { result, via: 'demo_fixture' }
  }

  const live = await llmJson<StripScanResult>({
    system: STRIP_SYSTEM,
    user: 'Read this medicine pack into the schema.',
    image: opts.image,
    schemaHint:
      '{"brand_name":"string","salt_text":"string","strength":"string|null","manufacturer":"string|null","confidence":0.0}',
  })

  if (live.ok && live.data.brand_name) {
    return {
      result: {
        brand_name: live.data.brand_name,
        salt_text: live.data.salt_text ?? '',
        strength: live.data.strength ?? null,
        manufacturer: live.data.manufacturer ?? null,
        confidence: typeof live.data.confidence === 'number' ? live.data.confidence : 0.4,
      },
      via: live.via,
    }
  }

  return {
    result: { brand_name: '', salt_text: '', strength: null, manufacturer: null, confidence: 0 },
    via: live.ok ? 'empty' : `unavailable:${live.error}`,
  }
}
