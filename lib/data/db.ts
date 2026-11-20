/**
 * Seed data loader (server only).
 *
 * Stands in for Postgres in the demo. The shapes are exactly the table shapes
 * in /docs/architecture.md, so swapping this module for SQLAlchemy queries is
 * the only change a real backend needs.
 */

import fs from 'node:fs'
import path from 'node:path'
import type {
  DrugInfoSource,
  InventoryRow,
  Pharmacy,
  Product,
  Scheme,
} from '@/lib/engine/types'
import type { DrugInfoContent } from '@/data/drug_info'

const SEED_DIR = path.join(process.cwd(), 'data', 'seed')

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf8')) as T
}

export interface CachedDrugInfo {
  salt_key: string
  language: string
  content: DrugInfoContent
  generated_at: string
  reviewed: boolean
}

export interface SeedDrugInfo extends DrugInfoSource {
  display_name: string
}

interface Db {
  products: Product[]
  productById: Map<string, Product>
  productsByKey: Map<string, Product[]>
  pharmacies: Pharmacy[]
  pharmacyById: Map<string, Pharmacy>
  inventory: InventoryRow[]
  inventoryByProduct: Map<string, InventoryRow[]>
  inventoryByPharmacy: Map<string, InventoryRow[]>
  drugInfo: Map<string, SeedDrugInfo>
  drugInfoCache: Map<string, CachedDrugInfo>
  schemes: Scheme[]
}

let cache: Db | null = null

export function db(): Db {
  if (cache) return cache

  const products = read<Product[]>('products.json')
  const pharmacies = read<Pharmacy[]>('pharmacies.json')
  const inventory = read<InventoryRow[]>('inventory.json')
  const drugInfoRows = read<SeedDrugInfo[]>('drug_info.json')
  const cacheRows = read<CachedDrugInfo[]>('drug_info_cache.json')
  const schemeFile = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data', 'schemes', 'schemes.json'), 'utf8'),
  ) as { schemes: Scheme[] }

  const productsByKey = new Map<string, Product[]>()
  for (const p of products) {
    if (!p.canonical_key) continue
    const g = productsByKey.get(p.canonical_key) ?? []
    g.push(p)
    productsByKey.set(p.canonical_key, g)
  }

  const inventoryByProduct = new Map<string, InventoryRow[]>()
  const inventoryByPharmacy = new Map<string, InventoryRow[]>()
  for (const row of inventory) {
    const a = inventoryByProduct.get(row.product_id) ?? []
    a.push(row)
    inventoryByProduct.set(row.product_id, a)
    const b = inventoryByPharmacy.get(row.pharmacy_id) ?? []
    b.push(row)
    inventoryByPharmacy.set(row.pharmacy_id, b)
  }

  cache = {
    products,
    productById: new Map(products.map((p) => [p.id, p])),
    productsByKey,
    pharmacies,
    pharmacyById: new Map(pharmacies.map((p) => [p.id, p])),
    inventory,
    inventoryByProduct,
    inventoryByPharmacy,
    drugInfo: new Map(drugInfoRows.map((r) => [r.salt_key, r])),
    drugInfoCache: new Map(cacheRows.map((r) => [`${r.salt_key}::${r.language}`, r])),
    schemes: schemeFile.schemes,
  }
  return cache
}

/**
 * Pharmacist stock confirmations are the one mutable thing in the demo. They
 * live in memory for the session, so the dashboard's "Confirm stock is current"
 * button visibly changes the freshness chip on the citizen side.
 */
const globalOverrides = globalThis as typeof globalThis & {
  __sd_stock?: Map<string, string>
  __sd_inventory?: Map<string, { in_stock?: boolean; price?: number }>
}

const stockOverrides = (globalOverrides.__sd_stock ??= new Map<string, string>())
const inventoryOverrides = (globalOverrides.__sd_inventory ??= new Map<
  string,
  { in_stock?: boolean; price?: number }
>())

export function confirmStockCurrent(pharmacyId: string, at = new Date().toISOString()) {
  stockOverrides.set(pharmacyId, at)
}

/** True once a pharmacist has confirmed this pharmacy's stock in the dashboard. */
export function isStockConfirmed(pharmacyId: string): boolean {
  return stockOverrides.has(pharmacyId)
}

export function lastStockUpdate(ph: Pharmacy): string | null {
  return stockOverrides.get(ph.id) ?? ph.last_stock_update
}

export function setInventory(
  pharmacyId: string,
  productId: string,
  patch: { in_stock?: boolean; price?: number },
) {
  const k = `${pharmacyId}::${productId}`
  inventoryOverrides.set(k, { ...inventoryOverrides.get(k), ...patch })
  confirmStockCurrent(pharmacyId)
}

export function inventoryFor(pharmacyId: string, productId: string): InventoryRow | null {
  const base = db()
    .inventoryByProduct.get(productId)
    ?.find((r) => r.pharmacy_id === pharmacyId)
  return base ? withOverrides(base) : null
}

/**
 * Applies any pharmacist override to a seeded row. Once a pharmacist has
 * confirmed their stock, that pharmacy's rows stop being labelled as simulated
 * demo stock and start ageing through the real freshness bands — which is what
 * makes the dashboard's effect visible on the citizen side.
 */
function withOverrides(r: InventoryRow): InventoryRow {
  const patch = inventoryOverrides.get(`${r.pharmacy_id}::${r.product_id}`)
  const confirmed = stockOverrides.has(r.pharmacy_id)
  const base = patch ? { ...r, ...patch } : r
  return confirmed ? { ...base, is_simulated: false, updated_at: stockOverrides.get(r.pharmacy_id) as string } : base
}

export function inventoryRowsForProduct(productId: string): InventoryRow[] {
  return (db().inventoryByProduct.get(productId) ?? []).map(withOverrides)
}

export function inventoryRowsForPharmacy(pharmacyId: string): InventoryRow[] {
  return (db().inventoryByPharmacy.get(pharmacyId) ?? []).map(withOverrides)
}
