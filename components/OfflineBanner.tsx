'use client'

import { WifiOff } from 'lucide-react'
import { useApp } from './AppProvider'

export function OfflineBanner() {
  const { online, d } = useApp()
  if (online) return null
  return (
    <div
      role="status"
      className="mx-auto mb-1 flex w-full max-w-xl items-center gap-2 px-4 pt-2 text-sm font-semibold text-savings-ink"
    >
      <span className="flex items-center gap-2 rounded-full bg-savings-tint px-3 py-1.5">
        <WifiOff size={16} aria-hidden />
        {d.offline.banner}
      </span>
    </div>
  )
}
