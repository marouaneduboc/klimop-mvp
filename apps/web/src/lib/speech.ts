/** Web Speech helpers — synthesis (listen) + recognition (speak). */

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speakDutch(text: string, opts?: { rate?: number; onend?: () => void }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!canSpeak()) {
      reject(new Error('speechSynthesis not supported'))
      return
    }
    const synth = window.speechSynthesis
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'nl-NL'
    utter.rate = opts?.rate ?? 0.92
    const voices = synth.getVoices()
    const nl = voices.find(v => /nl(-|_)?(NL|BE)?/i.test(v.lang)) || voices.find(v => /dutch/i.test(v.name))
    if (nl) utter.voice = nl
    utter.onend = () => { opts?.onend?.(); resolve() }
    utter.onerror = () => resolve() // treat as soft fail
    synth.speak(utter)
  })
}

export function listenAudioUrl(vocabId: string): string {
  return `audio/listen/${vocabId}.mp3`
}

export async function playListenClip(vocabId: string, fallbackText: string, rate = 0.92): Promise<'mp3' | 'tts'> {
  const url = listenAudioUrl(vocabId)
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (res.ok) {
      const audio = new Audio(url)
      await audio.play()
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve()
        audio.onerror = () => resolve()
      })
      return 'mp3'
    }
  } catch { /* fall through */ }
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

function getRecogCtor(): RecogCtor | null {
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function canRecognize(): boolean {
  return typeof window !== 'undefined' && !!getRecogCtor()
}

export function recognizeDutch(timeoutMs = 8000): Promise<RecogResult> {
  return new Promise((resolve, reject) => {
    const Ctor = getRecogCtor()
    if (!Ctor) {
      reject(new Error('Speech recognition not supported — use Chrome/Edge or type the phrase.'))
      return
    }
    const recog = new Ctor()
    recog.lang = 'nl-NL'
    recog.continuous = false
    recog.interimResults = false
    recog.maxAlternatives = 3
    let done = false
    const timer = window.setTimeout(() => {
      if (done) return
      done = true
      try { recog.stop() } catch { /* */ }
      reject(new Error('Listening timed out — try again.'))
    }, timeoutMs)
    recog.onresult = (ev: any) => {
      if (done) return
      done = true
      clearTimeout(timer)
      const alt = ev.results?.[0]?.[0]
      resolve({ transcript: (alt?.transcript ?? '').trim(), confidence: alt?.confidence ?? 0 })
    }
    recog.onerror = (ev: any) => {
      if (done) return
      done = true
      clearTimeout(timer)
      reject(new Error(ev?.error || 'Recognition failed'))
    }
    recog.onend = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      reject(new Error('No speech detected'))
    }
    try { recog.start() } catch (e: any) {
      clearTimeout(timer)
      reject(e)
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
  const aw = a.split(' ')
  const bw = b.split(' ')
  let hit = 0
  for (const w of aw) if (bw.includes(w)) hit++
  const score = aw.length ? hit / aw.length : 0
  if (score >= 0.8) return { ok: true, score, detail: 'Close enough' }
  if (b.includes(a) || a.includes(b)) return { ok: true, score: Math.max(score, 0.85), detail: 'Contains phrase' }
  return { ok: false, score, detail: `Heard: “${heard}”` }
}
