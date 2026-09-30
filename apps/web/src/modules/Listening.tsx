import { useEffect, useMemo, useRef, useState } from 'react'
import { playSoftMiss, playSoftSuccess, unlockSfx } from '../lib/sfx'
import { playListenClip, speakDutch } from '../lib/speech'

type Vocab = { id: string; theme: number; nl: string; en?: string | null; article?: 'de' | 'het' | null }
type Course = { themes: { id: number; title: string }[]; vocab: Vocab[] }

type Mode = 'mc' | 'type' | 'order'
type OrderChip = { id: string; text: string }
type OrderPhrase = { id: string; nl: string; en?: string | null; words: string[]; hearText: string }
type Q =
  | { mode: 'mc'; vocab: Vocab; options: string[] }
  | { mode: 'type'; vocab: Vocab }
  | { mode: 'order'; phrase: OrderPhrase; shuffled: OrderChip[] }

const FEEDBACK_MS_OK = 1200
const FEEDBACK_MS_MISS = 1800

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

/** Tokenize Dutch phrase into order chips (words only; drop bare punctuation). */
function tokenizeNl(raw: string): string[] {
  return (raw.match(/[A-Za-zÀ-ÿ0-9']+/g) || []).filter(Boolean)
}

/**
 * Full-sentence / full-phrase tokens for Order mode.
 * Skips short scraps (article+noun) and slash alternatives.
 */
function orderPhraseFromText(id: string, nl: string, en?: string | null): OrderPhrase | null {
  const raw = (nl || '').trim()
  if (!raw) return null
  if (/\//.test(raw) || /\.\.\./.test(raw)) return null
  const words = tokenizeNl(raw)
  if (words.length < 4 || words.length > 12) return null
  return { id, nl: raw.replace(/\s+/g, ' ').trim(), en: en || null, words, hearText: words.join(' ') }
}

function orderPhraseFromVocab(vocab: Vocab): OrderPhrase | null {
  // Prefer the full nl string (phrase), not article + single noun scraps.
  const parts = (vocab.nl || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length < 4) return null
  return orderPhraseFromText(`vocab:${vocab.id}`, vocab.nl, vocab.en)
}

/** Split story paragraphs into usable full sentences (4–12 words). */
function sentencesFromStoryLine(line: string): string[] {
  const chunks = line.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  const out: string[] = []
  for (const chunk of chunks) {
    const words = tokenizeNl(chunk)
    if (words.length >= 4 && words.length <= 12) {
      out.push(chunk)
      continue
    }
    if (words.length > 12) {
      // Prefer clause-sized pieces on commas / "en"
      const bits = chunk.split(/,\s+|\s+en\s+/i)
      let buf: string[] = []
      for (const bit of bits) {
        const w = tokenizeNl(bit)
        if (!w.length) continue
        const cand = buf.concat(w)
        if (cand.length <= 12) buf = cand
        else {
          if (buf.length >= 4) out.push(buf.join(' '))
          buf = w
        }
      }
      if (buf.length >= 4 && buf.length <= 12) out.push(buf.join(' '))
    }
  }
  return out
}

function normAns(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function displayNl(vocab: Vocab): string {
  return `${vocab.article ? `${vocab.article} ` : ''}${vocab.nl}`
}

export default function Listening({ course, speak }: { course: Course | null; speak: (t: string) => Promise<void> }) {
  const pool = useMemo(() => {
    if (!course) return [] as Vocab[]
    return course.vocab.filter(v => v.nl && v.nl.split(/\s+/).length <= 6)
  }, [course])

  const [storyPhrases, setStoryPhrases] = useState<OrderPhrase[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const collected: OrderPhrase[] = []
      try {
        const storiesRes = await fetch('content/stories.json?v=2.1')
        const storiesData = await storiesRes.json()
        for (const s of storiesData.stories || []) {
          for (let li = 0; li < (s.lines || []).length; li++) {
            for (const sent of sentencesFromStoryLine(s.lines[li])) {
              const built = orderPhraseFromText(`story:${s.id}:L${li}:${sent.slice(0, 24)}`, sent, s.titleEn || null)
              if (built) collected.push(built)
            }
          }
        }
      } catch { /* optional */ }
      try {
        const provRes = await fetch('content/proverbs.json?v=1')
        const provData = await provRes.json()
        for (const p of provData.proverbs || []) {
          const built = orderPhraseFromText(`proverb:${p.id}`, p.nl, p.en)
          if (built) collected.push(built)
        }
      } catch { /* optional */ }
      if (!cancelled) setStoryPhrases(collected)
    })()
    return () => { cancelled = true }
  }, [])

  const orderPool = useMemo(() => {
    const fromVocab = (course?.vocab || [])
      .map(orderPhraseFromVocab)
      .filter((p): p is OrderPhrase => !!p)
    // Prefer full sentences from stories/proverbs; fold in longer vocab phrases.
    const merged = [...storyPhrases, ...fromVocab]
    // Dedupe by normalized hearText
    const seen = new Set<string>()
    const uniq: OrderPhrase[] = []
    for (const p of merged) {
      const key = normAns(p.hearText)
      if (seen.has(key)) continue
      seen.add(key)
      uniq.push(p)
    }
    return shuffle(uniq).slice(0, 500)
  }, [course, storyPhrases])

  const [mode, setMode] = useState<Mode>('mc')
  const [q, setQ] = useState<Q | null>(null)
  const [typed, setTyped] = useState('')
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [source, setSource] = useState<'mp3' | 'tts' | null>(null)
  const [playHint, setPlayHint] = useState<string | null>(null)
  const [score, setScore] = useState({ ok: 0, n: 0 })
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackRef = useRef<'correct' | 'wrong' | null>(null)
  const playGenRef = useRef(0)

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current)
      advanceTimerRef.current = null
    }
  }

  useEffect(() => () => clearAdvanceTimer(), [])

  const next = (m: Mode = mode) => {
    clearAdvanceTimer()
    feedbackRef.current = null
    setFeedback(null)
    setTyped('')
    setPickedIds([])
    setSource(null)
    setPlayHint(null)
    playGenRef.current += 1
    if (m === 'order') {
      if (!orderPool.length) { setQ(null); return }
      const phrase = orderPool[Math.floor(Math.random() * orderPool.length)]
      const shuffled = shuffle(phrase.words.map((text, i) => ({ id: `${phrase.id}-${i}-${text}`, text })))
      setQ({ mode: 'order', phrase, shuffled })
      return
    }
    if (!pool.length) { setQ(null); return }
    const vocab = pool[Math.floor(Math.random() * Math.min(pool.length, 500))]
    if (m === 'mc') setQ({ mode: 'mc', vocab, options: pickOptions(vocab, pool) })
    else setQ({ mode: 'type', vocab })
  }

  useEffect(() => { next(mode) }, [course, mode, orderPool.length])

  const play = async (fromUserGesture = false) => {
    if (!q) return
    if (fromUserGesture) unlockSfx()
    const myGen = playGenRef.current
    const text = q.mode === 'order'
      ? q.phrase.hearText
      : displayNl(q.vocab)
    const clipId = q.mode === 'order' ? q.phrase.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) : q.vocab.id
    setPlayHint(null)
    try {
      const kind = await playListenClip(clipId, text)
      if (myGen !== playGenRef.current) return
      setSource(kind)
    } catch (e: any) {
      if (myGen !== playGenRef.current) return
      try {
        await speakDutch(text)
        if (myGen !== playGenRef.current) return
        setSource('tts')
      } catch (err: any) {
        try {
          await speak(text)
        } catch { /* */ }
        if (myGen !== playGenRef.current) return
        setSource('tts')
        const msg = String(err?.message || e?.message || '')
        if (/not-allowed|blocked|gesture/i.test(msg) || !fromUserGesture) {
          setPlayHint('Tap ▶ Hear again to play audio (browser blocked autoplay).')
        } else if (msg) {
          setPlayHint(msg)
        }
      }
    }
  }

  useEffect(() => {
    if (q) void play(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.mode === 'order' ? q.phrase.id : q?.vocab.id, q?.mode])

  const scheduleAdvance = (ok: boolean) => {
    clearAdvanceTimer()
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      next()
    }, ok ? FEEDBACK_MS_OK : FEEDBACK_MS_MISS)
  }

  /** Grade current answer; show feedback then auto-advance (slow enough to read NL+EN). */
  const grade = (answer: string) => {
    if (!q || feedbackRef.current) return false
    unlockSfx()
    const ok = q.mode === 'order'
      ? normAns(answer) === normAns(q.phrase.words.join(' '))
      : normAns(answer) === normAns(q.vocab.nl)
    feedbackRef.current = ok ? 'correct' : 'wrong'
    setFeedback(feedbackRef.current)
    setScore(s => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }))
    if (ok) playSoftSuccess()
    else playSoftMiss()
    scheduleAdvance(ok)
    return true
  }

  const pickedTexts = q?.mode === 'order'
    ? pickedIds.map(id => q.shuffled.find(c => c.id === id)?.text).filter((t): t is string => !!t)
    : []
  const availableOrder = q?.mode === 'order'
    ? q.shuffled.filter(c => !pickedIds.includes(c.id))
    : []

  const resultNl = q
    ? (q.mode === 'order' ? q.phrase.words.join(' ') : displayNl(q.vocab))
    : ''
  const resultEn = q
    ? (q.mode === 'order' ? (q.phrase.en || null) : (q.vocab.en || null))
    : null

  /** Next: if already checked, advance now; else grade (when answer ready) then brief feedback + advance. */
  const handleNext = () => {
    if (feedback) {
      clearAdvanceTimer()
      next()
      return
    }
    if (!q) return
    if (q.mode === 'type' && typed.trim()) {
      grade(typed)
      return
    }
    if (q.mode === 'order' && pickedIds.length === q.phrase.words.length) {
      grade(pickedTexts.join(' '))
    }
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
        <div className="small">{mode === 'order' ? 'No full sentences available for ordering yet.' : 'No vocab loaded.'}</div>
      ) : (
        <>
          <div className="listenPlayRow">
            <button type="button" className="btn-primary listenPlayBtn" onClick={() => { void play(true) }} aria-label="Play audio">▶ Hear again</button>
            <span className="small">{source === 'mp3' ? 'Audio file' : source === 'tts' ? 'Browser voice' : '…'}</span>
          </div>
          {playHint && (
            <div className="teachBanner" style={{ marginTop: 10 }} role="status">{playHint}</div>
          )}
          {feedback === 'wrong' && (
            <div className="teachBanner" style={{ marginTop: 12 }}>
              <strong>Heard:</strong>{' '}
              {resultNl}
              {resultEn ? <span className="listenEn"> · {resultEn}</span> : null}
            </div>
          )}
          {feedback === 'correct' && (
            <div className="okBanner" style={{ marginTop: 12 }}>
              Goed zo!
              {(q.mode === 'type' || q.mode === 'order') && (
                <div className="listenResultLine" style={{ marginTop: 6 }}>
                  <strong>{resultNl}</strong>
                  {resultEn ? <span className="listenEn"> · {resultEn}</span> : null}
                </div>
              )}
            </div>
          )}

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
            <form className="listenTypeForm" onSubmit={e => { e.preventDefault(); handleNext() }}>
              <input className="iosInputFix listenTypeInput" value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type what you heard…" autoCapitalize="off" autoCorrect="off" disabled={!!feedback} />
              <button type="submit" className="btn-primary" disabled={!feedback && !typed.trim()}>{feedback ? 'Next' : 'Check'}</button>
            </form>
          )}
          {q.mode === 'order' && (
            <div>
              <div className="small" style={{ marginBottom: 4 }}>
                Tap words in the right order{pickedTexts.length ? ' · tap a chosen word to undo' : ''}
                {' · '}full sentence
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
                  disabled={!feedback && pickedIds.length !== q.phrase.words.length}
                  onClick={handleNext}
                >{feedback ? 'Next' : 'Check'}</button>
              </div>
            </div>
          )}
          {feedback && q.mode === 'mc' && (
            <div className="row" style={{ marginTop: 14 }}>
              <button type="button" className="btn-primary" onClick={handleNext}>Next</button>
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
    playListenClip(vocab.id, text).catch(() => speak(text).catch(() => speakDutch(text)))
  }, [vocab.id])
  return (
    <div className="listenSlice">
      <div className="small" style={{ marginBottom: 8 }}>Listening · what did you hear?</div>
      <button type="button" className="btn-primary" onClick={() => {
        unlockSfx()
        const text = vocab.article ? `${vocab.article} ${vocab.nl}` : vocab.nl
        playListenClip(vocab.id, text).catch(() => speakDutch(text).catch(() => speak(text)))
      }}>▶ Replay</button>
      <div className="listenOptions" style={{ marginTop: 12 }}>
        {options.map(o => (
          <button key={o} type="button" className="listenOpt" disabled={!!feedback} onClick={() => {
            unlockSfx()
            const ok = o === vocab.nl
            setFeedback(ok ? 'correct' : 'wrong')
            if (ok) playSoftSuccess()
            else playSoftMiss()
            setTimeout(() => onDone(ok), ok ? FEEDBACK_MS_OK : FEEDBACK_MS_MISS)
          }}>{o}</button>
        ))}
      </div>
      {feedback === 'wrong' && <div className="teachBanner" style={{ marginTop: 10 }}>{vocab.nl}{vocab.en ? ` · ${vocab.en}` : ''}</div>}
      {feedback === 'correct' && (
        <div className="okBanner" style={{ marginTop: 10 }}>
          Goed zo!
          {vocab.en ? <span className="listenEn"> · {vocab.en}</span> : null}
        </div>
      )}
    </div>
  )
}
