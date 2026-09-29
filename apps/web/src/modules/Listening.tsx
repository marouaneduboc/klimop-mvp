import { useEffect, useMemo, useState } from 'react'
import { playListenClip, speakDutch } from '../lib/speech'

type Vocab = { id: string; theme: number; nl: string; en?: string | null; article?: 'de' | 'het' | null }
type Course = { themes: { id: number; title: string }[]; vocab: Vocab[] }

type Mode = 'mc' | 'type' | 'order'
type OrderChip = { id: string; text: string }
type Q =
  | { mode: 'mc'; vocab: Vocab; options: string[] }
  | { mode: 'type'; vocab: Vocab }
  | { mode: 'order'; vocab: Vocab; words: string[]; shuffled: OrderChip[]; hearText: string }

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

/** Dutch-only order tokens — never inject English (that broke Check for single-word vocab). */
function orderTokensFor(vocab: Vocab): { words: string[]; hearText: string } | null {
  const raw = (vocab.nl || '').trim()
  if (!raw) return null
  if (/\//.test(raw)) return null // skip "zij / ze"
  const parts = raw.split(/\s+/).map(p => p.trim()).filter(Boolean)
  if (parts.length >= 2 && parts.length <= 6) {
    return { words: parts, hearText: parts.join(' ') }
  }
  if (parts.length === 1 && vocab.article) {
    return { words: [vocab.article, parts[0]], hearText: `${vocab.article} ${parts[0]}` }
  }
  return null
}

function normAns(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export default function Listening({ course, speak }: { course: Course | null; speak: (t: string) => Promise<void> }) {
  const pool = useMemo(() => {
    if (!course) return [] as Vocab[]
    return course.vocab.filter(v => v.nl && v.nl.split(/\s+/).length <= 6)
  }, [course])

  const orderPool = useMemo(() => {
    const usable = pool.filter(v => orderTokensFor(v))
    const multi = usable.filter(v => (v.nl || '').trim().split(/\s+/).length >= 2)
    const base = multi.length >= 12 ? multi : usable
    return shuffle(base).slice(0, 400)
  }, [pool])

  const [mode, setMode] = useState<Mode>('mc')
  const [q, setQ] = useState<Q | null>(null)
  const [typed, setTyped] = useState('')
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [source, setSource] = useState<'mp3' | 'tts' | null>(null)
  const [score, setScore] = useState({ ok: 0, n: 0 })

  const next = (m: Mode = mode) => {
    setFeedback(null)
    setTyped('')
    setPickedIds([])
    setSource(null)
    if (m === 'order') {
      if (!orderPool.length) { setQ(null); return }
      const vocab = orderPool[Math.floor(Math.random() * orderPool.length)]
      const built = orderTokensFor(vocab)
      if (!built) { setQ(null); return }
      const shuffled = shuffle(built.words.map((text, i) => ({ id: `${vocab.id}-${i}-${text}`, text })))
      setQ({ mode: 'order', vocab, words: built.words, shuffled, hearText: built.hearText })
      return
    }
    if (!pool.length) { setQ(null); return }
    const vocab = pool[Math.floor(Math.random() * Math.min(pool.length, 500))]
    if (m === 'mc') setQ({ mode: 'mc', vocab, options: pickOptions(vocab, pool) })
    else setQ({ mode: 'type', vocab })
  }

  useEffect(() => { next(mode) }, [course, mode])

  const play = async () => {
    if (!q) return
    const text = q.mode === 'order'
      ? q.hearText
      : (q.vocab.article ? `${q.vocab.article} ${q.vocab.nl}` : q.vocab.nl)
    try {
      const kind = await playListenClip(q.vocab.id, text)
      setSource(kind)
    } catch {
      await speak(text).catch(() => speakDutch(text))
      setSource('tts')
    }
  }

  useEffect(() => {
    if (q) void play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.vocab.id, q?.mode])

  const grade = (answer: string) => {
    if (!q || feedback) return
    const ok = q.mode === 'order'
      ? normAns(answer) === normAns(q.words.join(' '))
      : normAns(answer) === normAns(q.vocab.nl)
    setFeedback(ok ? 'correct' : 'wrong')
    setScore(s => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }))
  }

  const pickedTexts = q?.mode === 'order'
    ? pickedIds.map(id => q.shuffled.find(c => c.id === id)?.text).filter((t): t is string => !!t)
    : []
  const availableOrder = q?.mode === 'order'
    ? q.shuffled.filter(c => !pickedIds.includes(c.id))
    : []

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
        <div className="small">{mode === 'order' ? 'No phrases available for ordering in this book.' : 'No vocab loaded.'}</div>
      ) : (
        <>
          <div className="listenPlayRow">
            <button type="button" className="btn-primary listenPlayBtn" onClick={() => { void play() }} aria-label="Play audio">▶ Hear again</button>
            <span className="small">{source === 'mp3' ? 'Audio file' : source === 'tts' ? 'Browser voice (drop MP3s in public/audio/listen/)' : '…'}</span>
          </div>
          {feedback === 'wrong' && (
            <div className="teachBanner" style={{ marginTop: 12 }}>
              <strong>Heard:</strong>{' '}
              {q.mode === 'order' ? q.words.join(' ') : `${q.vocab.article ? `${q.vocab.article} ` : ''}${q.vocab.nl}`}
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
                  className={`listenOpt${feedback && o === q.vocab.nl ? ' is-correct' : ''}`}
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
              <div className="small" style={{ marginBottom: 4 }}>
                Tap words in the right order{pickedTexts.length ? ' · tap a chosen word to undo' : ''}
              </div>
              <div className="orderPicked" aria-live="polite">
                {pickedTexts.length ? (
                  <div className="orderBank" style={{ margin: 0 }}>
                    {pickedIds.map(id => {
                      const chip = q.shuffled.find(c => c.id === id)
                      if (!chip) return null
                      return (
                        <button
                          key={`picked-${id}`}
                          type="button"
                          className="orderChip is-picked"
                          disabled={!!feedback}
                          onClick={() => setPickedIds(ids => ids.filter(x => x !== id))}
                        >{chip.text}</button>
                      )
                    })}
                  </div>
                ) : (
                  <span className="small">Tap words below…</span>
                )}
              </div>
              <div className="orderBank">
                {availableOrder.map(chip => (
                  <button
                    key={chip.id}
                    type="button"
                    className="orderChip"
                    disabled={!!feedback}
                    onClick={() => setPickedIds(ids => [...ids, chip.id])}
                  >{chip.text}</button>
                ))}
              </div>
              <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setPickedIds([])} disabled={!!feedback || !pickedIds.length}>Clear</button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!!feedback || pickedIds.length !== q.words.length}
                  onClick={() => grade(pickedTexts.join(' '))}
                >Check</button>
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
