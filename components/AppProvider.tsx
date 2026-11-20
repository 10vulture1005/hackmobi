'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DICTIONARIES, fill, type Dict, type Language } from '@/lib/i18n'
import { getPref, setPref } from '@/lib/client/idb'

export interface Place {
  lat: number
  lng: number
  label: string
}

/** Lucknow localities, for the no-GPS fallback. */
export const AREAS: Place[] = [
  { label: 'Hazratganj', lat: 26.8512, lng: 80.9471 },
  { label: 'Gomti Nagar', lat: 26.8575, lng: 81.0016 },
  { label: 'Indira Nagar', lat: 26.8905, lng: 80.9772 },
  { label: 'Aliganj', lat: 26.8903, lng: 80.9402 },
  { label: 'Alambagh', lat: 26.8042, lng: 80.8893 },
  { label: 'Chowk', lat: 26.8584, lng: 80.9052 },
  { label: 'Rajajipuram', lat: 26.8405, lng: 80.8794 },
  { label: 'Jankipuram', lat: 26.9101, lng: 80.9318 },
  { label: 'Telibagh', lat: 26.7807, lng: 80.9389 },
  { label: 'Chinhat', lat: 26.9004, lng: 81.0307 },
]

export type Theme = 'system' | 'light' | 'dark'

interface AppState {
  language: Language
  setLanguage: (l: Language) => void
  d: Dict
  t: (template: string, params?: Record<string, string | number>) => string
  largeText: boolean
  setLargeText: (v: boolean) => void
  voiceGuided: boolean
  setVoiceGuided: (v: boolean) => void
  theme: Theme
  setTheme: (t: Theme) => void
  place: Place
  setPlace: (p: Place) => void
  locating: boolean
  requestLocation: () => void
  locationError: string | null
  radiusKm: number
  setRadiusKm: (n: number) => void
  online: boolean
  ready: boolean
}

const Ctx = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('hi')
  const [largeText, setLargeTextState] = useState(false)
  const [voiceGuided, setVoiceGuidedState] = useState(false)
  const [theme, setThemeState] = useState<Theme>('system')
  const [place, setPlaceState] = useState<Place>(AREAS[0])
  const [radiusKm, setRadiusKmState] = useState(5)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [ready, setReady] = useState(false)

  // Preferences are per-device and survive a reload.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [lang, large, voice, th, pl, rad] = await Promise.all([
        getPref<Language>('language'),
        getPref<boolean>('largeText'),
        getPref<boolean>('voiceGuided'),
        getPref<Theme>('theme'),
        getPref<Place>('place'),
        getPref<number>('radiusKm'),
      ])
      if (cancelled) return
      if (lang) setLanguageState(lang)
      if (large) setLargeTextState(large)
      if (voice) setVoiceGuidedState(voice)
      if (th) setThemeState(th)
      if (pl) setPlaceState(pl)
      if (rad) setRadiusKmState(rad)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const flags = [largeText ? 'large' : '', largeText ? 'contrast' : ''].filter(Boolean).join(' ')
    if (flags) root.setAttribute('data-a11y', flags)
    else root.removeAttribute('data-a11y')
  }, [largeText])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const setLanguage = useCallback((l: Language) => {
    setLanguageState(l)
    void setPref('language', l)
  }, [])
  const setLargeText = useCallback((v: boolean) => {
    setLargeTextState(v)
    void setPref('largeText', v)
  }, [])
  const setVoiceGuided = useCallback((v: boolean) => {
    setVoiceGuidedState(v)
    void setPref('voiceGuided', v)
  }, [])
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    void setPref('theme', t)
  }, [])
  const setPlace = useCallback((p: Place) => {
    setPlaceState(p)
    void setPref('place', p)
  }, [])
  const setRadiusKm = useCallback((n: number) => {
    setRadiusKmState(n)
    void setPref('radiusKm', n)
  }, [])

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('unsupported')
      return
    }
    setLocating(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setPlace({
          lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
          lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
          label: 'my_location',
        })
      },
      () => {
        setLocating(false)
        setLocationError('denied')
      },
      { timeout: 8000, maximumAge: 300_000 },
    )
  }, [setPlace])

  const value = useMemo<AppState>(
    () => ({
      language,
      setLanguage,
      d: DICTIONARIES[language],
      t: fill,
      largeText,
      setLargeText,
      voiceGuided,
      setVoiceGuided,
      theme,
      setTheme,
      place,
      setPlace,
      locating,
      requestLocation,
      locationError,
      radiusKm,
      setRadiusKm,
      online,
      ready,
    }),
    [
      language, setLanguage, largeText, setLargeText, voiceGuided, setVoiceGuided, theme, setTheme,
      place, setPlace, locating, requestLocation, locationError, radiusKm, setRadiusKm, online, ready,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
