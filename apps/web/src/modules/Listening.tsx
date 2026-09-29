import { useEffect, useMemo, useState } from 'react'
import { playListenClip, speakDutch } from '../lib/speech'

type Vocab = { id: string; theme: number; nl: string; en?: string | null; article?: 'de' | 'het' | null }
type Course = { themes: { id: number; title: string }[]; vocab: Vocab[] }

type Mode = 'mc' | 'type' | 'order'
type Q =
  | { mode: 'mc'; vocab: Vocab; options: string[] }
  | { mode: 'type'; vocab: Vocab }
  | { mode: 'order'; vocab: Vocab; words: string[]; shuffled: string[] }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickOptions(correct: Vocab, pool: Vocab[]): string[] {
  const distractors = shuffle(pool.filter(v => v.id !== correct.id && v.nl !== correct.nl)).slice(0, 3).map(v => v.nl)
  return shuffle([correct.nl, ...distractors])
}

export default function Listening({ course, speak }: { course: Course | null; speak: (t: string) => Promise<void> }) {
  const pool = useMemo(() => {
    if (!course) return [] as Vocab[]
    return course.vocab.filter(v => v.nl && v.nl.split(/\s+/).length <= 6).slice(0, 400)
  }, [course])

  const [mode, setMode] = useState<Mode>('mc')
  const [q, setQ] = useState<Q | null>(null)
  const [typed, setTyped] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [source, setSource] = useState<'mp3' | 'tts' | null>(null)
  const [score, setScore] = useState({ ok: 0, n: 0 })

  const next = (m: Mode = mode) => {
    setFeedback(null)
    setTyped('')
    setPicked([])
    setSource(null)
    if (!pool.length) { setQ(null); return }
    const vocab = pool[Math.floor(Math.random() * pool.length)]
    if (m === 'mc') setQ({ mode: 'mc', vocab, options: pickOptions(vocab, pool) })
    else if (m === 'type') setQ({ mode: 'type', vocab })
    else {
      const words = vocab.nl.split(/\s+/).filter(Boolean)
      const base = words.length >= 2 ? words : (vocab.en ? `${vocab.nl} — ${vocab.en}`.split(/\s+/) : words)
      // Prefer short phrases: if single word, build from article+word or use example-like 2-3 tokens
      const tokens = base.length >= 2 ? base : [vocab.article, vocab.nl].filter(Boolean) as string[]
      const finalTokens = tokens.length >= 2 ? tokens : [vocab.nl, '?']
      setQ({ mode: 'order', vocab, words: finalTokens, shuffled: shuffle(finalTokens) })
    }
  }

  useEffect(() => { next(mode) }, [course, mode])

  const play = async () => {
    if (!q) return
    const text = q.vocab.article ? `${q.vocab.article} ${q.vocab.nl}` : q.vocab.nl
    try {
      const kind = await playListenClip(q.vocab.id, text)
      setSource(kind)
    } catch {
      await speak(text).catch(() => speakDutch(text))
      setSource('tts')
    }
  }

  useEffect(() => {
    if (q) play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.vocab.id, q?.mode])

  const grade = (answer: string) => {
    if (!q || feedback) return
    const ok = answer.trim().toLowerCase() === q.vocab.nl.trim().toLowerCase()
      || (q.mode === 'order' && answer.trim().toLowerCase() === q.words.join(' ').toLowerCase())
    setFeedback(ok ? 'correct' : 'wrong')
    setScore(s => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }))
  }

  if (!course) return <div className="card">Loading course…</div>

  return (
    <div className="card listenCard">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <img className="listenToolIcon" src="./assets/listen-icon.png" width={36} height={36} alt="" />
          <div>
            <div className="h1" style={{ marginBottom: 4 }}>Listening</div>
            <div className="h2">Hear Dutch → choose, type, or order the words</div>
          </div>
        </div>
        <div className="pill">{score.ok}/{score.n}</div>
      </div>
      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
        {(['mc', 'type', 'order'] as Mode[]).map(m => (
          <button key={m} type="button" className={`pill topBarBookPill${mode === m ? ' is-active' : ''}`} onClick={() => setMode(m)}>
            {m === 'mc' ? 'Multiple choice' : m === 'type' ? 'Type what you heard' : 'Order words'}
          </button>
        ))}
      </div>
      <div className="sep" />
      {!q ? (
        <div className="small">No vocab loaded.</div>
      ) : (
        <>
          <div className="listenPlayRow">
            <button type="button" className="btn-primary listenPlayBtn" onClick={play} aria-label="Play audio">▶ Hear again</button>
            <span className="small">{source === 'mp3' ? 'Audio file' : source === 'tts' ? 'Browser voice (drop MP3s in public/audio/listen/)' : '…'}</span>
          </div>
          {feedback === 'wrong' && (
            <div className="teachBanner" style={{ marginTop: 12 }}>
              <strong>Heard:</strong> {q.vocab.article ? `${q.vocab.article} ` : ''}{q.vocab.nl}
              {q.vocab.en ? <span className="small"> · {q.vocab.en}</span> : null}
            </div>
          )}
          {feedback === 'correct' && <div className="okBanner" style={{ marginTop: 12 }}>Goed zo!</div>}

          {q.mode === 'mc' && (
            <div className="listenOptions">
              {q.options.map(o => (
                <button
                  key={o}
                  type="button"
                  className={`listenOpt${feedback && o === q.vocab.nl ? ' is-correct' : ''}${feedback === 'wrong' && o !== q.vocab.nl ? '' : ''}`}
                  disabled={!!feedback}
                  onClick={() => grade(o)}
                >{o}</button>
              ))}
            </div>
          )}
          {q.mode === 'type' && (
            <form className="listenTypeForm" onSubmit={e => { e.preventDefault(); grade(typed) }}>
              <input className="iosInputFix listenTypeInput" value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type what you heard…" autoCapitalize="off" autoCorrect="off" disabled={!!feedback} />
              <button type="submit" className="btn-primary" disabled={!!feedback || !typed.trim()}>Check</button>
            </form>
          )}
          {q.mode === 'order' && (
            <div>
              <div className="orderPicked">{picked.length ? picked.join(' ') : <span className="small">Tap words in order</span>}</div>
              <div className="orderBank">
                {q.shuffled.map((w, i) => {
                  const countInPicked = picked.filter(p => p === w).length
                  const countInWords = q.words.filter(x => x === w).length
                  const disabled = !!feedback || countInPicked >= countInWords
                  return (
                    <button key={`${w}-${i}`} type="button" className="orderChip" disabled={disabled} onClick={() => setPicked(p => [...p, w])}>{w}</button>
                  )
                })}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" onClick={() => setPicked([])} disabled={!!feedback}>Clear</button>
                <button type="button" className="btn-primary" disabled={!!feedback || picked.length !== q.words.length} onClick={() => grade(picked.join(' '))}>Check</button>
              </div>
            </div>
          )}
          {feedback && (
            <div className="row" style={{ marginTop: 14 }}>
              <button type="button" className="btn-primary" onClick={() => next()}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Compact listening card for Daily retention mix */
export function ListeningSlice({
  vocab,
  pool,
  onDone,
  speak,
}: {
  vocab: Vocab
  pool: Vocab[]
  onDone: (correct: boolean) => void
  speak: (t: string) => Promise<void>
}) {
  const options = useMemo(() => pickOptions(vocab, pool), [vocab, pool])
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  useEffect(() => {
    const text = vocab.article ? `${vocab.article} ${vocab.nl}` : vocab.nl
    playListenClip(vocab.id, text).catch(() => speak(text))
  }, [vocab.id])
  return (
    <div className="listenSlice">
      <div className="small" style={{ marginBottom: 8 }}>Listening · what did you hear?</div>
      <button type="button" className="btn-primary" onClick={() => {
        const text = vocab.article ? `${vocab.article} ${vocab.nl}` : vocab.nl
        playListenClip(vocab.id, text).catch(() => speak(text))
      }}>▶ Replay</button>
      <div className="listenOptions" style={{ marginTop: 12 }}>
        {options.map(o => (
          <button key={o} type="button" className="listenOpt" disabled={!!feedback} onClick={() => {
            const ok = o === vocab.nl
            setFeedback(ok ? 'correct' : 'wrong')
            setTimeout(() => onDone(ok), ok ? 900 : 1600)
          }}>{o}</button>
        ))}
      </div>
      {feedback === 'wrong' && <div className="teachBanner" style={{ marginTop: 10 }}>{vocab.nl}{vocab.en ? ` · ${vocab.en}` : ''}</div>}
    </div>
  )
}
