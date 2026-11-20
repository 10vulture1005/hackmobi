'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Loader2, MapPin, Share2, Sparkles, Volume2 } from 'lucide-react'
import { useApp } from '@/components/AppProvider'
import { Badge, Button, Card, CountUp, EmptyState, SkeletonCard, Toast } from '@/components/ui'
import { MedicineCard } from '@/components/MedicineCard'
import { TrustExplainer } from '@/components/TrustExplainer'
import { BeforeYouBuy } from '@/components/BeforeYouBuy'
import { ReserveSheet, type ReserveItem } from '@/components/ReserveSheet'
import { ShareCard, type SharePayload } from '@/components/ShareCard'
import { api, type BasketResult } from '@/lib/client/api'
import { basketPrescription } from '@/lib/client/session'
import { listResults, saveMedicine, saveResult, listMedicines } from '@/lib/client/idb'
import { rupee, shortDate } from '@/lib/client/format'
import { speak } from '@/lib/client/speech'

interface Requested {
  product_id: string
  qty: number
}

function parseItems(raw: string | null): Requested[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => {
      const [product_id, qty] = part.split(':')
      return { product_id, qty: qty ? Number(qty) : 0 }
    })
    .filter((i) => i.product_id)
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <Results />
    </Suspense>
  )
}

function Results() {
  const router = useRouter()
  const params = useSearchParams()
  const { d, t, language, place, radiusKm, online, voiceGuided } = useApp()

  const requested = useMemo(() => parseItems(params.get('items')), [params])
  const [basket, setBasket] = useState<BasketResult | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<string[]>([])

  const [trustOpen, setTrustOpen] = useState(false)
  const [infoFor, setInfoFor] = useState<string | null>(null)
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)
  const [reserve, setReserve] = useState<{ items: ReserveItem[]; pharmacy: { id: string; name: string } | null; savings: number } | null>(null)

  const resultId = requested.map((i) => `${i.product_id}:${i.qty}`).join(',')

  useEffect(() => {
    void listMedicines().then((rows) => setSavedIds(rows.map((r) => r.product_id)))
  }, [])

  useEffect(() => {
    if (requested.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    setSavedAt(null)
    ;(async () => {
      try {
        const res = await api.alternatives({
          items: requested,
          lat: place.lat,
          lng: place.lng,
          radius_km: radiusKm,
          language,
        })
        if (cancelled) return
        setBasket(res)
        // Keep the last ten results on the device so they open with no network.
        void saveResult({
          id: resultId,
          saved_at: new Date().toISOString(),
          label: res.items.map((i) => i.original.brand_name).join(' + '),
          payload: res,
          items: requested,
          savings_total: res.savings_total,
          language,
        })
      } catch {
        if (cancelled) return
        // Offline or the API is down: fall back to the saved copy.
        const saved = (await listResults()).find((r) => r.id === resultId) ?? (await listResults())[0]
        if (saved) {
          setBasket(saved.payload as BasketResult)
          setSavedAt(saved.saved_at)
        } else {
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resultId, place.lat, place.lng, radiusKm, language, requested])

  useEffect(() => {
    if (!basket || savedAt) return
    let cancelled = false
    api
      .explain({ items: requested, language, lat: place.lat, lng: place.lng, radius_km: radiusKm })
      .then((res) => {
        if (!cancelled) setLines(res.lines)
      })
      .catch(() => {
        if (!cancelled) setLines([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basket, language])

  const spoken = useMemo(() => {
    if (!basket) return ''
    const parts = [...lines]
    for (const item of basket.items) {
      parts.push(
        `${item.original.brand_name}. ${item.switchable ? `${d.results.cheaper}: ${item.best.brand_name}, ${rupee(item.best.price_per_unit)} ${t(d.results.perUnit, { unit: item.best.unit_label })}. ${t(d.results.save, { amount: rupee(item.best.savings_total) })}.` : d.results.savingsNone}` +
          (item.best.best_offer ? ` ${item.best.best_offer.pharmacy_name}, ${t(d.results.away, { km: item.best.best_offer.distance_km ?? 0 })}.` : ''),
      )
    }
    parts.push(d.results.disclaimer)
    return parts.join(' ')
  }, [basket, lines, d, t])

  // Voice-guided mode reads the result in a fixed order, once.
  useEffect(() => {
    if (!voiceGuided || !basket || !spoken) return
    speak(spoken, language)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basket])

  const duplicateFor = useCallback(
    (productId: string): string | null => {
      const w = basket?.duplicate_salt_warnings.find((x) => x.product_ids.includes(productId))
      return w ? String(w.params.salt) : null
    },
    [basket],
  )

  async function onSave(item: BasketResult['items'][number]) {
    await saveMedicine({
      product_id: item.original.product_id,
      brand_name: item.original.brand_name,
      composition_raw: item.original.composition_raw,
      unit_label: item.original.unit_label,
      pack_size: item.original.pack_size,
      price_per_unit: item.original.price_per_unit,
      generic_price_per_unit: item.best.price_per_unit,
      generic_name: item.best.brand_name,
      generic_is_jan_aushadhi: item.best.is_jan_aushadhi,
      units_per_month: item.qty,
      added_at: new Date().toISOString(),
      last_bought_at: null,
      is_rx: item.original.rx_required,
    })
    setSavedIds((prev) => [...new Set([...prev, item.original.product_id])])
    setToast(d.mine.added)
  }

  if (requested.length === 0 && !loading) {
    return (
      <EmptyState
        icon={<Sparkles size={24} aria-hidden />}
        title={d.search.noResults}
        action={
          <Button onClick={() => router.push('/')}>
            <ArrowLeft size={16} aria-hidden />
            {d.common.back}
          </Button>
        }
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-28 w-full rounded-[20px]" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (error || !basket) {
    return (
      <EmptyState
        icon={<AlertTriangle size={24} aria-hidden />}
        title={online ? d.common.error : d.offline.noResults}
        action={
          <Button onClick={() => router.refresh()}>
            {d.common.retry}
          </Button>
        }
      />
    )
  }

  const progress = basket.original_total > 0 ? (basket.best_total / basket.original_total) * 100 : 100
  // The savings line wraps an animated number, so the template is split rather
  // than interpolated — the number is a node, not a string.
  const [savingsBefore, savingsAfter] = (
    basket.items.length > 1 ? d.results.savings : d.results.savingsOne
  ).split('{amount}')

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft size={16} aria-hidden />
          {d.common.back}
        </Button>
        {savedAt && <Badge tone="savings">{t(d.offline.savedOn, { date: shortDate(savedAt) })}</Badge>}
      </div>

      {/* sticky savings banner */}
      <div className="sticky top-[58px] z-30 -mx-1 px-1">
        <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-savings to-savings-deep p-4 text-on-savings shadow-lift">
          <p className="text-sm font-bold uppercase tracking-wide opacity-80">
            {basket.items.length > 1 ? d.results.title : d.results.doctorWrote}
          </p>
          <p className="mt-0.5 text-[1.75rem] font-extrabold leading-tight">
            {basket.savings_total > 0 ? (
              <>
                {savingsBefore}
                <CountUp value={basket.savings_total} format={(n) => rupee(Math.round(n))} />
                {savingsAfter}
              </>
            ) : (
              d.results.savingsNone
            )}
          </p>
          {basket.savings_total > 0 && (
            <>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-black/15">
                <div
                  className="h-full rounded-full bg-savings-meter transition-[width] duration-700"
                  style={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
                />
              </div>
              <p className="mt-1.5 flex items-center justify-between text-sm font-bold">
                <span>
                  {d.results.was} {rupee(basket.original_total)}
                </span>
                <span>
                  {d.results.becomes} {rupee(basket.best_total)}
                </span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* plain-language summary */}
      {lines.length > 0 && (
        <Card className="space-y-1">
          {lines.map((line) => (
            <p key={line} className="text-[0.9375rem] leading-snug">
              {line}
            </p>
          ))}
        </Card>
      )}

      {/* duplicate salt, basket level */}
      {basket.duplicate_salt_warnings.map((w) => (
        <p
          key={String(w.params.salt)}
          className="flex items-start gap-2 rounded-2xl bg-danger-tint px-3.5 py-3 text-sm font-bold text-danger-ink"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden />
          {t(d.results.duplicateSalt, { salt: String(w.params.salt) })}
        </p>
      ))}

      {/* one card per medicine */}
      {basket.items.map((item, i) => (
        <MedicineCard
          key={item.product_id}
          item={item}
          index={i}
          duplicateSalt={duplicateFor(item.product_id)}
          saved={savedIds.includes(item.original.product_id)}
          onTrust={() => setTrustOpen(true)}
          onInfo={(id) => setInfoFor(id)}
          onSave={(it) => void onSave(it)}
          onMap={(id) => router.push(`/map?product_id=${id}`)}
          onReserve={(option) => {
            setReserve({
              items: [
                {
                  product_id: option.product_id,
                  brand_name: option.brand_name,
                  qty: item.qty,
                  unit_label: option.unit_label,
                  price_per_unit: option.price_per_unit,
                  rx_required: option.rx_required,
                  counter_verification: option.counter_verification,
                },
              ],
              pharmacy: option.best_offer
                ? { id: option.best_offer.pharmacy_id, name: option.best_offer.pharmacy_name }
                : null,
              savings: option.savings_total,
            })
          }}
        />
      ))}

      {/* reserve the whole cheaper basket, where one shop has it all */}
      {basket.items.length > 1 && <WholeBasketBar basket={basket} onReserve={setReserve} />}

      <p className="px-1 text-xs font-semibold text-muted">{d.results.disclaimer}</p>
      {savedAt && <p className="px-1 text-xs text-muted">{d.offline.noReserve}</p>}

      {/* bottom action bar */}
      <div className="fixed inset-x-0 bottom-[66px] z-30 mx-auto w-full max-w-xl px-4">
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface/95 p-1.5 shadow-lift backdrop-blur">
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => speak(spoken, language)}>
            <Volume2 size={17} aria-hidden />
            {d.results.listen}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => {
              const item = basket.items.find((i) => i.switchable) ?? basket.items[0]
              setSharePayload({
                medicine: item.original.brand_name,
                composition: item.original.composition_raw,
                oldPrice: item.original.price_per_unit,
                newPrice: item.best.price_per_unit,
                newName: item.best.brand_name,
                unit: item.best.unit_label,
                savings: basket.savings_total || item.best.savings_total,
                savingsPct: item.best.savings_pct,
                store: item.best.best_offer?.pharmacy_name ?? null,
                distanceKm: item.best.best_offer?.distance_km ?? null,
                isJanAushadhi: item.best.is_jan_aushadhi,
              })
            }}
          >
            <Share2 size={17} aria-hidden />
            {d.results.shareShort}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => router.push(`/map?product_id=${basket.items[0].best.product_id}`)}
          >
            <MapPin size={17} aria-hidden />
            {d.results.mapShort}
          </Button>
        </div>
      </div>

      <TrustExplainer open={trustOpen} onClose={() => setTrustOpen(false)} autoShow={basket.items.some((i) => i.switchable)} />
      <BeforeYouBuy open={!!infoFor} productId={infoFor} onClose={() => setInfoFor(null)} />
      <ShareCard open={!!sharePayload} payload={sharePayload} onClose={() => setSharePayload(null)} />
      <ReserveSheet
        open={!!reserve}
        onClose={() => setReserve(null)}
        items={reserve?.items ?? []}
        pharmacy={reserve?.pharmacy ?? null}
        estimatedSavings={reserve?.savings ?? 0}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

/** Offers the whole cheaper basket at one shop, when a single shop has it all. */
function WholeBasketBar({
  basket,
  onReserve,
}: {
  basket: BasketResult
  onReserve: (r: { items: ReserveItem[]; pharmacy: { id: string; name: string } | null; savings: number }) => void
}) {
  const { d, t } = useApp()

  const counts = new Map<string, { name: string; n: number }>()
  for (const item of basket.items) {
    const offer = item.best.best_offer
    if (!offer) continue
    const cur = counts.get(offer.pharmacy_id) ?? { name: offer.pharmacy_name, n: 0 }
    cur.n += 1
    counts.set(offer.pharmacy_id, cur)
  }
  const [bestId, bestShop] = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0] ?? []
  if (!bestId || !bestShop || bestShop.n < 2) return null

  const items: ReserveItem[] = basket.items
    .filter((i) => i.best.best_offer?.pharmacy_id === bestId)
    .map((i) => ({
      product_id: i.best.product_id,
      brand_name: i.best.brand_name,
      qty: i.qty,
      unit_label: i.best.unit_label,
      price_per_unit: i.best.price_per_unit,
      rx_required: i.best.rx_required,
      counter_verification: i.best.counter_verification,
    }))

  return (
    <Card className="space-y-2">
      <p className="text-sm font-bold">{bestShop.name}</p>
      <p className="text-xs text-muted">
        {t(d.results.options, { n: bestShop.n })} {d.common.of} {basket.items.length} · {d.results.total}{' '}
        {rupee(items.reduce((s, i) => s + i.price_per_unit * i.qty, 0))}
      </p>
      <Button
        className="w-full"
        onClick={() =>
          onReserve({ items, pharmacy: { id: bestId, name: bestShop.name }, savings: basket.savings_total })
        }
      >
        {d.results.reserve}
      </Button>
    </Card>
  )
}
