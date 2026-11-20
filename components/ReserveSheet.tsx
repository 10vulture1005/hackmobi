'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Camera, CheckCircle2, Clock, FileText, Loader2, Lock, Sparkles } from 'lucide-react'
import { Badge, Button, Sheet } from './ui'
import { useApp } from './AppProvider'
import { api, type ValidationResult } from '@/lib/client/api'
import { basketPrescription, saveParse, setBasketPrescription } from '@/lib/client/session'
import { paise, rupee } from '@/lib/client/format'

export interface ReserveItem {
  product_id: string
  brand_name: string
  qty: number
  unit_label: string
  price_per_unit: number
  rx_required: boolean
  counter_verification: boolean
}

/**
 * The reserve flow, with the Rx gate visible to the citizen.
 *
 * Mixed baskets split automatically: over-the-counter items can be held right
 * away, prescription items wait for a prescription that passes validation. The
 * server enforces this regardless — a 422 here is the API refusing, not the UI.
 */
export function ReserveSheet({
  open,
  onClose,
  items,
  pharmacy,
  estimatedSavings,
}: {
  open: boolean
  onClose: () => void
  items: ReserveItem[]
  pharmacy: { id: string; name: string } | null
  estimatedSavings: number
}) {
  const { d, t } = useApp()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [rxId, setRxId] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otc = items.filter((i) => !i.rx_required)
  const rx = items.filter((i) => i.rx_required)

  useEffect(() => {
    if (!open) return
    setError(null)
    setRxId(basketPrescription())
  }, [open])

  const validate = useCallback(
    async (prescriptionId: string) => {
      if (rx.length === 0) return
      try {
        const res = await api.validatePrescription(prescriptionId, rx.map((i) => i.product_id))
        setValidation(res)
      } catch {
        setValidation(null)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, items.map((i) => i.product_id).join(',')],
  )

  useEffect(() => {
    if (open && rxId) void validate(rxId)
  }, [open, rxId, validate])

  async function attach(file: File | null, demoSlug?: string) {
    setUploading(true)
    setError(null)
    try {
      const res = await api.parsePrescription(file ? { file } : { demo_slug: demoSlug ?? 'chronic' })
      saveParse(res)
      setBasketPrescription(res.prescription_id)
      setRxId(res.prescription_id)
    } catch {
      setError(d.common.error)
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!pharmacy) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.reserve({
        pharmacy_id: pharmacy.id,
        items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        customer_name: name.trim() || 'Walk-in',
        customer_phone: phone.trim() || null,
        prescription_id: rxId,
        estimated_savings: estimatedSavings,
      })
      router.push(`/reserve/${res.reservation.code}`)
    } catch (e) {
      const err = e as Error & { code?: string }
      setError(err.code === 'prescription_required' || err.code === 'prescription_rejected' ? err.message : err.message || d.reserve.failed)
    } finally {
      setSubmitting(false)
    }
  }

  const rxStatus = validation?.status
  const blocked = rx.length > 0 && (!rxId || rxStatus === 'rejected')
  const total = items.reduce((s, i) => s + i.price_per_unit * i.qty, 0)

  return (
    <Sheet
      closeLabel={d.common.close}
      open={open}
      onClose={onClose}
      title={d.reserve.title}
      footer={
        <div className="space-y-2">
          {error && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-tint px-3 py-2 text-sm font-semibold text-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <Button className="w-full" size="lg" disabled={submitting || blocked || !pharmacy} onClick={submit}>
            {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Clock size={18} aria-hidden />}
            {submitting ? d.reserve.confirming : d.reserve.confirm} · {rupee(total)}
          </Button>
          <p className="text-[0.6875rem] leading-snug text-muted">{d.reserve.bring}</p>
        </div>
      }
    >
      <div className="space-y-4">
        {pharmacy && (
          <p className="rounded-2xl bg-primary-tint/60 px-3.5 py-2.5 text-sm font-semibold text-primary-dark">
            {pharmacy.name} · {d.reserve.holdNote}
          </p>
        )}

        {otc.length > 0 && (
          <ItemGroup title={rx.length ? d.reserve.rxSplitOtc : d.reserve.items} items={otc} />
        )}

        {rx.length > 0 && (
          <section className="space-y-2.5 rounded-2xl border border-danger/35 bg-danger-tint/40 p-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-danger">
              <Lock size={16} aria-hidden />
              {t(d.reserve.rxNeeded, { n: rx.length })}
            </h3>
            <ItemGroup title={d.reserve.rxSplitRx} items={rx} dense />

            {!rxId && (
              <div className="space-y-2">
                <Button variant="secondary" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Camera size={18} aria-hidden />}
                  {d.reserve.uploadRx}
                </Button>
                <Button variant="ghost" size="sm" className="w-full" disabled={uploading} onClick={() => void attach(null)}>
                  <Sparkles size={16} aria-hidden />
                  {d.reserve.useDemoRx}
                </Button>
                <p className="text-xs text-muted">{d.reserve.rxBlockedExplain}</p>
              </div>
            )}

            {rxId && validation && (
              <div className="space-y-2">
                <p
                  className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
                    rxStatus === 'verified'
                      ? 'bg-success-tint text-success'
                      : rxStatus === 'needs_pharmacist_review'
                        ? 'bg-savings-tint text-[#92400e]'
                        : 'bg-danger-tint text-danger'
                  }`}
                >
                  {rxStatus === 'verified' ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
                  ) : (
                    <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  )}
                  {rxStatus === 'verified'
                    ? d.reserve.rxVerified
                    : rxStatus === 'needs_pharmacist_review'
                      ? d.reserve.rxNeedsReview
                      : d.reserve.rxRejected}
                </p>
                <ul className="space-y-1 text-xs">
                  {validation.items.map((i) => (
                    <li key={i.product_id} className="flex items-start gap-1.5">
                      <span aria-hidden>{i.allowed ? '✓' : '•'}</span>
                      <span>
                        <strong>{i.brand_name}</strong> — {REASONS[i.reason_code] ?? i.reason_code}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                  <FileText size={15} aria-hidden />
                  {d.reserve.retake}
                </Button>
              </div>
            )}
          </section>
        )}

        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">{d.reserve.name}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={d.reserve.namePlaceholder}
              className="tap w-full rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-base outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">{d.reserve.phone}</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder={d.reserve.phonePlaceholder}
              className="tap w-full rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-base outline-none focus:border-primary"
            />
          </label>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          if (f) void attach(f)
          e.target.value = ''
        }}
      />
    </Sheet>
  )
}

/** Plain-language versions of the validator's machine reasons. */
const REASONS: Record<string, string> = {
  ok: 'covered by your prescription',
  otc_no_prescription_needed: 'no prescription needed',
  not_on_prescription: 'not written on this prescription',
  prescription_too_old: 'this prescription is too old for it',
  prescription_date_missing: 'no date on the prescription',
  prescription_date_in_future: 'the date is in the future',
  prescriber_missing: 'no doctor name or registration number',
  illegible: 'the photo was hard to read',
  counter_verification_required: 'the pharmacist must verify and record this one',
}

function ItemGroup({
  title,
  items,
  dense,
}: {
  title: string
  items: ReserveItem[]
  dense?: boolean
}) {
  const { d, t } = useApp()
  return (
    <section>
      {!dense && <h3 className="mb-1.5 text-sm font-bold">{title}</h3>}
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((i) => (
          <li key={i.product_id} className="flex items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{i.brand_name}</span>
              <span className="block text-xs text-muted">
                {i.qty} {i.unit_label} · {paise(i.price_per_unit)} {t(d.results.perUnit, { unit: i.unit_label })}
              </span>
            </span>
            {i.counter_verification && <Badge tone="danger">H1</Badge>}
            <span className="tabular shrink-0 font-bold">{rupee(i.price_per_unit * i.qty)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
