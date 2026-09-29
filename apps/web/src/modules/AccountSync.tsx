import { useEffect, useState } from 'react'
import { apiFetch, defaultApiBase } from '../lib/apiBase'

const PAIR_TOKEN_KEY = 'klimop.pairToken.v1'
const SYNC_PROFILE_KEY = 'klimop.syncProfileId.v1'

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
  const [pairCode, setPairCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [profileId, setProfileId] = useState(() => localStorage.getItem(SYNC_PROFILE_KEY) || '')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setApiBase(defaultApiBase()) }, [])

  const health = async () => {
    setErr(''); setStatus('Checking API…')
    try {
      const r = await fetch(`${apiBase}/health`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      setStatus(`API OK · ${j.service || 'klimop'} · ${apiBase}`)
    } catch (e: any) {
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
      localStorage.setItem(SYNC_PROFILE_KEY, j.profile_id)
      localStorage.setItem(PAIR_TOKEN_KEY, j.token)
      setStatus(`Pairing code ready — enter it on your phone. Expires in ${j.expires_minutes || 15} min.`)
    } catch (e: any) {
      setErr(String(e?.message || e))
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
      localStorage.setItem(SYNC_PROFILE_KEY, j.profile_id)
      localStorage.setItem(PAIR_TOKEN_KEY, j.token)
      if (j.progress) applyBlob(j.progress)
      setStatus('Joined — progress pulled from Mac. Reloading…')
      setTimeout(() => window.location.reload(), 600)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally { setBusy(false) }
  }

  const pushProgress = async () => {
    const token = localStorage.getItem(PAIR_TOKEN_KEY)
    const pid = localStorage.getItem(SYNC_PROFILE_KEY)
    if (!token || !pid) { setErr('Pair first (create or join).'); return }
    setBusy(true); setErr('')
    try {
      const blob = collectLocalBlob(currentUserId)
      const r = await apiFetch('/sync/progress', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile_id: pid, progress: blob }),
      })
      if (!r.ok) throw new Error(await r.text())
      setStatus('Progress pushed to Mac.')
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally { setBusy(false) }
  }

  const pullProgress = async () => {
    const token = localStorage.getItem(PAIR_TOKEN_KEY)
    const pid = localStorage.getItem(SYNC_PROFILE_KEY)
    if (!token || !pid) { setErr('Pair first (create or join).'); return }
    setBusy(true); setErr('')
    try {
      const r = await apiFetch(`/sync/progress/${encodeURIComponent(pid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error(await r.text())
      const j = await r.json()
      if (j.progress) applyBlob(j.progress)
      setStatus('Progress pulled. Reloading…')
      setTimeout(() => window.location.reload(), 600)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally { setBusy(false) }
  }

  return (
    <div className="card syncCard">
      <img className="listenToolIcon" src="./assets/sync-icon.png" width={36} height={36} alt="" />
        <div className="h1">Account sync</div>
      <div className="h2">Local-first · pair phone ↔ Mac on your LAN</div>
      <div className="sep" />
      <div className="small">API: <code>{apiBase}</code></div>
      <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={health}>Check API</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={createPair}>Create pairing code (this Mac)</button>
      </div>
      {pairCode && (
        <div className="pairCodeBox" aria-live="polite">
          <div className="small">Enter on phone</div>
          <div className="pairCode">{pairCode}</div>
          {profileId && <div className="small">Profile {profileId}</div>}
        </div>
      )}
      <div className="sep" />
      <div className="h2">Join from phone</div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          className="iosInputFix listenTypeInput"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ABCD12"
          maxLength={8}
          autoCapitalize="characters"
        />
        <button type="button" className="btn-primary" disabled={busy || joinCode.trim().length < 4} onClick={joinPair}>Join & migrate</button>
      </div>
      <div className="sep" />
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button type="button" disabled={busy || !profileId} onClick={pushProgress}>Push progress</button>
        <button type="button" disabled={busy || !profileId} onClick={pullProgress}>Pull progress</button>
      </div>
      {status && <div className="okBanner" style={{ marginTop: 12 }}>{status}</div>}
      {err && <div className="teachBanner" style={{ marginTop: 12 }}>{err}</div>}
      <div className="small" style={{ marginTop: 12 }}>
        On join, this device imports the Mac profile blob (reviews, stats, settings). Keep both on the same Wi‑Fi.
      </div>
    </div>
  )
}
