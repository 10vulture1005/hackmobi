'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Clock, Home, Lock, PackageCheck, Store } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from '@/components/AppProvider'
import { Badge, Button, Card, EmptyState, SkeletonCard } from '@/components/ui'
import { api, type ReservationRecord } from '@/lib/client/api'
import { minutesUntil, rupee } from '@/lib/client/format'

const STEPS = ['pending', 'confirmed', 'collected'] as const

export default function ReservationPage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const { d, t } = useApp()
  const [res, setRes] = useState<ReservationRecord | null>(null)
  const [missing, setMissing] = useState(false)

  // Polls every 5 seconds so the pharmacist's action shows up here.
  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const body = await api.reservation(code)
        if (!stop) setRes(body.reservation)
      } catch {
        if (!stop) setMissing(true)
      }
    }
    void tick()
    const id = setInterval(tick, 5000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [code])

  if (missing) {
    return (
      <EmptyState
        icon={<AlertCircle size={24} aria-hidden />}
        title={d.reserve.failed}
        action={
          <Button onClick={() => router.push('/')}>
            <Home size={16} aria-hidden />
            {d.nav.home}
          </Button>
        }
      />
    )
  }

  if (!res) return <SkeletonCard />

  const statusLabel: Record<string, string> = {
    pending: d.reserve.statusSent,
    confirmed: d.reserve.statusConfirmed,
    collected: d.reserve.statusCollected,
    rejected: d.reserve.statusRejected,
    expired: d.reserve.statusExpired,
  }

  const stepIndex = STEPS.indexOf(res.status as (typeof STEPS)[number])
  const total = res.items.reduce((s, i) => s + i.price_per_unit * i.qty, 0)

  return (
    <div className="space-y-3 pb-8">
      <Card className="space-y-3 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-muted">{d.reserve.code}</p>
        <p className="tabular text-[2.25rem] font-extrabold leading-none tracking-tight text-primary">{res.code}</p>
        <p className="flex items-center justify-center gap-2 text-sm font-semibold">
          <Store size={16} aria-hidden />
          {res.pharmacy_name}
        </p>
        {res.status === 'pending' && (
          <Badge tone="savings">
            <Clock size={13} aria-hidden />
            {t(d.reserve.expiresIn, { mins: minutesUntil(res.expires_at) })}
          </Badge>
        )}
        {res.status === 'rejected' && (
          <Badge tone="danger">{res.rejection_reason ?? d.reserve.statusRejected}</Badge>
        )}
      </Card>

      {/* status timeline */}
      <Card>
        <ol className="flex items-center">
          {STEPS.map((step, i) => {
            const done = stepIndex >= i && res.status !== 'rejected' && res.status !== 'expired'
            return (
              <li key={step} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={clsx(
                      'grid size-9 place-items-center rounded-full border-2 transition',
                      done ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted',
                    )}
                  >
                    {i === 0 ? <Clock size={16} aria-hidden /> : i === 1 ? <CheckCircle2 size={16} aria-hidden /> : <PackageCheck size={16} aria-hidden />}
                  </span>
                  <span className={clsx('text-[0.6875rem] font-bold', done ? 'text-ink' : 'text-muted')}>
                    {statusLabel[step]}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span className={clsx('mx-1 mb-4 h-0.5 flex-1', stepIndex > i ? 'bg-primary' : 'bg-line')} aria-hidden />
                )}
              </li>
            )
          })}
        </ol>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-sm font-bold">{d.reserve.items}</h2>
        <ul className="divide-y divide-line">
          {res.items.map((i) => (
            <li key={i.product_id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{i.brand_name}</span>
                <span className="text-xs text-muted">
                  {i.qty} × {rupee(i.price_per_unit)}
                </span>
              </span>
              {i.requires_rx && (
                <Badge tone="danger">
                  <Lock size={11} aria-hidden />
                  {d.results.rxRequired}
                </Badge>
              )}
              <span className="tabular shrink-0 font-bold">{rupee(i.price_per_unit * i.qty)}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-center justify-between border-t border-line pt-2 font-extrabold">
          <span>{d.results.total}</span>
          <span className="tabular">{rupee(total)}</span>
        </p>
        {res.estimated_savings > 0 && (
          <p className="rounded-xl bg-savings px-3 py-2 text-sm font-extrabold text-on-savings">
            {t(d.results.save, { amount: rupee(res.estimated_savings) })}
          </p>
        )}
      </Card>

      {res.requires_rx && (
        <p
          className={clsx(
            'flex items-start gap-2 rounded-2xl px-3.5 py-3 text-sm font-bold',
            res.rx_verified_by_pharmacist ? 'bg-success-tint text-success-ink' : 'bg-savings-tint text-savings-ink',
          )}
        >
          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
          {res.rx_verified_by_pharmacist ? d.reserve.rxVerified : d.reserve.rxNeedsReview}
        </p>
      )}

      <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-sm font-semibold">{d.reserve.bring}</p>

      <Button variant="secondary" className="w-full" onClick={() => router.push('/')}>
        <Home size={17} aria-hidden />
        {d.reserve.done}
      </Button>
    </div>
  )
}
