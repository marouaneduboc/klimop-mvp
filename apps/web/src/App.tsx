import { useEffect, useMemo, useState } from 'react'

type Vocab = { id:string; theme:number; nl:string; en?:string|null; article?:'de'|'het'|null }
type Review = { id:string; due:number; interval:number; ease:number; reps:number; lapses:number }
type Stats = {
  streak:number
  lastDay:string|null
  minutesToday:number
  reviewsToday:number
  correctToday:number
  newToday:number
  history:{day:string;minutes:number;reviews:number;correct:number;added:number}[]
}
type Settings = {
  ttsBaseUrl:string
  autoSpeak:boolean
  voice:string
  speed:number
  dailyTarget:number
  newPerDay:number
}
type Course = { version:string; themes:{id:number;title:string}[]; vocab:Vocab[]; audio:{groups:Record<string, any>} }

const LS = { reviews:'klimop.reviews.v1', stats:'klimop.stats.v1', settings:'klimop.settings.v1' }
const todayISO = ()=> new Date().toISOString().slice(0,10)
const loadJSON = <T,>(k:string, f:T):T => { try{ const s=localStorage.getItem(k); return s? JSON.parse(s):f }catch{return f} }
const saveJSON = (k:string,v:any)=> localStorage.setItem(k, JSON.stringify(v))

const DEFAULT_DAILY_TARGET = 20
const DEFAULT_NEW_PER_DAY = 8
const MIN_DAILY_TARGET = 5
const MAX_DAILY_TARGET = 200
const MIN_NEW_PER_DAY = 0
const MAX_NEW_PER_DAY = 80

const clamp = (n:number, min:number, max:number)=>Math.min(max, Math.max(min, n))
function normalizeSettings(raw:any):Settings{
  const base = {
    ttsBaseUrl:'http://127.0.0.1:8787',
    autoSpeak:false,
    voice:'',
    speed:1.0,
    dailyTarget:DEFAULT_DAILY_TARGET,
    newPerDay:DEFAULT_NEW_PER_DAY,
  }
  const s = {...base, ...(raw||{})}
  return {
    ttsBaseUrl: String(s.ttsBaseUrl || base.ttsBaseUrl),
    autoSpeak: !!s.autoSpeak,
    voice: String(s.voice || ''),
    speed: clamp(Number(s.speed || 1), 0.6, 1.4),
    dailyTarget: Math.round(clamp(Number(s.dailyTarget || DEFAULT_DAILY_TARGET), MIN_DAILY_TARGET, MAX_DAILY_TARGET)),
    newPerDay: Math.round(clamp(Number(s.newPerDay || DEFAULT_NEW_PER_DAY), MIN_NEW_PER_DAY, MAX_NEW_PER_DAY)),
  }
}

function ensureStats():Stats{
  const s = loadJSON<any>(LS.stats,{streak:0,lastDay:null,minutesToday:0,reviewsToday:0,correctToday:0,newToday:0,history:[]})
  if(typeof s.newToday !== 'number') s.newToday = 0
  if(!Array.isArray(s.history)) s.history = []

  const day=todayISO()
  if(s.lastDay!==day){
    if(s.lastDay){
      s.history=[...s.history,{day:s.lastDay,minutes:s.minutesToday,reviews:s.reviewsToday,correct:s.correctToday,added:s.newToday}].slice(-31)
      const prev=new Date(s.lastDay), cur=new Date(day)
      const diff=Math.round((cur.getTime()-prev.getTime())/86400000)
      s.streak = diff===1 ? s.streak+1 : 1
    }else s.streak=1
    s.lastDay=day; s.minutesToday=0; s.reviewsToday=0; s.correctToday=0; s.newToday=0
    saveJSON(LS.stats,s)
  }
  return s as Stats
}

function upsertReview(map:Record<string,Review>, id:string):Review{
  if(!map[id]) map[id]={id,due:Date.now(),interval:0,ease:2.3,reps:0,lapses:0}
  return map[id]
}

function gradeBinary(r:Review, correct:boolean){
  r.reps += 1
  if(!correct){
    r.lapses += 1
    r.interval = 0
    r.ease = Math.max(1.3, r.ease - 0.2)
    r.due = Date.now() + 10*60*1000
    return
  }
  r.ease = Math.min(2.8, r.ease + 0.05)
  if(r.interval===0) r.interval=1
  else if(r.interval===1) r.interval=3
  else r.interval=Math.round(r.interval*r.ease)
  r.due=Date.now()+r.interval*86400000
}

async function fetchJSON<T>(url:string):Promise<T>{
  const r=await fetch(url); if(!r.ok) throw new Error(await r.text()); return r.json()
}

export default function App(){
  const [course,setCourse]=useState<Course|null>(null)
  const [route,setRoute]=useState<'home'|'study'|'progress'|'tts'>('home')
  const [reviewsMap,setReviewsMap]=useState<Record<string,Review>>(()=>loadJSON(LS.reviews,{}))
  const [stats,setStats]=useState<Stats>(()=>ensureStats())
  const [studyTheme,setStudyTheme]=useState<number>(0)
  const [studyContinueMode,setStudyContinueMode]=useState(false)
  const [settings,setSettings]=useState<Settings>(()=>normalizeSettings(loadJSON(LS.settings,null)))
  const [voices,setVoices]=useState<string[]>([])
  const [err,setErr]=useState('')

  useEffect(()=>{ fetchJSON<Course>('/content/course.json').then(setCourse).catch(e=>setErr(String(e))) },[])
  useEffect(()=>saveJSON(LS.reviews,reviewsMap),[reviewsMap])
  useEffect(()=>saveJSON(LS.settings,settings),[settings])

  const dueCount = useMemo(()=>{
    if(!course) return 0
    const now=Date.now()
    const dueReviews = course.vocab.filter(v=>{
      const r = reviewsMap[v.id]
      return !!r && r.due<=now
    })
    const unseen = course.vocab.filter(v=>!reviewsMap[v.id]).length
    const newSlots = Math.max(0, settings.newPerDay - stats.newToday)
    return Math.min(settings.dailyTarget, dueReviews.length + Math.min(unseen, newSlots))
  },[course,reviewsMap,stats.newToday,settings.dailyTarget,settings.newPerDay])

  async function refreshVoices(){
    setErr('')
    try{
      const r=await fetchJSON<{voices:string[]}>(`${settings.ttsBaseUrl}/tts/voices`)
      const available=r.voices||[]
      setVoices(available)
      setSettings(s=>({
        ...s,
        voice: available.includes(s.voice) ? s.voice : (available[0]||'')
      }))
    }catch(e:any){ setErr(String(e?.message??e)) }
  }
  useEffect(()=>{ refreshVoices() },[settings.ttsBaseUrl])

  async function speak(text:string){
    if(!settings.voice){ setErr('No voice selected. Go to TTS tab.'); return }
    if(voices.length && !voices.includes(settings.voice)){
      setErr('Selected voice is no longer available. Click Refresh in TTS tab.')
      return
    }
    setErr('')
    try{
      const r=await fetch(`${settings.ttsBaseUrl}/tts/speak`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text,voice:settings.voice,speed:settings.speed})})
      if(!r.ok) throw new Error(await r.text())
      const blob=await r.blob()
      const url=URL.createObjectURL(blob)
      const a=new Audio(url); await a.play(); a.onended=()=>URL.revokeObjectURL(url)
    }catch(e:any){ setErr(String(e?.message??e)) }
  }

  function Top(){
    return (
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="row" style={{gap:10}}>
          <div className="pill" style={{borderRadius:14,padding:'10px 12px',fontWeight:700}}>Klim op</div>
          <div className="pill">Streak {stats.streak}🔥</div>
          <div className="pill">Today {dueCount}</div>
        </div>
        <div className="row">
          <button onClick={()=>setRoute('home')}>Home</button>
          <button onClick={()=>setRoute('study')}>Daily</button>
          <button onClick={()=>setRoute('progress')}>Progress</button>
          <button onClick={()=>setRoute('tts')}>TTS</button>
        </div>
      </div>
    )
  }

  function Home(){
    if(!course) return null
    const now = Date.now()
    const byTheme = course.themes.map(t=>{
      const cards = course.vocab.filter(v=>v.theme===t.id)
      const dueReview = cards.filter(v=>{const r=reviewsMap[v.id]; return !!r && r.due<=now}).length
      const unseen = cards.filter(v=>!reviewsMap[v.id]).length
      return {id:t.id,title:t.title,dueReview,unseen,total:cards.length}
    })

    return (
      <div className="row studyLayout" style={{alignItems:'stretch'}}>
        <div className="card" style={{flex:2}}>
          <div className="h1">Daily calm practice</div>
          <div className="h2">Binary checks, theme-based, capped daily queue.</div>
          <div className="sep" />
          <div className="row">
            <button onClick={()=>setRoute('study')}>Start Daily</button>
            <button onClick={()=>speak('Hallo! Hoe gaat het?')}>🔊 Test Speak</button>
          </div>
          <div className="sep" />
          <div className="small">Daily target: {settings.dailyTarget} cards • New cards/day: {settings.newPerDay}</div>
          <div className="sep" />
          <div className="grid">
            {byTheme.map(t=>(
              <div key={t.id} className="card" style={{padding:12}}>
                <div style={{fontWeight:700}}>{t.title}</div>
                <div className="small" style={{marginTop:6}}>Due reviews: {t.dueReview}</div>
                <div className="small">Unseen: {t.unseen}</div>
                <div className="small">Total: {t.total}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{flex:1}}>
          <div className="h1">Status</div>
          <div className="h2">Local-only progress.</div>
          <div className="sep" />
          <div className="row">
            <div className="pill">Reviews today {stats.reviewsToday}</div>
            <div className="pill">Correct {stats.correctToday}</div>
            <div className="pill">New {stats.newToday}</div>
          </div>
        </div>
      </div>
    )
  }

  function Study(){
    if(!course) return null
    const [idx,setIdx]=useState(0)
    const [showTranslation,setShowTranslation]=useState(false)
    const [showClue,setShowClue]=useState(false)
    const [clueError,setClueError]=useState(false)

    const now = Date.now()
    const baseDeck = useMemo(()=> studyTheme===0 ? course.vocab : course.vocab.filter(v=>v.theme===studyTheme),[course,studyTheme])

    const queue = useMemo(()=>{
      const dueReviews = baseDeck
        .filter(v=>{ const r=reviewsMap[v.id]; return !!r && r.due<=now })
        .sort((a,b)=>(reviewsMap[a.id]?.due||0)-(reviewsMap[b.id]?.due||0))

      const unseen = baseDeck.filter(v=>!reviewsMap[v.id])
      const newSlots = Math.max(0, settings.newPerDay - stats.newToday)
      const newPart = studyContinueMode ? unseen : unseen.slice(0,newSlots)

      return studyContinueMode
        ? [...dueReviews, ...newPart]
        : [...dueReviews, ...newPart].slice(0,settings.dailyTarget)
    },[baseDeck,reviewsMap,now,stats.newToday,settings.newPerDay,settings.dailyTarget,studyContinueMode])

    const cur=queue[idx]

    const themePlan = useMemo(()=>course.themes.map(t=>{
      const cards=course.vocab.filter(v=>v.theme===t.id)
      const dueReviews = cards.filter(v=>{const r=reviewsMap[v.id]; return !!r && r.due<=now}).length
      const unseen = cards.filter(v=>!reviewsMap[v.id]).length
      const planned = studyContinueMode
        ? (dueReviews + unseen)
        : Math.min(settings.dailyTarget, dueReviews + Math.min(unseen, Math.max(0, settings.newPerDay - stats.newToday)))
      return {id:t.id,title:t.title,planned,dueReviews,unseen}
    }),[course,reviewsMap,now,stats.newToday,studyContinueMode,settings.dailyTarget,settings.newPerDay])

    useEffect(()=>{
      if(idx>=queue.length) setIdx(0)
    },[queue.length,idx])

    useEffect(()=>{
      setIdx(0)
      setShowTranslation(false)
      setShowClue(false)
      setClueError(false)
    },[studyTheme])

    useEffect(()=>{
      setShowTranslation(false)
      setShowClue(false)
      setClueError(false)
    },[cur?.id])

    useEffect(()=>{
      if(cur && settings.autoSpeak) speak(cur.article? `${cur.article} ${cur.nl}`:cur.nl)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },[idx,settings.autoSpeak,cur?.id])

    function answer(correct:boolean){
      if(!cur) return
      const map={...reviewsMap}
      const wasNew = !map[cur.id]
      const r=upsertReview(map,cur.id)
      gradeBinary(r,correct)
      setReviewsMap(map)

      const s={...stats}
      s.reviewsToday+=1
      if(correct) s.correctToday+=1
      if(wasNew) s.newToday+=1
      setStats(s)
      saveJSON(LS.stats,s)

      setIdx(i=>i+1)
      setShowTranslation(false)
      setShowClue(false)
      setClueError(false)
    }

    if(!cur){
      return (
        <div className="card">
          <div className="h1">No cards in this plan</div>
          <div className="h2">You reached today&apos;s target for this theme.</div>
          <div className="sep" />
          <div className="row">
            <button onClick={()=>setStudyContinueMode(true)}>Continue beyond target</button>
            <button onClick={()=>setStudyTheme(0)}>Switch to all themes</button>
          </div>
        </div>
      )
    }

    const clueQuery = encodeURIComponent((cur.en || cur.nl).replace(/[()]/g,' '))
    const clueUrl = `https://source.unsplash.com/900x520/?${clueQuery}`

    return (
      <div className="row" style={{alignItems:'stretch'}}>
        <div className="card studyMain" style={{flex:2}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'flex-end'}}>
            <div>
              <div className="h1">Daily SRS</div>
              <div className="h2">{idx+1} / {queue.length} planned today</div>
            </div>
            <div className="studyTopActions">
              <button onClick={()=>speak(cur.article?`${cur.article} ${cur.nl}`:cur.nl)}>🔊</button>
              <div>
                <div className="small">Theme</div>
                <select value={studyTheme} onChange={e=>setStudyTheme(Number(e.target.value))}>
                  <option value={0}>All themes</option>
                  {course.themes.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <button onClick={()=>setStudyContinueMode(v=>!v)}>{studyContinueMode ? 'Planned only' : 'Continue'}</button>
            </div>
          </div>

          <div className="sep" />
          <div className="bigword">{cur.article? `${cur.article} `:''}{cur.nl}</div>

          <div className="flipCard" onClick={()=>setShowTranslation(v=>!v)}>
            <div className="small">Flip card</div>
            <div style={{marginTop:6, textAlign:'center'}}>
              {showTranslation ? (cur.en ?? '—') : 'Tap to reveal translation'}
            </div>
          </div>

          <div className="clueCard" onClick={()=>setShowClue(v=>!v)}>
            {!showClue && <div style={{textAlign:'center'}}>Tap to reveal clue image</div>}
            {showClue && !clueError && (
              <img
                src={clueUrl}
                alt={`Clue for ${cur.nl}`}
                className="clueImage"
                onError={()=>setClueError(true)}
              />
            )}
            {showClue && clueError && (
              <div className="small" style={{textAlign:'center'}}>No clue image found for this word.</div>
            )}
          </div>

          <div className="studyBottom">
            <div className="row" style={{justifyContent:'center'}}>
              <button onClick={()=>answer(false)}>Incorrect</button>
              <button onClick={()=>answer(true)}>Correct</button>
            </div>
          </div>
        </div>

        <div className="card" style={{flex:1}}>
          <div className="h1">Queue</div>
          <div className="h2">Planned now: {queue.length}</div>
          <div className="sep" />
          <div className="small" style={{maxHeight:'clamp(260px, 34vh, 420px)',overflow:'auto'}}>
            {themePlan.map(t=>{
              const active = studyTheme===t.id
              return (
                <div key={t.id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  <button onClick={()=>setStudyTheme(t.id)} style={{width:'100%',textAlign:'left',padding:'8px 10px',background:active?'rgba(255,255,255,0.14)':'var(--panel)'}}>
                    {t.title}
                  </button>
                  <div className="small" style={{marginTop:4}}>Planned {t.planned} • Due {t.dueReviews} • New {Math.min(t.unseen, Math.max(0, settings.newPerDay - stats.newToday))}</div>
                </div>
              )
            })}
          </div>
          <div className="sep" />
          <div className="small" style={{maxHeight:'clamp(260px, 34vh, 420px)',overflow:'auto'}}>
            {queue.slice(idx, idx+20).map(v=><div key={v.id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>{v.nl}</div>)}
          </div>
        </div>
      </div>
    )
  }

  function Progress(){
    const acc = stats.reviewsToday ? Math.round(100*stats.correctToday/stats.reviewsToday) : 0
    return (
      <div className="card">
        <div className="h1">Progress</div>
        <div className="h2">Binary scoring with daily caps.</div>
        <div className="sep" />
        <div className="row">
          <div className="pill">Streak {stats.streak}🔥</div>
          <div className="pill">Today target {dueCount}</div>
          <div className="pill">Reviews today {stats.reviewsToday}</div>
          <div className="pill">Accuracy {acc}%</div>
          <div className="pill">New today {stats.newToday}</div>
        </div>
        <div className="sep" />
        <button onClick={()=>{
          localStorage.removeItem(LS.reviews)
          localStorage.removeItem(LS.stats)
          setReviewsMap({})
          setStats(ensureStats())
        }}>Reset local progress</button>
      </div>
    )
  }

  function TTS(){
    return (
      <div className="row" style={{alignItems:'stretch'}}>
        <div className="card" style={{flex:2}}>
          <div className="h1">TTS</div>
          <div className="h2">Local FastAPI + sherpa-onnx-offline-tts</div>
          <div className="sep" />
          <div>
            <div className="small">API base URL</div>
            <input
              value={settings.ttsBaseUrl}
              onChange={e=>setSettings(s=>({...s,ttsBaseUrl:e.target.value}))}
              style={{width:'100%'}}
            />
            <div className="row" style={{justifyContent:'flex-end', marginTop:10}}>
              <button onClick={refreshVoices}>Refresh</button>
            </div>
          </div>
          <div className="sep" />
          <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:12}}>
            <div>
              <div className="small">Voice</div>
              <select
                value={settings.voice}
                onChange={e=>setSettings(s=>({...s,voice:e.target.value}))}
                style={{width:'100%'}}
              >
                {voices.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div>
              <div className="small">Speed</div>
              <input
                type="number"
                min="0.6"
                max="1.4"
                step="0.05"
                value={settings.speed}
                onChange={e=>setSettings(s=>({...s,speed:Number(e.target.value)}))}
                style={{width:'100%'}}
              />
            </div>

            <div style={{gridColumn:'1 / -1'}}>
              <div className="small">Auto-speak</div>
              <select
                value={settings.autoSpeak?'yes':'no'}
                onChange={e=>setSettings(s=>({...s,autoSpeak:e.target.value==='yes'}))}
                style={{width:'100%'}}
              >
                <option value="no">No</option><option value="yes">Yes</option>
              </select>
            </div>
          </div>
          <div className="sep" />
          <div>
            <div className="h2">Study settings</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:8}}>
              <div>
                <div className="small">Daily target</div>
                <input
                  type="number"
                  min={MIN_DAILY_TARGET}
                  max={MAX_DAILY_TARGET}
                  value={settings.dailyTarget}
                  onChange={e=>setSettings(s=>({...s,dailyTarget:Math.round(clamp(Number(e.target.value||DEFAULT_DAILY_TARGET), MIN_DAILY_TARGET, MAX_DAILY_TARGET))}))}
                  style={{width:'100%'}}
                />
              </div>
              <div>
                <div className="small">New cards/day</div>
                <input
                  type="number"
                  min={MIN_NEW_PER_DAY}
                  max={MAX_NEW_PER_DAY}
                  value={settings.newPerDay}
                  onChange={e=>setSettings(s=>({...s,newPerDay:Math.round(clamp(Number(e.target.value||DEFAULT_NEW_PER_DAY), MIN_NEW_PER_DAY, MAX_NEW_PER_DAY))}))}
                  style={{width:'100%'}}
                />
              </div>
            </div>
            <div className="small" style={{marginTop:8}}>You can still override the plan anytime in Study with the Continue button.</div>
          </div>
          <div className="sep" />
          <button onClick={()=>speak('Hallo! Hoe gaat het?')}>Test</button>
          {err && <div className="card" style={{marginTop:12}}><div className="small" style={{whiteSpace:'pre-wrap'}}>{err}</div></div>}
        </div>
        <div className="card" style={{flex:1}}>
          <div className="h1">Voice packs</div>
          <div className="h2">Install models under:</div>
          <div className="sep" />
          <div className="small" style={{wordBreak:'break-all'}}>/Users/fmjduboc/.openclaw/tools/sherpa-onnx-tts/models/</div>
        </div>
      </div>
    )
  }

  if(!course){
    return <div className="container"><Top /><div className="sep" /><div className="card">Loading course… (run tools/import_audio.py & tools/extract_content.py)</div></div>
  }

  return (
    <div className="container">
      <Top />
      <div className="sep" />
      <div className="pageContent">
        {route==='home' && <div className="pagePane"><Home /></div>}
        {route==='study' && <div className="pagePane"><Study /></div>}
        {route==='progress' && <div className="pagePane"><Progress /></div>}
        {route==='tts' && <div className="pagePane"><TTS /></div>}
      </div>
      <div className="sep appFooterSep" />
      <div className="small appFooterText">MVP • local-only • calm UI • private</div>
    </div>
  )
}
