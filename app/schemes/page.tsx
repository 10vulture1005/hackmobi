'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, FileCheck2, HelpCircle, Landmark, Loader2, Send } from 'lucide-react'
import { useApp } from '@/components/AppProvider'
import { Badge, Button, Card, Skeleton } from '@/components/ui'
import { api, type Scheme } from '@/lib/client/api'

const STATES = ['Uttar Pradesh', 'Maharashtra', 'Bihar', 'Delhi', 'Madhya Pradesh', 'Rajasthan']
const INCOME = ['BPL / Antyodaya', 'Below ₹1 lakh', '₹1–3 lakh', 'Above ₹3 lakh']

export default function SchemesPage() {
  const { d, language } = useApp()
  const [question, setQuestion] = useState('')
  const [age, setAge] = useState('')
  const [state, setState] = useState('Uttar Pradesh')
  const [income, setIncome] = useState('')
  const [condition, setCondition] = useState('')
  const [answer, setAnswer] = useState<Awaited<ReturnType<typeof api.askSchemes>> | null>(null)
  const [all, setAll] = useState<Scheme[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.schemes().then((r) => setAll(r.schemes)).catch(() => setAll([]))
  }, [])

  async function ask() {
    setLoading(true)
    try {
      const res = await api.askSchemes({
        question: question.trim() || condition.trim() || undefined,
        age: age ? Number(age) : null,
        state,
        income_band: income || null,
        condition: condition.trim() || null,
        language,
      })
      setAnswer(res)
    } catch {
      setAnswer(null)
    } finally {
      setLoading(false)
    }
  }

  const shown = answer?.schemes ?? []

  return (
    <div className="space-y-3 pb-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold leading-tight">
          <Landmark size={22} className="text-primary" aria-hidden />
          {d.schemes.title}
        </h1>
        <p className="mt-0.5 text-sm text-muted">{d.schemes.sub}</p>
      </header>

      <Card className="space-y-3">
        <label className="block">
          <span className="sr-only">{d.schemes.placeholder}</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder={d.schemes.placeholder}
            className="w-full resize-none rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-base outline-none focus:border-primary"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">{d.schemes.age}</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              inputMode="numeric"
              className="tap w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">{d.schemes.state}</span>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="tap w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary"
            >
              {STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">{d.schemes.income}</span>
            <select
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className="tap w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary"
            >
              <option value="">{d.schemes.optional}</option>
              {INCOME.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted">{d.schemes.condition}</span>
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="diabetes, TB, cancer…"
              className="tap w-full rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-primary"
            />
          </label>
        </div>

        <Button className="w-full" onClick={ask} disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
          {loading ? d.schemes.asking : d.schemes.ask}
        </Button>
      </Card>

      {answer && (
        <Card className="space-y-2">
          <p className="text-[0.9375rem] leading-snug">{answer.answer}</p>
          {answer.missing_info_questions.length > 0 && (
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted">
                <HelpCircle size={13} aria-hidden />
                {d.schemes.missing}
              </p>
              <ul className="space-y-0.5 text-sm">
                {answer.missing_info_questions.map((q) => (
                  <li key={q}>• {q}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {shown.length > 0 && <h2 className="px-1 pt-1 text-sm font-bold">{d.schemes.eligible}</h2>}

      <ul className="space-y-2.5">
        {(shown.length > 0 ? shown : (all ?? [])).map((s) => (
          <li key={s.id}>
            <SchemeCard scheme={s} />
          </li>
        ))}
      </ul>

      {!all && <Skeleton className="h-32 w-full" />}
    </div>
  )
}

function SchemeCard({ scheme }: { scheme: Scheme }) {
  const { d } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <Card className="space-y-2">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.0625rem] font-extrabold leading-tight">{scheme.title}</h3>
          <p className="mt-1 text-sm leading-snug text-muted">{scheme.summary}</p>
        </div>
        <Badge tone={scheme.scope.startsWith('state') ? 'savings' : 'primary'}>
          {scheme.scope.startsWith('state') ? scheme.scope.replace('state:', '') : d.schemes.national}
        </Badge>
      </header>

      <ul className="flex flex-wrap gap-1.5">
        {scheme.covers.map((c) => (
          <li key={c}>
            <Badge tone="neutral">{c}</Badge>
          </li>
        ))}
      </ul>

      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-sm font-bold text-primary">
        {open ? d.results.hideAll : `${d.schemes.documents} · ${d.schemes.howToApply}`}
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-line pt-2.5">
          <Section title={d.schemes.eligible} items={scheme.eligibility} />
          <Section title={d.schemes.documents} items={scheme.documents} check />
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{d.schemes.howToApply}</h4>
            <p className="mt-0.5 text-sm leading-snug">{scheme.how_to_claim}</p>
          </div>
        </div>
      )}

      <a
        href={scheme.source_url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary underline decoration-primary/40 underline-offset-4"
      >
        {d.schemes.source}
        <ExternalLink size={14} aria-hidden />
      </a>
    </Card>
  )
}

function Section({ title, items, check }: { title: string; items: string[]; check?: boolean }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h4>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-snug">
            {check ? (
              <FileCheck2 size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
            ) : (
              <span aria-hidden className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-muted" />
            )}
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
