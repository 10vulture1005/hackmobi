'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Camera,
  Keyboard,
  Loader2,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import clsx from 'clsx'
import { useApp, AREAS } from '@/components/AppProvider'
import { Badge, Button, Card, Sheet, Skeleton, Toast } from '@/components/ui'
import { MicButton } from '@/components/Mic'
import { api, type MatchBlock } from '@/lib/client/api'
import { saveParse, setBasketPrescription } from '@/lib/client/session'
import { paise } from '@/lib/client/format'
import { speak } from '@/lib/client/speech'

const POPULAR = ['Dolo 650', 'Paracetamol 500', 'Metformin 500', 'Amlopres 5', 'Alerid 10', 'Augmentin 625 Duo']

export default function HomePage() {
  const router = useRouter()
  const { d, t, language, place, setPlace, requestLocation, locating, voiceGuided, ready } = useApp()

  const [query, setQuery] = useState('')
  const [match, setMatch] = useState<MatchBlock | null>(null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState<null | 'rx' | 'strip'>(null)
  const [demoOpen, setDemoOpen] = useState(false)
  const [areaOpen, setAreaOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const rxInput = useRef<HTMLInputElement>(null)
  const stripInput = useRef<HTMLInputElement>(null)
  const spokenOnce = useRef(false)

  // Voice-guided mode: one spoken prompt per screen, never repeated.
  useEffect(() => {
    if (!ready || !voiceGuided || spokenOnce.current) return
    spokenOnce.current = true
    speak(`${d.home.hero} ${d.home.micHint}`, language)
  }, [ready, voiceGuided, d, language])

  const runSearch = useCallback(
    async (q: string) => {
      const text = q.trim()
      if (text.length < 2) return
      setSearching(true)
      setMatch(null)
      try {
        const res = await api.search(text, { lat: place.lat, lng: place.lng, language })
        setMatch(res)
        if (res.confident && res.best) {
          setBasketPrescription(null)
          router.push(`/results?items=${res.best.product.id}`)
        }
      } catch {
        setToast(d.common.error)
      } finally {
        setSearching(false)
      }
    },
    [place.lat, place.lng, language, router, d.common.error],
  )

  async function openDemo(slug: string) {
    setDemoOpen(false)
    setBusy('rx')
    try {
      const res = await api.parsePrescription({ demo_slug: slug })
      saveParse(res)
      router.push(`/review?rx=${res.prescription_id}`)
    } catch {
      setToast(d.common.error)
    } finally {
      setBusy(null)
    }
  }

  async function onRxFile(file: File) {
    setBusy('rx')
    try {
      const res = await api.parsePrescription({ file })
      saveParse(res)
      if (res.extracted.items.length === 0) {
        setToast(d.review.confidenceLow)
      }
      router.push(`/review?rx=${res.prescription_id}`)
    } catch {
      setToast(d.common.error)
    } finally {
      setBusy(null)
    }
  }

  async function onStripFile(file: File | null) {
    setBusy('strip')
    try {
      const res = await api.scanStrip(file ? { file } : { demo_key: 'default' })
      if (res.match.best && res.match.confident) {
        setBasketPrescription(null)
        router.push(`/results?items=${res.match.best.product.id}&from=strip`)
      } else {
        setQuery(res.scan.brand_name || res.scan.salt_text)
        setMatch(res.match)
        setToast(res.scan.brand_name ? d.search.pickOne : d.review.confidenceLow)
      }
    } catch {
      setToast(d.common.error)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* hero + search */}
      <section className="pt-1">
        <h1 className="text-[1.6rem] font-extrabold leading-tight tracking-tight">{d.home.hero}</h1>
        <p className="mt-1 text-sm text-muted">{d.home.sub}</p>

        <form
          className="mt-3.5 flex items-center gap-2 rounded-full border border-line bg-surface p-1.5 shadow-card focus-within:border-primary"
          onSubmit={(e) => {
            e.preventDefault()
            void runSearch(query)
          }}
        >
          <span className="pl-2.5 text-muted">
            <Search size={20} aria-hidden />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.home.searchPlaceholder}
            aria-label={d.home.searchPlaceholder}
            inputMode="search"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none placeholder:text-muted/80"
          />
          <Button type="submit" size="sm" disabled={query.trim().length < 2 || searching} className="shrink-0">
            {searching ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ArrowRight size={16} aria-hidden />}
            <span className="hidden sm:inline">{d.home.search}</span>
          </Button>
        </form>

        {/* four equal-weight inputs */}
        <div className="mt-3.5 grid grid-cols-4 gap-2">
          <ActionTile
            icon={<Camera size={22} aria-hidden />}
            label={d.home.scanRx}
            hint={d.home.uploadHint}
            busy={busy === 'rx'}
            onClick={() => rxInput.current?.click()}
          />
          <ActionTile
            icon={<Package size={22} aria-hidden />}
            label={d.home.scanStrip}
            hint={d.home.stripHint}
            busy={busy === 'strip'}
            onClick={() => stripInput.current?.click()}
          />
          <div className="flex flex-col items-center justify-start gap-1 rounded-2xl border border-line bg-surface p-2 text-center shadow-card">
            <MicButton onTranscript={(text) => void runSearch(text)} onInterim={setQuery} label={d.home.speak} />
          </div>
          <ActionTile
            icon={<Keyboard size={22} aria-hidden />}
            label={d.home.type}
            onClick={() => {
              const el = document.querySelector<HTMLInputElement>('input[inputmode="search"]')
              el?.focus()
            }}
          />
        </div>

        <input
          ref={rxInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onRxFile(f)
            e.target.value = ''
          }}
        />
        <input
          ref={stripInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            void onStripFile(f)
            e.target.value = ''
          }}
        />
      </section>

      {/* did you mean */}
      {searching && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {match && !searching && (
        <Card className="space-y-2.5">
          <h2 className="text-sm font-bold">
            {match.candidates.length === 0 ? d.search.noResults : match.confident ? d.search.pickOne : d.search.didYouMean}
          </h2>
          <ul className="space-y-2">
            {match.candidates.map((c) => (
              <li key={c.product.id}>
                <button
                  onClick={() => {
                    setBasketPrescription(null)
                    router.push(`/results?items=${c.product.id}`)
                  }}
                  className="tap flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 text-left transition hover:border-primary hover:bg-primary-tint/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-bold">{c.product.brand_name}</span>
                      {c.product.is_jan_aushadhi && <Badge tone="savings">{d.results.janAushadhi}</Badge>}
                      {c.product.is_rx && <Badge tone="danger">{d.results.rxRequired}</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted">{c.product.composition_raw}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular font-bold">{paise(c.product.price_per_unit)}</span>
                    <span className="block text-[0.6875rem] text-muted">
                      {t(d.results.perUnit, { unit: c.product.unit_label })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* popular + demo */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-bold">{d.home.popular}</h2>
        <ul className="flex flex-wrap gap-2">
          {POPULAR.map((p) => (
            <li key={p}>
              <button
                onClick={() => {
                  setQuery(p)
                  void runSearch(p)
                }}
                className="pill bg-surface hover:border-primary hover:text-primary-dark"
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="md" className="w-full" onClick={() => setDemoOpen(true)}>
          <Sparkles size={18} aria-hidden />
          {d.home.tryDemo}
        </Button>
      </section>

      {/* location */}
      <Card className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary-dark">
          <MapPin size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">
            {place.label === 'my_location' ? d.map.useLocation : place.label}
          </p>
          <p className="text-xs text-muted">Lucknow, Uttar Pradesh</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={requestLocation}
            disabled={locating}
            aria-label={locating ? d.map.locating : d.map.useLocation}
            title={d.map.useLocation}
          >
            {locating ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <MapPin size={15} aria-hidden />}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAreaOpen(true)}>
            {d.map.pickArea}
          </Button>
        </div>
      </Card>

      {/* how it works */}
      <section className="a11y-hide">
        <h2 className="mb-2 text-sm font-bold">{d.home.howItWorks}</h2>
        <ol className="grid grid-cols-3 gap-2">
          {[d.home.step1, d.home.step2, d.home.step3].map((step, i) => (
            <li key={step} className="card flex flex-col gap-1.5 p-3">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-[0.6875rem] font-extrabold text-white">
                {i + 1}
              </span>
              <span className="text-xs font-semibold leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-primary-tint/60 px-3.5 py-3 text-xs font-semibold text-primary-dark">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
        {d.home.trust} <span className="font-bold">{d.app.demoBadge}.</span>
      </p>

      <Sheet closeLabel={d.common.close} open={demoOpen} onClose={() => setDemoOpen(false)} title={d.home.demoPick}>
        <DemoList onPick={openDemo} />
      </Sheet>

      <Sheet closeLabel={d.common.close} open={areaOpen} onClose={() => setAreaOpen(false)} title={d.map.pickArea}>
        <ul className="grid grid-cols-2 gap-2">
          {AREAS.map((a) => (
            <li key={a.label}>
              <button
                onClick={() => {
                  setPlace(a)
                  setAreaOpen(false)
                }}
                className={clsx(
                  'tap w-full rounded-2xl border px-3 py-3 text-left font-semibold',
                  place.label === a.label ? 'border-primary bg-primary-tint text-primary-dark' : 'border-line bg-surface',
                )}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

function ActionTile({
  icon,
  label,
  hint,
  busy,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  busy?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="tap flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface p-2 text-center shadow-card transition hover:border-primary hover:bg-primary-tint/40"
    >
      <span className="grid size-[60px] place-items-center rounded-full bg-primary-tint text-primary-dark">
        {busy ? <Loader2 size={22} className="animate-spin" aria-hidden /> : icon}
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
      {hint && <span className="sr-only">{hint}</span>}
    </button>
  )
}

function DemoList({ onPick }: { onPick: (slug: string) => void }) {
  const { d } = useApp()
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.demoPrescriptions>>['prescriptions'] | null>(null)

  useEffect(() => {
    api.demoPrescriptions().then((r) => setRows(r.prescriptions)).catch(() => setRows([]))
  }, [])

  if (!rows) return <Skeleton className="h-40 w-full" />

  const DEMO_LABELS: Record<string, string> = {
    savings: d.results.cheaper,
    rx_gate: d.results.rxRequired,
    nti: d.results.ntiWhy,
    duplicate_salt: d.results.sameSalt,
    otc_info: d.info.title,
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((p) => (
        <li key={p.slug}>
          <button
            onClick={() => onPick(p.slug)}
            className="tap flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 text-left transition hover:border-primary"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt="" className="size-16 shrink-0 rounded-xl border border-line object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{p.label}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                {p.demonstrates.map((tag) => (
                  <Badge key={tag} tone="primary">
                    {DEMO_LABELS[tag] ?? tag}
                  </Badge>
                ))}
              </span>
            </span>
            <ArrowRight size={18} className="shrink-0 text-muted" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}
