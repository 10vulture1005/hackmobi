'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SPEECH_LOCALES, type Language } from '@/lib/i18n'

/* The Web Speech API is still vendor-prefixed in Chrome. */
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechRecognition(language: Language) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<SpeechRecognitionLike | null>(null)

  useEffect(() => setSupported(!!recognitionCtor()), [])

  const stop = useCallback(() => {
    ref.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      setError('unsupported')
      return
    }
    setError(null)
    setTranscript('')
    const rec = new Ctor()
    rec.lang = SPEECH_LOCALES[language]
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setTranscript(text.trim())
    }
    rec.onerror = (e) => {
      setError(e.error)
      setListening(false)
    }
    rec.onend = () => setListening(false)
    ref.current = rec
    rec.start()
    setListening(true)
  }, [language])

  useEffect(() => () => ref.current?.abort(), [])

  return { supported, listening, transcript, error, start, stop, setTranscript }
}

/** Reads text aloud in the selected language, cancelling anything already queued. */
export function speak(text: string, language: Language) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  const locale = SPEECH_LOCALES[language]
  utter.lang = locale
  const voice =
    synth.getVoices().find((v) => v.lang === locale) ??
    synth.getVoices().find((v) => v.lang.startsWith(locale.split('-')[0]))
  if (voice) utter.voice = voice
  utter.rate = 0.95
  synth.speak(utter)
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}
