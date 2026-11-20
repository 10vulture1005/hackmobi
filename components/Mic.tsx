'use client'

import { Mic, Square } from 'lucide-react'
import clsx from 'clsx'
import { useApp } from './AppProvider'
import { useSpeechRecognition } from '@/lib/client/speech'
import { useEffect } from 'react'

/** Voice input. On-device Web Speech API — no upload, no key, no cost. */
export function MicButton({
  onTranscript,
  onInterim,
  label,
}: {
  onTranscript: (text: string) => void
  onInterim?: (text: string) => void
  label: string
}) {
  const { language, d } = useApp()
  const { supported, listening, transcript, error, start, stop } = useSpeechRecognition(language)

  useEffect(() => {
    if (transcript) onInterim?.(transcript)
  }, [transcript, onInterim])

  useEffect(() => {
    if (!listening && transcript) onTranscript(transcript)
    // Fires once listening ends with a final transcript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening])

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-disabled={!supported}
        aria-label={listening ? d.home.stop : label}
        className={clsx(
          'tap grid size-[60px] place-items-center rounded-full border-2 transition',
          listening
            ? 'listening border-primary bg-primary text-on-primary'
            : 'border-line bg-surface text-primary hover:bg-primary-tint',
        )}
      >
        {listening ? <Square size={22} aria-hidden /> : <Mic size={24} aria-hidden />}
      </button>
      <span className="text-xs font-semibold">{listening ? d.home.stop : label}</span>
      {/* Only after a tap — an unsupported notice on first paint just makes the
          button look broken, and the keyboard is right next to it anyway. */}
      {error === 'unsupported' && (
        <span className="text-[0.6875rem] leading-tight text-muted">{d.home.voiceUnsupported}</span>
      )}
      {error === 'not-allowed' && (
        <span className="text-[0.6875rem] leading-tight text-danger">{d.map.locationDenied}</span>
      )}
    </div>
  )
}
