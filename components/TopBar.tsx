'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Accessibility, Check, Moon, Pill, Volume2 } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from './AppProvider'
import { Sheet } from './ui'
import { LANGUAGE_LABELS, type Language } from '@/lib/i18n'

const LANGS: Language[] = ['hi', 'en', 'awa']

export function TopBar() {
  const { language, setLanguage, d, largeText, setLargeText, voiceGuided, setVoiceGuided, theme, setTheme } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-on-primary shadow-card">
              <Pill size={19} aria-hidden />
            </span>
            <span className="leading-none">
              <span className="block text-[1.0625rem]">{d.app.name}</span>
              <span className="a11y-hide block text-[0.6875rem] font-semibold text-muted">{d.app.tagline}</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            <div
              role="group"
              aria-label={d.a11y.language}
              className="flex items-center rounded-full border border-line bg-surface p-0.5"
            >
              {LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  aria-pressed={language === l}
                  className={clsx(
                    'rounded-full px-2.5 py-1.5 text-xs font-bold transition',
                    language === l ? 'bg-primary text-on-primary' : 'text-muted hover:text-ink',
                  )}
                >
                  {LANGUAGE_LABELS[l]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setOpen(true)}
              aria-label={d.a11y.openMenu}
              className="tap grid place-items-center rounded-full border border-line bg-surface text-ink"
            >
              <Accessibility size={20} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <Sheet closeLabel={d.common.close} open={open} onClose={() => setOpen(false)} title={d.a11y.title}>
        <ul className="space-y-2.5">
          <ToggleRow
            icon={<Accessibility size={20} aria-hidden />}
            label={d.a11y.large}
            on={largeText}
            onChange={setLargeText}
            onLabel={d.a11y.on}
            offLabel={d.a11y.off}
          />
          <ToggleRow
            icon={<Volume2 size={20} aria-hidden />}
            label={d.a11y.voice}
            on={voiceGuided}
            onChange={setVoiceGuided}
            onLabel={d.a11y.on}
            offLabel={d.a11y.off}
          />
          <ToggleRow
            icon={<Moon size={20} aria-hidden />}
            label={d.a11y.theme}
            on={theme === 'dark'}
            onChange={(v) => setTheme(v ? 'dark' : 'light')}
            onLabel={d.a11y.on}
            offLabel={d.a11y.off}
          />
        </ul>
        <p className="mt-4 text-xs text-muted">{d.mine.sub}</p>
      </Sheet>
    </>
  )
}

function ToggleRow({
  icon,
  label,
  on,
  onChange,
  onLabel,
  offLabel,
}: {
  icon: React.ReactNode
  label: string
  on: boolean
  onChange: (v: boolean) => void
  onLabel: string
  offLabel: string
}) {
  return (
    <li>
      <button
        onClick={() => onChange(!on)}
        aria-pressed={on}
        className={clsx(
          'tap flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left font-semibold transition',
          on ? 'border-primary bg-primary-tint text-primary-ink' : 'border-line bg-surface hover:bg-surface-2',
        )}
      >
        <span className={clsx('grid size-9 shrink-0 place-items-center rounded-xl', on ? 'bg-primary text-on-primary' : 'bg-surface-2 text-muted')}>
          {icon}
        </span>
        <span className="flex-1">{label}</span>
        <span className="pill border-none bg-transparent text-xs">
          {on ? <Check size={16} aria-hidden /> : null}
          {on ? onLabel : offLabel}
        </span>
      </button>
    </li>
  )
}
