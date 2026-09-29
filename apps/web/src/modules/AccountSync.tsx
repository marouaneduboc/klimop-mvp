import { useEffect, useState } from 'react'
import { apiFetch, defaultApiBase } from '../lib/apiBase'

const PAIR_TOKEN_KEY = 'klimop.pairToken.v1'
const SYNC_PROFILE_KEY = 'klimop.syncProfileId.v1'
const LAST_PUSH_KEY = 'klimop.syncLastPush.v1'
const LAST_PULL_KEY = 'klimop.syncLastPull.v1'

const MIGRATE_KEYS = [
  'klimop.reviews.v1',
  'klimop.stats.v1',
  'klimop.settings.v1',
  'klimop.difficult.v1',
  'klimop.users',
  'klimop.currentUser',
  'klimop.userDisplayNames',
  'klimop.deofhet.v2',
  'klimop.grammar.v1',
  'klimop.deofhet.history',
  'klimop.grammar.history',
  'klimop.onboarding.v1',
  'klimop.remind.v1',
]

function collectLocalBlob(userId: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (!k.startsWith('klimop.')) continue
    // Prefer user-scoped + shared profile keys
    if (k.includes(`:u:${userId}`) || MIGRATE_KEYS.some(b => k === b || k.startsWith(b + ':u:'))) {
      try { out[k] = JSON.parse(localStorage.getItem(k) || 'null') } catch { out[k] = localStorage.getItem(k) }
    }
  }
  // Always include core scoped keys even if empty
  for (const base of MIGRATE_KEYS) {
    const scoped = `${base}:u:${userId}`
    if (!(scoped in out) && localStorage.getItem(scoped)) {
      try { out[scoped] = JSON.parse(localStorage.getItem(scoped)!) } catch { out[scoped] = localStorage.getItem(scoped) }
    }
  }
  return out
}

function applyBlob(blob: Record<string, unknown>) {
  for (const [k, v] of Object.entries(blob || {})) {
    try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) } catch { /* */ }
  }
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'never'
  try {
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return d.toISOString()
  }
}

/** Clipboard API fails on non-secure HTTP (LAN). Fallback: select textarea, execCommand copy. */
async function copyText(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function AccountSync({
  currentUserId,
  displayName,
}: {
  currentUserId: string
  displayName: string
}) {
  const [apiBase, setApiBase] = useState(defaultApiBase())
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pairCode, setPairCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [profileId, setProfileId] = useState(() => localStorage.getItem(SYNC_PROFILE_KEY) || '')
  const [hasToken, setHasToken] = useState(() => !!localStorage.getItem(PAIR_TOKEN_KEY))
  const [lastPush, setLastPush] = useState(() => localStorage.getItem(LAST_PUSH_KEY))
  const [lastPull, setLastPull] = useState(() => localStorage.getItem(LAST_PULL_KEY))
  const [busy, setBusy] = useState(false)

  const paired = !!(profileId && hasToken)

  useEffect(() => { setApiBase(defaultApiBase()) }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    if (kind === 'ok') { setStatus(text); setErr('') }
    else { setErr(text); setStatus('') }
  }

  const health = async () => {
    setErr(''); setStatus('Checking API…')
    try {
      const r = await fetch(`${apiBase}/health`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setStatus(`API OK · ${j.service || 'klimop'} · ${apiBase}`)
    } catch {
      setErr(`API unreachable at ${apiBase}. Start ./run-local.sh on the Mac (binds 0.0.0.0:8000).`)
      setStatus('')
    }
  }

  useEffect(() => { health() }, [])

  const createPair = async () => {
    setBusy(true); setErr('')
    try {
      const blob = collectLocalBlob(currentUserId)
      const r = await apiFetch('/sync/pair/create', {
        method: 'POST',
        body: JSON.stringify({
          display_name: displayName || currentUserId,
          local_user_id: currentUserId,
          progress: blob,
        }),
      })
      if (!r.ok) throw new Error(await r.text())
      const j = await r.json()
      setPairCode(j.code)
      setProfileId(j.profile_id)
      setHasToken(true)
      localStorage.setItem(SYNC_PROFILE_KEY, j.profile_id)
      localStorage.setItem(PAIR_TOKEN_KEY, j.token)
      showToast('ok', `Pairing code ready — enter it on your phone. Expires in ${j.expires_minutes || 15} min.`)
    } catch (e: any) {
      showToast('err', String(e?.message || e))
    } finally { setBusy(false) }
  }

  const joinPair = async () => {
    setBusy(true); setErr('')
    try {
      const code = joinCode.trim().toUpperCase()
      const r = await apiFetch('/sync/pair/join', {
        method: 'POST',
        body: JSON.stringify({ code, device_label: `phone-${currentUserId}` }),
      })
      if (!r.ok) throw new Error(await r.text())
      const j = await r.json()
      setProfileId(j.profile_id)
      setHasToken(true)
      localStorage.setItem(SYNC_PROFILE_KEY, j.profile_id)
      localStorage.setItem(PAIR_TOKEN_KEY, j.token)
      if (j.progress) applyBlob(j.progress)
      const now = new Date().toISOString()
      localStorage.setItem(LAST_PULL_KEY, now)
      setLastPull(now)
      showToast('ok', 'Joined — sync active. Progress pulled from Mac. Reloading…')
      setTimeout(() => window.location.reload(), 900)
    } catch (e: any) {
      showToast('err', `Join failed: ${String(e?.message || e)}`)
    } finally { setBusy(false) }
  }

  const pushProgress = async () => {
    const token = localStorage.getItem(PAIR_TOKEN_KEY)
    const pid = localStorage.getItem(SYNC_PROFILE_KEY)
    if (!token || !pid) { showToast('err', 'Pair first (create or join).'); return }
    setBusy(true); setErr('')
    try {
      const blob = collectLocalBlob(currentUserId)
      const r = await apiFetch('/sync/progress', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile_id: pid, progress: blob }),
      })
      if (!r.ok) throw new Error(await r.text())
      const now = new Date().toISOString()
      localStorage.setItem(LAST_PUSH_KEY, now)
      setLastPush(now)
      showToast('ok', 'Progress pushed to Mac.')
    } catch (e: any) {
      showToast('err', String(e?.message || e))
    } finally { setBusy(false) }
  }

  const pullProgress = async () => {
    const token = localStorage.getItem(PAIR_TOKEN_KEY)
    const pid = localStorage.getItem(SYNC_PROFILE_KEY)
    if (!token || !pid) { showToast('err', 'Pair first (create or join).'); return }
    setBusy(true); setErr('')
    try {
      const r = await apiFetch(`/sync/progress/${encodeURIComponent(pid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error(await r.text())
      const j = await r.json()
      if (j.progress) applyBlob(j.progress)
      const now = new Date().toISOString()
      localStorage.setItem(LAST_PULL_KEY, now)
      setLastPull(now)
      showToast('ok', 'Progress pulled. Reloading…')
      setTimeout(() => window.location.reload(), 900)
    } catch (e: any) {
      showToast('err', String(e?.message || e))
    } finally { setBusy(false) }
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const onThisMac = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
  const pageUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text)
    if (ok) showToast('ok', `Copied ${label}`)
    else showToast('err', `Could not copy automatically. Select and copy: ${text}`)
  }

  return (
    <div className="card syncCard">
      <img className="listenToolIcon" src="./assets/sync-icon.png" width={36} height={36} alt="" />
      <div className="h1">Pair your phone</div>
      <div className="h2">Same Wi‑Fi · Mac makes a code · phone types it</div>

      {paired ? (
        <div className="syncPairedBanner" role="status" aria-live="polite">
          <span className="syncPairedBadge">Synced</span>
          <div className="syncPairedMeta">
            <div><strong>Profile</strong> <code className="syncProfileId">{profileId}</code></div>
            <div className="small">Last push: {formatSyncTime(lastPush)}</div>
            <div className="small">Last pull: {formatSyncTime(lastPull)}</div>
          </div>
        </div>
      ) : (
        <div className="syncUnpairedBanner" role="status">
          <span className="syncUnpairedBadge">Not paired</span>
          <div className="small">Create a code on the Mac, or join with a code on the phone.</div>
        </div>
      )}

      <div className="sep" />

      <div className="syncUrlBox">
        <div className="small">Open this page on the phone (not “localhost”)</div>
        <div className="syncUrl">{pageUrl || '—'}</div>
        <button type="button" onClick={() => { void copy(pageUrl, 'page link') }} disabled={!pageUrl}>Copy page link</button>
        <div className="small" style={{ marginTop: 10 }}>API the app talks to</div>
        <div className="syncUrl">{apiBase}</div>
        <button type="button" onClick={() => { void copy(apiBase, 'API URL') }}>Copy API URL</button>
        <div className="small" style={{ marginTop: 8 }}>
          {onThisMac
            ? 'You are on the Mac. After ./run-local.sh, the terminal prints a http://192.168… link — use that on the phone.'
            : 'You are on another device. Stay on this link, then join with the code from the Mac.'}
        </div>
      </div>

      <ol className="syncSteps">
        <li>
          <div className="syncStepTitle">On the Mac</div>
          <div className="small">1. Same Wi‑Fi as the phone.</div>
          <div className="small">2. In the project folder, run <code>./run-local.sh</code>.</div>
          <div className="small">3. Open Sync and tap the button below. A big code appears.</div>
          <button type="button" className="btn-primary" style={{ marginTop: 8 }} disabled={busy} onClick={createPair}>
            {busy ? 'Working…' : 'Create pairing code'}
          </button>
        </li>
        <li>
          <div className="syncStepTitle">On the phone</div>
          <div className="small">1. Same Wi‑Fi. Do not use localhost.</div>
          <div className="small">2. Open the page link above (the 192.168… address).</div>
          <div className="small">3. Tap Sync, type the code, then Join.</div>
        </li>
      </ol>

      {pairCode && (
        <div className="pairCodeBox" aria-live="polite">
          <div className="small">Pairing code — type this on the phone</div>
          <div className="pairCode">{pairCode}</div>
          <button type="button" onClick={() => { void copy(pairCode, 'pairing code') }}>Copy code</button>
          {profileId && <div className="small" style={{ marginTop: 8 }}>Profile {profileId}</div>}
        </div>
      )}

      <div className="sep" />
      <div className="h2">Join with a code</div>
      <div className="small">On the phone, type the code from the Mac. Letters become capitals automatically.</div>
      <form
        className="syncJoin"
        onSubmit={e => { e.preventDefault(); if (joinCode.trim().length >= 4) void joinPair() }}
      >
        <input
          className="iosInputFix syncJoinInput"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="CODE"
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          inputMode="text"
          aria-label="Pairing code"
        />
        <button type="submit" className="btn-primary" disabled={busy || joinCode.trim().length < 4}>Join</button>
      </form>
      <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => { void health() }}>Check API</button>
      </div>

      <div className="sep" />
      <div className="small">Already paired? Push or pull progress.</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <button type="button" disabled={busy || !paired} onClick={pushProgress}>Push progress</button>
        <button type="button" disabled={busy || !paired} onClick={pullProgress}>Pull progress</button>
      </div>
      {status && <div className="okBanner" style={{ marginTop: 12 }}>{status}</div>}
      {err && <div className="teachBanner" style={{ marginTop: 12 }} role="alert">{err}</div>}

      {toast && (
        <div className={`syncToast syncToast-${toast.kind}`} role="status" aria-live="assertive">
          {toast.text}
        </div>
      )}
    </div>
  )
}
