'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Download, MessageCircle, Share2 } from 'lucide-react'
import { Button, Sheet } from './ui'
import { useApp } from './AppProvider'
import { rupee } from '@/lib/client/format'

export interface SharePayload {
  medicine: string
  composition: string
  oldPrice: number
  newPrice: number
  newName: string
  unit: string
  savings: number
  savingsPct: number
  store: string | null
  distanceKm: number | null
  isJanAushadhi: boolean
}

/**
 * The share card is drawn on a canvas so what lands in a WhatsApp chat is a
 * readable image, not a wall of text — and it carries the disclaimer with it.
 */
function draw(canvas: HTMLCanvasElement, p: SharePayload, labels: Record<string, string>) {
  const W = 1080
  const H = 1080
  const dpr = 1
  canvas.width = W * dpr
  canvas.height = H * dpr
  const c = canvas.getContext('2d')
  if (!c) return

  const grad = c.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#0F766E')
  grad.addColorStop(1, '#115E59')
  c.fillStyle = grad
  c.fillRect(0, 0, W, H)

  // card
  c.fillStyle = '#FFFFFF'
  roundRect(c, 56, 150, W - 112, 780, 44)
  c.fill()

  c.fillStyle = 'rgba(255,255,255,0.92)'
  c.font = '700 40px system-ui, sans-serif'
  c.fillText(labels.app, 60, 90)
  c.font = '600 26px system-ui, sans-serif'
  c.fillStyle = 'rgba(255,255,255,0.75)'
  c.fillText(labels.tagline, 60, 126)

  let y = 232
  c.fillStyle = '#5B6B69'
  c.font = '600 30px system-ui, sans-serif'
  c.fillText(labels.doctorWrote.toUpperCase(), 104, y)
  y += 52
  c.fillStyle = '#0B1F1D'
  c.font = '800 54px system-ui, sans-serif'
  wrap(c, p.medicine, 104, y, W - 208, 60)
  y += 70
  c.fillStyle = '#5B6B69'
  c.font = '500 28px system-ui, sans-serif'
  wrap(c, p.composition, 104, y, W - 208, 34)
  y += 54
  c.fillStyle = '#DC2626'
  c.font = '700 40px system-ui, sans-serif'
  const oldText = `${rupee(p.oldPrice)} / ${p.unit}`
  c.fillText(oldText, 104, y)
  const w = c.measureText(oldText).width
  c.strokeStyle = '#DC2626'
  c.lineWidth = 4
  c.beginPath()
  c.moveTo(104, y - 13)
  c.lineTo(104 + w, y - 13)
  c.stroke()

  y += 42
  c.fillStyle = '#F1F6F5'
  roundRect(c, 96, y, W - 192, 230, 28)
  c.fill()

  y += 60
  c.fillStyle = '#0F766E'
  c.font = '700 30px system-ui, sans-serif'
  c.fillText(p.isJanAushadhi ? labels.janAushadhi.toUpperCase() : labels.sameSalt.toUpperCase(), 128, y)
  y += 56
  c.fillStyle = '#0B1F1D'
  c.font = '800 46px system-ui, sans-serif'
  wrap(c, p.newName, 128, y, W - 256, 52)
  y += 62
  c.fillStyle = '#16A34A'
  c.font = '800 48px system-ui, sans-serif'
  c.fillText(`${rupee(p.newPrice)} / ${p.unit}`, 128, y)

  y += 104
  c.fillStyle = '#F59E0B'
  roundRect(c, 96, y - 58, W - 192, 110, 26)
  c.fill()
  c.fillStyle = '#3B2600'
  c.font = '800 54px system-ui, sans-serif'
  c.fillText(`${labels.save} ${rupee(p.savings)}`, 128, y + 12)
  c.font = '700 34px system-ui, sans-serif'
  c.fillText(`${p.savingsPct}%`, W - 220, y + 12)

  y += 108
  if (p.store) {
    c.fillStyle = '#0B1F1D'
    c.font = '600 30px system-ui, sans-serif'
    const dist = p.distanceKm !== null ? ` · ${p.distanceKm} km` : ''
    wrap(c, `${p.store}${dist}`, 104, y, W - 208, 36)
    y += 44
  }

  c.fillStyle = '#5B6B69'
  c.font = '500 24px system-ui, sans-serif'
  wrap(c, labels.disclaimer, 104, 876, W - 208, 30)

  c.fillStyle = 'rgba(255,255,255,0.78)'
  c.font = '600 24px system-ui, sans-serif'
  c.fillText(labels.demo, 60, 1010)
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (c.measureText(test).width > maxWidth && line) {
      c.fillText(line, x, yy)
      line = word
      yy += lineHeight
    } else {
      line = test
    }
  }
  if (line) c.fillText(line, x, yy)
}

export function ShareCard({
  open,
  onClose,
  payload,
}: {
  open: boolean
  onClose: () => void
  payload: SharePayload | null
}) {
  const { d, t } = useApp()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const text = payload
    ? t(d.share.text, {
        medicine: payload.medicine,
        oldPrice: rupee(payload.oldPrice),
        newPrice: rupee(payload.newPrice),
        store: payload.store ?? '—',
        distance: payload.distanceKm ?? '—',
        savings: rupee(payload.savings),
      })
    : ''

  useEffect(() => {
    if (!open || !payload || !canvasRef.current) return
    draw(canvasRef.current, payload, {
      app: d.app.name,
      tagline: d.app.tagline,
      doctorWrote: d.results.doctorWrote,
      sameSalt: d.results.sameSalt,
      janAushadhi: d.results.janAushadhi,
      save: t(d.results.save, { amount: '' }).replace('{amount}', '').trim(),
      disclaimer: d.results.disclaimer,
      demo: d.app.demoBadge,
    })
    setDataUrl(canvasRef.current.toDataURL('image/png'))
  }, [open, payload, d, t])

  const shareNative = useCallback(async () => {
    if (!dataUrl) return
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'sasta-dawa.png', { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
        return
      }
      await navigator.share({ text })
    } catch {
      /* the user dismissed the share sheet */
    }
  }, [dataUrl, text])

  return (
    <Sheet
      closeLabel={d.common.close}
      open={open}
      onClose={onClose}
      title={d.results.share}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')}
          >
            <MessageCircle size={18} aria-hidden />
            WhatsApp
          </Button>
          <Button variant="secondary" onClick={shareNative}>
            <Share2 size={18} aria-hidden />
            {d.results.share}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(text)
              setCopied(true)
            }}
          >
            <Copy size={15} aria-hidden />
            {copied ? d.share.copied : d.common.ok}
          </Button>
          <a
            href={dataUrl ?? '#'}
            download="sasta-dawa.png"
            className="tap inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold text-primary hover:bg-primary-tint"
          >
            <Download size={15} aria-hidden />
            {d.share.download}
          </a>
        </div>
      }
    >
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={d.share.cardAlt} className="w-full rounded-2xl border border-line" />
      ) : (
        <div className="skeleton aspect-square w-full rounded-2xl" />
      )}
      <p className="mt-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-sm">{text}</p>
    </Sheet>
  )
}
