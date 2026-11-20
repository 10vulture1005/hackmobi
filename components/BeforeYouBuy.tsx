'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ExternalLink, HeartPulse, Info, ShieldAlert, Volume2 } from 'lucide-react'
import { Button, Sheet, Skeleton } from './ui'
import { useApp } from './AppProvider'
import { api } from '@/lib/client/api'
import { speak } from '@/lib/client/speech'

type Info = Awaited<ReturnType<typeof api.drugInfo>>

/**
 * Grounded OTC information. Every bullet comes from retrieved label text, with
 * the source linked. No dose, no frequency, ever — that is the pharmacist's job.
 */
export function BeforeYouBuy({
  productId,
  open,
  onClose,
}: {
  productId: string | null
  open: boolean
  onClose: () => void
}) {
  const { d, language } = useApp()
  const [data, setData] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !productId) return
    setData(null)
    setError(null)
    api
      .drugInfo(productId, language)
      .then(setData)
      .catch((e: Error & { code?: string }) =>
        setError(e.code === 'rx_only' ? d.info.rxOnly : d.info.notAvailable),
      )
  }, [open, productId, language, d.info.rxOnly, d.info.notAvailable])

  const sections = data
    ? [
        { icon: <HeartPulse size={18} aria-hidden />, title: d.info.usedFor, items: data.content.common_uses, tone: 'bg-primary-tint text-primary-ink' },
        { icon: <Info size={18} aria-hidden />, title: d.info.sideEffects, items: data.content.common_side_effects, tone: 'bg-surface-2 text-ink' },
        { icon: <AlertTriangle size={18} aria-hidden />, title: d.info.stopAndSee, items: data.content.seek_help_if, tone: 'bg-danger-tint text-danger-ink' },
        { icon: <ShieldAlert size={18} aria-hidden />, title: d.info.careful, items: data.content.who_should_be_careful, tone: 'bg-savings-tint text-savings-ink' },
      ].filter((s) => s.items.length > 0)
    : []

  const spoken = data
    ? [
        `${d.info.usedFor}: ${data.content.common_uses.join(', ')}`,
        `${d.info.sideEffects}: ${data.content.common_side_effects.join(', ')}`,
        `${d.info.stopAndSee}: ${data.content.seek_help_if.join(', ')}`,
      ].join('. ')
    : ''

  return (
    <Sheet
      closeLabel={d.common.close}
      open={open}
      onClose={onClose}
      title={`${d.info.title}${data ? ` — ${data.brand_name}` : ''}`}
      footer={
        <div className="space-y-2">
          <Button variant="secondary" className="w-full" disabled={!data} onClick={() => speak(spoken, language)}>
            <Volume2 size={18} aria-hidden />
            {d.results.listen}
          </Button>
          <p className="text-[0.6875rem] leading-snug text-muted">{d.info.footer}</p>
        </div>
      }
    >
      {error && <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-sm font-semibold">{error}</p>}

      {!data && !error && (
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.translation_notice && (
            <p className="rounded-xl bg-savings-tint px-3 py-2 text-xs font-semibold text-savings-ink">
              {d.info.translationNotice}
            </p>
          )}
          {sections.map((s) => (
            <section key={s.title}>
              <h3 className="mb-1.5 flex items-center gap-2 text-sm font-bold">
                <span className={`grid size-8 place-items-center rounded-lg ${s.tone}`}>{s.icon}</span>
                {s.title}
              </h3>
              <ul className="space-y-1.5 pl-1">
                {s.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[0.9375rem] leading-snug">
                    <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-muted" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{d.info.noDosage}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-bold">{d.info.source}:</span>
            {data.source_urls.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary underline decoration-primary/40 underline-offset-2"
              >
                {new URL(u).hostname.replace('www.', '')}
                <ExternalLink size={12} aria-hidden />
              </a>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
