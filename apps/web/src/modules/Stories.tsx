import { useEffect, useState } from 'react'
import { speakDutch } from '../lib/speech'

type Story = {
  id: string
  level: string
  theme: string
  title: string
  titleEn: string
  lines: string[]
  glossary: { nl: string; en: string }[]
  questions: { q: string; options: string[]; correct: string }[]
}

export default function Stories({ speak }: { speak: (t: string) => Promise<void> }) {
  const [stories, setStories] = useState<Story[]>([])
  const [active, setActive] = useState<Story | null>(null)
  const [qIdx, setQIdx] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [done, setDone] = useState(false)
  const [score, setScore] = useState({ ok: 0, n: 0 })

  useEffect(() => {
    fetch('content/stories.json')
      .then(r => r.json())
      .then(d => setStories(d.stories || []))
      .catch(() => setStories([]))
  }, [])

  const open = (s: Story) => {
    setActive(s)
    setQIdx(0)
    setFeedback(null)
    setDone(false)
    setScore({ ok: 0, n: 0 })
  }

  const readAloud = async (s: Story) => {
    for (const line of s.lines) {
      try { await speak(line) } catch { await speakDutch(line) }
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
        <button type="button" onClick={() => setActive(null)}>← All stories</button>
        <span className="pill">{active.level}</span>
      </div>
      <div className="h1" style={{ marginTop: 8 }}>{active.title}</div>
      <div className="h2">{active.titleEn}</div>
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn-primary" onClick={() => readAloud(active)}>🔊 Read aloud</button>
      </div>
      <div className="storyBody">
        {active.lines.map((line, i) => (
          <p key={i} className="storyLine">{line}</p>
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
                  }, ok ? 700 : 1400)
                }}
              >{o}</button>
            ))}
          </div>
          {feedback === 'wrong' && <div className="teachBanner" style={{ marginTop: 10 }}>Antwoord: {q.correct}</div>}
        </div>
      )}
      {done && (
        <div className="celebrateBanner">
          <div className="title">Klaar — {score.ok}/{score.n} goed</div>
          <button type="button" className="btn-primary" style={{ marginTop: 10 }} onClick={() => setActive(null)}>More stories</button>
        </div>
      )}
    </div>
  )
}
