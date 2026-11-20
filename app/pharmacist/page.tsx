'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Lock,
  LogIn,
  PackageX,
  RefreshCw,
  Search,
  Store,
  Upload,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import { Badge, Button, Card, Skeleton, Toast } from '@/components/ui'
import {
  api,
  type ImportResult,
  type PharmacistInventory,
  type PharmacistReservation,
} from '@/lib/client/api'
import { minutesUntil, rupee, shortDate } from '@/lib/client/format'

/**
 * Pharmacist dashboard (desktop-first, English).
 *
 * Production auth is a Supabase magic link with row-level security, so a
 * pharmacist can only see and edit their own pharmacy. The demo swaps that for
 * a shop picker; everything downstream is the real flow, including the rule
 * that an Rx item cannot be marked collected until the prescription is verified.
 */
type Tab = 'inventory' | 'queue' | 'import'

export default function PharmacistPage() {
  const [pharmacyId, setPharmacyId] = useState<string | null>(null)
  const [options, setOptions] = useState<Array<{ id: string; name: string; is_jan_aushadhi: boolean }>>([])
  const [tab, setTab] = useState<Tab>('queue')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    api
      .nearby({ lat: 26.8512, lng: 80.9471, radius_km: 12, limit: 60 })
      .then((r) => setOptions(r.pharmacies.map((p) => ({ id: p.id, name: p.name, is_jan_aushadhi: p.is_jan_aushadhi }))))
      .catch(() => setOptions([]))
  }, [])

  if (!pharmacyId) {
    return (
      <div className="mx-auto max-w-lg space-y-3 pt-6">
        <Card className="space-y-3">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <LogIn size={20} className="text-primary" aria-hidden />
            Pharmacy sign in
          </h1>
          <p className="text-sm text-muted">
            In production this is a Supabase magic link, and row-level security limits you to your own
            pharmacy. For the demo, pick the shop you are signing in as.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">Your pharmacy</span>
            <select
              defaultValue=""
              onChange={(e) => setPharmacyId(e.target.value || null)}
              className="tap w-full rounded-xl border border-field-line bg-surface px-3 py-2.5 outline-none focus:border-primary"
            >
              <option value="">Select…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          {options.length === 0 && <Skeleton className="h-10 w-full" />}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-10">
      <Header pharmacyId={pharmacyId} onToast={setToast} onSwitch={() => setPharmacyId(null)} />

      <nav className="flex gap-1.5 overflow-x-auto">
        {(
          [
            ['queue', 'Reservations'],
            ['inventory', 'Inventory'],
            ['import', 'Import CSV'],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-current={tab === key}
            className={clsx(
              'tap rounded-full px-4 py-2 text-sm font-bold transition',
              tab === key ? 'bg-primary text-on-primary' : 'border border-line bg-surface text-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'queue' && <Queue pharmacyId={pharmacyId} onToast={setToast} />}
      {tab === 'inventory' && <Inventory pharmacyId={pharmacyId} onToast={setToast} />}
      {tab === 'import' && <Import pharmacyId={pharmacyId} onToast={setToast} />}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

function Header({
  pharmacyId,
  onToast,
  onSwitch,
}: {
  pharmacyId: string
  onToast: (m: string) => void
  onSwitch: () => void
}) {
  const [data, setData] = useState<PharmacistInventory['pharmacy'] | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.pharmacistInventory(pharmacyId).then((r) => setData(r.pharmacy)).catch(() => setData(null))
  }, [pharmacyId])

  useEffect(load, [load])

  async function confirm() {
    setBusy(true)
    try {
      await api.pharmacistConfirmStock(pharmacyId)
      onToast('Stock marked as current — you will rank higher in results')
      load()
    } finally {
      setBusy(false)
    }
  }

  const stale = data?.stock_freshness !== 'fresh'

  return (
    <Card className="flex flex-wrap items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl bg-primary text-on-primary">
        <Store size={20} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="flex flex-wrap items-center gap-2 text-lg font-extrabold leading-tight">
          {data?.name ?? <Skeleton className="h-5 w-40" />}
          {data?.verified && (
            <Badge tone="primary">
              <BadgeCheck size={13} aria-hidden />
              Verified
            </Badge>
          )}
          {data?.is_jan_aushadhi && <Badge tone="savings">Jan Aushadhi</Badge>}
        </h1>
        <p className="text-xs text-muted">
          {data?.licence_no ? `Licence ${data.licence_no} · ` : ''}
          Last synced{' '}
          {data?.last_stock_update ? new Date(data.last_stock_update).toLocaleString('en-IN') : 'never'}
        </p>
      </div>
      {stale && (
        <p className="rounded-xl bg-savings-tint px-3 py-2 text-xs font-bold text-savings-ink">
          Update your stock to appear higher in results
        </p>
      )}
      <Button onClick={confirm} disabled={busy}>
        {busy ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <RefreshCw size={17} aria-hidden />}
        Confirm stock is current
      </Button>
      <Button variant="ghost" size="sm" onClick={onSwitch}>
        Switch
      </Button>
    </Card>
  )
}

function Queue({ pharmacyId, onToast }: { pharmacyId: string; onToast: (m: string) => void }) {
  const [rows, setRows] = useState<PharmacistReservation[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => {
    api.pharmacistReservations(pharmacyId).then((r) => setRows(r.reservations)).catch(() => setRows([]))
  }, [pharmacyId])

  useEffect(() => {
    load()
    const id = setInterval(load, 6000)
    return () => clearInterval(id)
  }, [load])

  async function act(code: string, action: string, reason?: string) {
    setBusy(code + action)
    try {
      await api.pharmacistAction(code, action, reason)
      onToast(`${code}: ${action.replace('_', ' ')}`)
      load()
    } catch (e) {
      onToast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const pending = (rows ?? []).filter((r) => r.status === 'pending' || r.status === 'confirmed')
  const savings = (rows ?? []).reduce((s, r) => s + r.estimated_savings, 0)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Open requests</p>
          <p className="tabular text-2xl font-extrabold">{pending.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Today&apos;s reservations</p>
          <p className="tabular text-2xl font-extrabold">{rows?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Customer savings</p>
          <p className="tabular text-2xl font-extrabold text-savings-ink">{rupee(savings)}</p>
        </Card>
      </div>

      {!rows && <Skeleton className="h-32 w-full" />}
      {rows?.length === 0 && <Card>No requests yet. They appear here the moment a customer reserves.</Card>}

      <ul className="grid gap-3 lg:grid-cols-2">
        {(rows ?? []).map((r) => {
          const needsRx = r.requires_rx && !r.rx_verified_by_pharmacist
          return (
            <li key={r.code}>
              <Card className="space-y-3">
                <header className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="tabular text-lg font-extrabold text-primary">{r.code}</span>
                      <Badge tone={r.status === 'pending' ? 'savings' : r.status === 'collected' ? 'success' : 'neutral'}>
                        {r.status}
                      </Badge>
                      {r.requires_rx && (
                        <Badge tone={r.rx_verified_by_pharmacist ? 'success' : 'danger'}>
                          <Lock size={11} aria-hidden />
                          {r.rx_verified_by_pharmacist ? 'Rx verified' : 'Rx to verify'}
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm font-semibold">
                      {r.customer_name}
                      {r.customer_phone ? ` · ${r.customer_phone}` : ''}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <Badge tone="neutral">
                      <Clock size={12} aria-hidden />
                      {minutesUntil(r.expires_at)} min
                    </Badge>
                  )}
                </header>

                <ul className="divide-y divide-line rounded-xl border border-line">
                  {r.items.map((i) => (
                    <li key={i.product_id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-semibold">{i.brand_name}</span>
                      {i.counter_verification && <Badge tone="danger">H1</Badge>}
                      <span className="tabular">
                        {i.qty} × {rupee(i.price_per_unit)}
                      </span>
                    </li>
                  ))}
                </ul>

                {r.prescription && (
                  <div className="flex gap-3 rounded-xl bg-surface-2 p-2.5">
                    {r.prescription.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.prescription.image_url}
                        alt="Prescription"
                        className="size-24 shrink-0 rounded-lg border border-line object-cover"
                      />
                    ) : (
                      <span className="grid size-24 shrink-0 place-items-center rounded-lg border border-line text-muted">
                        <FileText size={22} aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-bold">{r.prescription.doctor_name ?? 'No doctor name'}</p>
                      <p className="text-muted">{r.prescription.registration_no ?? 'No registration number'}</p>
                      <p className="text-muted">{r.prescription.clinic_or_hospital ?? '—'}</p>
                      <p className="text-muted">
                        Dated {r.prescription.prescription_date ?? '—'} · legibility{' '}
                        {Math.round(r.prescription.legibility_score * 100)}%
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {r.prescription.items.map((line) => (
                          <li key={line} className="truncate font-mono text-[0.6875rem]">
                            {line}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-1.5 flex gap-1.5">
                        <Button size="sm" onClick={() => act(r.code, 'verify_prescription')} disabled={!!busy}>
                          <Check size={14} aria-hidden />
                          Prescription OK
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => act(r.code, 'reject_prescription', 'Prescription not acceptable')}
                          disabled={!!busy}
                        >
                          <X size={14} aria-hidden />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => act(r.code, 'confirm')} disabled={!!busy || r.status === 'collected'}>
                    <CheckCircle2 size={15} aria-hidden />
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => act(r.code, 'reject', 'Out of stock')}
                    disabled={!!busy || r.status === 'collected'}
                  >
                    <PackageX size={15} aria-hidden />
                    Out of stock
                  </Button>
                  <Button
                    size="sm"
                    variant={needsRx ? 'secondary' : 'primary'}
                    onClick={() => act(r.code, 'collected')}
                    disabled={!!busy || needsRx || r.status === 'collected'}
                    title={needsRx ? 'Verify the prescription first' : undefined}
                  >
                    {needsRx ? <Lock size={15} aria-hidden /> : <Check size={15} aria-hidden />}
                    Collected
                  </Button>
                </div>
                {needsRx && (
                  <p className="text-xs font-semibold text-danger">
                    Verify the prescription before handing over — required for Schedule H and H1 medicines.
                  </p>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Inventory({ pharmacyId, onToast }: { pharmacyId: string; onToast: (m: string) => void }) {
  const [data, setData] = useState<PharmacistInventory | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [dirty, setDirty] = useState<Record<string, { in_stock?: boolean; price?: number }>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.pharmacistInventory(pharmacyId, q, filter).then(setData).catch(() => setData(null))
  }, [pharmacyId, q, filter])

  useEffect(() => {
    const id = setTimeout(load, 220)
    return () => clearTimeout(id)
  }, [load])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const dirtyCount = Object.keys(dirty).length

  async function save() {
    setSaving(true)
    try {
      await api.pharmacistUpdate(
        pharmacyId,
        Object.entries(dirty).map(([product_id, patch]) => ({ product_id, ...patch })),
      )
      onToast(`${dirtyCount} rows updated — stock marked current`)
      setDirty({})
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-full border border-field-line px-3 py-2">
          <Search size={16} className="text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search medicine or salt"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        {(
          [
            ['all', 'All'],
            ['out_of_stock', 'Out of stock'],
            ['rx', 'Prescription only'],
          ] as Array<[string, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={clsx('pill', filter === key ? 'border-transparent bg-primary text-on-primary' : 'bg-surface')}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-muted">{data ? `${data.total} rows` : ''}</span>
        {dirtyCount > 0 && (
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />}
            Save {dirtyCount}
          </Button>
        )}
      </Card>

      {!data && <Skeleton className="h-64 w-full" />}

      {data && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead className="sticky top-0 bg-surface-2">
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">Medicine</th>
                <th className="px-3 py-2">Pack</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Per unit</th>
                <th className="px-3 py-2 text-center">In stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const patch = dirty[r.product_id] ?? {}
                const inStock = patch.in_stock ?? r.in_stock
                const price = patch.price ?? r.price
                return (
                  <tr key={r.product_id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold">{r.brand_name}</span>
                        {r.is_jan_aushadhi && <Badge tone="savings">Jan Aushadhi</Badge>}
                        {r.is_rx && <Badge tone="danger">{r.schedule}</Badge>}
                      </span>
                      <span className="block text-xs text-muted">{r.composition_raw}</span>
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {r.pack_size} {r.unit_label}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={price}
                        onChange={(e) =>
                          setDirty((prev) => ({
                            ...prev,
                            [r.product_id]: { ...prev[r.product_id], price: Number(e.target.value) },
                          }))
                        }
                        className="tabular w-24 rounded-lg border border-field-line bg-surface px-2 py-1 text-right outline-none focus:border-primary"
                      />
                    </td>
                    <td className="tabular px-3 py-2 text-right text-muted">{rupee(price / r.pack_size)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        role="switch"
                        aria-checked={inStock}
                        onClick={() =>
                          setDirty((prev) => ({
                            ...prev,
                            [r.product_id]: { ...prev[r.product_id], in_stock: !inStock },
                          }))
                        }
                        className={clsx(
                          'relative h-7 w-12 rounded-full transition',
                          inStock ? 'bg-success' : 'bg-line',
                        )}
                      >
                        <span
                          className={clsx(
                            'absolute top-0.5 size-6 rounded-full bg-white shadow transition',
                            inStock ? 'left-[1.4rem]' : 'left-0.5',
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-muted">
        Demo stock is seeded data, flagged as simulated everywhere a customer sees it. Editing a row here marks
        your stock as confirmed now.
      </p>
    </div>
  )
}

function Import({ pharmacyId, onToast }: { pharmacyId: string; onToast: (m: string) => void }) {
  const [csv, setCsv] = useState('medicine,price,in_stock\nDolo 650,34.5,yes\nGlycomet 500,48,yes\nAugmentin 625 Duo,221,no\n')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(commit: boolean) {
    setBusy(true)
    try {
      const res = await api.pharmacistImport(pharmacyId, csv, commit)
      setPreview(res)
      if (commit) onToast(`${res.applied} rows applied`)
    } catch (e) {
      onToast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <h2 className="text-base font-bold">Import your stock list</h2>
        <p className="text-sm text-muted">
          Drop a CSV with a medicine name column, and optionally price and stock columns. Nothing is applied
          until you confirm the preview, and rows we cannot match confidently are never guessed.
        </p>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file) setCsv(await file.text())
          }}
          className="rounded-2xl border-2 border-dashed border-field-line p-4"
        >
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full resize-y bg-transparent font-mono text-xs outline-none"
          />
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-primary">
            <Upload size={16} aria-hidden />
            Choose a file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setCsv(await f.text())
              }}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => run(false)} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
            Preview
          </Button>
          <Button onClick={() => run(true)} disabled={busy || !preview}>
            Apply {preview ? `${preview.summary.ok + preview.summary.needs_review} rows` : ''}
          </Button>
        </div>
      </Card>

      {preview && (
        <Card className="space-y-2 overflow-x-auto">
          <p className="flex flex-wrap gap-2 text-sm">
            <Badge tone="success">{preview.summary.ok} matched</Badge>
            <Badge tone="savings">{preview.summary.needs_review} to check</Badge>
            <Badge tone="danger">{preview.summary.unmatched} unmatched</Badge>
            {preview.committed && <Badge tone="primary">{preview.applied} applied</Badge>}
          </p>
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-2">Line</th>
                <th className="py-1.5 pr-2">Your text</th>
                <th className="py-1.5 pr-2">Matched to</th>
                <th className="py-1.5 pr-2 text-right">Price</th>
                <th className="py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.line} className="border-t border-line">
                  <td className="py-1.5 pr-2 text-muted">{r.line}</td>
                  <td className="py-1.5 pr-2 font-mono text-xs">{r.input}</td>
                  <td className="py-1.5 pr-2">{r.matched_name ?? '—'}</td>
                  <td className="tabular py-1.5 pr-2 text-right">{r.price !== null ? rupee(r.price) : '—'}</td>
                  <td className="py-1.5">
                    <Badge
                      tone={
                        r.status === 'ok'
                          ? 'success'
                          : r.status === 'needs_review'
                            ? 'savings'
                            : 'danger'
                      }
                    >
                      {r.status.replace('_', ' ')}
                    </Badge>
                    {r.message && <span className="block text-xs text-muted">{r.message}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
