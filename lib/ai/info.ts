/**
 * "Before you buy" — grounded OTC medicine information.
 *
 * Grounding is absolute: the only text that may reach the user is what we
 * retrieved into drug_info for that salt. Reviewed Hindi/English/Marathi
 * summaries are pre-generated, so the sheet opens instantly and the demo spends
 * no quota. Anything generated live is validated for dosage-like content and
 * for having a source before it is shown.
 */

import { db } from '@/lib/data/db'
import type { DrugInfoContent } from '@/data/drug_info'
import { containsDosageAdvice, llmJson, stripDosageItems, type Language } from './provider'

export interface InfoResponse {
  salt_key: string
  display_name: string
  language: Language
  content: DrugInfoContent
  source_urls: string[]
  reviewed: boolean
  /** True when we are showing English source text in a non-English UI. */
  translation_notice: boolean
  via: 'reviewed_cache' | 'generated' | 'source_fallback'
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim().replace(/^[,;]\s*/, ''))
    .filter((s) => s.length > 3)
}

/** Deterministic bullets straight from the source text, with no model at all. */
function fromSource(source: {
  source_text: { indications: string; adverse_reactions: string; warnings: string; stop_use: string }
}): DrugInfoContent {
  const uses = sentences(source.source_text.indications).slice(0, 2)
  const effects = source.source_text.adverse_reactions
    .replace(/\bare (reported|common)\.?/gi, '')
    .split(/,| and /)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 4)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  const stop = sentences(source.source_text.stop_use)
    .join(' ')
    .replace(/^Stop use and (ask|see) a doctor if\s*/i, '')
    .split(/,\s*(?:if|or if)\s*|\bor if\b/i)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 4)
    .slice(0, 4)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  const careful = sentences(source.source_text.warnings)
    .filter((s) => /ask a doctor|higher in|keep out of reach|do not use|for external use/i.test(s))
    .slice(0, 3)

  return {
    common_uses: stripDosageItems(uses),
    common_side_effects: stripDosageItems(effects),
    seek_help_if: stripDosageItems(stop),
    who_should_be_careful: stripDosageItems(careful),
    source_ids: [],
  }
}

const generated = new Map<string, InfoResponse>()

const SYSTEM = `You translate and simplify medicine label text for Indian citizens.
Absolute rules:
- Use ONLY the source text provided. Do not add any fact from your own knowledge.
- NEVER include a dose, a strength, a frequency, or how much to take.
- Do not tell the reader to buy or avoid the medicine. No medical advice.
- Short plain sentences, grade-6 reading level, in the requested language.
- Each bullet must come from the source text.`

export async function drugInfo(
  saltKey: string,
  language: Language,
  opts: { schedule?: string } = {},
): Promise<InfoResponse | { error: 'not_available' | 'rx_only' }> {
  if (opts.schedule && opts.schedule !== 'OTC') return { error: 'rx_only' }

  const d = db()
  const source = d.drugInfo.get(saltKey)
  if (!source) return { error: 'not_available' }

  const reviewed = d.drugInfoCache.get(`${saltKey}::${language}`)
  if (reviewed) {
    return {
      salt_key: saltKey,
      display_name: source.display_name,
      language,
      content: reviewed.content,
      source_urls: source.source_urls,
      reviewed: true,
      translation_notice: false,
      via: 'reviewed_cache',
    }
  }

  const memo = generated.get(`${saltKey}::${language}`)
  if (memo) return memo

  const fallback: InfoResponse = {
    salt_key: saltKey,
    display_name: source.display_name,
    language,
    content: fromSource(source),
    source_urls: source.source_urls,
    reviewed: false,
    translation_notice: language !== 'en',
    via: 'source_fallback',
  }

  const live = await llmJson<DrugInfoContent>({
    system: SYSTEM,
    user: `Language: ${language}\nMedicine (salt): ${source.display_name}\n\nSOURCE TEXT (the only permitted facts):\n${JSON.stringify(source.source_text, null, 2)}`,
    schemaHint:
      '{"common_uses":["string"],"common_side_effects":["string"],"seek_help_if":["string"],"who_should_be_careful":["string"],"source_ids":["string"]}',
  })

  if (live.ok) {
    const c = live.data
    const clean: DrugInfoContent = {
      common_uses: stripDosageItems(c.common_uses ?? []),
      common_side_effects: stripDosageItems(c.common_side_effects ?? []),
      seek_help_if: stripDosageItems(c.seek_help_if ?? []),
      who_should_be_careful: stripDosageItems(c.who_should_be_careful ?? []),
      source_ids: [saltKey],
    }
    const hasContent = clean.common_uses.length > 0 && clean.seek_help_if.length > 0
    const safe = !JSON.stringify(clean).match(/\d+\s*(mg|ml|mcg|iu)/i) && !containsDosageAdvice(JSON.stringify(clean))
    if (hasContent && safe) {
      const out: InfoResponse = {
        salt_key: saltKey,
        display_name: source.display_name,
        language,
        content: clean,
        source_urls: source.source_urls,
        reviewed: false,
        translation_notice: false,
        via: 'generated',
      }
      generated.set(`${saltKey}::${language}`, out)
      return out
    }
  }

  generated.set(`${saltKey}::${language}`, fallback)
  return fallback
}
