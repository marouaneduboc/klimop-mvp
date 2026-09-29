import { useEffect, useMemo, useState } from 'react'
import { canRecognize, recognizeDutch, scorePhrase, speakDutch } from '../lib/speech'

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
  const supported = canRecognize()
  const cur = phrases[idx % Math.max(1, phrases.length)]

  const next = () => {
    setResult(null)
    setFallback('')
    setIdx(i => i + 1)
  }

  const hearModel = () => {
    if (!cur) return
    speak(cur.nl).catch(() => speakDutch(cur.nl))
  }

  const startMic = async () => {
    if (!cur) return
    setResult(null)
    setListening(true)
    try {
      const r = await recognizeDutch(9000)
      const scored = scorePhrase(cur.nl, r.transcript)
      setResult(scored)
      setScore(s => ({ ok: s.ok + (scored.ok ? 1 : 0), n: s.n + 1 }))
    } catch (e: any) {
      setResult({ ok: false, detail: e?.message || 'Mic failed — type instead', score: 0 })
    } finally {
      setListening(false)
    }
  }

  const checkTyped = () => {
    if (!cur) return
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
          <div className="h2">Say it out loud · score · retry</div>
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
        <button type="button" className="btn-primary" disabled={listening || !supported} onClick={startMic}>
          {listening ? 'Listening…' : '🎤 Speak'}
        </button>
        <button type="button" onClick={next}>Skip</button>
      </div>
      {!supported && (
        <div className="small" style={{ marginTop: 10 }}>
          Speech recognition needs Chrome/Edge (or Safari with permission). Type the phrase below as fallback.
        </div>
      )}
      <div className="speakFallback">
        <input
          className="iosInputFix listenTypeInput"
          value={fallback}
          onChange={e => setFallback(e.target.value)}
          placeholder="Or type the phrase…"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button type="button" className="btn-primary" disabled={!fallback.trim()} onClick={checkTyped}>Check</button>
      </div>
      {result && (
        <div className={result.ok ? 'okBanner' : 'teachBanner'} style={{ marginTop: 12 }}>
          {result.ok ? `Goed! (${Math.round(result.score * 100)}%)` : result.detail}
          <div className="row" style={{ marginTop: 10 }}>
            {!result.ok && <button type="button" onClick={() => { setResult(null); startMic() }}>Retry</button>}
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
  const supported = canRecognize()

  useEffect(() => {
    speak(phrase.nl).catch(() => speakDutch(phrase.nl))
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
        <button type="button" className="btn-primary" disabled={listening || !supported || !!result} onClick={async () => {
          setListening(true)
          try {
            const r = await recognizeDutch(8000)
            const s = scorePhrase(phrase.nl, r.transcript)
            finish(s.ok, s.detail)
          } catch (e: any) {
            finish(false, e?.message || 'Try typing')
          } finally {
            setListening(false)
          }
        }}>{listening ? '…' : '🎤'}</button>
      </div>
      <div className="speakFallback" style={{ marginTop: 8 }}>
        <input className="iosInputFix listenTypeInput" value={fallback} onChange={e => setFallback(e.target.value)} placeholder="Type fallback…" disabled={!!result} />
        <button type="button" disabled={!fallback.trim() || !!result} onClick={() => {
          const s = scorePhrase(phrase.nl, fallback)
          finish(s.ok, s.detail)
        }}>Check</button>
      </div>
      {result && <div className={result.ok ? 'okBanner' : 'teachBanner'} style={{ marginTop: 8 }}>{result.ok ? 'Goed!' : result.detail}</div>}
    </div>
  )
}
