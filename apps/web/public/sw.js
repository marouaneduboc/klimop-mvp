/* Klimop shell SW — caches app shell + content JSON for offline reopen on LAN. */
const CACHE = 'klimop-shell-v1'
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './content/books.json',
  './content/course.json',
  './content/grammar.json',
  './content/stories.json',
  './content/proverbs.json',
  './content/klimop.json',
  './content/windmee.json',
  './content/blinkuit.json',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Network-first for API; cache-first for shell/content
  if (url.pathname.includes('/api') || url.port === '8000') return
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.ok && (url.pathname.endsWith('.json') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/'))) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => cached)
      return cached || fetched
    })
  )
})
