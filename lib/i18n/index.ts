import { en, type Dict } from './en'
import { hi } from './hi'
import { mr } from './mr'

export type Language = 'en' | 'hi' | 'mr'

export const DICTIONARIES: Record<Language, Dict> = { en, hi, mr }

export const LANGUAGE_LABELS: Record<Language, string> = {
  hi: 'हिन्दी',
  en: 'English',
  mr: 'मराठी',
}

/** BCP-47 tags for SpeechRecognition and speechSynthesis. */
export const SPEECH_LOCALES: Record<Language, string> = {
  hi: 'hi-IN',
  en: 'en-IN',
  mr: 'mr-IN',
}

export type { Dict }

/** Interpolates {name} placeholders. */
export function fill(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] === undefined ? `{${k}}` : String(params[k]),
  )
}
