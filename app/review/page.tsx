'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, Lock, Search, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/components/AppProvider'
import { Badge, Button, Card, EmptyState, SkeletonCard, Toast } from '@/components/ui'
import { api, type MatchBlock, type ParsePrescriptionResponse, type Product } from '@/lib/client/api'
import { getParse, lastParseId, saveParse, setBasketPrescription } from '@/lib/client/session'
import { paise } from '@/lib/client/format'

interface Row {
  key: string
  raw_text: string
  typed: string
  strength: string | null
  qty: number
  confidence: number
  product: Product | null
  candidates: Product[]
  searching: boolean
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <Review />
    </Suspense>
  )
}

function Review() {
  const router = useRouter()
  const params = useSearchParams()
  const { d, t } = useApp()

  const rxId = params.get('rx') ?? lastParseId()
  const [parsed, setParsed] = useState<ParsePrescriptionResponse | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!rxId) {
      setLoading(false)
      return
    }
    const cached = getParse(rxId)
    if (cached) {
      hydrate(cached)
      setLoading(false)
      return
    }
    // A reload lost the session copy. Demo prescriptions can be re-read.
    const slug = rxId.replace('rx_demo_', '')
    api
      .parsePrescription({ demo_slug: slug })
      .then((res) => {
        saveParse(res)
        hydrate(res)
      })
      .catch(() => setToast(d.common.error))
      .finally(() => setLoading(false))

    function hydrate(res: ParsePrescriptionResponse) {
      setParsed(res)
      setRows(
        res.extracted.items.map((item, i) => ({
          key: `${i}-${item.brand_or_generic_name}`,
          raw_text: item.raw_text,
          typed: item.brand_or_generic_name,
          strength: item.strength,
          qty: item.quantity ?? 0,
          confidence: item.confidence,
          product: item.match.best?.product ?? null,
          candidates: item.match.candidates.map((c) => c.product),
          searching: false,
        })),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rxId])

  async function research(key: string, text: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, typed: text, searching: true } : r)))
    try {
      const res: MatchBlock & { query: string } = await api.search(text)
      setRows((prev) =>
        prev.map((r) =>
          r.key === key
            ? {
                ...r,
                searching: false,
                candidates: res.candidates.map((c) => c.product),
                product: res.confident ? (res.best?.product ?? null) : r.product,
              }
            : r,
        ),
      )
    } catch {
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, searching: false } : r)))
    }
  }

  // Duplicate salts are detectable here, before anything is priced: every
  // matched product carries its canonical salts.
  const duplicates = useMemo(() => {
    const bySalt = new Map<string, string[]>()
    for (const r of rows) {
      if (!r.product) continue
      for (const s of r.product.salts) {
        const g = bySalt.get(s.salt) ?? []
        if (!g.includes(r.product.brand_name)) g.push(r.product.brand_name)
        bySalt.set(s.salt, g)
      }
    }
    return [...bySalt.entries()].filter(([, names]) => names.length > 1)
  }, [rows])

  const matched = rows.filter((r) => r.product)

  if (loading) return <SkeletonCard />

  if (!parsed) {
    return (
      <EmptyState
        icon={<AlertTriangle size={24} aria-hidden />}
        title={d.review.confidenceLow}
        body={d.home.uploadHint}
        action={
          <Button onClick={() => router.push('/')}>
            <ArrowLeft size={16} aria-hidden />
            {d.common.back}
          </Button>
        }
      />
    )
  }

  const ex = parsed.extracted

  return (
    <div className="space-y-3 pb-24">
      <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
        <ArrowLeft size={16} aria-hidden />
        {d.common.back}
      </Button>

      <header>
        <h1 className="text-xl font-extrabold leading-tight">{d.review.title}</h1>
        <p className="mt-0.5 text-sm text-muted">{d.review.sub}</p>
      </header>

      {parsed.image_url && (
        <Card className="space-y-2 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={parsed.image_url}
            alt={d.review.imageAlt}
            className="max-h-64 w-full rounded-xl border border-line object-contain"
          />
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <Meta label={d.review.doctor} value={ex.doctor_name ?? '—'} />
            <Meta label={d.review.date} value={ex.prescription_date ?? '—'} />
            <Meta label={d.review.clinic} value={ex.clinic_or_hospital ?? '—'} />
            <Meta label={d.review.legibility} value={`${Math.round(ex.legibility_score * 100)}%`} />
          </dl>
          <p className="text-[0.6875rem] text-muted">{d.review.retention}</p>
        </Card>
      )}

      {duplicates.map(([salt, names]) => (
        <p key={salt} className="flex items-start gap-2 rounded-2xl bg-danger-tint px-3.5 py-3 text-sm font-bold text-danger">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
          {t(d.results.duplicateSalt, { salt })} ({names.join(', ')})
        </p>
      ))}

      <ul className="space-y-2.5">
        {rows.map((row) => {
          const conf =
            row.confidence >= 0.85
              ? { tone: 'bg-success', label: d.review.confidenceHigh }
              : row.confidence >= 0.6
                ? { tone: 'bg-savings', label: d.review.confidenceMed }
                : { tone: 'bg-danger', label: d.review.confidenceLow }

          return (
            <li key={row.key}>
              <Card className="space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className={clsx('mt-2 size-2.5 shrink-0 rounded-full', conf.tone)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[0.6875rem] text-muted">{row.raw_text}</p>
                    <input
                      value={row.typed}
                      onChange={(e) => void research(row.key, e.target.value)}
                      aria-label={d.review.name}
                      className="mt-0.5 w-full rounded-xl border border-line bg-surface px-2.5 py-2 text-base font-bold outline-none focus:border-primary"
                    />
                    <p className="mt-1 text-[0.6875rem] font-semibold text-muted">{conf.label}</p>
                  </div>
                  <label className="shrink-0 text-right">
                    <span className="block text-[0.6875rem] font-bold text-muted">{d.review.qty}</span>
                    <input
                      type="number"
                      min={0}
                      value={row.qty || ''}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, qty: Number(e.target.value) } : r)),
                        )
                      }
                      className="tabular mt-0.5 w-20 rounded-xl border border-line bg-surface px-2 py-2 text-right text-base outline-none focus:border-primary"
                    />
                  </label>
                  <button
                    onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                    aria-label={d.review.remove}
                    className="tap -mr-1 grid shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>

                {row.product ? (
                  <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                    <Check size={16} className="shrink-0 text-success" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{row.product.brand_name}</span>
                        {row.product.is_jan_aushadhi && <Badge tone="savings">{d.results.janAushadhi}</Badge>}
                        {row.product.is_rx && (
                          <Badge tone="danger">
                            <Lock size={11} aria-hidden />
                            {d.results.rxRequired}
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted">{row.product.composition_raw}</span>
                    </span>
                    <button
                      onClick={() => setEditing(editing === row.key ? null : row.key)}
                      className="shrink-0 text-xs font-bold text-primary"
                    >
                      {d.review.change}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditing(row.key)}
                    className="flex w-full items-center gap-2 rounded-xl bg-savings-tint px-3 py-2 text-left text-sm font-bold text-[#92400e]"
                  >
                    <Search size={15} aria-hidden />
                    {d.review.notMatched}
                  </button>
                )}

                {(editing === row.key || (!row.product && row.candidates.length > 0)) && (
                  <ul className="space-y-1.5">
                    {row.searching && <Loader2 size={16} className="animate-spin text-muted" aria-hidden />}
                    {row.candidates.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => {
                            setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, product: p } : r)))
                            setEditing(null)
                          }}
                          className={clsx(
                            'tap flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left',
                            row.product?.id === p.id ? 'border-primary bg-primary-tint' : 'border-line bg-surface',
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{p.brand_name}</span>
                            <span className="block truncate text-xs text-muted">{p.composition_raw}</span>
                          </span>
                          <span className="tabular shrink-0 text-sm font-bold">{paise(p.price_per_unit)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-[66px] z-30 mx-auto w-full max-w-xl px-4">
        <Button
          size="lg"
          className="w-full shadow-lift"
          disabled={matched.length === 0}
          onClick={() => {
            setBasketPrescription(parsed.prescription_id)
            const items = matched
              .map((r) => `${r.product?.id}${r.qty ? `:${r.qty}` : ''}`)
              .join(',')
            router.push(`/results?items=${items}`)
          }}
        >
          {d.review.findCheaper}
          <ArrowRight size={18} aria-hidden />
        </Button>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-bold text-muted">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  )
}
