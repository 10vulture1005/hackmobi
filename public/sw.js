/*
 * Offline shell.
 *
 * - App shell and static assets: cache-first, so the app opens with no network.
 * - Result and nearby API calls: network-first, with the last response cached so
 *   a previously viewed result still renders offline (the UI labels it as saved).
 * - Reservations and anything that writes: never cached, never replayed.
 */

const VERSION = 'v1'
const SHELL = `sd-shell-${VERSION}`
const DATA = `sd-data-${VERSION}`

const SHELL_URLS = [
  '/',
  '/map',
  '/schemes',
  '/my-medicines',
  '/manifest.webmanifest',
  '/icons/icon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_URLS).catch(() => undefined)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const CACHEABLE_API = ['/api/alternatives', '/api/pharmacies/nearby', '/api/medicines/search', '/api/schemes/ask', '/api/demo/prescriptions']
const NEVER_CACHE = ['/api/reservations', '/api/pharmacist', '/api/prescription', '/api/scan', '/api/voice']

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (NEVER_CACHE.some((p) => url.pathname.startsWith(p))) return

  // API: network first, fall back to the last good response.
  if (url.pathname.startsWith('/api/')) {
    if (!CACHEABLE_API.some((p) => url.pathname.startsWith(p))) return
    event.respondWith(
      (async () => {
        const key = req.method === 'POST' ? `${url.pathname}:${await req.clone().text()}` : req.url
        try {
          const res = await fetch(req)
          if (res.ok) {
            const cache = await caches.open(DATA)
            await cache.put(new Request(key, { method: 'GET' }), res.clone())
          }
          return res
        } catch (err) {
          const cache = await caches.open(DATA)
          const hit = await cache.match(new Request(key, { method: 'GET' }))
          if (hit) {
            const body = await hit.json()
            return new Response(JSON.stringify({ ...body, __offline: true }), {
              headers: { 'content-type': 'application/json', 'x-from-cache': '1' },
            })
          }
          throw err
        }
      })(),
    )
    return
  }

  // Navigations and assets: cache first, refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL)
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' })
      if (hit) {
        void fetch(req)
          .then((res) => (res.ok ? cache.put(req, res.clone()) : undefined))
          .catch(() => undefined)
        return hit
      }
      try {
        const res = await fetch(req)
        if (res.ok && (req.mode === 'navigate' || /\.(css|js|svg|png|woff2?)$/.test(url.pathname))) {
          await cache.put(req, res.clone())
        }
        return res
      } catch (err) {
        const shell = await cache.match('/')
        if (req.mode === 'navigate' && shell) return shell
        throw err
      }
    })(),
  )
})
