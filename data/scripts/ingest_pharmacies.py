#!/usr/bin/env python3
"""Ingest real pharmacy locations from OpenStreetMap.

This one runs as-is, with no manual download:

    python3 data/scripts/ingest_pharmacies.py
    python3 data/scripts/ingest_pharmacies.py --bbox 19.0,72.8,19.3,73.0 --city Mumbai
    python3 data/scripts/ingest_pharmacies.py --jan-aushadhi data/raw/kendras.csv --nominatim

Writes data/seed/pharmacies.json in the shape the app already reads, so the app
picks the real stores up on the next request.

OpenStreetMap data is © OpenStreetMap contributors, ODbL. Attribution is shown
on the map screen. Overpass is a shared free service: this script makes one
request per run and backs off on failure. Nominatim geocoding, used only for
Jan Aushadhi Kendras published as addresses, is rate-limited to 1 req/sec with a
persisted cache, per its usage policy.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from math import asin, cos, radians, sin, sqrt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SEED = os.path.join(ROOT, 'data', 'seed')
CACHE = os.path.join(ROOT, 'data', 'raw', 'geocode_cache.json')
OVERPASS = 'https://overpass-api.de/api/interpreter'
NOMINATIM = 'https://nominatim.openstreetmap.org/search'
UA = 'SastaDawa/0.1 (hackathon demo; contact via repository)'

# Lucknow, Uttar Pradesh: south,west,north,east
DEFAULT_BBOX = os.environ.get('DEMO_CITY_BBOX', '26.72,80.82,26.95,81.05')

QUERY = """
[out:json][timeout:90];
(
  node["amenity"="pharmacy"]({bbox});
  way["amenity"="pharmacy"]({bbox});
  node["healthcare"="pharmacy"]({bbox});
  way["healthcare"="pharmacy"]({bbox});
);
out center tags;
"""


def fetch_overpass(bbox: str, attempts: int = 3) -> dict:
    body = urllib.parse.urlencode({'data': QUERY.format(bbox=bbox)}).encode()
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(OVERPASS, body, {'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=120) as res:
                return json.load(res)
        except Exception as exc:  # noqa: BLE001 - Overpass is a shared service
            wait = 5 * attempt
            print(f'  overpass attempt {attempt} failed ({exc}); retrying in {wait}s', file=sys.stderr)
            if attempt == attempts:
                raise
            time.sleep(wait)
    raise RuntimeError('unreachable')


def distance_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    r = 6371.0
    d_lat = radians(b_lat - a_lat)
    d_lng = radians(b_lng - a_lng)
    h = sin(d_lat / 2) ** 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(d_lng / 2) ** 2
    return 2 * r * asin(min(1.0, sqrt(h)))


def is_jan_aushadhi_name(name: str) -> bool:
    n = name.lower()
    return 'jan aushadhi' in n or 'janaushadhi' in n or 'pmbjp' in n or 'generic store' in n


def clean_name(tags: dict) -> str | None:
    for key in ('name:en', 'name', 'operator', 'brand'):
        value = tags.get(key)
        if value and len(value.strip()) > 2:
            return re.sub(r'\s+', ' ', value.strip())
    return None


def address_of(tags: dict, city: str) -> str:
    parts = [
        tags.get('addr:housenumber'),
        tags.get('addr:street'),
        tags.get('addr:suburb') or tags.get('addr:neighbourhood'),
        tags.get('addr:city') or city,
        tags.get('addr:state'),
    ]
    return ', '.join(p for p in parts if p) or city


def load_cache() -> dict:
    try:
        with open(CACHE) as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, 'w') as f:
        json.dump(cache, f, indent=0)


def geocode(address: str, cache: dict) -> tuple[float, float] | None:
    """Nominatim, 1 req/sec, cached. Only for Kendras published as addresses."""
    if address in cache:
        hit = cache[address]
        return (hit['lat'], hit['lng']) if hit else None
    params = urllib.parse.urlencode({'q': address, 'format': 'json', 'limit': 1})
    try:
        req = urllib.request.Request(f'{NOMINATIM}?{params}', headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as res:
            rows = json.load(res)
    except Exception as exc:  # noqa: BLE001
        print(f'  geocode failed for {address!r}: {exc}', file=sys.stderr)
        rows = []
    time.sleep(1.1)  # usage policy: at most one request per second
    if not rows:
        cache[address] = None
        save_cache(cache)
        return None
    lat, lng = float(rows[0]['lat']), float(rows[0]['lon'])
    cache[address] = {'lat': lat, 'lng': lng}
    save_cache(cache)
    return lat, lng


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--bbox', default=DEFAULT_BBOX, help='south,west,north,east')
    ap.add_argument('--city', default=os.environ.get('NEXT_PUBLIC_DEMO_CITY', 'Lucknow'))
    ap.add_argument('--out', default=os.path.join(SEED, 'pharmacies.json'))
    ap.add_argument('--jan-aushadhi', help='CSV of Kendras: name,address[,lat,lng]')
    ap.add_argument('--nominatim', action='store_true', help='geocode Kendras missing coordinates')
    ap.add_argument('--max', type=int, default=400)
    args = ap.parse_args()

    print(f'Querying Overpass for pharmacies in {args.city} [{args.bbox}] …')
    data = fetch_overpass(args.bbox)
    elements = data.get('elements', [])
    print(f'  {len(elements)} raw elements')

    rows: list[dict] = []
    for el in elements:
        tags = el.get('tags') or {}
        name = clean_name(tags)
        if not name:
            continue  # an unnamed point is useless to a citizen looking for a shop
        lat = el.get('lat') or (el.get('center') or {}).get('lat')
        lng = el.get('lon') or (el.get('center') or {}).get('lon')
        if lat is None or lng is None:
            continue
        rows.append(
            {
                'id': f"osm{el['type'][0]}{el['id']}",
                'name': name,
                'address': address_of(tags, args.city),
                'lat': round(float(lat), 6),
                'lng': round(float(lng), 6),
                'phone': tags.get('phone') or tags.get('contact:phone'),
                'opening_hours': tags.get('opening_hours'),
                'is_jan_aushadhi': is_jan_aushadhi_name(name),
                'osm_id': f"{el['type']}/{el['id']}",
                # OSM cannot tell us a licence number or a verified owner, and we
                # do not invent either: a store is unverified until its owner
                # claims it in the dashboard.
                'verified': False,
                'licence_no': None,
                'last_stock_update': None,
            }
        )

    # Dedupe: the same shop mapped twice, as a node and as a building way.
    deduped: list[dict] = []
    for row in rows:
        twin = next(
            (
                d
                for d in deduped
                if d['name'].lower() == row['name'].lower()
                and distance_km(d['lat'], d['lng'], row['lat'], row['lng']) < 0.1
            ),
            None,
        )
        if twin is None:
            deduped.append(row)
    print(f'  {len(deduped)} named, de-duplicated pharmacies')

    if args.jan_aushadhi:
        cache = load_cache()
        added = 0
        with open(args.jan_aushadhi, newline='') as f:
            for i, rec in enumerate(csv.DictReader(f)):
                name = (rec.get('name') or '').strip()
                address = (rec.get('address') or '').strip()
                if not name:
                    continue
                lat = rec.get('lat')
                lng = rec.get('lng')
                if (not lat or not lng) and args.nominatim and address:
                    point = geocode(f'{address}, {args.city}, India', cache)
                    if not point:
                        continue
                    lat, lng = point
                if not lat or not lng:
                    continue
                deduped.append(
                    {
                        'id': f'ja{i:04d}',
                        'name': name,
                        'address': address or args.city,
                        'lat': round(float(lat), 6),
                        'lng': round(float(lng), 6),
                        'phone': (rec.get('phone') or '').strip() or None,
                        'opening_hours': rec.get('opening_hours') or None,
                        'is_jan_aushadhi': True,
                        'osm_id': None,
                        'verified': True,
                        'licence_no': (rec.get('licence_no') or '').strip() or None,
                        'last_stock_update': None,
                    }
                )
                added += 1
        print(f'  + {added} Jan Aushadhi Kendras')

    deduped = deduped[: args.max]
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w') as f:
        json.dump(deduped, f)

    kendras = sum(1 for d in deduped if d['is_jan_aushadhi'])
    print(f'\nWrote {len(deduped)} pharmacies ({kendras} Jan Aushadhi) to {args.out}')
    print('Next: npx tsx data/scripts/seed_all.ts --pharmacies-from-seed   # regenerate inventory')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
