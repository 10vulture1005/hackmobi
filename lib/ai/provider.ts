/**
 * Model access.
 *
 * Demo mode (the default, and whenever no key is set) never calls out: every
 * AI-shaped feature has a deterministic path that uses only engine numbers and
 * retrieved source text. With GEMINI_API_KEY set and DEMO_MODE off, the same
 * features go through Gemini, with Groq as a text-only fallback.
 */

export type Language = 'en' | 'hi' | 'mr'

export const LANGUAGES: Language[] = ['en', 'hi', 'mr']

export function isLanguage(v: unknown): v is Language {
  return typeof v === 'string' && (LANGUAGES as string[]).includes(v)
}

export function demoMode(): boolean {
  if (process.env.DEMO_MODE === '1') return true
  return !process.env.GEMINI_API_KEY
}

export interface LlmCall {
  system: string
  user: string
  /** base64 image data for vision calls */
  image?: { mime: string; data: string }
  schemaHint: string
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

async function callGemini<T>(call: LlmCall): Promise<T> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('no_gemini_key')
  const parts: unknown[] = [{ text: `${call.user}\n\nReturn JSON only:\n${call.schemaHint}` }]
  if (call.image) {
    parts.unshift({ inline_data: { mime_type: call.image.mime, data: call.image.data } })
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: call.system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(25_000),
    },
  )
  if (!res.ok) throw new Error(`gemini_${res.status}`)
  const body = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  return JSON.parse(text) as T
}

async function callGroq<T>(call: LlmCall): Promise<T> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('no_groq_key')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: call.system },
        { role: 'user', content: `${call.user}\n\nReturn JSON only:\n${call.schemaHint}` },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) throw new Error(`groq_${res.status}`)
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return JSON.parse(body.choices?.[0]?.message?.content ?? '{}') as T
}

/**
 * Tries Gemini, then Groq for text-only calls, then gives up so the caller can
 * fall back to its deterministic path. Never throws past the caller's fallback.
 */
export async function llmJson<T>(call: LlmCall): Promise<{ ok: true; data: T; via: string } | { ok: false; error: string }> {
  if (demoMode()) return { ok: false, error: 'demo_mode' }
  try {
    return { ok: true, data: await callGemini<T>(call), via: `gemini:${GEMINI_MODEL}` }
  } catch (e) {
    const first = e instanceof Error ? e.message : 'gemini_failed'
    if (call.image) return { ok: false, error: first }
    try {
      return { ok: true, data: await callGroq<T>(call), via: 'groq:llama-3.3-70b' }
    } catch (e2) {
      return { ok: false, error: `${first};${e2 instanceof Error ? e2.message : 'groq_failed'}` }
    }
  }
}

/** Rejects anything that reads like dosage advice. Applied to every AI output. */
const DOSE_PATTERNS: RegExp[] = [
  /\b\d+(\.\d+)?\s*(mg|mcg|ml|g|iu)\b/i,
  /\b\d+\s*(times|time)\s*(a|per)\s*(day|week)/i,
  /\b(once|twice|thrice)\s*(a|per)\s*(day|week)/i,
  /\b\d\s*-\s*\d\s*-\s*\d\b/,
  /\b(tablet|capsule|spoon|tsp|drops?)\s*(s)?\s*(daily|per day|a day)/i,
  /\b(दिन में|रोज़ाना|गोली लें|खुराक)\b/,
  /\b(दररोज|दिवसातून|गोळी घ्या|मात्रा)\b/,
]

export function containsDosageAdvice(text: string): boolean {
  return DOSE_PATTERNS.some((re) => re.test(text))
}

export function stripDosageItems(items: string[]): string[] {
  return items.filter((i) => !containsDosageAdvice(i))
}
