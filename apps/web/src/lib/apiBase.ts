/** Resolve FastAPI base for localhost or phone-on-LAN (same host + protocol as the page). */
export function defaultApiBase(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000'
  const host = window.location.hostname || '127.0.0.1'
  const proto = window.location.protocol === 'https:' ? 'https' : 'http'
  // When opened via LAN IP / HTTPS, hit API on same host:8000 with matching scheme.
  return `${proto}://${host}:8000`
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = defaultApiBase()
  return fetch(`${base}${path.startsWith('/') ? path : '/' + path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
}
