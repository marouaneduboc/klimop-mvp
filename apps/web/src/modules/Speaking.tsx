import { useEffect, useMemo, useRef, useState } from 'react'
import { playSoftMiss, playSoftSuccess, unlockSfx } from '../lib/sfx'
import {
  canRecognize,
  recognitionSecureOk,
  recognitionSupportMessage,
  recognizeDutch,
  scorePhrase,
  speakDutch,
  stopRecognizing,
} from '../lib/speech'

type Vocab = { id: string; theme: number; nl: string; en?: string | null; article?: 'de' | 'het' | null }
type Course = { themes: { id: number; title: string }[]; vocab: Vocab[] }

const STARTER_PHRASES = [
  { id: 'ph_hallo', nl: 'Hallo, hoe gaat het?', en: 'Hi, how are you?' },
  { id: 'ph_naam', nl: 'Ik heet Sam.', en: 'My name is Sam.' },
  { id: 'ph_dank', nl: 'Dank je wel.', en: 'Thank you.' },
  { id: 'ph_alsjeblieft', nl: 'Alsjeblieft.', en: 'Please / here you are.' },
  { id: 'ph_waar', nl: 'Waar is het station?', en: 'Where is the station?' },
  { id: 'ph_koffie', nl: 'Mag ik een koffie?', en: 'Can I have a coffee?' },
  { id: 'ph_fiets', nl: 'Ik ga met de fiets.', en: 'I go by bike.' },
  { id: 'ph_totzien', nl: 'Tot ziens!', en: 'Goodbye!' },
]

type Phrase = { id: string; nl: string; en: string }

const ADVANCE_OK_MS = 750
const ADVANCE_MISS_MS = 1600

export default function Speaking({ course, speak }: { course: Course | null; speak: (t: string) => Promise<void> }) {
  const phrases: Phrase[] = useMemo(() => {
    const fromVocab: Phrase[] = (course?.vocab || [])
      .filter(v => v.nl && v.nl.length >= 3 && v.nl.length <= 28)
      .slice(0, 60)
      .map(v => ({
        id: v.id,
        nl: v.article ? `${v.article} ${v.nl}` : v.nl,
        en: v.en || '',
      }))
    return [...STARTER_PHRASES, ...fromVocab]
  }, [course])

  const [idx, setIdx] = useState(0)
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; detail: string; score: number } | null>(null)
  const [score, setScore] = useState({ ok: 0, n: 0 })
  const [micHint, setMicHint] = useState<string | null>(() => recognitionSupportMessage())
  const [supported, setSupported] = useState(() => canRecognize() && recognitionSecureOk())
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cur = phrases[idx % Math.max(1, phrases.length)]

  const clearAdvance = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }

  useEffect(() => {
    const refresh = () => {
      setSupported(canRecognize() && recognitionSecureOk())
      setMicHint(recognitionSupportMessage())
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      clearAdvance()
      stopRecognizing()
    }
  }, [])

  const next = () => {
    clearAdvance()
    stopRecognizing()
    setListening(false)
    setResult(null)
    setMicHint(recognitionSupportMessage())
    setIdx(i => i + 1)
  }

  const scheduleAdvance = (ok: boolean) => {
    clearAdvance()
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      next()
    }, ok ? ADVANCE_OK_MS : ADVANCE_MISS_MS)
  }

  const applyGrade = (scored: { ok: boolean; detail: string; score: number }) => {
    setResult(scored)
    setScore(s => ({ ok: s.ok + (scored.ok ? 1 : 0), n: s.n + 1 }))
    if (scored.ok) playSoftSuccess()
    else playSoftMiss()
    // Auto-advance after success; brief pause on miss then still advance so flow stays moving.
    scheduleAdvance(scored.ok)
  }

  const hearModel = () => {
    unlockSfx()
    if (!cur) return
    speak(cur.nl).catch(() => speakDutch(cur.nl))
  }

  const startMic = async () => {
    if (!cur) return
    unlockSfx()
    const supportMsg = recognitionSupportMessage()
    if (supportMsg) {
      setMicHint(supportMsg)
      setResult({ ok: false, detail: supportMsg, score: 0 })
      return
    }
    clearAdvance()
    setResult(null)
    setMicHint(null)
    setListening(true)
    try {
      const r = await recognizeDutch(9000)
      applyGrade(scorePhrase(cur.nl, r.transcript))
    } catch (e: any) {
      const detail = e?.message || 'Mic failed — try again or Skip.'
      setResult({ ok: false, detail, score: 0 })
      setMicHint(detail)
      playSoftMiss()
    } finally {
      setListening(false)
    }
  }

  const stopMic = () => {
    stopRecognizing()
    setListening(false)
  }

  /** Manual credit when mic is unavailable but the learner said it aloud. */
  const iSaidIt = () => {
    if (!cur || result?.ok) return
    unlockSfx()
    clearAdvance()
    applyGrade({ ok: true, detail: 'Marked as said', score: 1 })
  }

  if (!cur) return <div className="card">No phrases.</div>

  return (
    <div className="card speakCard">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <img className="listenToolIcon" src="./assets/speak-icon.png" width={36} height={36} alt="" />
          <div className="h1" style={{ marginBottom: 4 }}>Speaking</div>
          <div className="h2">Hear the model · say it out loud · score</div>
        </div>
        <div className="pill">{score.ok}/{score.n}</div>
      </div>
      <div className="sep" />
      <div className="speakPrompt">
        <div className="speakNl">{cur.nl}</div>
        {cur.en && <div className="small">{cur.en}</div>}
      </div>
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={hearModel}>🔊 Model</button>
        {listening ? (
          <button type="button" className="btn-primary" onClick={stopMic}>⏹ Stop</button>
        ) : (
          <button type="button" className="btn-primary" disabled={!supported || !!result?.ok} onClick={() => { void startMic() }} title={supported ? 'Speak in Dutch' : 'Mic unavailable'}>
            🎤 Speak
          </button>
        )}
        <button type="button" onClick={next}>Skip</button>
        {!supported && (
          <button type="button" className="pill speakSaidPill" onClick={iSaidIt} title="Credit yourself if you said it aloud">I said it</button>
        )}
      </div>
      {!!micHint && (
        <div className="teachBanner" style={{ marginTop: 10 }} role="status">{micHint}</div>
      )}
      {result && (
        <div className={result.ok ? 'okBanner' : 'teachBanner'} style={{ marginTop: 12 }}>
          {result.ok ? `Goed! (${Math.round(result.score * 100)}%)` : result.detail}
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
            {!result.ok && supported && (
              <button type="button" onClick={() => { clearAdvance(); setResult(null); void startMic() }}>Retry mic</button>
            )}
            {!result.ok && !supported && (
              <button type="button" onClick={iSaidIt}>I said it</button>
            )}
            <button type="button" className="btn-primary" onClick={next}>{result.ok ? 'Next…' : 'Next'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SpeakingSlice({
  phrase,
  onDone,
  speak,
}: {
  phrase: { nl: string; en?: string }
  onDone: (correct: boolean) => void
  speak: (t: string) => Promise<void>
}) {
  const [listening, setListening] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null)
  const [hint, setHint] = useState<string | null>(() => recognitionSupportMessage())
  const [supported, setSupported] = useState(() => canRecognize() && recognitionSecureOk())
  const doneRef = useRef(false)

  useEffect(() => {
    const refresh = () => {
      setSupported(canRecognize() && recognitionSecureOk())
      setHint(recognitionSupportMessage())
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    speak(phrase.nl).catch(() => speakDutch(phrase.nl))
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      stopRecognizing()
    }
  }, [phrase.nl])

  const finish = (ok: boolean, detail: string) => {
    if (doneRef.current) return
    doneRef.current = true
    setResult({ ok, detail })
    if (ok) playSoftSuccess()
    else playSoftMiss()
    setTimeout(() => onDone(ok), ok ? ADVANCE_OK_MS : ADVANCE_MISS_MS)
  }

  return (
    <div className="speakSlice">
      <div className="small" style={{ marginBottom: 8 }}>Speaking · say this phrase</div>
      <div className="speakNl">{phrase.nl}</div>
      {phrase.en && <div className="small">{phrase.en}</div>}
      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => { unlockSfx(); speak(phrase.nl).catch(() => speakDutch(phrase.nl)) }}>🔊</button>
        {listening ? (
          <button type="button" className="btn-primary" onClick={() => { stopRecognizing(); setListening(false) }}>⏹</button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={!supported || !!result}
            onClick={async () => {
              unlockSfx()
              const msg = recognitionSupportMessage()
              if (msg) {
                setHint(msg)
                return
              }
              setListening(true)
              setHint(null)
              try {
                const r = await recognizeDutch(8000)
                const s = scorePhrase(phrase.nl, r.transcript)
                finish(s.ok, s.detail)
              } catch (e: any) {
                setHint(e?.message || 'Try again')
                playSoftMiss()
              } finally {
                setListening(false)
              }
            }}
          >🎤</button>
        )}
        {!supported && !result && (
          <button type="button" className="pill speakSaidPill" onClick={() => finish(true, 'Marked as said')}>I said it</button>
        )}
        <button type="button" disabled={!!result} onClick={() => finish(false, 'Skipped')}>Skip</button>
      </div>
      {!!hint && <div className="small" style={{ marginTop: 8 }}>{hint}</div>}
      {result && <div className={result.ok ? 'okBanner' : 'teachBanner'} style={{ marginTop: 8 }}>{result.ok ? 'Goed!' : result.detail}</div>}
    </div>
  )
}
