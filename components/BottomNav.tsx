'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HeartPulse, Landmark, Map, Search, Store } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from './AppProvider'

export function BottomNav() {
  const { d } = useApp()
  const path = usePathname()

  const tabs = [
    { href: '/', label: d.nav.home, icon: Search, match: (p: string) => p === '/' || p.startsWith('/results') || p.startsWith('/review') },
    { href: '/map', label: d.nav.map, icon: Map, match: (p: string) => p.startsWith('/map') },
    { href: '/schemes', label: d.nav.schemes, icon: Landmark, match: (p: string) => p.startsWith('/schemes') },
    { href: '/my-medicines', label: d.nav.mine, icon: HeartPulse, match: (p: string) => p.startsWith('/my-medicines') },
    { href: '/pharmacist', label: d.nav.pharmacist, icon: Store, match: (p: string) => p.startsWith('/pharmacist') },
  ]

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-between px-1 pb-[max(env(safe-area-inset-bottom),4px)]">
        {tabs.map((tab) => {
          const active = tab.match(path)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'tap flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[0.6875rem] font-semibold leading-tight transition',
                  active ? 'text-primary' : 'text-muted hover:text-ink',
                )}
              >
                <Icon size={21} aria-hidden strokeWidth={active ? 2.4 : 1.9} />
                <span className="text-center">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
