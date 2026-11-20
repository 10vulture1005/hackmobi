'use client'

import { usePathname } from 'next/navigation'
import clsx from 'clsx'

/** Citizen screens are mobile-first and narrow; the dashboards are desktop-first. */
export function MainShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const wide = path.startsWith('/pharmacist') || path.startsWith('/impact')
  return (
    <main
      id="main"
      className={clsx('mx-auto w-full px-4 pb-28 pt-3 sm:pb-10', wide ? 'max-w-6xl' : 'max-w-xl')}
    >
      {children}
    </main>
  )
}
