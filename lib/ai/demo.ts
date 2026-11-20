/**
 * Demo prescriptions with pre-baked OCR output.
 *
 * Each one exercises a different part of the product, and each has its OCR
 * result checked in, so the demo works with no network, no quota and no
 * variance. The same shape is what Gemini returns for a real upload.
 */

import type { ExtractedPrescription } from '@/lib/server/store'

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export type Demonstrates = 'savings' | 'rx_gate' | 'nti' | 'duplicate_salt' | 'otc_info'

export interface DemoPrescription {
  id: string
  slug: string
  /** English label; the UI translates via i18n keys of the same slug. */
  label: string
  image: string
  demonstrates: Demonstrates[]
  extracted: ExtractedPrescription
}

export const DEMO_PRESCRIPTIONS: DemoPrescription[] = [
  {
    id: 'rx_demo_fever',
    slug: 'fever',
    label: 'Fever and throat infection',
    image: '/demo/prescription-fever.svg',
    demonstrates: ['savings', 'rx_gate'],
    extracted: {
      doctor_name: 'Dr. A. K. Verma (demo)',
      registration_no: 'UPMC/DEMO/48213',
      clinic_or_hospital: 'Demo Clinic, Indira Nagar, Lucknow',
      prescription_date: daysAgo(3),
      patient_name_present: true,
      signature_or_stamp_present: true,
      legibility_score: 0.88,
      items: [
        {
          raw_text: 'Tab. Dolo 650  1-0-1 x 3 days',
          brand_or_generic_name: 'Dolo 650',
          strength: '650mg',
          form: 'Tablet',
          quantity: 10,
          frequency: '1-0-1',
          confidence: 0.94,
        },
        {
          raw_text: 'Tab. Augmentin 625 Duo  1-0-1 x 5 days',
          brand_or_generic_name: 'Augmentin 625 Duo',
          strength: '625mg',
          form: 'Tablet',
          quantity: 10,
          frequency: '1-0-1',
          confidence: 0.91,
        },
        {
          raw_text: 'Syp. Ascoril D Plus  100ml',
          brand_or_generic_name: 'Ascoril D Plus Syrup',
          strength: null,
          form: 'Syrup',
          quantity: 100,
          frequency: 'as advised',
          confidence: 0.79,
        },
      ],
    },
  },
  {
    id: 'rx_demo_chronic',
    slug: 'chronic',
    label: 'Monthly diabetes, BP and cholesterol',
    image: '/demo/prescription-chronic.svg',
    demonstrates: ['savings', 'rx_gate'],
    extracted: {
      doctor_name: 'Dr. S. Mishra (demo)',
      registration_no: 'UPMC/DEMO/31904',
      clinic_or_hospital: 'Demo Diabetes Care, Gomti Nagar, Lucknow',
      prescription_date: daysAgo(9),
      patient_name_present: true,
      signature_or_stamp_present: true,
      legibility_score: 0.9,
      items: [
        {
          raw_text: 'Tab. Glycomet 500  1-0-1 x 30 days',
          brand_or_generic_name: 'Glycomet 500',
          strength: '500mg',
          form: 'Tablet',
          quantity: 60,
          frequency: '1-0-1',
          confidence: 0.93,
        },
        {
          raw_text: 'Tab. Amlopres 5  1-0-0 x 30 days',
          brand_or_generic_name: 'Amlopres 5',
          strength: '5mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '1-0-0',
          confidence: 0.9,
        },
        {
          raw_text: 'Tab. Atorva 10  0-0-1 x 30 days',
          brand_or_generic_name: 'Atorva 10',
          strength: '10mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '0-0-1',
          confidence: 0.87,
        },
      ],
    },
  },
  {
    id: 'rx_demo_thyroid',
    slug: 'thyroid',
    label: 'Thyroid — switching needs a doctor',
    image: '/demo/prescription-thyroid.svg',
    demonstrates: ['nti'],
    extracted: {
      doctor_name: 'Dr. N. Bajpai (demo)',
      registration_no: 'UPMC/DEMO/22510',
      clinic_or_hospital: 'Demo Endocrine Clinic, Hazratganj, Lucknow',
      prescription_date: daysAgo(14),
      patient_name_present: true,
      signature_or_stamp_present: true,
      legibility_score: 0.85,
      items: [
        {
          raw_text: 'Tab. Thyronorm 50 mcg  1-0-0 before breakfast',
          brand_or_generic_name: 'Thyronorm 50',
          strength: '50mcg',
          form: 'Tablet',
          quantity: 30,
          frequency: '1-0-0',
          confidence: 0.92,
        },
        {
          raw_text: 'Tab. Shelcal 500  0-0-1',
          brand_or_generic_name: 'Shelcal 500',
          strength: '500mg',
          form: 'Tablet',
          quantity: 30,
          frequency: '0-0-1',
          confidence: 0.88,
        },
      ],
    },
  },
  {
    id: 'rx_demo_duplicate',
    slug: 'duplicate',
    label: 'Two medicines, same salt',
    image: '/demo/prescription-duplicate.svg',
    demonstrates: ['duplicate_salt', 'savings'],
    extracted: {
      doctor_name: 'Dr. R. Saxena (demo)',
      registration_no: 'UPMC/DEMO/77431',
      clinic_or_hospital: 'Demo Polyclinic, Alambagh, Lucknow',
      prescription_date: daysAgo(1),
      patient_name_present: true,
      signature_or_stamp_present: true,
      legibility_score: 0.83,
      items: [
        {
          raw_text: 'Tab. Combiflam  1-1-1 x 3 days',
          brand_or_generic_name: 'Combiflam',
          strength: null,
          form: 'Tablet',
          quantity: 10,
          frequency: '1-1-1',
          confidence: 0.9,
        },
        {
          raw_text: 'Tab. Dolo 650  SOS for fever',
          brand_or_generic_name: 'Dolo 650',
          strength: '650mg',
          form: 'Tablet',
          quantity: 10,
          frequency: 'SOS',
          confidence: 0.93,
        },
        {
          raw_text: 'Tab. Pan 40  1-0-0 before food',
          brand_or_generic_name: 'Pan 40',
          strength: '40mg',
          form: 'Tablet',
          quantity: 10,
          frequency: '1-0-0',
          confidence: 0.89,
        },
      ],
    },
  },
  {
    id: 'rx_demo_otc',
    slug: 'otc',
    label: 'Allergy and fever — over the counter',
    image: '/demo/prescription-otc.svg',
    demonstrates: ['otc_info', 'savings'],
    extracted: {
      doctor_name: 'Dr. P. Khan (demo)',
      registration_no: 'UPMC/DEMO/58120',
      clinic_or_hospital: 'Demo Family Clinic, Aliganj, Lucknow',
      prescription_date: daysAgo(2),
      patient_name_present: true,
      signature_or_stamp_present: true,
      legibility_score: 0.91,
      items: [
        {
          raw_text: 'Tab. Alerid 10  0-0-1 x 5 days',
          brand_or_generic_name: 'Alerid 10',
          strength: '10mg',
          form: 'Tablet',
          quantity: 10,
          frequency: '0-0-1',
          confidence: 0.92,
        },
        {
          raw_text: 'Tab. Crocin Advance 500  SOS',
          brand_or_generic_name: 'Crocin Advance 500',
          strength: '500mg',
          form: 'Tablet',
          quantity: 10,
          frequency: 'SOS',
          confidence: 0.94,
        },
      ],
    },
  },
]

export function demoBySlug(slug: string) {
  return DEMO_PRESCRIPTIONS.find((d) => d.slug === slug)
}

/** Pre-baked strip-scan results, keyed by the demo strip image. */
export interface StripScanResult {
  brand_name: string
  salt_text: string
  strength: string | null
  manufacturer: string | null
  confidence: number
}

export const DEMO_STRIP_SCANS: Record<string, StripScanResult> = {
  default: {
    brand_name: 'Glycomet 500',
    salt_text: 'Metformin Hydrochloride',
    strength: '500mg',
    manufacturer: 'USV Private Limited',
    confidence: 0.9,
  },
  dolo: {
    brand_name: 'Dolo 650',
    salt_text: 'Paracetamol',
    strength: '650mg',
    manufacturer: 'Micro Labs',
    confidence: 0.95,
  },
  augmentin: {
    brand_name: 'Augmentin 625 Duo',
    salt_text: 'Amoxycillin + Potassium Clavulanate',
    strength: '500mg + 125mg',
    manufacturer: 'GlaxoSmithKline',
    confidence: 0.88,
  },
}
