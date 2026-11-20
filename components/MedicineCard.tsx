'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  BookmarkPlus,
  ChevronDown,
  Info,
  Lock,
  MapPin,
  ShieldAlert,
  Store,
} from 'lucide-react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Badge, Button, Card } from './ui'
import { StockChips } from './StockChip'
import { useApp } from './AppProvider'
import { paise, rupee } from '@/lib/client/format'
import type { BasketResult } from '@/lib/client/api'

type Item = BasketResult['items'][number]
type Option = Item['original']

export function MedicineCard({
  item,
  index,
  duplicateSalt,
  onReserve,
  onInfo,
  onTrust,
  onSave,
  onMap,
  saved,
}: {
  item: Item
  index: number
  duplicateSalt: string | null
  onReserve: (option: Option) => void
  onInfo: (productId: string) => void
  onTrust: () => void
  onSave: (item: Item) => void
  onMap: (productId: string) => void
  saved: boolean
}) {
  const { d, t, radiusKm } = useApp()
  const [openAll, setOpenAll] = useState(false)

  const original = item.original
  const best = item.best
  const switched = item.switchable
  const offer = best.best_offer
  const allOptions = [original, ...item.alternatives].sort((a, b) => a.price_per_unit - b.price_per_unit)

  return (
    <Card delay={index * 0.04} className="space-y-3 overflow-hidden">
      {/* what the doctor wrote */}
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">{d.results.doctorWrote}</p>
          <h3 className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[1.0625rem] font-extrabold leading-tight">
            <span className={clsx(switched && 'text-muted line-through decoration-2')}>{original.brand_name}</span>
            {original.rx_required && (
              <Badge tone="danger">
                <Lock size={12} aria-hidden />
                {d.results.rxRequired}
              </Badge>
            )}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted">{original.composition_raw}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={clsx('tabular text-base font-bold', switched && 'text-muted line-through')}>
            {paise(original.price_per_unit)}
          </p>
          <p className="text-[0.6875rem] text-muted">{t(d.results.perUnit, { unit: original.unit_label })}</p>
        </div>
      </header>

      {/* the cheaper same-salt option */}
      {switched && (
        <div className="rounded-2xl border border-success/40 bg-success-tint/50 p-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-success text-white">
              <ArrowDown size={16} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={onTrust}
                  className="pill border-transparent bg-success text-white"
                  aria-label={`${d.results.sameSalt} — ${d.trust.title}`}
                >
                  {d.results.sameSalt} ✓
                  <Info size={13} aria-hidden />
                </button>
                {best.is_jan_aushadhi && <Badge tone="savings">{d.results.janAushadhi}</Badge>}
                {!best.is_jan_aushadhi && best.is_generic && <Badge tone="primary">{d.results.generic}</Badge>}
                {best.rx_required && <Badge tone="danger">{d.results.rxRequired}</Badge>}
              </p>
              <p className="mt-1.5 text-[1.0625rem] font-extrabold leading-tight">{best.brand_name}</p>
              <p className="text-xs text-muted">
                {best.manufacturer} · {t(d.results.pack, { n: best.pack_size })}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tabular text-lg font-extrabold text-success">{paise(best.price_per_unit)}</p>
              <p className="text-[0.6875rem] text-muted">{t(d.results.perUnit, { unit: best.unit_label })}</p>
            </div>
          </div>

          <p className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-savings px-3 py-2 text-sm font-extrabold text-[#3b2600]">
            <span>{t(d.results.save, { amount: rupee(best.savings_total) })}</span>
            <span className="tabular">{t(d.results.savingsPct, { pct: best.savings_pct })}</span>
          </p>
        </div>
      )}

      {/* warnings */}
      <ul className="space-y-1.5">
        {item.narrow_therapeutic_index && (
          <WarnRow
            tone="danger"
            icon={<ShieldAlert size={15} aria-hidden />}
            text={`${t(d.results.nti, { salt: item.salt_key.replace(/\+/g, ' + ') })} — ${d.results.ntiWhy}`}
          />
        )}
        {duplicateSalt && (
          <WarnRow
            tone="danger"
            icon={<AlertTriangle size={15} aria-hidden />}
            text={t(d.results.duplicateSalt, { salt: duplicateSalt })}
          />
        )}
        {original.above_nppa_ceiling && original.nppa_ceiling_per_unit !== null && (
          <WarnRow
            tone="savings"
            icon={<AlertTriangle size={15} aria-hidden />}
            text={t(d.results.aboveCeiling, {
              ceiling: paise(original.nppa_ceiling_per_unit),
              unit: original.unit_label,
            })}
          />
        )}
        {original.counter_verification && (
          <WarnRow tone="danger" icon={<Lock size={15} aria-hidden />} text={d.results.counterVerification} />
        )}
        {!item.canonical_key && <WarnRow tone="neutral" icon={<Info size={15} aria-hidden />} text={d.results.noSubstitute} />}
        {item.warnings.some((w) => w.code === 'no_stock_nearby') && (
          <WarnRow
            tone="neutral"
            icon={<Store size={15} aria-hidden />}
            text={t(d.results.noStockNearby, { radius: radiusKm })}
          />
        )}
      </ul>

      {/* nearest shop + reserve */}
      {offer ? (
        <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted">{d.results.nearest}</p>
          <div className="mt-1 flex items-start gap-2">
            <span
              className={clsx(
                'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl',
                offer.is_jan_aushadhi ? 'bg-savings-tint text-[#92400e]' : 'bg-primary-tint text-primary-dark',
              )}
            >
              <Store size={16} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{offer.pharmacy_name}</p>
              <p className="text-xs text-muted">
                {offer.distance_km !== null ? t(d.results.away, { km: offer.distance_km }) : ''} · {rupee(offer.price)}{' '}
                {t(d.results.pack, { n: best.pack_size })}
              </p>
              <div className="mt-1.5">
                <StockChips offer={offer} />
              </div>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onReserve(best)} className="flex-1">
              {best.rx_required ? <Lock size={15} aria-hidden /> : null}
              {best.rx_required ? d.results.uploadToReserve : d.results.reserve}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onMap(best.product_id)}>
              <MapPin size={15} aria-hidden />
              {d.results.findOnMap}
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-surface-2 px-3 py-2.5 text-sm text-muted">
          {t(d.results.noStockNearby, { radius: radiusKm })}
        </p>
      )}

      {/* secondary actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
        {!original.rx_required && (
          <Button variant="ghost" size="sm" onClick={() => onInfo(original.product_id)}>
            <Info size={16} aria-hidden />
            {d.results.beforeYouBuy}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onSave(item)} disabled={saved}>
          <BookmarkPlus size={16} aria-hidden />
          {saved ? d.mine.added : d.mine.add}
        </Button>
        {item.alternatives.length > 0 && (
          <button
            onClick={() => setOpenAll((v) => !v)}
            aria-expanded={openAll}
            className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-primary"
          >
            {openAll ? d.results.hideAll : d.results.compareAll}
            <ChevronDown size={16} className={clsx('transition', openAll && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>

      {/* all options */}
      <AnimatePresence initial={false}>
        {openAll && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[0.6875rem] uppercase tracking-wide text-muted">
                    <th className="py-1.5 pr-2 font-bold">{d.review.name}</th>
                    <th className="py-1.5 pr-2 text-right font-bold">
                      {t(d.results.perUnit, { unit: original.unit_label })}
                    </th>
                    <th className="py-1.5 pr-2 text-right font-bold">{d.results.mrp}</th>
                    <th className="py-1.5 text-right font-bold">{d.results.inStock}</th>
                  </tr>
                </thead>
                <tbody>
                  {allOptions.map((o) => (
                    <tr key={o.product_id} className="border-t border-line align-top">
                      <td className="py-2 pr-2">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{o.brand_name}</span>
                          {o.is_jan_aushadhi && <Badge tone="savings">{d.results.janAushadhi}</Badge>}
                          {o.product_id === original.product_id && <Badge tone="neutral">{d.results.doctorWrote}</Badge>}
                        </span>
                        <span className="block text-xs text-muted">{o.manufacturer}</span>
                      </td>
                      <td className="tabular py-2 pr-2 text-right font-bold">{paise(o.price_per_unit)}</td>
                      <td className="tabular py-2 pr-2 text-right text-muted">{rupee(o.mrp)}</td>
                      <td className="py-2 text-right">
                        {o.in_stock_nearby ? (
                          <Badge tone="savings">{d.results.demoStock}</Badge>
                        ) : (
                          <Badge tone="muted">{d.results.outOfStock}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function WarnRow({
  tone,
  icon,
  text,
}: {
  tone: 'danger' | 'savings' | 'neutral'
  icon: React.ReactNode
  text: string
}) {
  return (
    <li
      className={clsx(
        'flex items-start gap-2 rounded-xl px-3 py-2 text-[0.8125rem] font-semibold leading-snug',
        tone === 'danger' && 'bg-danger-tint text-danger',
        tone === 'savings' && 'bg-savings-tint text-[#92400e]',
        tone === 'neutral' && 'bg-surface-2 text-muted',
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </li>
  )
}
