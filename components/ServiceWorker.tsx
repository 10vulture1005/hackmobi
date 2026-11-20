'use client'

import { useEffect } from 'react'

/** Registers the offline shell. Failure is silent: the app still works online. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const id = setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }, 1200)
    return () => clearTimeout(id)
  }, [])
  return null
}
