/** Resolve FastAPI base for localhost or phone-on-LAN. */
export function defaultApiBase(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000'
  const port = window.location.port
  // Vite dev/preview: same-origin so HTTPS UI can reach HTTP API via the Vite proxy
  // (see apps/web/vite.config.ts). Avoids scheme mismatch when basicSsl/mkcert serves the page.
  if (port === '5175' || port === '4173') {
    return window.location.origin
  }
  const host = window.location.hostname || '127.0.0.1'
  const proto = window.location.protocol === 'https:' ? 'https' : 'http'
  // Direct API (mkcert on :8000, or plain HTTP local runs).
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
