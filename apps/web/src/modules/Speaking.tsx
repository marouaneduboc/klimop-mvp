import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [fallback, setFallback] = useState('')
  const [result, setResult] = useState<{ ok: boolean; detail: string; score: number } | null>(null)
  const [score, setScore] = useState({ ok: 0, n: 0 })
  const [micHint, setMicHint] = useState<string | null>(() => recognitionSupportMessage())
  const inputRef = useRef<HTMLInputElement>(null)
  const supported = canRecognize() && recognitionSecureOk()
  const cur = phrases[idx % Math.max(1, phrases.length)]

  useEffect(() => () => { stopRecognizing() }, [])

  const next = () => {
    stopRecognizing()
    setListening(false)
    setResult(null)
    setFallback('')
    setMicHint(recognitionSupportMessage())
    setIdx(i => i + 1)
  }

  const hearModel = () => {
    if (!cur) return
    speak(cur.nl).catch(() => speakDutch(cur.nl))
  }

  const focusType = () => {
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  const startMic = async () => {
    if (!cur) return
    const supportMsg = recognitionSupportMessage()
    if (supportMsg) {
      setMicHint(supportMsg)
      setResult({ ok: false, detail: supportMsg, score: 0 })
      focusType()
      return
    }
    setResult(null)
    setMicHint(null)
    setListening(true)
    try {
      const r = await recognizeDutch(9000)
      const scored = scorePhrase(cur.nl, r.transcript)
      setResult(scored)
      setScore(s => ({ ok: s.ok + (scored.ok ? 1 : 0), n: s.n + 1 }))
    } catch (e: any) {
      const detail = e?.message || 'Mic failed — type the phrase below.'
      setResult({ ok: false, detail, score: 0 })
      setMicHint(detail)
      focusType()
    } finally {
      setListening(false)
    }
  }

  const stopMic = () => {
    stopRecognizing()
    setListening(false)
  }

  const checkTyped = () => {
    if (!cur || !fallback.trim()) return
    const scored = scorePhrase(cur.nl, fallback)
    setResult(scored)
    setScore(s => ({ ok: s.ok + (scored.ok ? 1 : 0), n: s.n + 1 }))
  }

  if (!cur) return <div className="card">No phrases.</div>

  return (
    <div className="card speakCard">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <img className="listenToolIcon" src="./assets/speak-icon.png" width={36} height={36} alt="" />
          <div className="h1" style={{ marginBottom: 4 }}>Speaking</div>
          <div className="h2">Say it out loud · score · or type</div>
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
          <button type="button" className="btn-primary" disabled={!supported} onClick={() => { void startMic() }} title={supported ? 'Speak in Dutch' : 'Mic unavailable — type below'}>
            🎤 Speak
          </button>
        )}
        <button type="button" onClick={next}>Skip</button>
      </div>
      {!!micHint && (
        <div className="teachBanner" style={{ marginTop: 10 }} role="status">{micHint}</div>
      )}
      <div className="speakFallback" style={{ marginTop: 14 }}>
        <div className="small" style={{ width: '100%', marginBottom: 6 }}>
          {supported ? 'Or type the phrase (always works):' : 'Type the phrase to practise (mic unavailable):'}
        </div>
        <form
          className="listenTypeForm"
          style={{ marginTop: 0, width: '100%' }}
          onSubmit={e => { e.preventDefault(); checkTyped() }}
        >
          <input
            ref={inputRef}
            className="iosInputFix listenTypeInput"
            value={fallback}
            onChange={e => setFallback(e.target.value)}
            placeholder="Type the Dutch phrase…"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            enterKeyHint="done"
          />
          <button type="submit" className="btn-primary" disabled={!fallback.trim()}>Check</button>
        </form>
      </div>
      {result && (
        <div className={result.ok ? 'okBanner' : 'teachBanner'} style={{ marginTop: 12 }}>
          {result.ok ? `Goed! (${Math.round(result.score * 100)}%)` : result.detail}
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
            {!result.ok && supported && (
              <button type="button" onClick={() => { setResult(null); void startMic() }}>Retry mic</button>
            )}
            {!result.ok && (
              <button type="button" onClick={() => { setResult(null); focusType() }}>Edit typed</button>
            )}
            <button type="button" className="btn-primary" onClick={next}>Next</button>
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
  const [fallback, setFallback] = useState('')
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null)
  const [hint, setHint] = useState<string | null>(() => recognitionSupportMessage())
  const supported = canRecognize() && recognitionSecureOk()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    speak(phrase.nl).catch(() => speakDutch(phrase.nl))
    return () => { stopRecognizing() }
  }, [phrase.nl])

  const finish = (ok: boolean, detail: string) => {
    setResult({ ok, detail })
    setTimeout(() => onDone(ok), ok ? 900 : 1800)
  }

  return (
    <div className="speakSlice">
      <div className="small" style={{ marginBottom: 8 }}>Speaking · say this phrase</div>
      <div className="speakNl">{phrase.nl}</div>
      {phrase.en && <div className="small">{phrase.en}</div>}
      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => speak(phrase.nl).catch(() => speakDutch(phrase.nl))}>🔊</button>
        {listening ? (
          <button type="button" className="btn-primary" onClick={() => { stopRecognizing(); setListening(false) }}>⏹</button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            disabled={!supported || !!result}
            onClick={async () => {
              const msg = recognitionSupportMessage()
              if (msg) {
                setHint(msg)
                inputRef.current?.focus()
                return
              }
              setListening(true)
              setHint(null)
              try {
                const r = await recognizeDutch(8000)
                const s = scorePhrase(phrase.nl, r.transcript)
                finish(s.ok, s.detail)
              } catch (e: any) {
                setHint(e?.message || 'Try typing')
                inputRef.current?.focus()
              } finally {
                setListening(false)
              }
            }}
          >🎤</button>
        )}
      </div>
      {!!hint && <div className="small" style={{ marginTop: 8 }}>{hint}</div>}
      <form
        className="speakFallback"
        style={{ marginTop: 8 }}
        onSubmit={e => {
          e.preventDefault()
          if (!fallback.trim() || result) return
          const s = scorePhrase(phrase.nl, fallback)
          finish(s.ok, s.detail)
        }}
      >
        <input
          ref={inputRef}
          className="iosInputFix listenTypeInput"
          value={fallback}
          onChange={e => setFallback(e.target.value)}
          placeholder="Type the phrase…"
          disabled={!!result}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button type="submit" className="btn-primary" disabled={!fallback.trim() || !!result}>Check</button>
      </form>
      {result && <div className={result.ok ? 'okBanner' : 'teachBanner'} style={{ marginTop: 8 }}>{result.ok ? 'Goed!' : result.detail}</div>}
    </div>
  )
}
