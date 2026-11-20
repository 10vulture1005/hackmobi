'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { useEffect, useRef } from 'react'

/* ----------------------------------------------------------------- button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'savings'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'md' | 'lg' | 'sm' }) {
  return (
    <button
      {...rest}
      className={clsx(
        'tap inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'lg' && 'px-6 py-3.5 text-[1.0625rem]',
        size === 'md' && 'px-5 py-3 text-[0.9375rem]',
        size === 'sm' && 'min-h-0 px-3.5 py-2 text-sm',
        variant === 'primary' && 'bg-primary text-white hover:bg-primary-dark',
        variant === 'savings' && 'bg-savings text-[#3b2600] hover:brightness-105',
        variant === 'secondary' &&
          'border border-line bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-primary hover:bg-primary-tint',
        variant === 'danger' && 'bg-danger text-white hover:brightness-110',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ badge */

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'success' | 'savings' | 'danger' | 'primary' | 'muted'
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={clsx(
        'pill',
        tone === 'neutral' && 'bg-surface-2 text-ink',
        tone === 'muted' && 'border-dashed bg-transparent text-muted',
        tone === 'success' && 'border-transparent bg-success-tint text-success',
        tone === 'savings' && 'border-transparent bg-savings-tint text-[#92400e]',
        tone === 'danger' && 'border-transparent bg-danger-tint text-danger',
        tone === 'primary' && 'border-transparent bg-primary-tint text-primary-dark',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------- card */

export function Card({
  className,
  children,
  delay = 0,
}: {
  className?: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay, ease: [0.22, 1, 0.36, 1] }}
      className={clsx('card p-4', className)}
    >
      {children}
    </motion.section>
  )
}

/* ------------------------------------------------------------ bottom sheet */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-[#031412]/55 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] border border-line bg-surface shadow-[0_-10px_40px_-12px_rgba(3,20,18,0.4)] outline-none sm:rounded-[24px]"
          >
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="text-base font-bold">{title}</h2>
              <button
                onClick={onClose}
                className="tap -mr-2 grid place-items-center rounded-full text-muted hover:bg-surface-2"
                aria-label="Close"
              >
                <X size={20} aria-hidden />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
            {footer && <footer className="border-t border-line bg-surface px-4 py-3">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* --------------------------------------------------------------- skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden />
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3 p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-1/2" />
    </div>
  )
}

/* ------------------------------------------------------------------ toast */

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [message, onDone])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-bg shadow-lift"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ----------------------------------------------------------- count-up number */

export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prev.current
    const to = value
    prev.current = value
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === to) {
      el.textContent = format(to)
      return
    }
    const start = performance.now()
    const dur = 700
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - (1 - p) ** 3
      el.textContent = format(from + (to - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, format])

  return <span ref={ref} className="tabular">{format(value)}</span>
}

/* ------------------------------------------------------------- empty state */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary-tint text-primary-dark">{icon}</div>
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action}
    </div>
  )
}
