'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, ExternalLink, FlaskConical, Pill, Volume2 } from 'lucide-react'
import { Button, Sheet } from './ui'
import { useApp } from './AppProvider'
import { speak } from '@/lib/client/speech'
import { getPref, setPref } from '@/lib/client/idb'

const SEEN_KEY = 'trustExplainerSeen'

/**
 * "Is the cheaper one really the same?" — the single biggest objection to
 * generics. Shown once automatically, and always reachable from the ℹ️ on the
 * "Same salt" badge. The copy is curated per language, never model-generated.
 */
export function TrustExplainer({
  open,
  onClose,
  autoShow,
}: {
  open: boolean
  onClose: () => void
  autoShow?: boolean
}) {
  const { d, language } = useApp()
  const [auto, setAuto] = useState(false)

  useEffect(() => {
    if (!autoShow) return
    let cancelled = false
    ;(async () => {
      const seen = await getPref<boolean>(SEEN_KEY)
      if (!cancelled && !seen) setAuto(true)
    })()
    return () => {
      cancelled = true
    }
  }, [autoShow])

  const visible = open || auto
  const close = () => {
    if (auto) {
      setAuto(false)
      void setPref(SEEN_KEY, true)
    }
    onClose()
  }

  const lines = [
    { icon: <Pill size={20} aria-hidden />, text: d.trust.line1 },
    { icon: <FlaskConical size={20} aria-hidden />, text: d.trust.line2 },
    { icon: <BadgeCheck size={20} aria-hidden />, text: d.trust.line3 },
  ]

  return (
    <Sheet
      closeLabel={d.common.close}
      open={visible}
      onClose={close}
      title={d.trust.title}
      footer={
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => speak([d.trust.title, d.trust.line1, d.trust.line2, d.trust.line3].join('. '), language)}
          >
            <Volume2 size={18} aria-hidden />
            {d.results.listen}
          </Button>
          <Button className="flex-1" onClick={close}>
            {d.trust.gotIt}
          </Button>
        </div>
      }
    >
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.text} className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-tint text-primary-dark">
              {l.icon}
            </span>
            <p className="pt-1.5 text-[0.9375rem] font-medium leading-snug">{l.text}</p>
          </li>
        ))}
      </ul>
      <a
        href="https://janaushadhi.gov.in/"
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary underline decoration-primary/40 underline-offset-4"
      >
        {d.trust.source}
        <ExternalLink size={15} aria-hidden />
      </a>
    </Sheet>
  )
}
