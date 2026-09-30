import { useEffect, useRef, useState } from 'react'
import { canSpeak, speakDutchLines, stopSpeaking } from '../lib/speech'
import { playSoftMiss, playSoftSuccess, unlockSfx } from '../lib/sfx'

type StoryTip = {
  afterLine: number
  kind?: 'tip' | 'grammar' | 'culture' | 'wistJeDat' | 'vocab'
  nl: string
  en?: string
}

type Story = {
  id: string
  level: string
  theme: string
  title: string
  titleEn: string
  lines: string[]
  glossary: { nl: string; en: string }[]
  tips?: StoryTip[]
  questions: { q: string; options: string[]; correct: string; explanation?: string }[]
}

const FEEDBACK_MS_OK = 3000
const FEEDBACK_MS_MISS = 3000

const TIP_LABEL: Record<NonNullable<StoryTip['kind']>, string> = {
  tip: 'Tip',
  grammar: 'Grammatica',
  culture: 'Cultuur',
  wistJeDat: 'Wist je dat',
  vocab: 'Vocab',
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
  /** Selected paragraph for Read aloud — tap a line to select. */
  const [selectedLine, setSelectedLine] = useState<number | null>(null)
  const [speechErr, setSpeechErr] = useState('')
  // Speak prop kept for App compatibility; Read aloud uses speakDutchLines which picks up App TTS voice via setPreferredDutchVoice.
  void speak

  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = active?.id ?? null

  useEffect(() => {
    fetch('content/stories.json?v=2.2')
      .then(r => r.json())
      .then(d => setStories(d.stories || []))
      .catch(() => setStories([]))
  }, [])

  useEffect(() => () => { stopSpeaking() }, [])

  const open = (s: Story) => {
    stopSpeaking()
    setReading(false)
    setLineIdx(null)
    setSelectedLine(0) // nicer UX: first paragraph pre-selected so Read aloud is ready
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
    setSelectedLine(null)
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

    // Speak ONLY the selected paragraph. If none selected, select first and speak that.
    let target = selectedLine
    if (target == null || target < 0 || target >= s.lines.length) {
      target = 0
      setSelectedLine(0)
    }
    const linesToSpeak = [s.lines[target]]

    setReading(true)
    setLineIdx(target)
    try {
      await speakDutchLines(linesToSpeak, {
        rate: 0.92,
        onLineStart: () => {
          if (activeIdRef.current === s.id) setLineIdx(target)
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
  const tips = active.tips || []

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
        {reading && (
          <span className="small">
            Speaking paragraph {(selectedLine ?? 0) + 1}/{active.lines.length}…
          </span>
        )}
        {!reading && selectedLine != null && (
          <span className="small">Selected §{selectedLine + 1} — Read aloud speaks this paragraph only</span>
        )}
      </div>
      <div className="small" style={{ marginTop: 6 }}>
        Tip: tap a paragraph to select it, then Read aloud.
      </div>
      {!!speechErr && (
        <div className="teachBanner" style={{ marginTop: 10 }} role="alert">{speechErr}</div>
      )}
      <div className="storyBody">
        {active.lines.map((line, i) => {
          const lineTips = tips.filter(t => t.afterLine === i)
          const isSelected = selectedLine === i
          const isSpeaking = reading && lineIdx === i
          return (
            <div key={i} className="storyParaBlock">
              <button
                type="button"
                className={`storyLine${isSelected ? ' is-selected' : ''}${isSpeaking ? ' is-speaking' : ''}`}
                onClick={() => {
                  if (reading) {
                    stopSpeaking()
                    setReading(false)
                    setLineIdx(null)
                  }
                  setSelectedLine(i)
                }}
                aria-pressed={isSelected}
                aria-label={`Select paragraph ${i + 1}`}
              >
                {line}
              </button>
              {lineTips.map((t, ti) => (
                <div key={`${i}-${ti}`} className="teachBanner storyTip" role="note">
                  <strong>{TIP_LABEL[t.kind || 'tip']}</strong>
                  {' — '}
                  {t.nl}
                  {t.en ? <div className="small" style={{ marginTop: 4 }}>{t.en}</div> : null}
                </div>
              ))}
            </div>
          )
        })}
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
                  unlockSfx()
                  if (ok) playSoftSuccess()
                  else playSoftMiss()
                  setFeedback(ok ? 'correct' : 'wrong')
                  setScore(s => ({ ok: s.ok + (ok ? 1 : 0), n: s.n + 1 }))
                  setTimeout(() => {
                    setFeedback(null)
                    if (qIdx + 1 >= active.questions.length) setDone(true)
                    else setQIdx(i => i + 1)
                  }, ok ? FEEDBACK_MS_OK : FEEDBACK_MS_MISS)
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
          {feedback === 'correct' && (
            <div className="okBanner" style={{ marginTop: 10 }}>
              Goed!
              {q.explanation ? <div className="small" style={{ marginTop: 6 }}>{q.explanation}</div> : null}
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
