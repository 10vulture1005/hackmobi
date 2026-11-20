'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, Download, HeartPulse, Lock, Trash2, TrendingDown } from 'lucide-react'
import { useApp } from '@/components/AppProvider'
import { Badge, Button, Card, CountUp, EmptyState, Toast } from '@/components/ui'
import { clearMedicines, listMedicines, removeMedicine, saveMedicine, type SavedMedicine } from '@/lib/client/idb'
import { rupee, shortDate } from '@/lib/client/format'

/**
 * Refill and savings tracker. Entirely on-device: no login, no citizen table,
 * no upload. Units per month are entered by the citizen — the app never infers
 * a dose, and a prescription medicine still needs a prescription at reorder.
 */
export default function MyMedicinesPage() {
  const router = useRouter()
  const { d, t, language } = useApp()
  const [rows, setRows] = useState<SavedMedicine[] | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(() => {
    void listMedicines().then(setRows)
  }, [])

  useEffect(load, [load])

  const totals = useMemo(() => {
    const list = rows ?? []
    const now = list.reduce((s, m) => s + m.price_per_unit * m.units_per_month, 0)
    const generic = list.reduce((s, m) => s + m.generic_price_per_unit * m.units_per_month, 0)
    return { now, generic, saving: Math.max(0, now - generic) }
  }, [rows])

  async function setUnits(m: SavedMedicine, units: number) {
    const next = { ...m, units_per_month: Math.max(0, units) }
    await saveMedicine(next)
    setRows((prev) => (prev ?? []).map((r) => (r.product_id === m.product_id ? next : r)))
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(rows ?? [], null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-medicines.json'
    a.click()
    URL.revokeObjectURL(url)
    setToast(d.mine.export)
  }

  function reminder(m: SavedMedicine) {
    // A calendar link, so the reminder lives in the phone's own calendar.
    const days = m.units_per_month > 0 ? Math.round((m.pack_size / m.units_per_month) * 30) : 30
    const when = new Date(Date.now() + days * 86400_000)
    const stamp = when.toISOString().replace(/[-:]/g, '').split('.')[0]
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${stamp}Z`,
      `SUMMARY:${m.brand_name} — refill`,
      `DESCRIPTION:${d.mine.reminderNote}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${m.brand_name}-refill.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (rows && rows.length === 0) {
    return (
      <EmptyState
        icon={<HeartPulse size={24} aria-hidden />}
        title={d.mine.title}
        body={d.mine.empty}
        action={<Button onClick={() => router.push('/')}>{d.nav.home}</Button>}
      />
    )
  }

  return (
    <div className="space-y-3 pb-8">
      <header>
        <h1 className="text-xl font-extrabold leading-tight">{d.mine.title}</h1>
        <p className="mt-0.5 text-sm text-muted">{d.mine.sub}</p>
      </header>

      <Card className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={d.mine.monthlyNow} value={rupee(totals.now)} />
          <Stat label={d.mine.monthlyGeneric} value={rupee(totals.generic)} tone="text-success-ink" />
          <Stat label={d.mine.monthlySaving} value={rupee(totals.saving)} tone="text-savings-ink" />
        </div>
        <p className="flex items-center justify-center gap-2 rounded-2xl bg-savings px-3 py-2.5 text-center text-sm font-extrabold text-on-savings">
          <TrendingDown size={17} aria-hidden />
          <CountUp value={totals.saving * 12} format={(n) => rupee(Math.round(n))} /> {d.mine.yearly}
        </p>
      </Card>

      <ul className="space-y-2.5">
        {(rows ?? []).map((m) => {
          const days = m.units_per_month > 0 ? Math.round((m.pack_size / m.units_per_month) * 30) : null
          const runsOut = days ? new Date(new Date(m.added_at).getTime() + days * 86400_000) : null
          return (
            <li key={m.product_id}>
              <Card className="space-y-2.5">
                <header className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-extrabold">{m.brand_name}</span>
                      {m.is_rx && (
                        <Badge tone="danger">
                          <Lock size={11} aria-hidden />
                          {d.results.rxRequired}
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted">{m.composition_raw}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await removeMedicine(m.product_id)
                      load()
                    }}
                    aria-label={d.mine.remove}
                    className="tap -mr-1 grid shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </header>

                <div className="flex items-end gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-muted">{d.mine.perMonth}</span>
                    <input
                      type="number"
                      min={0}
                      value={m.units_per_month || ''}
                      onChange={(e) => void setUnits(m, Number(e.target.value))}
                      className="tabular w-24 rounded-xl border border-field-line bg-surface px-3 py-2 text-right outline-none focus:border-primary"
                    />
                  </label>
                  <div className="flex-1 text-right text-sm">
                    <p>
                      <span className="text-muted">{d.mine.monthlyNow}: </span>
                      <span className="tabular font-bold line-through">
                        {rupee(m.price_per_unit * m.units_per_month)}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted">{m.generic_name}: </span>
                      <span className="tabular font-extrabold text-success-ink">
                        {rupee(m.generic_price_per_unit * m.units_per_month)}
                      </span>
                    </p>
                  </div>
                </div>

                {runsOut && (
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{t(d.mine.runsOut, { date: shortDate(runsOut.toISOString(), language === 'en' ? 'en-IN' : 'hi-IN') })}</span>
                    <Button variant="ghost" size="sm" onClick={() => reminder(m)}>
                      <BellRing size={14} aria-hidden />
                      {d.mine.reminder}
                    </Button>
                  </p>
                )}

                <Button variant="secondary" size="sm" onClick={() => router.push(`/results?items=${m.product_id}:${m.units_per_month || m.pack_size}`)}>
                  {d.results.title}
                </Button>
              </Card>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-muted">{d.mine.reminderNote}</p>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={exportJson}>
          <Download size={17} aria-hidden />
          {d.mine.export}
        </Button>
        <Button
          variant="ghost"
          className="flex-1"
          onClick={async () => {
            if (!confirm(d.mine.clearConfirm)) return
            await clearMedicines()
            load()
          }}
        >
          <Trash2 size={17} aria-hidden />
          {d.mine.clear}
        </Button>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-bold uppercase leading-tight tracking-wide text-muted">{label}</p>
      <p className={`tabular mt-0.5 text-lg font-extrabold ${tone ?? ''}`}>{value}</p>
    </div>
  )
}
