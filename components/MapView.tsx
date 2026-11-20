'use client'

import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import type { NearbyPharmacy } from '@/lib/client/api'

/**
 * OpenStreetMap raster tiles, with attribution, per the OSM tile usage policy
 * (see /docs/data-sources.md). Markers are circle markers so the map needs no
 * icon assets and renders instantly on a slow connection.
 */
function Recentre({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true })
  }, [lat, lng, map])
  return null
}

export default function MapView({
  centre,
  pharmacies,
  selectedId,
  onSelect,
}: {
  centre: { lat: number; lng: number }
  pharmacies: NearbyPharmacy[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <MapContainer
      center={[centre.lat, centre.lng]}
      zoom={13}
      scrollWheelZoom
      className="h-[46dvh] w-full rounded-[16px] border border-line"
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <Recentre lat={centre.lat} lng={centre.lng} />

      <CircleMarker
        center={[centre.lat, centre.lng]}
        radius={7}
        pathOptions={{ color: '#115E59', fillColor: '#0F766E', fillOpacity: 1, weight: 3 }}
      >
        <Tooltip>You</Tooltip>
      </CircleMarker>

      {pharmacies.map((p) => {
        const selected = p.id === selectedId
        const out = p.product && !p.product.in_stock
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={selected ? 12 : 8}
            eventHandlers={{ click: () => onSelect(p.id) }}
            pathOptions={{
              color: selected ? '#0B1F1D' : '#ffffff',
              weight: selected ? 3 : 2,
              fillColor: out ? '#9AA7A5' : p.is_jan_aushadhi ? '#F59E0B' : '#0F766E',
              fillOpacity: out ? 0.6 : 0.95,
            }}
          >
            <Popup>
              <strong>{p.name}</strong>
              <br />
              {p.address}
              {p.product && (
                <>
                  <br />₹{p.product.price} · {p.product.in_stock ? 'in stock (demo)' : 'out of stock'}
                </>
              )}
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
