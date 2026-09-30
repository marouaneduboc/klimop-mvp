/** Web Speech helpers — synthesis (listen) + recognition (speak). */

let speakGeneration = 0

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function stopSpeaking(): void {
  speakGeneration += 1
  if (canSpeak()) {
    try { window.speechSynthesis.cancel() } catch { /* */ }
  }
}

/** Wait briefly for async voice lists (Chrome/Safari often empty until voiceschanged). */
export function ensureVoices(timeoutMs = 600): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!canSpeak()) {
      resolve([])
      return
    }
    const synth = window.speechSynthesis
    const existing = synth.getVoices()
    if (existing.length) {
      resolve(existing)
      return
    }
    let done = false
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { synth.removeEventListener('voiceschanged', onChange) } catch { /* */ }
      resolve(voices)
    }
    const onChange = () => finish(synth.getVoices() || [])
    const timer = window.setTimeout(() => finish(synth.getVoices() || []), timeoutMs)
    try { synth.addEventListener('voiceschanged', onChange) } catch { /* */ }
    // Some engines only expose onvoiceschanged
    try {
      const anySynth = synth as SpeechSynthesis & { onvoiceschanged: (() => void) | null }
      anySynth.onvoiceschanged = onChange
    } catch { /* */ }
  })
}

export function pickDutchVoice(
  voices?: SpeechSynthesisVoice[],
  preferredName?: string,
): SpeechSynthesisVoice | null {
  const list = voices ?? (canSpeak() ? window.speechSynthesis.getVoices() : [])
  if (!list.length) return null
  if (preferredName) {
    const byName = list.find(v => v.name === preferredName)
    if (byName) return byName
  }
  const nlExact = list.find(v => /^nl(-|_ )?NL$/i.test(v.lang))
  const nlAny = list.find(v => /^nl\b/i.test(v.lang))
  const byDutchName = list.find(v => /dutch|nederlands|nederland/i.test(v.name))
  return nlExact || nlAny || byDutchName || null
}

function isBenignSpeechError(error: string | undefined): boolean {
  const e = (error || '').toLowerCase()
  return e === 'canceled' || e === 'cancelled' || e === 'interrupted'
}

type SpeakOpts = {
  rate?: number
  voiceName?: string
  onend?: () => void
  /** Cancel anything currently speaking before this utterance (default true). */
  cancelPrevious?: boolean
}

/**
 * Speak one Dutch utterance. Resolves when finished.
 * Rejects on unsupported / empty text / real synthesis errors (not user cancel).
 */
export function speakDutch(text: string, opts?: SpeakOpts): Promise<void> {
  const trimmed = (text || '').trim()
  if (!trimmed) return Promise.reject(new Error('Nothing to speak'))

  return (async () => {
    if (!canSpeak()) throw new Error('Browser TTS (speechSynthesis) is not supported on this device.')

    const myGen = opts?.cancelPrevious === false ? speakGeneration : (speakGeneration += 1)
    const synth = window.speechSynthesis

    if (opts?.cancelPrevious !== false) {
      try { synth.cancel() } catch { /* */ }
      // Chrome often drops the next utter if speak() follows cancel() too quickly.
      await new Promise<void>(r => setTimeout(r, 50))
      if (myGen !== speakGeneration) return
    }

    const voices = await ensureVoices()
    if (myGen !== speakGeneration) return

    // Chrome long-utterance pause bug: keep synthesis awake.
    try { if (synth.paused) synth.resume() } catch { /* */ }

    await new Promise<void>((resolve, reject) => {
      if (myGen !== speakGeneration) {
        resolve()
        return
      }
      const utter = new SpeechSynthesisUtterance(trimmed)
      utter.lang = 'nl-NL'
      utter.rate = opts?.rate ?? 0.92
      const voice = pickDutchVoice(voices, opts?.voiceName)
      if (voice) utter.voice = voice

      let settled = false
      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      utter.onend = () => {
        opts?.onend?.()
        settle(resolve)
      }
      utter.onerror = (ev) => {
        const errName = (ev as SpeechSynthesisErrorEvent)?.error
        if (myGen !== speakGeneration || isBenignSpeechError(errName)) {
          settle(resolve)
          return
        }
        settle(() => reject(new Error(
          errName === 'not-allowed'
            ? 'Speech was blocked — tap Read aloud again (browsers require a user gesture).'
            : `Speech failed (${errName || 'error'}). Try Chrome/Safari with a Dutch voice installed.`,
        )))
      }

      try {
        synth.speak(utter)
        // Chrome sometimes leaves synthesis paused after cancel.
        try { if (synth.paused) synth.resume() } catch { /* */ }
      } catch (e: unknown) {
        settle(() => reject(e instanceof Error ? e : new Error(String(e))))
      }
    })
  })()
}

/** Speak multiple Dutch lines in order without cancelling between lines. */
export async function speakDutchLines(
  lines: string[],
  opts?: Omit<SpeakOpts, 'cancelPrevious' | 'onend'> & {
    onLineStart?: (index: number, line: string) => void
  },
): Promise<void> {
  const parts = (lines || []).map(l => (l || '').trim()).filter(Boolean)
  if (!parts.length) throw new Error('Nothing to read')
  if (!canSpeak()) throw new Error('Browser TTS (speechSynthesis) is not supported on this device.')

  const myGen = (speakGeneration += 1)
  const synth = window.speechSynthesis
  try { synth.cancel() } catch { /* */ }
  await new Promise<void>(r => setTimeout(r, 50))
  if (myGen !== speakGeneration) return

  const voices = await ensureVoices()
  const voice = pickDutchVoice(voices, opts?.voiceName)
  const rate = opts?.rate ?? 0.92

  for (let i = 0; i < parts.length; i++) {
    if (myGen !== speakGeneration) return
    opts?.onLineStart?.(i, parts[i])
    await new Promise<void>((resolve, reject) => {
      if (myGen !== speakGeneration) {
        resolve()
        return
      }
      const utter = new SpeechSynthesisUtterance(parts[i])
      utter.lang = 'nl-NL'
      utter.rate = rate
      if (voice) utter.voice = voice

      let settled = false
      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      utter.onend = () => settle(resolve)
      utter.onerror = (ev) => {
        const errName = (ev as SpeechSynthesisErrorEvent)?.error
        if (myGen !== speakGeneration || isBenignSpeechError(errName)) {
          settle(resolve)
          return
        }
        settle(() => reject(new Error(
          errName === 'not-allowed'
            ? 'Speech was blocked — tap Read aloud again (browsers require a user gesture).'
            : `Speech failed (${errName || 'error'}). Try Chrome/Safari with a Dutch voice installed.`,
        )))
      }

      try {
        synth.speak(utter)
        try { if (synth.paused) synth.resume() } catch { /* */ }
      } catch (e: unknown) {
        settle(() => reject(e instanceof Error ? e : new Error(String(e))))
      }
    })
  }
}

export function listenAudioUrl(vocabId: string): string {
  // Resolve against the document base so relative Vite `base: './'` stays correct on LAN/HTTPS.
  try {
    return new URL(`audio/listen/${encodeURIComponent(vocabId)}.mp3`, document.baseURI).href
  } catch {
    return `audio/listen/${encodeURIComponent(vocabId)}.mp3`
  }
}

/** In-memory probe cache — most vocab has no MP3; skip repeat HEAD waits. */
const listenMp3Present = new Set<string>()
const listenMp3Missing = new Set<string>()

function isAudioContentType(ct: string): boolean {
  const c = (ct || '').toLowerCase()
  return c.includes('audio') || c.includes('mpeg') || c.includes('mp3') || c.includes('ogg') || c.includes('wav')
}

/**
 * Quick existence probe for listen MP3s.
 * Abort fast: Vite SPA can return 200 HTML for missing paths; never wait long on that.
 */
async function probeListenMp3(url: string, timeoutMs = 400): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, cache: 'no-cache' })
    if (!res.ok) return false
    const ct = res.headers.get('content-type') || ''
    // SPA/HTML fallback must never count as a clip.
    if (!isAudioContentType(ct)) return false
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Play a listen clip. Prefers public/audio/listen/{id}.mp3 when it is real audio;
 * otherwise browser TTS.
 *
 * Important: Vite SPA fallback can serve index.html with HTTP 200 for missing paths.
 * Probe with a short abort + audio Content-Type check, cache misses, then TTS quickly.
 */
export async function playListenClip(vocabId: string, fallbackText: string, rate = 0.92): Promise<'mp3' | 'tts'> {
  const url = listenAudioUrl(vocabId)

  let tryMp3 = !listenMp3Missing.has(vocabId)
  if (tryMp3 && !listenMp3Present.has(vocabId)) {
    const ok = await probeListenMp3(url, 400)
    if (ok) listenMp3Present.add(vocabId)
    else {
      listenMp3Missing.add(vocabId)
      tryMp3 = false
    }
  }

  if (tryMp3) {
    try {
      const audio = new Audio(url)
      await audio.play()
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const done = (fn: () => void) => {
          if (settled) return
          settled = true
          fn()
        }
        audio.onended = () => done(resolve)
        audio.onerror = () => done(() => reject(new Error('Audio playback failed')))
        // Safety: don't hang forever if neither event fires.
        window.setTimeout(() => done(resolve), 12_000)
      })
      return 'mp3'
    } catch {
      listenMp3Present.delete(vocabId)
      listenMp3Missing.add(vocabId)
      /* fall through to TTS */
    }
  }

  await speakDutch(fallbackText, { rate })
  return 'tts'
}

export type RecogResult = { transcript: string; confidence: number }

type RecogCtor = new () => SpeechRecognitionLike
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((ev: any) => void) | null
  onerror: ((ev: any) => void) | null
  onend: (() => void) | null
}

let activeRecog: SpeechRecognitionLike | null = null

function getRecogCtor(): RecogCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/** True when Web Speech Recognition API exists (Chrome/Edge; Safari often partial). */
export function canRecognize(): boolean {
  return !!getRecogCtor()
}

/** Mic recognition needs a secure context (HTTPS or localhost). Plain LAN http://192.168.x.x usually blocks it. */
export function recognitionSecureOk(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.isSecureContext) return true
    const h = window.location.hostname
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
  } catch {
    return false
  }
}

export function recognitionSupportMessage(): string | null {
  if (!canRecognize()) {
    return 'Speech recognition is not available in this browser (common on Safari desktop). Use Skip, or open in Chrome/Edge on HTTPS.'
  }
  if (!recognitionSecureOk()) {
    return 'Microphone speech needs HTTPS (or localhost). Use Skip, or open via the local HTTPS URL.'
  }
  return null
}

function mapRecogError(code: string | undefined): string {
  const c = (code || '').toLowerCase()
  if (c === 'not-allowed' || c === 'service-not-allowed') {
    return 'Microphone permission denied — allow mic for this site, then try Speak again.'
  }
  if (c === 'no-speech') return 'No speech detected — try Speak again.'
  if (c === 'audio-capture') return 'No microphone found — check device settings.'
  if (c === 'network') return 'Speech service network error (common offline / some Safari builds). Try again or Skip.'
  if (c === 'aborted') return 'Listening stopped.'
  if (c === 'language-not-supported') return 'Dutch (nl-NL) not supported by this browser’s recognizer — try Chrome/Edge.'
  return code ? `Recognition failed (${code}). Try again or Skip.` : 'Recognition failed — try again or Skip.'
}

export function stopRecognizing(): void {
  const r = activeRecog
  activeRecog = null
  if (!r) return
  try { r.onresult = null; r.onerror = null; r.onend = null } catch { /* */ }
  try { r.abort() } catch {
    try { r.stop() } catch { /* */ }
  }
}

async function ensureMicPermission(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    for (const t of stream.getTracks()) t.stop()
  } catch (e: any) {
    const name = String(e?.name || e?.message || e)
    if (/notallowed|permission|denied/i.test(name)) {
      throw new Error('Microphone permission denied — allow mic for this site, then try Speak again.')
    }
    // Some browsers expose SpeechRecognition without getUserMedia — continue.
  }
}

export async function recognizeDutch(timeoutMs = 9000): Promise<RecogResult> {
  const Ctor = getRecogCtor()
  if (!Ctor) {
    throw new Error('Speech recognition not supported in this browser.')
  }
  if (!recognitionSecureOk()) {
    throw new Error('Microphone speech needs HTTPS or localhost.')
  }

  stopRecognizing()
  await ensureMicPermission()

  return new Promise((resolve, reject) => {
    const recog = new Ctor()
    activeRecog = recog
    recog.lang = 'nl-NL'
    recog.continuous = false
    recog.interimResults = true
    recog.maxAlternatives = 3
    let done = false
    let best = ''
    let bestConf = 0

    const finish = (fn: () => void) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (activeRecog === recog) activeRecog = null
      try { recog.onresult = null; recog.onerror = null; recog.onend = null } catch { /* */ }
      fn()
    }

    const timer = window.setTimeout(() => {
      try { recog.stop() } catch { /* */ }
      // Give onend a moment; if still open, settle with best interim or timeout.
      window.setTimeout(() => {
        if (done) return
        if (best) finish(() => resolve({ transcript: best, confidence: bestConf }))
        else finish(() => reject(new Error('Speech timed out — try Speak again.')))
      }, 200)
    }, timeoutMs)

    recog.onresult = (ev: any) => {
      try {
        for (let i = ev.resultIndex ?? 0; i < (ev.results?.length ?? 0); i++) {
          const res = ev.results[i]
          const alt = res?.[0]
          const t = (alt?.transcript ?? '').trim()
          if (!t) continue
          const conf = typeof alt?.confidence === 'number' ? alt.confidence : bestConf
          if (t.length >= best.length) {
            best = t
            bestConf = conf
          }
          if (res.isFinal) {
            finish(() => {
              try { recog.stop() } catch { /* */ }
              resolve({ transcript: t, confidence: conf })
            })
            return
          }
        }
      } catch { /* */ }
    }

    recog.onerror = (ev: any) => {
      const code = ev?.error as string | undefined
      if (code === 'aborted') {
        finish(() => reject(new Error('Listening stopped.')))
        return
      }
      // If we already have interim text, prefer that over a soft no-speech.
      if ((code === 'no-speech' || code === 'network') && best) {
        finish(() => resolve({ transcript: best, confidence: bestConf }))
        return
      }
      finish(() => reject(new Error(mapRecogError(code))))
    }

    recog.onend = () => {
      if (done) return
      if (best) finish(() => resolve({ transcript: best, confidence: bestConf }))
      else finish(() => reject(new Error('No speech detected — try again or type the phrase.')))
    }

    try {
      recog.start()
    } catch (e: any) {
      finish(() => reject(new Error(e?.message || mapRecogError(String(e)))))
    }
  })
}

/** Normalize Dutch text for fuzzy compare (lowercase, strip punct, collapse spaces). */
export function normNl(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function scorePhrase(expected: string, heard: string): { ok: boolean; score: number; detail: string } {
  const a = normNl(expected)
  const b = normNl(heard)
  if (!b) return { ok: false, score: 0, detail: 'Nothing heard' }
  if (a === b) return { ok: true, score: 1, detail: 'Exact match' }
  const aw = a.split(' ').filter(Boolean)
  const bw = b.split(' ').filter(Boolean)
  let hit = 0
  for (const w of aw) if (bw.includes(w)) hit++
  const score = aw.length ? hit / aw.length : 0
  if (score >= 0.75) return { ok: true, score, detail: 'Close enough' }
  if (b.includes(a) || a.includes(b)) return { ok: true, score: Math.max(score, 0.85), detail: 'Contains phrase' }
  return { ok: false, score, detail: `Heard: “${heard}”` }
}
