export function rupee(n: number, opts: { decimals?: boolean } = {}): string {
  const showDecimals = opts.decimals ?? n % 1 !== 0
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  })}`
}

export function paise(n: number): string {
  return `₹${n.toFixed(2)}`
}

export function km(n: number | null): string {
  if (n === null) return '—'
  return n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`
}

export function shortDate(iso: string, locale = 'en-IN'): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000))
}
