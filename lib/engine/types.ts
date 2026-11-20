/** Shared domain types. Mirrors the Postgres schema in /docs/architecture.md. */

export type Schedule = 'OTC' | 'H' | 'H1' | 'X' | 'unknown'

export type DosageForm =
  | 'tablet'
  | 'tablet_er'
  | 'capsule'
  | 'capsule_er'
  | 'syrup'
  | 'suspension'
  | 'injection'
  | 'cream'
  | 'ointment'
  | 'drops'
  | 'inhaler'
  | 'other'

export interface Salt {
  salt: string
  strength: number | null
  unit: string | null
}

export interface Product {
  id: string
  brand_name: string
  manufacturer: string
  composition_raw: string
  salts: Salt[]
  dosage_form: DosageForm
  /** null when composition parsing was not confident — such products never get substitutes. */
  canonical_key: string | null
  pack_size: number
  unit_label: string
  mrp: number
  price_per_unit: number
  is_generic: boolean
  is_jan_aushadhi: boolean
  is_rx: boolean
  schedule: Schedule
  nppa_ceiling_per_unit: number | null
  source: string
}

export interface Pharmacy {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  phone: string | null
  opening_hours: string | null
  is_jan_aushadhi: boolean
  osm_id: string | null
  verified: boolean
  licence_no: string | null
  /** ISO timestamp of the last stock confirmation. */
  last_stock_update: string | null
}

export interface InventoryRow {
  pharmacy_id: string
  product_id: string
  in_stock: boolean
  price: number
  updated_at: string
  is_simulated: boolean
}

export type StockFreshness = 'fresh' | 'stale' | 'old' | 'unknown'

export interface Scheme {
  id: string
  title: string
  summary: string
  eligibility: string[]
  documents: string[]
  how_to_claim: string
  covers: string[]
  scope: string
  tags: string[]
  source_url: string
}

export interface DrugInfoSource {
  salt_key: string
  source_text: {
    indications: string
    adverse_reactions: string
    warnings: string
    stop_use: string
  }
  source_urls: string[]
  fetched_at: string
}

export type ValidationStatus = 'verified' | 'needs_pharmacist_review' | 'rejected'

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'collected'
  | 'expired'
