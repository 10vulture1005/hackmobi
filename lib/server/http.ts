/** Small helpers so every route returns the same error shape. */

import { NextResponse } from 'next/server'

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function fail(status: number, code: string, message: string, details: unknown = null) {
  return NextResponse.json({ error: { code, message, details } }, { status })
}

/** In-memory fixed-window rate limit. slowapi's job, without the dependency. */
const hits = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(req: Request, bucketName: string, limit = 60, windowMs = 60_000) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'
  const key = `${bucketName}:${ip}`
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  entry.count += 1
  if (entry.count > limit) {
    return fail(429, 'rate_limited', 'Too many requests. Please slow down.', {
      retry_after_ms: entry.resetAt - now,
    })
  }
  return null
}

export function num(v: string | null): number | undefined {
  if (v === null || v.trim() === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
