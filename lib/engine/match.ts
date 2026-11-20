/**
 * Matching a user's words to a product.
 *
 * Mirrors the production plan: exact normalised name, then trigram similarity
 * (what pg_trgm gives us in Postgres) re-ranked by an edit-distance ratio
 * (what rapidfuzz gives us in Python), then a salt-name search.
 *
 * The important rule is the last one: below the confidence threshold we return
 * candidates as "Did you mean...?" and never silently pick one.
 */

import type { Product } from './types'
import { canonicaliseSaltName } from './canonical'

export interface MatchCandidate {
  product: Product
  score: number
  matched_on: 'name' | 'salt' | 'fuzzy'
}

export interface MatchResult {
  query: string
  /** Set only when one candidate is clearly ahead of the rest. */
  best: MatchCandidate | null
  confident: boolean
  candidates: MatchCandidate[]
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-token containment, so "mox" never matches inside "amoxicillin". */
function containsPhrase(haystack: string, needle: string): boolean {
  return new RegExp(`(^|\\s)${escapeRegExp(needle)}(\\s|$)`).test(haystack)
}

export const CONFIDENT_SCORE = 0.86
export const MIN_SCORE = 0.34

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `
  const out = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3))
  return out
}

/** Jaccard trigram similarity — the same shape as pg_trgm's similarity(). */
export function trigramSimilarity(a: string, b: string): number {
  const A = trigrams(a)
  const B = trigrams(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

export function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  if (max === 0) return 1
  return 1 - levenshtein(a, b) / max
}

/** Best alignment of the query against any single token of the target. */
function partialRatio(query: string, target: string): number {
  const tokens = target.split(' ')
  let best = ratio(query, target)
  for (const t of tokens) best = Math.max(best, ratio(query, t))
  // Also try the leading run of tokens, so "crocin advance" scores well
  // against "crocin advance 500".
  for (let n = 1; n <= Math.min(3, tokens.length); n++) {
    best = Math.max(best, ratio(query, tokens.slice(0, n).join(' ')))
  }
  return best
}

const STRENGTH_WITH_UNIT = /(\d+(?:\.\d+)?)\s*(mg|mcg|ml|iu|g)\b/gi
const ANY_NUMBER = /(\d+(?:\.\d+)?)/

/**
 * OCR and pack labels often say the strength twice ("Glycomet 500 500mg").
 * A bare number that repeats a strength already written with its unit is
 * dropped, so the duplicate does not drag every candidate's score down.
 */
function dedupeStrength(q: string): string {
  const numbers = [...q.matchAll(STRENGTH_WITH_UNIT)].map((m) => m[1])
  if (numbers.length === 0) return q
  let out = q
  for (const n of numbers) {
    const escaped = n.replace('.', '\\.')
    out = out.replace(new RegExp(`(?<![\\d.])${escaped}(?!\\s*(?:mg|mcg|ml|iu|g)\\b)(?![\\d.])`, 'gi'), ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

/** The query with every strength token removed — what the salt search uses. */
function withoutStrength(q: string): string {
  return q.replace(STRENGTH_WITH_UNIT, ' ').replace(/\b\d+(?:\.\d+)?\b/g, ' ').replace(/\s+/g, ' ').trim()
}

export function search(products: Product[], rawQuery: string, limit = 10): MatchResult {
  const query = dedupeStrength(normaliseName(rawQuery))
  if (query.length < 2) {
    return { query, best: null, confident: false, candidates: [] }
  }

  const numberMatch = query.match(ANY_NUMBER)
  const queryNumber = numberMatch ? parseFloat(numberMatch[1]) : null
  const queryWords = withoutStrength(query)
  const saltGuess = canonicaliseSaltName(queryWords || query)

  const scored: MatchCandidate[] = []

  for (const p of products) {
    const name = normaliseName(p.brand_name)

    // 1. exact normalised name
    if (name === query) {
      scored.push({ product: p, score: 1, matched_on: 'name' })
      continue
    }

    // 2. trigram + edit distance on the brand name.
    // Scored against the query both with and without its strength token, since
    // OCR often repeats the strength ("Glycomet 500 500mg") and a brand name
    // frequently carries the number already.
    const nameScore = (q: string) =>
      0.55 * trigramSimilarity(q, name) + 0.45 * partialRatio(q, name)
    // The strength-free query is a weaker signal than the whole query, so it
    // is discounted rather than allowed to flatten every candidate to a tie.
    let score = Math.max(nameScore(query), queryWords ? 0.92 * nameScore(queryWords) : 0)
    let matched_on: MatchCandidate['matched_on'] = 'fuzzy'
    if (name === queryWords) score = 1
    else if (name.startsWith(query)) score = Math.max(score, 0.9)
    // A pack photo gives the brand and the full composition at once
    // ("Augmentin 625 Duo 500mg 125mg"): a whole brand name sitting inside the
    // query is a strong signal, not a weak one.
    else if (name.length >= 6 && containsPhrase(query, name)) score = Math.max(score, 0.93)
    // A strength written in the query that the product actually has is a
    // confirmation, not noise.
    if (queryNumber !== null && p.salts.some((s) => s.strength === queryNumber)) {
      score = Math.min(1, score + 0.08)
    }

    // 3. salt search — "paracetamol 500" should find every paracetamol 500
    const saltNames = p.salts.map((s) => s.salt)
    if (saltGuess.length > 3 && saltNames.includes(saltGuess)) {
      const strengthHit =
        queryNumber === null || p.salts.some((s) => s.strength === queryNumber)
      // A single-salt product is a better answer for a single-salt query.
      const saltScore = (strengthHit ? 0.93 : 0.74) - (saltNames.length > 1 ? 0.06 : 0)
      if (saltScore > score) {
        score = saltScore
        matched_on = 'salt'
      }
    } else {
      // partial salt text ("para 500", "amox")
      const saltText = saltNames.join(' ')
      const saltTri = trigramSimilarity(queryWords || query, saltText)
      if (saltTri > 0.4 && saltTri * 0.8 > score) {
        score = saltTri * 0.8
        matched_on = 'salt'
      }
    }

    if (score >= MIN_SCORE) scored.push({ product: p, score: Math.min(1, score), matched_on })
  }

  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score
    // Prefer the cheaper, generic option when scores tie.
    if (a.product.is_jan_aushadhi !== b.product.is_jan_aushadhi) {
      return a.product.is_jan_aushadhi ? -1 : 1
    }
    return a.product.price_per_unit - b.product.price_per_unit
  })

  const candidates = scored.slice(0, limit)
  const top = candidates[0] ?? null
  const runnerUp = candidates[1]
  const clearlyAhead = !!top && (!runnerUp || top.score - runnerUp.score > 0.06)
  const confident = !!top && top.score >= CONFIDENT_SCORE && (clearlyAhead || top.score === 1)

  return { query, best: confident ? top : null, confident, candidates }
}
