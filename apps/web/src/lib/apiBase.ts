/** Resolve FastAPI base for localhost or phone-on-LAN. */
export function defaultApiBase(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000'
  const host = window.location.hostname || '127.0.0.1'
  // When opened via LAN IP, hit API on same host:8000
  return `http://${host}:8000`
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
