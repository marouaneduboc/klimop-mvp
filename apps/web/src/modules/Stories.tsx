import { useEffect, useRef, useState } from 'react'
import { canSpeak, speakDutchLines, stopSpeaking } from '../lib/speech'

type Story = {
  id: string
  level: string
  theme: string
  title: string
  titleEn: string
  lines: string[]
  glossary: { nl: string; en: string }[]
  questions: { q: string; options: string[]; correct: string; explanation?: string }[]
}

export default function Stories({ speak }: { speak: (t: string) => Promise<void> }) {
  const [stories, setStories] = useState<Story[]>([])
  const [active, setActive] = useState<Story | null>(null)
  const [qIdx, setQIdx] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState({ ok: 0, n: 0 })
  const [reading, setReading] = useState(false)
  const [lineIdx, setLineIdx] = useState<number | null>(null)
  const [speechErr, setSpeechErr] = useState('')
  // Keep speak prop referenced so call sites stay compatible; Stories uses speakDutchLines for multi-line.
  void speak

  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = active?.id ?? null

  useEffect(() => {
    fetch('content/stories.json?v=2.0')
      .then(r => r.json())
      .then(d => setStories(d.stories || []))
      .catch(() => setStories([]))
  }, [])

  useEffect(() => () => { stopSpeaking() }, [])

  const open = (s: Story) => {
    stopSpeaking()
    setReading(false)
    setLineIdx(null)
    setSpeechErr('')
    setActive(s)
    setQIdx(0)
    setFeedback(null)
    setDone(false)
    setScore({ ok: 0, n: 0 })
  }

  const closeStory = () => {
    stopSpeaking()
    setReading(false)
    setLineIdx(null)
    setSpeechErr('')
    setActive(null)
  }

  const readAloud = async (s: Story) => {
    setSpeechErr('')
    if (!canSpeak()) {
      setSpeechErr('Browser TTS is not supported on this device. Try Chrome or Safari.')
      return
    }
    if (reading) {
      stopSpeaking()
      setReading(false)
      setLineIdx(null)
      return
    }
    setReading(true)
    setLineIdx(0)
    try {
      // User-gesture click starts this; speakDutchLines queues nl-NL lines without cancelling between them.
      await speakDutchLines(s.lines, {
        rate: 0.92,
        onLineStart: (i) => {
          if (activeIdRef.current === s.id) setLineIdx(i)
        },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setSpeechErr(msg || 'Could not speak. Tap Read aloud again (user gesture required).')
    } finally {
      if (activeIdRef.current === s.id) {
        setReading(false)
        setLineIdx(null)
      }
    }
  }

  if (!active) {
    return (
      <div className="card">
        <img className="listenToolIcon" src="./assets/story-icon.png" width={36} height={36} alt="" />
        <div className="h1">Stories</div>
        <div className="h2">Short graded reads · culture · comprehension</div>
        <div className="sep" />
        <div className="storyGrid">
          {stories.map(s => (
            <button key={s.id} type="button" className="storyCard" onClick={() => open(s)}>
              <div className="storyLevel">{s.level}</div>
              <div className="storyTitle">{s.title}</div>
              <div className="small">{s.titleEn}</div>
            </button>
          ))}
        </div>
        {!stories.length && <div className="small">Loading stories…</div>}
      </div>
    )
  }

  const q = active.questions[qIdx]

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" onClick={closeStory}>← All stories</button>
        <span className="pill">{active.level}</span>
      </div>
      <div className="h1" style={{ marginTop: 8 }}>{active.title}</div>
      <div className="h2">{active.titleEn}</div>
      <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn-primary" onClick={() => { void readAloud(active) }}>
          {reading ? '⏹ Stop' : '🔊 Read aloud'}
        </button>
        {reading && <span className="small">Speaking Dutch… {lineIdx != null ? `(${lineIdx + 1}/${active.lines.length})` : ''}</span>}
      </div>
      {!!speechErr && (
        <div className="teachBanner" style={{ marginTop: 10 }} role="alert">{speechErr}</div>
      )}
      <div className="storyBody">
        {active.lines.map((line, i) => (
          <p
            key={i}
            className="storyLine"
            style={reading && lineIdx === i ? { background: 'rgba(255, 186, 73, 0.25)', borderRadius: 6, padding: '2px 4px' } : undefined}
          >{line}</p>
        ))}
      </div>
      {!!active.glossary.length && (
        <div className="storyGlossary">
          {active.glossary.map(g => (
            <span key={g.nl} className="pill">{g.nl} · {g.en}</span>
          ))}
        </div>
      )}
      <div className="sep" />
      {!done && q && (
        <div>
          <div className="small">Comprehension {qIdx + 1}/{active.questions.length}</div>
          <div style={{ fontWeight: 700, margin: '8px 0' }}>{q.q}</div>
          <div className="listenOptions">
            {q.options.map(o => (
              <button
                key={o}
                type="button"
                className="listenOpt"
                disabled={!!feedback}
                onClick={() => {
                  const ok = o === q.correct
                  setFeedback(ok ? 'correct' : 'wrong')
                  setScore(s => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }))
                  setTimeout(() => {
                    setFeedback(null)
                    if (qIdx + 1 >= active.questions.length) setDone(true)
                    else setQIdx(i => i + 1)
                  }, ok ? 900 : 1800)
                }}
              >{o}</button>
            ))}
          </div>
          {feedback === 'wrong' && (
            <div className="teachBanner" style={{ marginTop: 10 }}>
              Antwoord: {q.correct}
              {q.explanation ? <div className="small" style={{ marginTop: 6 }}>{q.explanation}</div> : null}
            </div>
          )}
          {feedback === 'correct' && q.explanation && (
            <div className="okBanner" style={{ marginTop: 10 }}>
              Goed!
              <div className="small" style={{ marginTop: 6 }}>{q.explanation}</div>
            </div>
          )}
        </div>
      )}
      {done && (
        <div className="celebrateBanner">
          <div className="title">Klaar — {score.ok}/{score.n} goed</div>
          <button type="button" className="btn-primary" style={{ marginTop: 10 }} onClick={closeStory}>More stories</button>
        </div>
      )}
    </div>
  )
}
