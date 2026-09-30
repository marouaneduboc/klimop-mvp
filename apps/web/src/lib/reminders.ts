const REMIND_LS = 'klimop.remind.v1'

export type RemindPrefs = {
  enabled: boolean
  /** HH:MM local */
  time: string
  lastNotifiedDay: string | null
}

export function loadRemindPrefs(userId: string): RemindPrefs {
  try {
    const raw = localStorage.getItem(`${REMIND_LS}:u:${userId}`)
    if (!raw) return { enabled: false, time: '18:00', lastNotifiedDay: null }
    return { enabled: false, time: '18:00', lastNotifiedDay: null, ...JSON.parse(raw) }
  } catch {
    return { enabled: false, time: '18:00', lastNotifiedDay: null }
  }
}

export function saveRemindPrefs(userId: string, prefs: RemindPrefs) {
  localStorage.setItem(`${REMIND_LS}:u:${userId}`, JSON.stringify(prefs))
}

export async function ensureNotifyPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function maybeNudge(userId: string, reviewsToday: number, dailyTarget: number): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  const prefs = loadRemindPrefs(userId)
  if (!prefs.enabled) return
  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  if (prefs.lastNotifiedDay === day) return
  if (reviewsToday >= dailyTarget) return
  const [hh, mm] = (prefs.time || '18:00').split(':').map(Number)
  const mins = now.getHours() * 60 + now.getMinutes()
  const target = (hh || 18) * 60 + (mm || 0)
  // Fire once after remind time
  if (mins < target) return
  try {
    new Notification('Lichte Klimop', {
      body: `Tijd voor een korte Daily — nog ${Math.max(0, dailyTarget - reviewsToday)} kaarten vandaag.`,
      icon: './icon.svg',
      tag: 'klimop-daily',
    })
    saveRemindPrefs(userId, { ...prefs, lastNotifiedDay: day })
  } catch { /* ignore */ }
}

export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // Secure context required (HTTPS / localhost). Phone LAN must use HTTPS (see LOCAL_RUN.md).
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    console.info('[klimop] Service worker skipped — open via HTTPS on the LAN for offline/PWA.')
    return
  }
  const start = () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
