'use client'

import { BadgeCheck, Clock, PackageCheck, PackageX } from 'lucide-react'
import { Badge } from './ui'
import { useApp } from './AppProvider'
import type { Offer } from '@/lib/client/api'

/**
 * Stock and trust signals for one shop. Simulated rows are always labelled
 * "Demo stock" and their freshness is reported as unconfirmed.
 */
export function StockChips({ offer, compact }: { offer: Offer; compact?: boolean }) {
  const { d, t } = useApp()

  const freshness = (() => {
    switch (offer.freshness) {
      case 'fresh':
        return { tone: 'success' as const, text: t(d.results.stockFresh, { hours: offer.stock_age_hours ?? 0 }) }
      case 'stale':
        return {
          tone: 'savings' as const,
          text: t(d.results.stockStale, { days: Math.max(1, Math.round((offer.stock_age_hours ?? 24) / 24)) }),
        }
      case 'old':
        return { tone: 'muted' as const, text: d.results.stockOld }
      default:
        return { tone: 'muted' as const, text: d.results.stockUnknown }
    }
  })()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {offer.in_stock ? (
        <Badge tone={offer.is_simulated ? 'savings' : 'success'}>
          {offer.is_simulated ? <PackageCheck size={13} aria-hidden /> : <PackageCheck size={13} aria-hidden />}
          {offer.is_simulated ? d.results.demoStock : d.results.inStock}
        </Badge>
      ) : (
        <Badge tone="muted">
          <PackageX size={13} aria-hidden />
          {d.results.outOfStock}
        </Badge>
      )}
      <Badge tone={freshness.tone}>
        <Clock size={13} aria-hidden />
        {freshness.text}
      </Badge>
      {!compact && offer.verified && (
        <Badge tone="primary">
          <BadgeCheck size={13} aria-hidden />
          {d.results.verified}
        </Badge>
      )}
      {!compact && offer.licence_no && (
        <span className="text-[0.6875rem] text-muted">{t(d.results.licence, { no: offer.licence_no })}</span>
      )}
    </div>
  )
}
