import { en, type Dict } from './en'
import { hi } from './hi'
import { awa } from './awa'

export type Language = 'en' | 'hi' | 'awa'

export const DICTIONARIES: Record<Language, Dict> = { en, hi, awa }

export const LANGUAGE_LABELS: Record<Language, string> = {
  hi: 'हिन्दी',
  en: 'English',
  awa: 'अवधी',
}

/**
 * BCP-47 tags for SpeechRecognition and speechSynthesis.
 *
 * There is no `awa-IN` voice in the Web Speech API, so Awadhi falls back to the
 * Hindi voice, which reads Devanagari correctly.
 */
export const SPEECH_LOCALES: Record<Language, string> = {
  hi: 'hi-IN',
  en: 'en-IN',
  awa: 'hi-IN',
}

export type { Dict }

/** Interpolates {name} placeholders. */
export function fill(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] === undefined ? `{${k}}` : String(params[k]),
  )
}
