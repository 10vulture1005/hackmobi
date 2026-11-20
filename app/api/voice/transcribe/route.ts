import { fail, ok, rateLimit } from '@/lib/server/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Fallback only. Voice input is the browser's Web Speech API first, which
 * costs nothing and needs no upload. This endpoint exists for browsers without
 * it, and uses Groq's free Whisper endpoint when a key is configured.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, 'voice', 20)
  if (limited) return limited

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return fail(
      501,
      'voice_fallback_unconfigured',
      'Server transcription is not configured. Use the on-device microphone, or type the medicine name.',
    )
  }

  const form = await req.formData()
  const file = form.get('audio')
  if (!(file instanceof File)) return fail(400, 'no_audio', 'Attach an audio file as "audio".')

  const language = (form.get('language') as string | null) ?? 'hi'
  const upstream = new FormData()
  upstream.append('file', file, file.name || 'audio.webm')
  upstream.append('model', 'whisper-large-v3-turbo')
  upstream.append('language', language)

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: upstream,
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) {
    return fail(502, 'transcription_failed', 'Could not transcribe that clip. Please type instead.')
  }
  const body = (await res.json()) as { text?: string }
  return ok({ text: (body.text ?? '').trim(), via: 'groq:whisper-large-v3-turbo' })
}
