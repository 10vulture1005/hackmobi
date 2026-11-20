'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Loader2, MapPin, Navigation, Store } from 'lucide-react'
import clsx from 'clsx'
import { AREAS, useApp } from '@/components/AppProvider'
import { Badge, Button, Card, Skeleton } from '@/components/ui'
import { api, type NearbyPharmacy } from '@/lib/client/api'
import { km, rupee } from '@/lib/client/format'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <Skeleton className="h-[46dvh] w-full rounded-[16px]" />,
})

export default function MapPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[60dvh] w-full" />}>
      <MapScreen />
    </Suspense>
  )
}

function MapScreen() {
  const params = useSearchParams()
  const productId = params.get('product_id')
  const { d, t, place, setPlace, requestLocation, locating, locationError, radiusKm, setRadiusKm } = useApp()

  const [rows, setRows] = useState<NearbyPharmacy[] | null>(null)
  const [product, setProduct] = useState<{ id: string; brand_name: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [kendraOnly, setKendraOnly] = useState(false)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    api
      .nearby({
        lat: place.lat,
        lng: place.lng,
        radius_km: radiusKm,
        product_id: productId ?? undefined,
        jan_aushadhi_only: kendraOnly,
        limit: 120,
      })
      .then((res) => {
        if (!cancelled) setRows(res.pharmacies)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [place.lat, place.lng, radiusKm, productId, kendraOnly])

  // The product's name comes back on the inventory rows, so the header needs
  // no second lookup.
  useEffect(() => {
    if (!rows || !productId) {
      setProduct(null)
      return
    }
    const first = rows.find((r) => r.product)
    setProduct(first?.product ? { id: first.product.product_id, brand_name: first.product.brand_name } : null)
  }, [rows, productId])

  const selectedRow = useMemo(() => rows?.find((r) => r.id === selected) ?? null, [rows, selected])

  return (
    <div className="space-y-3 pb-6">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold leading-tight">{d.map.title}</h1>
          <p className="text-sm text-muted">
            {product ? product.brand_name : t(d.map.radius, { km: radiusKm })}
            {rows ? ` · ${t(d.map.showing, { n: rows.length })}` : ''}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={requestLocation} disabled={locating}>
          {locating ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Navigation size={15} aria-hidden />}
          {d.map.useLocation}
        </Button>
      </header>

      {locationError && <p className="rounded-xl bg-savings-tint px-3 py-2 text-xs font-semibold text-[#92400e]">{d.map.locationDenied}</p>}

      <MapView
        centre={place}
        pharmacies={rows ?? []}
        selectedId={selected}
        onSelect={(id) => setSelected(id)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setKendraOnly((v) => !v)}
          aria-pressed={kendraOnly}
          className={clsx('pill', kendraOnly ? 'border-transparent bg-savings text-[#3b2600]' : 'bg-surface')}
        >
          <span className="size-2 rounded-full bg-savings" aria-hidden />
          {d.map.kendra}
        </button>
        <span className="pill bg-surface">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          {d.map.private}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {[2, 5, 10].map((r) => (
            <button
              key={r}
              onClick={() => setRadiusKm(r)}
              aria-pressed={radiusKm === r}
              className={clsx('pill', radiusKm === r ? 'border-transparent bg-primary text-white' : 'bg-surface')}
            >
              {r} {d.common.km}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {AREAS.map((a) => (
          <li key={a.label}>
            <button
              onClick={() => setPlace(a)}
              className={clsx('pill', place.label === a.label ? 'border-transparent bg-primary-tint text-primary-dark' : 'bg-surface')}
            >
              {a.label}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted">{d.map.stockNote}</p>

      {!rows && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      <ul className="space-y-2">
        {(rows ?? []).map((p) => (
          <li key={p.id}>
            <Card
              className={clsx(
                'space-y-2 transition',
                selectedRow?.id === p.id && 'border-primary ring-2 ring-primary/30',
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={clsx(
                    'grid size-9 shrink-0 place-items-center rounded-xl',
                    p.is_jan_aushadhi ? 'bg-savings-tint text-[#92400e]' : 'bg-primary-tint text-primary-dark',
                  )}
                >
                  <Store size={17} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-bold">{p.name}</span>
                    {p.is_jan_aushadhi && <Badge tone="savings">{d.results.janAushadhi}</Badge>}
                    {p.verified && <Badge tone="primary">{d.results.verified}</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">{p.address}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="tabular font-bold">{km(p.distance_km)}</span>
                    {p.opening_hours && <span className="text-muted">{p.opening_hours}</span>}
                    {p.licence_no && <span className="text-muted">{t(d.results.licence, { no: p.licence_no })}</span>}
                  </p>
                </div>
                {p.product && (
                  <div className="shrink-0 text-right">
                    <p className="tabular font-bold">{rupee(p.product.price)}</p>
                    <Badge tone={p.product.in_stock ? 'savings' : 'muted'}>
                      {p.product.in_stock ? d.results.demoStock : d.results.outOfStock}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={p.stock_freshness === 'fresh' ? 'success' : 'muted'}>
                  {p.stock_freshness === 'fresh'
                    ? t(d.results.stockFresh, { hours: p.stock_age_hours ?? 0 })
                    : p.stock_freshness === 'stale'
                      ? t(d.results.stockStale, { days: Math.round((p.stock_age_hours ?? 24) / 24) })
                      : p.stock_freshness === 'old'
                        ? d.results.stockOld
                        : d.results.stockUnknown}
                </Badge>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold text-primary"
                >
                  <MapPin size={15} aria-hidden />
                  {d.map.directions}
                </a>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
