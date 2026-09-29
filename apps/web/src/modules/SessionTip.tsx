import { useEffect, useState } from 'react'

type Proverb = { id: string; nl: string; en: string; note?: string }
type Tip = { id: string; nl: string; en: string }
type Bundle = { proverbs: Proverb[]; wistJeDat: Tip[] }

const SESSION_KEY = 'klimop.sessionTip.v1'

/** At most one tip/proverb per browser session (Home / celebrate / between cards). */
export function SessionTip({ slot }: { slot: 'home' | 'celebrate' | 'between' }) {
  const [item, setItem] = useState<{ kind: 'proverb' | 'wist'; text: string; sub?: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    const shown = sessionStorage.getItem(SESSION_KEY)
    if (shown) return
    fetch('content/proverbs.json')
      .then(r => r.json())
      .then((data: Bundle) => {
        if (cancelled) return
        const useProverb = Math.random() < 0.5
        if (useProverb && data.proverbs?.length) {
          const p = data.proverbs[Math.floor(Math.random() * data.proverbs.length)]
          setItem({ kind: 'proverb', text: p.nl, sub: p.en })
        } else if (data.wistJeDat?.length) {
          const t = data.wistJeDat[Math.floor(Math.random() * data.wistJeDat.length)]
          setItem({ kind: 'wist', text: t.nl, sub: t.en })
        }
        sessionStorage.setItem(SESSION_KEY, slot)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slot])

  if (!item) return null
  return (
    <div className={`sessionTip sessionTip-${slot}`} role="note">
      <div className="sessionTipLabel">{item.kind === 'proverb' ? 'Spreekwoord' : 'Wist je dat?'}</div>
      <div className="sessionTipText">{item.text}</div>
      {item.sub && <div className="sessionTipSub">{item.sub}</div>}
    </div>
  )
}

/** Call when celebrating a Daily goal — only shows if session tip not yet used. */
export function CelebrateTip() {
  return <SessionTip slot="celebrate" />
}
