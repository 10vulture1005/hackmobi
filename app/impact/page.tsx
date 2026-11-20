'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  ZAxis,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, IndianRupee, MapPinOff, Package, Store } from 'lucide-react'
import { Badge, Card, Skeleton } from '@/components/ui'
import { api, type AdminStats } from '@/lib/client/api'
import { rupee } from '@/lib/client/format'

/**
 * Impact dashboard (English, desktop-first). Everything here is aggregated and
 * anonymous: search coordinates are rounded to about a kilometre before they
 * are ever stored, and no prescription content is recorded.
 */
export default function ImpactPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null))
    const id = setInterval(() => api.stats().then(setStats).catch(() => undefined), 10_000)
    return () => clearInterval(id)
  }, [])

  if (!stats) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const topSearches = stats.top_searches.map((t) => ({ ...t, label: t.query.slice(0, 22) }))

  return (
    <div className="space-y-4 pb-10">
      <header>
        <h1 className="text-2xl font-extrabold leading-tight">Impact</h1>
        <p className="text-sm text-muted">
          Live aggregates from this session. Anonymous by design — no names, no phone numbers, no prescription
          text, and coordinates rounded to roughly a kilometre.
        </p>
        {stats.includes_demo_activity && (
          <p className="mt-2">
            <Badge tone="savings">Includes seeded demo activity · real searches land alongside it</Badge>
          </p>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<IndianRupee size={18} aria-hidden />} label="Savings surfaced" value={rupee(stats.savings_generated)} tone="text-savings" />
        <Kpi icon={<Activity size={18} aria-hidden />} label="Searches" value={String(stats.searches)} />
        <Kpi icon={<Package size={18} aria-hidden />} label="Reservations" value={String(stats.reservations)} />
        <Kpi
          icon={<Store size={18} aria-hidden />}
          label="Jan Aushadhi coverage"
          value={`${stats.catalogue.jan_aushadhi_coverage_pct}%`}
          tone="text-success"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="text-base font-bold">Most searched medicines</h2>
          {topSearches.length === 0 ? (
            <p className="text-sm text-muted">Run a few searches and they appear here.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSearches} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-line)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
                  <YAxis dataKey="label" type="category" width={140} tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-line)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {topSearches.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? 'var(--color-savings)' : 'var(--color-primary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="space-y-2">
          <h2 className="text-base font-bold">Where people are searching</h2>
          <p className="text-xs text-muted">One dot per search, rounded to a ~1 km grid. Size follows the saving found.</p>
          {stats.search_heat.length === 0 ? (
            <p className="text-sm text-muted">No located searches yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" />
                  <XAxis
                    dataKey="lng"
                    type="number"
                    domain={['dataMin - 0.02', 'dataMax + 0.02']}
                    tickFormatter={(v: number) => v.toFixed(2)}
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted)"
                  />
                  <YAxis
                    dataKey="lat"
                    type="number"
                    domain={['dataMin - 0.02', 'dataMax + 0.02']}
                    tickFormatter={(v: number) => v.toFixed(2)}
                    tick={{ fontSize: 10 }}
                    stroke="var(--color-muted)"
                  />
                  <ZAxis dataKey="savings" type="number" range={[40, 320]} name="saving" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-line)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Scatter data={stats.search_heat} fill="var(--color-primary)" opacity={0.65} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <MapPinOff size={18} className="text-danger" aria-hidden />
          Areas with no Jan Aushadhi Kendra within 3 km
        </h2>
        {stats.generic_gap_areas.length === 0 ? (
          <p className="text-sm text-muted">Every mapped area has a Kendra within 3 km.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {stats.generic_gap_areas.map((g) => (
              <li key={g.area}>
                <Badge tone="danger">
                  {g.area} · nearest {g.nearest_kendra_km} km
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          This is the policy ask: these are the wards where a new Kendra would cut the most out of household
          medicine bills.
        </p>
      </Card>

      <Card className="grid gap-3 sm:grid-cols-3">
        <Figure label="Products in catalogue" value={stats.catalogue.products} />
        <Figure label="Canonical medicines" value={stats.catalogue.canonical_keys} />
        <Figure label="Jan Aushadhi products" value={stats.catalogue.jan_aushadhi_products} />
        <Figure label="Pharmacies mapped" value={stats.catalogue.pharmacies} />
        <Figure label="Jan Aushadhi Kendras" value={stats.catalogue.kendras} />
        <Figure label="Reservations" value={stats.reservations} />
      </Card>
    </div>
  )
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <Card className="space-y-1">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        {icon}
        {label}
      </p>
      <p className={`tabular text-2xl font-extrabold ${tone ?? ''}`}>{value}</p>
    </Card>
  )
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="tabular text-xl font-extrabold">{value}</p>
    </div>
  )
}
