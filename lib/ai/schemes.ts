/**
 * Scheme assistant.
 *
 * Retrieval is a keyword and tag match over 17 curated entries — small enough
 * that the whole shortlist fits in a prompt, so there is no vector database.
 * The answer must cite scheme ids, and the UI renders the cited schemes as
 * cards with their source links, not as loose chat text.
 */

import { db } from '@/lib/data/db'
import type { Scheme } from '@/lib/engine/types'
import { llmJson, type Language } from './provider'

export interface SchemeQuery {
  question?: string
  age?: number | null
  state?: string | null
  ration_card?: string | null
  income_band?: string | null
  condition?: string | null
  language: Language
}

export interface SchemeAnswer {
  answer: string
  scheme_ids: string[]
  schemes: Scheme[]
  missing_info_questions: string[]
  via: 'retrieval' | string
}

const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'for', 'of', 'in', 'to', 'my', 'me', 'i', 'can', 'get', 'what',
  'which', 'how', 'do', 'does', 'and', 'or', 'any', 'there', 'be', 'free', 'scheme', 'schemes',
  'medicine', 'medicines', 'help', 'need', 'needs', 'every', 'week', 'month', 'year', 'have',
  'has', 'she', 'her', 'his', 'him', 'they', 'them', 'much', 'very', 'cost', 'costs', 'about',
  'what', 'who', 'will', 'from', 'with', 'this', 'that', 'there', 'available',
  // Family words carry no scheme signal but match a lot of prose.
  'mother', 'father', 'son', 'daughter', 'wife', 'husband', 'brother', 'sister', 'child',
  'children', 'family', 'parents', 'grandmother', 'grandfather',
])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    // Two-letter conditions matter in India: TB, BP.
    .filter((t) => t.length > 1 && !STOP.has(t))
}

export function retrieve(q: SchemeQuery, limit = 4): Scheme[] {
  const all = db().schemes
  const words = [...tokens(q.question ?? ''), ...tokens(q.condition ?? '')]
  const stateWords = tokens(q.state ?? '')

  const scored = all.map((s) => {
    const haystack = `${s.title} ${s.summary} ${s.tags.join(' ')} ${s.covers.join(' ')}`.toLowerCase()
    let score = 0
    // What the person actually asked about outweighs everything else: a tag hit
    // is worth four times a passing mention in the summary.
    for (const w of words) {
      if (s.tags.some((t) => t.toLowerCase().includes(w))) score += 4
      else if (haystack.includes(w)) score += 1
    }
    // State scope: a matching state scheme gets a nudge, a mismatched one is out.
    if (s.scope.startsWith('state:')) {
      const scopeState = s.scope.slice(6).toLowerCase()
      if (stateWords.length && scopeState.includes(stateWords.join(' '))) score += 2
      else if (stateWords.length) score -= 5
      else score -= 1
    }
    if (q.age && q.age >= 70 && s.id === 'ab-vay-vandana') score += 4
    if (q.income_band && /bpl|below|low/i.test(q.income_band) && /bpl|poor/.test(s.tags.join(' '))) {
      score += 2
    }
    return { s, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.filter((x) => x.score > 0).slice(0, limit)
  // Jan Aushadhi is relevant to practically every "cheaper medicine" question.
  if (!top.some((x) => x.s.id === 'pmbjp')) {
    const ja = all.find((s) => s.id === 'pmbjp')
    if (ja) top.push({ s: ja, score: 0 })
  }
  return top.slice(0, limit).map((x) => x.s)
}

function missingInfo(q: SchemeQuery): string[] {
  const out: string[] = []
  const L = q.language
  if (!q.state) {
    out.push(
      L === 'hi' ? 'आप किस राज्य में रहते हैं?' : L === 'awa' ? 'अहाँ कवन राज्य में रहत बानी?' : 'Which state do you live in?',
    )
  }
  if (!q.age) {
    out.push(L === 'hi' ? 'मरीज़ की उम्र क्या है?' : L === 'awa' ? 'मरीज क उमिर कितना बा?' : 'How old is the patient?')
  }
  if (!q.ration_card && !q.income_band) {
    out.push(
      L === 'hi'
        ? 'क्या आपके पास राशन कार्ड या आय प्रमाण है?'
        : L === 'awa'
          ? 'का तोहरा लगे राशन कार्ड भा आमदनी क कागज बा?'
          : 'Do you have a ration card or an income certificate?',
    )
  }
  return out.slice(0, 2)
}

function retrievalAnswer(schemes: Scheme[], q: SchemeQuery): string {
  const names = schemes.map((s) => s.title).join('; ')
  if (q.language === 'hi') {
    return schemes.length
      ? `आपकी जानकारी के आधार पर ये योजनाएँ काम आ सकती हैं: ${names}. नीचे हर कार्ड में पात्रता, ज़रूरी कागज़ और आवेदन का तरीका दिया है, साथ में सरकारी लिंक भी।`
      : 'इस सवाल से मेल खाती कोई योजना हमारी सूची में नहीं मिली। नज़दीकी जन औषधि केंद्र से सस्ती जेनेरिक दवा ज़रूर मिल सकती है।'
  }
  if (q.language === 'awa') {
    return schemes.length
      ? `तोहर जानकारी के हिसाब से ई योजना काम आ सके: ${names}. नीचे हर कार्ड में हक, जरूरी कागज अउर आवेदन क तरीका बा, सरकारी लिंक के साथ।`
      : 'ई सवाल से मेल खाइवला कवनो योजना हमर सूची में नाहीं मिलल। नगीचे क जन औषधि केंद्र से सस्ता जेनेरिक दवा जरूर मिली।'
  }
  return schemes.length
    ? `Based on what you told us, these may apply: ${names}. Each card below lists who is eligible, the documents you need and how to apply, with the official link.`
    : 'Nothing in our list matches that question. A nearby Jan Aushadhi Kendra is still likely to have a cheaper generic.'
}

const SYSTEM = `You answer questions about Indian government health schemes for citizens.
Absolute rules:
- Use ONLY the scheme entries provided. Never mention a scheme that is not in them.
- Cite the scheme ids you used in scheme_ids.
- Never give medical advice and never mention medicine doses.
- Answer in the requested language, in short plain sentences.
- If eligibility depends on information the user did not give, put that as a question in missing_info_questions.`

export async function askSchemes(q: SchemeQuery): Promise<SchemeAnswer> {
  const shortlist = retrieve(q)
  const fallback: SchemeAnswer = {
    answer: retrievalAnswer(shortlist, q),
    scheme_ids: shortlist.map((s) => s.id),
    schemes: shortlist,
    missing_info_questions: missingInfo(q),
    via: 'retrieval',
  }

  const live = await llmJson<{ answer: string; scheme_ids: string[]; missing_info_questions: string[] }>({
    system: SYSTEM,
    user: `Language: ${q.language}\nUser question: ${q.question ?? '(none)'}\nAge: ${q.age ?? 'unknown'}\nState: ${q.state ?? 'unknown'}\nRation card: ${q.ration_card ?? 'unknown'}\nIncome band: ${q.income_band ?? 'unknown'}\nCondition: ${q.condition ?? 'unknown'}\n\nSCHEME ENTRIES (the only permitted facts):\n${JSON.stringify(shortlist, null, 2)}`,
    schemaHint: '{"answer":"string","scheme_ids":["string"],"missing_info_questions":["string"]}',
  })

  if (live.ok && typeof live.data.answer === 'string' && live.data.answer.trim()) {
    const allowed = new Set(shortlist.map((s) => s.id))
    const ids = (live.data.scheme_ids ?? []).filter((id) => allowed.has(id))
    if (ids.length) {
      return {
        answer: live.data.answer.trim(),
        scheme_ids: ids,
        schemes: shortlist.filter((s) => ids.includes(s.id)),
        missing_info_questions: (live.data.missing_info_questions ?? []).slice(0, 3),
        via: live.via,
      }
    }
  }

  return fallback
}
