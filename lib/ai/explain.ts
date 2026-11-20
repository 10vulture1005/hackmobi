/**
 * Plain-language result summary.
 *
 * The deterministic templates below are the primary path: they interpolate the
 * engine's own numbers and names and can state nothing else. The live model is
 * only ever asked to rewrite those same numbers more naturally, under a system
 * prompt that forbids adding anything — and if it drifts, we keep the template.
 */

import type { BasketResult } from '@/lib/engine/alternatives'
import { containsDosageAdvice, llmJson, type Language } from './provider'

export interface Explanation {
  lines: string[]
  spoken: string
  via: 'template' | string
  language: Language
}

const rupee = (n: number) => `₹${n.toFixed(n % 1 === 0 ? 0 : 2)}`

interface Facts {
  savings: number
  originalTotal: number
  bestTotal: number
  switchCount: number
  itemCount: number
  janAushadhiCount: number
  store: string | null
  distance: number | null
  rxCount: number
  dupSalts: string[]
  ntiCount: number
}

function facts(basket: BasketResult): Facts {
  const switched = basket.items.filter((i) => i.switchable)
  const best = switched[0]?.best ?? basket.items[0]?.best
  return {
    savings: basket.savings_total,
    originalTotal: basket.original_total,
    bestTotal: basket.best_total,
    switchCount: switched.length,
    itemCount: basket.items.length,
    janAushadhiCount: switched.filter((i) => i.best.is_jan_aushadhi).length,
    store: best?.best_offer?.pharmacy_name ?? null,
    distance: best?.best_offer?.distance_km ?? null,
    rxCount: basket.items.filter((i) => i.original.rx_required).length,
    dupSalts: basket.duplicate_salt_warnings.map((w) => String(w.params.salt)),
    ntiCount: basket.items.filter((i) => i.narrow_therapeutic_index).length,
  }
}

function template(f: Facts, language: Language): string[] {
  const lines: string[] = []
  const store = f.store ?? ''
  const dist = f.distance !== null ? `${f.distance} km` : ''

  if (language === 'hi') {
    if (f.savings > 0) {
      lines.push(
        `वही दवा, वही साल्ट। ${f.switchCount} दवा${f.switchCount > 1 ? 'ओं' : ''} का सस्ता विकल्प मिला — आप ${rupee(f.savings)} बचा सकते हैं।`,
      )
      lines.push(`कुल ${rupee(f.originalTotal)} की जगह ${rupee(f.bestTotal)}।`)
      if (store) lines.push(`सबसे नज़दीक: ${store}${dist ? `, ${dist} दूर` : ''}।`)
    } else {
      lines.push('इस पर्चे पर अभी आसपास सस्ता विकल्प नहीं मिला।')
    }
    if (f.dupSalts.length) {
      lines.push(`ध्यान दें: दो दवाओं में एक ही साल्ट (${f.dupSalts.join(', ')}) है — डॉक्टर या फार्मासिस्ट से पूछें।`)
    }
    if (f.ntiCount > 0) lines.push('थायरॉइड जैसी दवा बदलने से पहले डॉक्टर से पूछना ज़रूरी है।')
    if (f.rxCount > 0) lines.push(`${f.rxCount} दवा के लिए डॉक्टर का पर्चा ज़रूरी है।`)
    lines.push('दवा बदलने से पहले फार्मासिस्ट या डॉक्टर से पुष्टि करें।')
    return lines
  }

  if (language === 'awa') {
    if (f.savings > 0) {
      lines.push(
        `वही दवा, वही साल्ट। ${f.switchCount} दवा${f.switchCount > 1 ? 'नी' : ''} क सस्ता विकल्प मिलल — तोहरा ${rupee(f.savings)} बचत होई।`,
      )
      lines.push(`कुल ${rupee(f.originalTotal)} के जगह ${rupee(f.bestTotal)}।`)
      if (store) lines.push(`सबसे नगीचे: ${store}${dist ? `, ${dist} दूर` : ''}।`)
    } else {
      lines.push('ई परचा पर अबहीं नगीचे सस्ता विकल्प नाहीं मिलल।')
    }
    if (f.dupSalts.length) {
      lines.push(`ध्यान दीं: दू दवाई में एकही साल्ट (${f.dupSalts.join(', ')}) बा — डाक्टर भा फार्मासिस्ट से पूछीं।`)
    }
    if (f.ntiCount > 0) lines.push('थायराइड जइसन दवा बदले से पहिले डाक्टर से पूछे जरूरी बा।')
    if (f.rxCount > 0) lines.push(`${f.rxCount} दवा बदे डाक्टर क परचा जरूरी बा।`)
    lines.push('दवा बदले से पहिले फार्मासिस्ट भा डाक्टर से पक्का करीं।')
    return lines
  }

  if (f.savings > 0) {
    lines.push(
      `Same medicine, same salt. ${f.switchCount} of your ${f.itemCount} medicines have a cheaper option — you save ${rupee(f.savings)}.`,
    )
    lines.push(`${rupee(f.originalTotal)} becomes ${rupee(f.bestTotal)}.`)
    if (store) lines.push(`Nearest option: ${store}${dist ? `, ${dist} away` : ''}.`)
  } else {
    lines.push('No cheaper same-salt option is available nearby right now.')
  }
  if (f.dupSalts.length) {
    lines.push(
      `Note: two of these contain the same salt (${f.dupSalts.join(', ')}) — check with your doctor or pharmacist.`,
    )
  }
  if (f.ntiCount > 0) lines.push('One medicine here should only be switched on a doctor’s advice.')
  if (f.rxCount > 0) lines.push(`${f.rxCount} of these need a doctor’s prescription.`)
  lines.push('Confirm with your pharmacist or doctor before switching medicines.')
  return lines
}

const cache = new Map<string, Explanation>()

function hashKey(basket: BasketResult, language: Language): string {
  const sig = basket.items
    .map((i) => `${i.product_id}:${i.qty}:${i.best.product_id}:${i.best.price_per_unit}`)
    .join(',')
  return `${sig}|${basket.savings_total}|${language}`
}

const SYSTEM = `You rewrite price-comparison results for a low-literacy reader in India.
Rules you must not break:
- Use ONLY the numbers, medicine names and store names given to you. Invent nothing.
- Never give medical advice, never mention a dose, a frequency or how much to take.
- Never suggest a different salt, strength or form.
- Short sentences, grade-6 reading level, in the requested language.
- Output 2 to 4 short lines.`

export async function explain(basket: BasketResult, language: Language): Promise<Explanation> {
  const key = hashKey(basket, language)
  const hit = cache.get(key)
  if (hit) return hit

  const f = facts(basket)
  const fallbackLines = template(f, language)
  let result: Explanation = {
    lines: fallbackLines,
    spoken: fallbackLines.join(' '),
    via: 'template',
    language,
  }

  const live = await llmJson<{ lines: string[] }>({
    system: SYSTEM,
    user: `Language: ${language}\nFacts (the only facts you may use):\n${JSON.stringify(f, null, 2)}\nBaseline wording you should improve on, keeping every number identical:\n${fallbackLines.join('\n')}`,
    schemaHint: '{"lines": ["string", "string"]}',
  })

  if (live.ok && Array.isArray(live.data.lines) && live.data.lines.length) {
    const lines = live.data.lines.filter((l) => typeof l === 'string' && l.trim().length > 0)
    const drifted =
      lines.some((l) => containsDosageAdvice(l)) ||
      (f.savings > 0 && !lines.some((l) => l.includes(String(Math.round(f.savings)))))
    if (!drifted) {
      result = { lines, spoken: lines.join(' '), via: live.via, language }
    }
  }

  cache.set(key, result)
  return result
}
