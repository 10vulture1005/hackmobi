/**
 * On-device storage.
 *
 * Saved results, "My medicines" and preferences live in IndexedDB on the
 * citizen's phone. Nothing here is uploaded, there is no login, and there is no
 * citizen table on the server. Every call degrades to a no-op if IndexedDB is
 * unavailable (private mode, blocked site data).
 */

const DB_NAME = 'sasta-dawa'
const DB_VERSION = 1
const STORES = { results: 'results', medicines: 'medicines', prefs: 'prefs' } as const

type StoreName = (typeof STORES)[keyof typeof STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no_indexeddb'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORES.results)) {
        db.createObjectStore(STORES.results, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.medicines)) {
        db.createObjectStore(STORES.medicines, { keyPath: 'product_id' })
      }
      if (!db.objectStoreNames.contains(STORES.prefs)) {
        db.createObjectStore(STORES.prefs, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('idb_open_failed'))
  })
  return dbPromise
}

async function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  try {
    const db = await open()
    return await new Promise<T | null>((resolve, reject) => {
      const t = db.transaction(store, mode)
      const req = fn(t.objectStore(store))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/* ------------------------------------------------------------- results */

export interface SavedResult {
  id: string
  saved_at: string
  label: string
  /** The full basket response, so the screen renders identically offline. */
  payload: unknown
  items: Array<{ product_id: string; qty: number }>
  savings_total: number
  language: string
}

const MAX_SAVED_RESULTS = 10

export async function saveResult(result: SavedResult): Promise<void> {
  await tx(STORES.results, 'readwrite', (s) => s.put(result))
  const all = await listResults()
  if (all.length > MAX_SAVED_RESULTS) {
    for (const old of all.slice(MAX_SAVED_RESULTS)) {
      await tx(STORES.results, 'readwrite', (s) => s.delete(old.id))
    }
  }
}

export async function listResults(): Promise<SavedResult[]> {
  const all = (await tx<SavedResult[]>(STORES.results, 'readonly', (s) => s.getAll())) ?? []
  return all.sort((a, b) => b.saved_at.localeCompare(a.saved_at))
}

export async function getResult(id: string): Promise<SavedResult | null> {
  return (await tx<SavedResult>(STORES.results, 'readonly', (s) => s.get(id))) ?? null
}

/* ----------------------------------------------------------- medicines */

export interface SavedMedicine {
  product_id: string
  brand_name: string
  composition_raw: string
  unit_label: string
  pack_size: number
  /** Price per unit of what the citizen buys today. */
  price_per_unit: number
  /** Price per unit of the cheapest same-salt option the engine found. */
  generic_price_per_unit: number
  generic_name: string
  generic_is_jan_aushadhi: boolean
  /** Entered by the citizen — we never infer a dose. */
  units_per_month: number
  added_at: string
  last_bought_at: string | null
  is_rx: boolean
}

export async function saveMedicine(m: SavedMedicine): Promise<void> {
  await tx(STORES.medicines, 'readwrite', (s) => s.put(m))
}

export async function listMedicines(): Promise<SavedMedicine[]> {
  const all = (await tx<SavedMedicine[]>(STORES.medicines, 'readonly', (s) => s.getAll())) ?? []
  return all.sort((a, b) => a.brand_name.localeCompare(b.brand_name))
}

export async function removeMedicine(productId: string): Promise<void> {
  await tx(STORES.medicines, 'readwrite', (s) => s.delete(productId))
}

export async function clearMedicines(): Promise<void> {
  await tx(STORES.medicines, 'readwrite', (s) => s.clear())
}

/* --------------------------------------------------------------- prefs */

export async function setPref(key: string, value: unknown): Promise<void> {
  await tx(STORES.prefs, 'readwrite', (s) => s.put({ key, value }))
}

export async function getPref<T>(key: string): Promise<T | null> {
  const row = await tx<{ key: string; value: T }>(STORES.prefs, 'readonly', (s) => s.get(key))
  return row?.value ?? null
}
