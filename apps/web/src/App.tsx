import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Vocab = { id:string; theme:number; nl:string; en?:string|null; article?:'de'|'het'|null }
type Review = { id:string; due:number; interval:number; ease:number; reps:number; lapses:number; learningStep?:number }
type Book = { id:string; title:string; levels:string; url:string }
type BooksManifest = { books:Book[]; placeholders?:number }
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
type GrammarVerb = { id:string; infinitive:string; en:string; type:string; auxiliary:string; present:Record<string,string>; past:Record<string,string>; perfect:string }
type GrammarData = { version:string; verbs:GrammarVerb[]; zullen?:{ present:Record<string,string>; past:Record<string,string> } }

const LS = { reviews:'klimop.reviews.v1', stats:'klimop.stats.v1', settings:'klimop.settings.v1', difficult:'klimop.difficult.v1' }
const todayISO = ()=> new Date().toISOString().slice(0,10)
const loadJSON = <T,>(k:string, f:T):T => { try{ const s=localStorage.getItem(k); return s? JSON.parse(s):f }catch{return f} }
const saveJSON = (k:string,v:any)=> localStorage.setItem(k, JSON.stringify(v))

const SCOPED_KEY_MIGRATED = 'klimop.reviews.scopedMigrated'
function scopedKey(bookId:string, vocabId:string):string { return `${bookId}:${vocabId}` }
function migrateToScopedKeys(reviews:Record<string,Review>, difficult:Record<string,boolean>):{reviews:Record<string,Review>;difficult:Record<string,boolean>}{
  if(localStorage.getItem(SCOPED_KEY_MIGRATED)) return {reviews,difficult}
  const migratedReviews:Record<string,Review>={}
  const migratedDifficult:Record<string,boolean>={}
  for(const [k,v] of Object.entries(reviews)) migratedReviews[k.includes(':')?k:`klimop:${k}`]=v
  for(const [k,v] of Object.entries(difficult)) migratedDifficult[k.includes(':')?k:`klimop:${k}`]=v
  localStorage.setItem(SCOPED_KEY_MIGRATED,'1')
  saveJSON(LS.reviews,migratedReviews)
  saveJSON(LS.difficult,migratedDifficult)
  return {reviews:migratedReviews,difficult:migratedDifficult}
}

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

const LEARNING_STEP_1_MS = 60*1000
const LEARNING_STEP_2_MS = 10*60*1000

function interleaveAfter<T>(main:T[], wrong:T[], everyN:number):T[]{
  if(wrong.length===0) return main
  const out:T[]=[]
  let wi=0
  for(let i=0;i<main.length;i++){
    out.push(main[i])
    if((i+1)%everyN===0 && wi<wrong.length) out.push(wrong[wi++])
  }
  while(wi<wrong.length) out.push(wrong[wi++])
  return out
}

function gradeBinary(r:Review, correct:boolean, isDifficult?:boolean){
  r.reps += 1
  const now = Date.now()
  if(!correct){
    r.lapses += 1
    r.interval = 0
    r.learningStep = 1
    r.ease = Math.max(1.3, r.ease - 0.2)
    r.due = now + LEARNING_STEP_2_MS
    return
  }
  r.ease = Math.min(2.8, r.ease + 0.05)
  const step = r.learningStep ?? 0
  if(step===1){
    r.learningStep = 2
    r.due = now + LEARNING_STEP_2_MS
    return
  }
  if(step===2){
    r.learningStep = 0
    r.interval = 1
    r.due = now + 86400000
    if(isDifficult) r.interval = 1
    return
  }
  if(r.interval===0){
    r.learningStep = 1
    r.due = now + LEARNING_STEP_1_MS
    return
  }
  if(r.interval===1) r.interval=3
  else r.interval=Math.round(r.interval*r.ease)
  if(isDifficult) r.interval=Math.min(r.interval,1)
  r.due=now+r.interval*86400000
}

async function fetchJSON<T>(url:string):Promise<T>{
  const r=await fetch(url); if(!r.ok) throw new Error(await r.text()); return r.json()
}

export default function App(){
  const [books,setBooks]=useState<Book[]>([])
  const [coursesByBookId,setCoursesByBookId]=useState<Record<string,Course>>({})
  const [currentBookId,setCurrentBookId]=useState<string>('klimop')
  const [route,setRoute]=useState<'home'|'study'|'progress'|'tts'|'deofhet'|'grammar'>('home')
  const rawReviews=useMemo(()=>loadJSON<Record<string,Review>>(LS.reviews,{}),[])
  const rawDifficult=useMemo(()=>loadJSON<Record<string,boolean>>(LS.difficult,{}),[])
  const {reviews:migratedReviews,difficult:migratedDifficult}=useMemo(()=>migrateToScopedKeys(rawReviews,rawDifficult),[rawReviews,rawDifficult])
  const [reviewsMap,setReviewsMap]=useState<Record<string,Review>>(migratedReviews)
  const [difficultMap,setDifficultMap]=useState<Record<string,boolean>>(migratedDifficult)
  const [stats,setStats]=useState<Stats>(()=>ensureStats())
  const [studyTheme,setStudyTheme]=useState<number>(0)
  const [studyContinueMode,setStudyContinueMode]=useState(false)
  const [studySeenSession,setStudySeenSession]=useState<Record<string,boolean>>({})
  const [settings,setSettings]=useState<Settings>(()=>normalizeSettings(loadJSON(LS.settings,null)))
  const [voices,setVoices]=useState<string[]>([])
  const [err,setErr]=useState('')

  useEffect(()=>{
    fetchJSON<BooksManifest>('/content/books.json')
      .then(m=>{
        setBooks(m.books)
        return Promise.all(m.books.map(b=>fetchJSON<Course>(b.url).then(c=>[b.id,c] as const)))
      })
      .then(entries=>{
        const map:Record<string,Course>={}
        for(const [id,c] of entries) map[id]=c
        setCoursesByBookId(map)
      })
      .catch(()=>{
        fetchJSON<Course>('/content/course.json')
          .then(c=>{
            setBooks([{id:'klimop',title:'Klim Op',levels:'A0 naar A1',url:'/content/course.json'}])
            setCoursesByBookId({klimop:c})
          })
          .catch(e=>setErr(String(e)))
      })
  },[])
  useEffect(()=>saveJSON(LS.reviews,reviewsMap),[reviewsMap])
  useEffect(()=>saveJSON(LS.difficult,difficultMap),[difficultMap])
  useEffect(()=>saveJSON(LS.settings,settings),[settings])
  useEffect(()=>{
    if(route!=='study') setStudySeenSession({})
  },[route])
  useEffect(()=>{
    setStudySeenSession({})
  },[studyTheme])

  const course = coursesByBookId[currentBookId] ?? null
  const currentBook = books.find(b=>b.id===currentBookId)
  useEffect(()=>{
    if(!course && books.length>0 && Object.keys(coursesByBookId).length>0){
      const firstLoaded = books.find(b=>coursesByBookId[b.id])
      if(firstLoaded) setCurrentBookId(firstLoaded.id)
    }
  },[course,books,coursesByBookId])

  const dueCount = useMemo(()=>{
    if(!course) return 0
    const now=Date.now()
    const sk=(id:string)=>scopedKey(currentBookId,id)
    const dueReviews = course.vocab.filter(v=>{
      const r = reviewsMap[sk(v.id)]
      return !!r && r.due<=now
    })
    const difficultRepeat = course.vocab.filter(v=>{
      if(!difficultMap[sk(v.id)]) return false
      const r = reviewsMap[sk(v.id)]
      return !r || r.due>now
    }).length
    const unseen = course.vocab.filter(v=>!reviewsMap[sk(v.id)]).length
    const newSlots = Math.max(0, settings.newPerDay - stats.newToday)
    return Math.min(settings.dailyTarget, dueReviews.length + difficultRepeat + Math.min(unseen, newSlots))
  },[course,currentBookId,reviewsMap,difficultMap,stats.newToday,settings.dailyTarget,settings.newPerDay])

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
        <div className="row" style={{gap:10,flexWrap:'wrap'}}>
          <div className="row" style={{gap:4}}>
            {books.map(b=>(
              <button
                key={b.id}
                onClick={()=>setCurrentBookId(b.id)}
                className="pill"
                style={{
                  borderRadius:14,
                  padding:'10px 12px',
                  fontWeight:currentBookId===b.id?700:400,
                  background:currentBookId===b.id?'rgba(255,255,255,0.14)':'var(--panel)',
                  border:'1px solid rgba(255,255,255,0.12)',
                }}
              >
                {b.title}
              </button>
            ))}
            <button
              onClick={()=>setRoute('deofhet')}
              className="pill"
              style={{
                borderRadius:14,
                padding:'10px 12px',
                fontWeight:route==='deofhet'?700:500,
                background:route==='deofhet'?'rgba(255,255,255,0.14)':'var(--panel)',
                border:'1px solid rgba(255,255,255,0.12)',
              }}
            >
              De of Het
            </button>
            <button
              onClick={()=>setRoute('grammar')}
              className="pill"
              style={{
                borderRadius:14,
                padding:'10px 12px',
                fontWeight:route==='grammar'?700:500,
                background:route==='grammar'?'rgba(255,255,255,0.14)':'var(--panel)',
                border:'1px solid rgba(255,255,255,0.12)',
              }}
            >
              Grammar
            </button>
          </div>
          <div className="pill">Streak {stats.streak}🔥</div>
          <div className="pill">Today {dueCount}</div>
        </div>
        <div className="row" style={{gap:4}}>
          <button onClick={()=>setRoute('home')} style={{fontWeight:route==='home'?700:400}}>Home</button>
          <button onClick={()=>setRoute('study')} style={{fontWeight:route==='study'?700:400}}>Daily</button>
          <button onClick={()=>setRoute('progress')} style={{fontWeight:route==='progress'?700:400}}>Progress</button>
          <button onClick={()=>setRoute('tts')} style={{fontWeight:route==='tts'?700:400}}>TTS</button>
        </div>
      </div>
    )
  }

  function Home(){
    if(!course) return null
    const now = Date.now()
    const sk=(id:string)=>scopedKey(currentBookId,id)
    const byTheme = course.themes.map(t=>{
      const cards = course.vocab.filter(v=>v.theme===t.id)
      const dueReview = cards.filter(v=>{const r=reviewsMap[sk(v.id)]; return !!r && r.due<=now}).length
      const unseen = cards.filter(v=>!reviewsMap[sk(v.id)]).length
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
    const [sessionWrongIds,setSessionWrongIds]=useState<Set<string>>(new Set())
    const sk=(id:string)=>scopedKey(currentBookId,id)

    const now = Date.now()
    const baseDeck = useMemo(()=> studyTheme===0 ? course.vocab : course.vocab.filter(v=>v.theme===studyTheme),[course,studyTheme])

    const queue = useMemo(()=>{
      const sessionWrongRetry = baseDeck.filter(v=>sessionWrongIds.has(v.id))

      const dueReviews = baseDeck
        .filter(v=>{
          if(sessionWrongIds.has(v.id)) return false
          const r=reviewsMap[sk(v.id)]
          if(!r || r.due>now) return false
          const step = r.learningStep ?? 0
          if(step>0) return true
          return !studySeenSession[v.id]
        })
        .sort((a,b)=>{
          const ra=reviewsMap[sk(a.id)], rb=reviewsMap[sk(b.id)]
          const sa=ra?.learningStep??0, sb=rb?.learningStep??0
          if((sa>0)!==(sb>0)) return sa>0?-1:1
          return (ra?.due??0)-(rb?.due??0)
        })

      const difficultPart = baseDeck
        .filter(v=>{
          if(sessionWrongIds.has(v.id)) return false
          if(!difficultMap[sk(v.id)]) return false
          if(studySeenSession[v.id]) return false
          const r = reviewsMap[sk(v.id)]
          return !r || r.due>now
        })
        .sort((a,b)=>(reviewsMap[sk(a.id)]?.due||Number.MAX_SAFE_INTEGER)-(reviewsMap[sk(b.id)]?.due||Number.MAX_SAFE_INTEGER))

      const unseen = baseDeck.filter(v=>!reviewsMap[sk(v.id)] && !studySeenSession[v.id] && !sessionWrongIds.has(v.id))
      const newSlots = Math.max(0, settings.newPerDay - stats.newToday)
      const newPart = studyContinueMode ? unseen : unseen.slice(0,newSlots)

      const seen = new Set<string>()
      const main = [...difficultPart, ...dueReviews, ...newPart].filter(v=>{
        if(seen.has(v.id)) return false
        seen.add(v.id)
        return true
      })
      const wrongList = sessionWrongRetry.filter(v=>!seen.has(v.id))
      const merged = interleaveAfter(main,wrongList,3)

      return studyContinueMode ? merged : merged.slice(0,settings.dailyTarget)
    },[baseDeck,currentBookId,reviewsMap,difficultMap,studySeenSession,sessionWrongIds,now,stats.newToday,settings.newPerDay,settings.dailyTarget,studyContinueMode])

    const cur=queue[0]
    const answeredSessionCount = Object.keys(studySeenSession).length
    const plannedTotal = answeredSessionCount + queue.length
    const currentPos = plannedTotal===0 ? 0 : Math.min(plannedTotal, answeredSessionCount + 1)

    const themePlan = useMemo(()=>course.themes.map(t=>{
      const cards=course.vocab.filter(v=>v.theme===t.id)
      const dueReviews = cards.filter(v=>{const r=reviewsMap[sk(v.id)]; return !!r && r.due<=now}).length
      const difficultRepeat = cards.filter(v=>{
        if(!difficultMap[sk(v.id)]) return false
        const r = reviewsMap[sk(v.id)]
        return !r || r.due>now
      }).length
      const unseen = cards.filter(v=>!reviewsMap[sk(v.id)]).length
      const planned = studyContinueMode
        ? (dueReviews + difficultRepeat + unseen)
        : Math.min(settings.dailyTarget, dueReviews + difficultRepeat + Math.min(unseen, Math.max(0, settings.newPerDay - stats.newToday)))
      return {id:t.id,title:t.title,planned,dueReviews,difficultRepeat,unseen}
    }),[course,currentBookId,reviewsMap,difficultMap,now,stats.newToday,studyContinueMode,settings.dailyTarget,settings.newPerDay])

    useEffect(()=>{
      if(idx!==0) setIdx(0)
    },[idx,queue.length])

    useEffect(()=>{
      setIdx(0)
      setShowTranslation(false)
      setShowClue(false)
      setSessionWrongIds(new Set())
    },[studyTheme])

    useEffect(()=>{
      setShowTranslation(false)
      setShowClue(false)
    },[cur?.id])

    useEffect(()=>{
      if(cur && settings.autoSpeak) speak(cur.nl)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },[settings.autoSpeak,cur?.id])

    function answer(correct:boolean){
      if(!cur) return
      const key=sk(cur.id)
      const map={...reviewsMap}
      const wasNew = !map[key]
      const r=upsertReview(map,key)
      gradeBinary(r,correct,difficultMap[key])
      setReviewsMap(map)

      const s={...stats}
      s.reviewsToday+=1
      if(correct) s.correctToday+=1
      if(wasNew) s.newToday+=1
      setStats(s)
      saveJSON(LS.stats,s)

      const graduated = (r.learningStep ?? 0) === 0
      if(correct){
        if(graduated) setStudySeenSession(s=>({ ...s, [cur.id]: true }))
        setSessionWrongIds(prev=>{ const n=new Set(prev); n.delete(cur.id); return n })
      } else {
        setSessionWrongIds(prev=>new Set(prev).add(cur.id))
      }
      setIdx(0)
      setShowTranslation(false)
      setShowClue(false)
    }

    function toggleDifficult(){
      if(!cur) return
      const key=sk(cur.id)
      setDifficultMap(m=>({ ...m, [key]: !m[key] }))
    }

    const generateClue = (word: string) => {
      if (!word) return '';
      const first = word[0].toUpperCase();
      const rest = word.slice(1).split('').map(() => '_').join(' ');
      return `${first} ${rest}`;
    };

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

    return (
      <div className="row" style={{alignItems:'stretch'}}>
        <div className="card studyMain" style={{flex:2}}>
          <div className="row" style={{justifyContent:'space-between', alignItems:'flex-end'}}>
            <div>
              <div className="h1">Daily SRS</div>
              <div className="h2">{currentPos} / {plannedTotal} planned today</div>
            </div>
            <div className="studyTopActions">
              <button onClick={()=>speak(cur.article ? `${cur.article} ${cur.nl}` : cur.nl)} title="Hear the Dutch word">🔊</button>
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
          <div className="bigword">{cur.en ?? '—'}</div>

          <div className="flipCard" onClick={()=>setShowTranslation(v=>!v)}>
            <div className="small">Flip card</div>
            <div style={{marginTop:6, textAlign:'center'}}>
              {showTranslation ? (cur.article ? `${cur.article} ` : '') + cur.nl : 'Tap to reveal Dutch'}
            </div>
          </div>

          <div className="clueCard" onClick={()=>setShowClue(v=>!v)}>
            {!showClue && <div style={{textAlign:'center'}}>Tap to reveal clue</div>}
            {showClue && (
              <div style={{textAlign:'center', fontSize:'2rem', fontWeight:'bold'}}>
                {generateClue(cur.nl)}
              </div>
            )}
          </div>

          <div className="studyBottom">
            <div className="row" style={{justifyContent:'center'}}>
              <button
                onClick={toggleDifficult}
                style={difficultMap[sk(cur.id)]
                  ? {
                    background:'rgba(245, 158, 11, 0.18)',
                    borderColor:'rgba(245, 158, 11, 0.45)',
                    color:'rgba(255, 244, 214, 0.96)',
                  }
                  : undefined}
              >
                Difficult
              </button>
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
                  <div className="small" style={{marginTop:4}}>Planned {t.planned} • Due {t.dueReviews} • Difficult {t.difficultRepeat} • New {Math.min(t.unseen, Math.max(0, settings.newPerDay - stats.newToday))}</div>
                </div>
              )
            })}
          </div>
          <div className="sep" />
          <div className="small" style={{maxHeight:'clamp(260px, 34vh, 420px)',overflow:'auto'}}>
            {queue.slice(0,20).map(v=><div key={v.id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>{v.en ?? v.nl}</div>)}
          </div>
        </div>
      </div>
    )
  }

  function Progress(){
    const now = Date.now()
    const acc = stats.reviewsToday ? Math.round(100*stats.correctToday/stats.reviewsToday) : 0
    const placeholdersCount = 2

    function BookProgressSection({bookId,bookTitle,bookLevels,courseData}:{bookId:string;bookTitle:string;bookLevels:string;courseData:Course|null}){
      if(!courseData){
        return (
          <div className="card progressThemeCard" style={{opacity:0.6}}>
            <div className="h1" style={{fontSize:24}}>{bookTitle}</div>
            <div className="small" style={{marginTop:8}}>Loading…</div>
          </div>
        )
      }
      const c = courseData
      const sk=(id:string)=>scopedKey(bookId,id)
      const byTheme = c.themes.map(t=>{
        const cards = c.vocab.filter(v=>v.theme===t.id)
        const total = cards.length
        const seen = cards.filter(v=>!!reviewsMap[sk(v.id)]).length
        const due = cards.filter(v=>{ const r=reviewsMap[sk(v.id)]; return !!r && r.due<=now }).length
        const difficult = cards.filter(v=>!!difficultMap[sk(v.id)]).length
        const mastered = cards.filter(v=>{
          const r=reviewsMap[sk(v.id)]
          return !!r && r.interval>=7 && r.due>now
        }).length
        const unseen = total - seen
        const seenPct = total ? Math.round((seen/total)*100) : 0
        const masteredPct = total ? Math.round((mastered/total)*100) : 0
        return {id:t.id,title:t.title,total,seen,unseen,due,difficult,mastered,seenPct,masteredPct}
      })

      function resetThemeProgress(themeId:number){
        const ids = new Set(c.vocab.filter(v=>v.theme===themeId).map(v=>sk(v.id)))
        setReviewsMap(prev=>{ const next={...prev}; for(const id of ids) delete next[id]; return next })
        setDifficultMap(prev=>{ const next={...prev}; for(const id of ids) delete next[id]; return next })
        setStudySeenSession(prev=>{
          const vocabIds = c.vocab.filter(v=>v.theme===themeId).map(v=>v.id)
          const next={...prev}; for(const id of vocabIds) delete next[id]; return next
        })
      }

      function resetBookProgress(){
        const ids = new Set(c.vocab.map(v=>sk(v.id)))
        const vocabIds = c.vocab.map(v=>v.id)
        setReviewsMap(prev=>{ const next={...prev}; for(const id of ids) delete next[id]; return next })
        setDifficultMap(prev=>{ const next={...prev}; for(const id of ids) delete next[id]; return next })
        setStudySeenSession(prev=>{ const next={...prev}; for(const id of vocabIds) delete next[id]; return next })
      }

      return (
        <div className="card progressThemeCard">
          <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div className="h1" style={{fontSize:24,marginBottom:4}}>{bookTitle}</div>
              <div className="small" style={{color:'var(--muted)'}}>{bookLevels}</div>
            </div>
            <button onClick={resetBookProgress}>Reset book</button>
          </div>
          <div className="sep" />
          <div className="themeGrid">
            {byTheme.map(t=>(
              <div key={t.id} className="themeStatCard">
                <div className="row" style={{justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontWeight:700}}>{t.title}</div>
                  <button onClick={()=>resetThemeProgress(t.id)}>Reset theme</button>
                </div>
                <div className="themeBarTrack" aria-label={`Progress for ${t.title}`}>
                  <div className="themeBarSeen" style={{width:`${t.seenPct}%`}} />
                  <div className="themeBarMastered" style={{width:`${t.masteredPct}%`}} />
                </div>
                <div className="small">Seen {t.seen}/{t.total} ({t.seenPct}%) • Mastered {t.mastered} ({t.masteredPct}%)</div>
                <div className="small">Unseen {t.unseen} • Due {t.due} • Difficult {t.difficult}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="progressLayout">
        <div className="card">
          <div className="h1">Progress Dashboard</div>
          <div className="h2">Track progress by book and theme. Combined view.</div>
          <div className="sep" />
          <div className="row">
            <div className="pill">Streak {stats.streak}🔥</div>
            <div className="pill">Today target {dueCount}</div>
            <div className="pill">Reviews today {stats.reviewsToday}</div>
            <div className="pill">Accuracy {acc}%</div>
            <div className="pill">New today {stats.newToday}</div>
          </div>
          <div className="sep" />
          <div className="targetGrid">
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
          <div className="small" style={{marginTop:8}}>Targets are saved immediately and apply to the next queue build.</div>
        </div>

        {books.map(b=>(
          <BookProgressSection
            key={b.id}
            bookId={b.id}
            bookTitle={b.title}
            bookLevels={b.levels}
            courseData={coursesByBookId[b.id] ?? null}
          />
        ))}
        {Array.from({length:placeholdersCount},(_,i)=>(
          <div key={`placeholder-${i}`} className="card progressThemeCard" style={{opacity:0.5,borderStyle:'dashed'}}>
            <div className="h1" style={{fontSize:24}}>Book {books.length+i+1}</div>
            <div className="small" style={{marginTop:8}}>Coming soon</div>
          </div>
        ))}

        <div className="card" style={{marginTop:12}}>
          <button onClick={()=>{
            localStorage.removeItem(LS.reviews)
            localStorage.removeItem(LS.stats)
            localStorage.removeItem(LS.difficult)
            localStorage.removeItem(SCOPED_KEY_MIGRATED)
            setReviewsMap({})
            setDifficultMap({})
            setStats(ensureStats())
            setStudySeenSession({})
          }}>Reset all progress (all books)</button>
        </div>
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

  const DEHET_LS = 'klimop.deofhet.v2'
  type DeHetStats = { correct:number; total:number; wrongIds:Record<string,number>; mastered:Record<string,boolean>; streak:Record<string,number> }
  function DeOfHet({ coursesByBookId, reviewsMap, difficultMap, speak }:{ coursesByBookId:Record<string,Course>; reviewsMap:Record<string,Review>; difficultMap:Record<string,boolean>; speak:(t:string)=>Promise<void> }){
    const wrongKey = (v:Vocab)=>v.nl.toLowerCase()

    const difficultNls = useMemo(()=>{
      const set = new Set<string>()
      for(const [bookId,c] of Object.entries(coursesByBookId)){
        if(!c?.vocab) continue
        for(const v of c.vocab){
          if(difficultMap[scopedKey(bookId,v.id)]) set.add(v.nl.toLowerCase())
        }
      }
      return set
    },[coursesByBookId,difficultMap])

    const fullPool = useMemo(()=>{
      const seen = new Set<string>()
      const out:Vocab[]=[]
      for(const c of Object.values(coursesByBookId)){
        if(!c?.vocab) continue
        for(const v of c.vocab){
          if((v.article==='de'||v.article==='het')&&!seen.has(v.nl.toLowerCase())){
            seen.add(v.nl.toLowerCase())
            out.push(v)
          }
        }
      }
      return out
    },[coursesByBookId])

    const learnedNls = useMemo(()=>{
      const set = new Set<string>()
      for(const [bookId,c] of Object.entries(coursesByBookId)){
        if(!c?.vocab) continue
        for(const v of c.vocab){
          const r = reviewsMap[scopedKey(bookId,v.id)]
          if(r && r.interval >= 1) set.add(v.nl.toLowerCase())
        }
      }
      return set
    },[coursesByBookId,reviewsMap])

    const [stats,setStats]=useState<DeHetStats>(()=>{
      const raw=loadJSON<any>(DEHET_LS,{correct:0,total:0,wrongIds:{}})
      return {
        correct:raw.correct??0,
        total:raw.total??0,
        wrongIds:raw.wrongIds??{},
        mastered:raw.mastered??{},
        streak:raw.streak??{},
      }
    })
    const [cur,setCur]=useState<Vocab|null>(null)
    const [feedback,setFeedback]=useState<'correct'|'wrong'|null>(null)
    const [sessionWrong,setSessionWrong]=useState<string[]>([])
    const [picksSinceWrong,setPicksSinceWrong]=useState(0)
    const [triggerPick,setTriggerPick]=useState(0)

    useEffect(()=>{ saveJSON(DEHET_LS,stats) },[stats])

    const activePool = useMemo(()=>
      fullPool.filter(v=>!stats.mastered[wrongKey(v)]),
    [fullPool,stats.mastered])
    const learnedPool = useMemo(()=>
      activePool.filter(v=>learnedNls.has(wrongKey(v))),
    [activePool,learnedNls])
    const unlearnedPool = useMemo(()=>
      activePool.filter(v=>!learnedNls.has(wrongKey(v))),
    [activePool,learnedNls])

    const pickNext = useCallback(()=>{
      if(activePool.length===0) return null
      const wrongReady = sessionWrong.filter(nl=>!cur?.nl||nl.toLowerCase()!==cur.nl.toLowerCase())
      const shouldRetry = wrongReady.length>0 && picksSinceWrong>=1
      if(shouldRetry && wrongReady.length>0){
        const idx = Math.floor(Math.random()*wrongReady.length)
        const nl = wrongReady[idx]
        setSessionWrong(w=>w.filter(x=>x.toLowerCase()!==nl.toLowerCase()))
        setPicksSinceWrong(0)
        return activePool.find(v=>wrongKey(v)===nl.toLowerCase()) ?? activePool[Math.floor(Math.random()*activePool.length)]
      }
      const byWrong = [...activePool].sort((a,b)=>{
        const wa=stats.wrongIds[wrongKey(a)]??0
        const wb=stats.wrongIds[wrongKey(b)]??0
        return wb-wa
      })
      const topWrong = byWrong.filter(v=>(stats.wrongIds[wrongKey(v)]??0)>0)
      const useWrong = topWrong.length>0 && Math.random()<0.65
      if(useWrong && topWrong.length>0){
        return topWrong[Math.floor(Math.random()*Math.min(10,topWrong.length))]
      }
      const pool = learnedPool.length > 0 ? learnedPool : unlearnedPool
      const difficultInPool = pool.filter(v=>difficultNls.has(wrongKey(v)))
      const preferDifficult = difficultInPool.length>0 && Math.random()<0.6
      const pickPool = preferDifficult ? difficultInPool : pool
      return pickPool[Math.floor(Math.random()*pickPool.length)]
    },[activePool,learnedPool,unlearnedPool,stats.wrongIds,sessionWrong,picksSinceWrong,cur?.nl,difficultNls])

    useEffect(()=>{
      const next = pickNext()
      setCur(next ?? null)
      setFeedback(null)
    },[triggerPick,activePool.length,learnedPool.length,unlearnedPool.length])

    function answer(guess:'de'|'het'){
      if(!cur) return
      const correct = guess===cur.article
      const k = wrongKey(cur)
      setStats(s=>{
        const next={...s,total:s.total+1,correct:s.correct+(correct?1:0)}
        if(!correct){
          next.wrongIds={...next.wrongIds,[k]:(next.wrongIds[k]??0)+1}
          next.streak={...next.streak,[k]:0}
        } else {
          const streak = (next.streak[k]??0)+1
          next.streak={...next.streak,[k]:streak}
          if(streak>=3) next.mastered={...next.mastered,[k]:true}
        }
        return next
      })
      setFeedback(correct?'correct':'wrong')
      if(!correct){
        setSessionWrong(w=>w.some(x=>x.toLowerCase()===k)?w:[...w,cur.nl])
      } else {
        setPicksSinceWrong(p=>p+1)
      }
      setTimeout(()=>setTriggerPick(t=>t+1),correct?800:1400)
    }

    const pct = stats.total>0 ? Math.round(100*stats.correct/stats.total) : 0

    if(fullPool.length===0){
      return (
        <div className="card">
          <div className="h1">De of Het</div>
          <div className="h2">No words with articles in your books yet.</div>
        </div>
      )
    }
    if(activePool.length===0){
      return (
        <div className="card">
          <div className="h1">De of Het</div>
          <div className="h2">All words mastered! You got 3 correct in a row for every word.</div>
          <div className="sep" />
          <div className="deofhetStats">
            <span className="deofhetStatPill correct">{stats.correct} correct</span>
            <span className="deofhetStatPill total">{stats.total} total</span>
            <span className="deofhetStatPill pct">{pct}%</span>
            <span className="deofhetStatPill total">{Object.keys(stats.mastered).length} mastered</span>
          </div>
          <div className="sep" />
          <button className="pill" onClick={()=>setStats(s=>({...s,mastered:{}}))}>Practice again (reset mastered)</button>
        </div>
      )
    }

    return (
      <div className="deofhetLayout">
        <div className="card deofhetCard">
          <div className="deofhetHeader">
            <div className="h1">De of Het</div>
            <div className="h2">Choose the correct article</div>
            <div className="deofhetStats">
              <span className="deofhetStatPill correct">{stats.correct} correct</span>
              <span className="deofhetStatPill total">{stats.total} total</span>
              <span className="deofhetStatPill pct">{pct}%</span>
              <span className="deofhetStatPill total">{Object.keys(stats.mastered).length} mastered</span>
            </div>
          </div>
          <div className="sep" />
          {cur && (
            <>
              <div className={`deofhetWord ${feedback?`feedback-${feedback}`:''}`}>
                {cur.nl}
              </div>
              {feedback && (
                <div className={`deofhetFeedback feedback-${feedback}`}>
                  {feedback==='correct'?(
                    <span>✓ Correct — {cur.article} {cur.nl}</span>
                  ):(
                    <span>✗ The answer is <strong>{cur.article}</strong> {cur.nl}</span>
                  )}
                </div>
              )}
              <div className="deofhetActions">
                <button
                  className="deofhetBtn de"
                  onClick={()=>feedback===null&&answer('de')}
                  disabled={feedback!==null}
                >
                  De
                </button>
                <button
                  className="deofhetBtn het"
                  onClick={()=>feedback===null&&answer('het')}
                  disabled={feedback!==null}
                >
                  Het
                </button>
              </div>
              <button
                className="deofhetSpeak"
                onClick={()=>speak(cur.nl)}
              >
                🔊 Hear it
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const GRAMMAR_LS = 'klimop.grammar.v1'
  type GrammarStats = { correct:number; total:number; wrongIds:Record<string,number>; mastered:Record<string,boolean>; streak:Record<string,number>; mode?:'mc'|'typing' }
  type GrammarItem = { verb:GrammarVerb; tense:'present'|'past'|'perfect'|'future'|'conditional'; person?:string; correct:string; key:string }
  function Grammar({ speak }:{ speak:(t:string)=>Promise<void> }){
    const [grammarData,setGrammarData]=useState<GrammarData|null>(null)
    useEffect(()=>{ fetchJSON<GrammarData>('/content/grammar.json').then(setGrammarData).catch(()=>{}) },[])

    const fullPool = useMemo(()=>{
      if(!grammarData?.verbs) return []
      const out:GrammarItem[]=[]
      const persons = ['ik','jij','hij','wij','jullie','zij'] as const
      const singular = ['ik','jij','hij']
      const plural = ['wij','jullie','zij']
      const zullen = grammarData.zullen
      for(const v of grammarData.verbs){
        for(const p of persons){
          const form = v.present[p]
          if(form) out.push({ verb:v, tense:'present', person:p, correct:form, key:`${v.id}:present:${p}` })
        }
        for(const p of persons){
          const form = v.past[singular.includes(p)?'singular':'plural']
          if(form) out.push({ verb:v, tense:'past', person:p, correct:form, key:`${v.id}:past:${p}` })
        }
        out.push({ verb:v, tense:'perfect', correct:v.perfect, key:`${v.id}:perfect` })
        if(zullen?.present){
          for(const p of persons){
            const aux = zullen.present[p]
            if(aux) out.push({ verb:v, tense:'future', person:p, correct:`${aux} ${v.infinitive}`, key:`${v.id}:future:${p}` })
          }
        }
        if(zullen?.past){
          for(const p of persons){
            const aux = zullen.past[plural.includes(p)?'plural':'singular']
            if(aux) out.push({ verb:v, tense:'conditional', person:p, correct:`${aux} ${v.infinitive}`, key:`${v.id}:conditional:${p}` })
          }
        }
      }
      return out
    },[grammarData])

    const [stats,setStats]=useState<GrammarStats>(()=>{
      const raw=loadJSON<any>(GRAMMAR_LS,{correct:0,total:0,wrongIds:{},mastered:{},streak:{},mode:'mc'})
      return { correct:raw.correct??0, total:raw.total??0, wrongIds:raw.wrongIds??{}, mastered:raw.mastered??{}, streak:raw.streak??{}, mode:raw.mode??'mc' }
    })
    const [card,setCard]=useState<{ cur:GrammarItem|null; options:string[] }>({ cur:null, options:[] })
    const cur = card.cur
    const options = card.options
    const [feedback,setFeedback]=useState<'correct'|'wrong'|null>(null)
    const [chosenOption,setChosenOption]=useState<string|null>(null)
    const [typedAnswer,setTypedAnswer]=useState('')
    const [sessionWrong,setSessionWrong]=useState<string[]>([])
    const [picksSinceWrong,setPicksSinceWrong]=useState(0)
    const [triggerPick,setTriggerPick]=useState(0)
    const [lastPickedVerbIds,setLastPickedVerbIds]=useState<string[]>([])
    const curKeyRef = useRef<string|null>(null)
    const lastPickedVerbIdsRef = useRef<string[]>([])

    useEffect(()=>{ saveJSON(GRAMMAR_LS,stats) },[stats])

    const activePool = useMemo(()=>fullPool.filter(i=>!stats.mastered[i.key]),[fullPool,stats.mastered])

    const pickNext = useCallback(()=>{
      if(activePool.length===0) return null
      const avoid = lastPickedVerbIdsRef.current
      const avoidSameVerb = activePool.filter(i=>!avoid.includes(i.verb.id))
      const pool = avoidSameVerb.length>0 ? avoidSameVerb : activePool
      const wrongReady = sessionWrong.filter(k=>!curKeyRef.current||k!==curKeyRef.current)
      const shouldRetry = wrongReady.length>0 && picksSinceWrong>=1
      if(shouldRetry && wrongReady.length>0){
        const k = wrongReady[Math.floor(Math.random()*wrongReady.length)]
        setSessionWrong(w=>w.filter(x=>x!==k))
        setPicksSinceWrong(0)
        return pool.find(i=>i.key===k) ?? pool[Math.floor(Math.random()*pool.length)]
      }
      const byWrong = [...pool].sort((a,b)=>(stats.wrongIds[b.key]??0)-(stats.wrongIds[a.key]??0))
      const topWrong = byWrong.filter(i=>(stats.wrongIds[i.key]??0)>0)
      const useWrong = topWrong.length>0 && Math.random()<0.65
      if(useWrong && topWrong.length>0) return topWrong[Math.floor(Math.random()*Math.min(10,topWrong.length))]
      return pool[Math.floor(Math.random()*pool.length)]
    },[activePool,stats.wrongIds,sessionWrong,picksSinceWrong])

    function orthoFoils(correct:string):string[]{
      const out:string[]=[]
      if(correct.length<3) return out
      if(correct.endsWith('t')){
        out.push(correct.slice(0,-1)+'d')
        out.push(correct.slice(0,-1))
      } else if(correct.endsWith('d')){
        out.push(correct.slice(0,-1)+'t')
        out.push(correct.slice(0,-1))
      }
      if(correct.endsWith('en') && correct.length>4) out.push(correct.slice(0,-2)+'e')
      return [...new Set(out)].filter(x=>x!==correct && x.length>0)
    }

    useEffect(()=>{
      const next = pickNext()
      setFeedback(null)
      setTypedAnswer('')
      setChosenOption(null)
      if(!next){
        curKeyRef.current = null
        setCard({ cur:null, options:[] })
        return
      }
      const nextIds = [next.verb.id,...lastPickedVerbIdsRef.current].slice(0,2)
      lastPickedVerbIdsRef.current = nextIds
      setLastPickedVerbIds(nextIds)
      const distractors:string[]=[]
      const sameVerbOther = fullPool.filter(i=>i.verb.id===next.verb.id && i.correct!==next.correct).map(i=>i.correct)
      const sameTenseOther = fullPool.filter(i=>i.verb.id===next.verb.id && i.tense===next.tense && i.correct!==next.correct).map(i=>i.correct)
      const otherTenseSameVerb = sameVerbOther.filter(c=>!sameTenseOther.includes(c))
      const candidatesSameTense = [...new Set(sameTenseOther)]
      const candidatesOtherTense = [...new Set(otherTenseSameVerb)]
      while(distractors.length<2 && candidatesSameTense.length>0){
        const idx = Math.floor(Math.random()*candidatesSameTense.length)
        const v = candidatesSameTense.splice(idx,1)[0]
        if(!distractors.includes(v)) distractors.push(v)
      }
      while(distractors.length<2 && candidatesOtherTense.length>0){
        const idx = Math.floor(Math.random()*candidatesOtherTense.length)
        const v = candidatesOtherTense.splice(idx,1)[0]
        if(!distractors.includes(v)) distractors.push(v)
      }
      const foils = orthoFoils(next.correct).filter(f=>!distractors.includes(f))
      while(distractors.length<2 && foils.length>0){
        const v = foils.splice(Math.floor(Math.random()*foils.length),1)[0]
        if(!distractors.includes(v)) distractors.push(v)
      }
      const all = [next.correct,...distractors.slice(0,2)]
      for(let i=all.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [all[i],all[j]]=[all[j],all[i]] }
      curKeyRef.current = next.key
      setCard({ cur:next, options:all })
    },[triggerPick,pickNext,fullPool])

    function answer(guess:string){
      if(!cur) return
      if(stats.mode==='mc') setChosenOption(guess)
      const normalized = guess.toLowerCase().trim()
      const correct = normalized===cur.correct.toLowerCase()
      setStats(s=>{
        const next={...s,total:s.total+1,correct:s.correct+(correct?1:0)}
        if(!correct){ next.wrongIds={...next.wrongIds,[cur.key]:(next.wrongIds[cur.key]??0)+1}; next.streak={...next.streak,[cur.key]:0} }
        else { const streak=(next.streak[cur.key]??0)+1; next.streak={...next.streak,[cur.key]:streak}; if(streak>=3) next.mastered={...next.mastered,[cur.key]:true} }
        return next
      })
      setFeedback(correct?'correct':'wrong')
      if(!correct) setSessionWrong(w=>w.includes(cur.key)?w:[...w,cur.key])
      else setPicksSinceWrong(p=>p+1)
      setTimeout(()=>setTriggerPick(t=>t+1),correct?800:1400)
    }

    const pct = stats.total>0 ? Math.round(100*stats.correct/stats.total) : 0

    if(!grammarData) return <div className="card"><div className="h1">Grammar</div><div className="h2">Loading…</div></div>
    if(fullPool.length===0) return <div className="card"><div className="h1">Grammar</div><div className="h2">No verb data.</div></div>
    if(activePool.length===0) return (
      <div className="card">
        <div className="h1">Grammar</div>
        <div className="h2">All conjugated forms mastered!</div>
        <div className="sep" />
        <div className="deofhetStats">
          <span className="deofhetStatPill correct">{stats.correct} correct</span>
          <span className="deofhetStatPill total">{stats.total} total</span>
          <span className="deofhetStatPill pct">{pct}%</span>
        </div>
      </div>
    )

    return (
      <div className="deofhetLayout">
        <div className="card deofhetCard">
          <div className="deofhetHeader">
            <div className="h1">Grammar</div>
            <div className="h2">Verb conjugation</div>
            <div className="row" style={{flexWrap:'wrap',gap:8,alignItems:'center'}}>
            <div className="deofhetStats">
              <span className="deofhetStatPill correct">{stats.correct} correct</span>
              <span className="deofhetStatPill total">{stats.total} total</span>
              <span className="deofhetStatPill pct">{pct}%</span>
            </div>
            <button
              className="pill"
              onClick={()=>setStats(s=>({...s,mode:s.mode==='mc'?'typing':'mc'}))}
            >
              {stats.mode==='mc' ? 'Switch to typing' : 'Switch to multiple choice'}
            </button>
          </div>
          </div>
          <div className="sep" />
          {cur && (
            <div key={triggerPick} className="grammarCardContent">
              <div className="h2" style={{marginBottom:8}}>
                {cur.verb.en} — {cur.tense}{cur.person ? ` — ${cur.person}` : ''}
              </div>
              {feedback && (
                <div className={`deofhetWord feedback-${feedback}`} style={{fontSize:28}}>
                  {cur.correct}
                </div>
              )}
              {feedback && (
                <div className={`deofhetFeedback feedback-${feedback}`}>
                  {feedback==='correct' ? <span>✓ Correct — {cur.correct}</span> : <span>✗ The answer is <strong>{cur.correct}</strong></span>}
                </div>
              )}
              {stats.mode==='mc' ? (
                <div className="deofhetActions" style={{flexDirection:'column',gap:8}}>
                  {options.map(opt=>{
                    const norm = (s:string)=>s.toLowerCase().trim()
                    const isCorrect = norm(opt)===norm(cur.correct)
                    const isChosenWrong = feedback&&chosenOption!==null&&norm(chosenOption)===norm(opt)&&!isCorrect
                    const showGreen = feedback&&isCorrect
                    const showRed = feedback&&!!isChosenWrong
                    return (
                      <button
                        key={opt}
                        className={`grammarOptionBtn${showGreen ? ' grammarOptionBtn-correct' : ''}${showRed ? ' grammarOptionBtn-wrong' : ''}`}
                        style={{width:'100%'}}
                        onClick={()=>feedback===null&&answer(opt)}
                        disabled={feedback!==null}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="deofhetActions" style={{flexDirection:'column',gap:8}}>
                  <input
                    type="text"
                    value={typedAnswer}
                    onChange={e=>setTypedAnswer(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter' && feedback===null) answer(typedAnswer) }}
                    placeholder="Type the conjugated form"
                    disabled={feedback!==null}
                    style={{width:'100%',maxWidth:320,padding:14,fontSize:18}}
                    autoFocus
                  />
                  <button className="deofhetBtn de" onClick={()=>feedback===null&&answer(typedAnswer)} disabled={feedback!==null || !typedAnswer.trim()}>
                    Check
                  </button>
                </div>
              )}
              <button className="deofhetSpeak" onClick={()=>speak(cur.person ? `${cur.person} ${cur.correct}` : cur.correct)}>🔊 Hear it</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const hasAnyCourse = Object.keys(coursesByBookId).length > 0
  if(!hasAnyCourse && !err && route!=='grammar'){
    return <div className="container"><Top /><div className="sep" /><div className="card">Loading books…</div></div>
  }
  if(err && !hasAnyCourse && route!=='grammar'){
    return <div className="container"><Top /><div className="sep" /><div className="card">Error: {err}</div></div>
  }
  if(!course && route!=='grammar'){
    return <div className="container"><Top /><div className="sep" /><div className="card">Loading course…</div></div>
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
        {route==='deofhet' && <div className="pagePane"><DeOfHet coursesByBookId={coursesByBookId} reviewsMap={reviewsMap} difficultMap={difficultMap} speak={speak} /></div>}
        {route==='grammar' && <div className="pagePane"><Grammar speak={speak} /></div>}
      </div>
      <div className="sep appFooterSep" />
      <div className="small appFooterText">MVP • local-only • calm UI • private</div>
    </div>
  )
}
