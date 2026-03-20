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

const LS = { reviews:'klimop.reviews.v1', stats:'klimop.stats.v1', settings:'klimop.settings.v1', difficult:'klimop.difficult.v1', deofhetHistory:'klimop.deofhet.history', grammarHistory:'klimop.grammar.history' }
const USERS_LIST_KEY = 'klimop.users'
const CURRENT_USER_KEY = 'klimop.currentUser'
const USER_DISPLAY_NAMES_KEY = 'klimop.userDisplayNames'
const DEHET_LS_BASE = 'klimop.deofhet.v2'
const GRAMMAR_LS_BASE = 'klimop.grammar.v1'

function userScopedKey(base:string, userId:string):string { return `${base}:u:${userId}` }
const todayISO = ()=> new Date().toISOString().slice(0,10)
type DaySnapshot = { date:string; correct:number; total:number }
function updateDayHistory(key:string, correct:number, total:number):void{
  const hist = loadJSON<DaySnapshot[]>(key, [])
  const today = todayISO()
  const idx = hist.findIndex(h=>h.date===today)
  const entry:DaySnapshot = { date:today, correct, total }
  const next = idx>=0 ? hist.map((h,i)=>i===idx ? entry : h) : [...hist, entry]
  saveJSON(key, next.sort((a,b)=>a.date.localeCompare(b.date)).slice(-31))
}
const loadJSON = <T,>(k:string, f:T):T => { try{ const s=localStorage.getItem(k); return s? JSON.parse(s):f }catch{return f} }
const saveJSON = (k:string,v:any)=> localStorage.setItem(k, JSON.stringify(v))

const SCOPED_KEY_MIGRATED_BASE = 'klimop.reviews.scopedMigrated'
function scopedKey(bookId:string, vocabId:string):string { return `${bookId}:${vocabId}` }
function migrateToScopedKeys(
  reviews:Record<string,Review>,
  difficult:Record<string,boolean>,
  keys:{reviewsKey:string;difficultKey:string;migratedKey:string}
):{reviews:Record<string,Review>;difficult:Record<string,boolean>}{
  if(localStorage.getItem(keys.migratedKey)) return {reviews,difficult}
  const migratedReviews:Record<string,Review>={}
  const migratedDifficult:Record<string,boolean>={}
  for(const [k,v] of Object.entries(reviews)) migratedReviews[k.includes(':')?k:`klimop:${k}`]=v
  for(const [k,v] of Object.entries(difficult)) migratedDifficult[k.includes(':')?k:`klimop:${k}`]=v
  localStorage.setItem(keys.migratedKey,'1')
  saveJSON(keys.reviewsKey,migratedReviews)
  saveJSON(keys.difficultKey,migratedDifficult)
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
    ttsBaseUrl:'http://192.168.68.107:8000',
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

function ensureStats(statsKey:string):Stats{
  const s = loadJSON<any>(statsKey,{streak:0,lastDay:null,minutesToday:0,reviewsToday:0,correctToday:0,newToday:0,history:[]})
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
    saveJSON(statsKey,s)
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
  const [users,setUsers]=useState<string[]>(()=>loadJSON<string[]>(USERS_LIST_KEY,['default']))
  const [currentUserId,setCurrentUserId]=useState<string>(()=>{
    const cur=loadJSON(CURRENT_USER_KEY,'default')
    const list=loadJSON<string[]>(USERS_LIST_KEY,['default'])
    return list.includes(cur)?cur:list[0]||'default'
  })
  useEffect(()=>{ saveJSON(CURRENT_USER_KEY,currentUserId) },[currentUserId])
  useEffect(()=>{
    if(users.length===0) setUsers(['default'])
    if(!users.includes(currentUserId)) setUsers(prev=>[...prev,currentUserId])
  },[currentUserId,users])
  useEffect(()=>{ saveJSON(USERS_LIST_KEY,users) },[users])

  return <AppContent key={currentUserId} currentUserId={currentUserId} users={users} setUsers={setUsers} setCurrentUserId={setCurrentUserId} />
}

function AppContent({ currentUserId, users, setUsers, setCurrentUserId }: { currentUserId:string; users:string[]; setUsers:(u:string[]|((p:string[])=>string[]))=>void; setCurrentUserId:(u:string)=>void }){
  const sk=(base:string)=>userScopedKey(base,currentUserId)
  const [books,setBooks]=useState<Book[]>([])
  const [placeholdersCount,setPlaceholdersCount]=useState(0)
  const [coursesByBookId,setCoursesByBookId]=useState<Record<string,Course>>({})
  const [currentBookId,setCurrentBookId]=useState<string>('klimop')
  const [route,setRoute]=useState<'home'|'study'|'progress'|'tts'|'deofhet'|'grammar'>('home')
  const rawReviews=useMemo(()=>loadJSON<Record<string,Review>>(sk(LS.reviews),{}),[currentUserId])
  const rawDifficult=useMemo(()=>loadJSON<Record<string,boolean>>(sk(LS.difficult),{}),[currentUserId])
  const {reviews:migratedReviews,difficult:migratedDifficult}=useMemo(()=>
    migrateToScopedKeys(rawReviews,rawDifficult,{
      reviewsKey:sk(LS.reviews),
      difficultKey:sk(LS.difficult),
      migratedKey:userScopedKey(SCOPED_KEY_MIGRATED_BASE,currentUserId),
    }),[rawReviews,rawDifficult,currentUserId])
  const [reviewsMap,setReviewsMap]=useState<Record<string,Review>>(migratedReviews)
  const [difficultMap,setDifficultMap]=useState<Record<string,boolean>>(migratedDifficult)
  const [stats,setStats]=useState<Stats>(()=>ensureStats(sk(LS.stats)))
  const [studyTheme,setStudyTheme]=useState<number>(0)
  const [studyContinueMode,setStudyContinueMode]=useState(false)
  const [studySeenSession,setStudySeenSession]=useState<Record<string,boolean>>({})
  const [settings,setSettings]=useState<Settings>(()=>normalizeSettings(loadJSON(sk(LS.settings),null)))
  const [voices,setVoices]=useState<string[]>([])
  const [err,setErr]=useState('')
  const [displayNames,setDisplayNames]=useState<Record<string,string>>(()=>loadJSON(USER_DISPLAY_NAMES_KEY,{}))
  const ttsUrlRef = useRef<HTMLInputElement>(null)
  const dailyTargetRef = useRef<HTMLInputElement>(null)
  const newPerDayRef = useRef<HTMLInputElement>(null)
  const speedRef = useRef<HTMLInputElement>(null)
  const profileNameInputRef = useRef<HTMLInputElement>(null)
  useEffect(()=>saveJSON(USER_DISPLAY_NAMES_KEY,displayNames),[displayNames])
  const commitDailyTarget = ()=>{
    const el = dailyTargetRef.current
    if(!el) return
    const n = Math.round(clamp(Number(el.value)||DEFAULT_DAILY_TARGET, MIN_DAILY_TARGET, MAX_DAILY_TARGET))
    setSettings(s=>({...s,dailyTarget:n}))
    el.value = String(n)
  }
  const commitNewPerDay = ()=>{
    const el = newPerDayRef.current
    if(!el) return
    const n = Math.round(clamp(Number(el.value)||DEFAULT_NEW_PER_DAY, MIN_NEW_PER_DAY, MAX_NEW_PER_DAY))
    setSettings(s=>({...s,newPerDay:n}))
    el.value = String(n)
  }
  const commitSpeed = ()=>{
    const el = speedRef.current
    if(!el) return
    const n = clamp(Number(el.value)||1, 0.6, 1.4)
    setSettings(s=>({...s,speed:n}))
    el.value = String(n)
  }

  useEffect(()=>{
    setReviewsMap(migratedReviews)
    setDifficultMap(migratedDifficult)
  },[migratedReviews,migratedDifficult])

  const MIGRATED_TO_USER_SCOPED = 'klimop.migratedToUserScoped'
  useEffect(()=>{
    if(currentUserId!=='default'||localStorage.getItem(MIGRATED_TO_USER_SCOPED)) return
    const legacyReviews=loadJSON<Record<string,Review>>(LS.reviews,{})
    const legacyDifficult=loadJSON<Record<string,boolean>>(LS.difficult,{})
    if(Object.keys(legacyReviews).length>0){ saveJSON(sk(LS.reviews),legacyReviews); setReviewsMap(legacyReviews) }
    if(Object.keys(legacyDifficult).length>0){ saveJSON(sk(LS.difficult),legacyDifficult); setDifficultMap(legacyDifficult) }
    const legacyStats=loadJSON<any>(LS.stats,null)
    if(legacyStats&&(legacyStats.reviewsToday>0||legacyStats.streak>0)){ saveJSON(sk(LS.stats),legacyStats); setStats(ensureStats(sk(LS.stats))) }
    const legacySettings=loadJSON(LS.settings,null)
    if(legacySettings){ saveJSON(sk(LS.settings),legacySettings); setSettings(normalizeSettings(legacySettings)) }
    localStorage.setItem(MIGRATED_TO_USER_SCOPED,'1')
  },[currentUserId])

  useEffect(()=>{
    fetchJSON<BooksManifest>('/content/books.json')
      .then(m=>{
        setBooks(m.books)
        setPlaceholdersCount(m.placeholders ?? 0)
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
  useEffect(()=>saveJSON(sk(LS.reviews),reviewsMap),[reviewsMap,currentUserId])
  useEffect(()=>saveJSON(sk(LS.difficult),difficultMap),[difficultMap,currentUserId])
  useEffect(()=>saveJSON(sk(LS.settings),settings),[settings,currentUserId])
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

  async function refreshVoices(overrideBaseUrl?:string){
    const baseUrl = (overrideBaseUrl ?? settings.ttsBaseUrl).trim() || settings.ttsBaseUrl
    setErr('')
    try{
      const r=await fetchJSON<{voices:string[]}>(`${baseUrl}/tts/voices`)
      const available=r.voices||[]
      setVoices(available)
      setSettings(s=>({
        ...s,
        ...(overrideBaseUrl !== undefined ? { ttsBaseUrl: baseUrl } : {}),
        voice: available.includes(s.voice) ? s.voice : (available[0]||'')
      }))
      if(overrideBaseUrl !== undefined && ttsUrlRef.current) ttsUrlRef.current.value = baseUrl
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
      const audioUrl=URL.createObjectURL(blob)
      const a=new Audio(audioUrl)
      a.onended=()=>URL.revokeObjectURL(audioUrl)
      await a.play()
    }catch(e:any){ setErr(String(e?.message??e)) }
  }

  function Top(){
    const displayName = displayNames[currentUserId] ?? (currentUserId==='default'?'Guest':currentUserId.replace(/_/g,' '))
    const [editingName,setEditingName]=useState(false)
    const [showUserList,setShowUserList]=useState(false)
    const profileWrapRef = useRef<HTMLDivElement>(null)
    useEffect(()=>{
      if(!showUserList) return
      const onDocClick = (e:MouseEvent)=>{
        if(profileWrapRef.current && !profileWrapRef.current.contains(e.target as Node)) setShowUserList(false)
      }
      document.addEventListener('click', onDocClick)
      return ()=> document.removeEventListener('click', onDocClick)
    },[showUserList])
    const saveDisplayName = ()=>{
      const name = (profileNameInputRef.current?.value??'').trim()
      if(name) setDisplayNames(prev=>({...prev,[currentUserId]:name}))
      setEditingName(false)
    }
    const otherUsers = users.filter(u=>u!==currentUserId)
    return (
      <header className="topBar">
        <div className="topBarRowNav">
          <button type="button" className="topBarNavBtn" onClick={()=>setRoute('home')} style={{fontWeight:route==='home'?700:400}}>Home</button>
          <button type="button" className="topBarNavBtn" onClick={()=>setRoute('study')} style={{fontWeight:route==='study'?700:400}}>Daily</button>
          <button type="button" className="topBarNavBtn" onClick={()=>setRoute('progress')} style={{fontWeight:route==='progress'?700:400}}>Progress</button>
          <button type="button" className="topBarNavBtn" onClick={()=>setRoute('tts')} style={{fontWeight:route==='tts'?700:400}}>TTS</button>
        </div>
        <div className="topBarRowBooks">
          {books.map(b=>(
            <button
              key={b.id}
              type="button"
              onClick={()=>{ setCurrentBookId(b.id); setRoute('home') }}
              className="pill topBarBookPill"
              style={{
                fontWeight:currentBookId===b.id?700:400,
                background:currentBookId===b.id?'rgba(255,255,255,0.14)':'var(--panel)',
                border:'1px solid rgba(255,255,255,0.12)',
              }}
            >
              {b.title}
            </button>
          ))}
          {Array.from({length:placeholdersCount},(_,i)=>(
            <span key={`book-ph-${i}`} className="pill topBarBookPill topBarBookPlaceholder" title="Coming soon">
              Book {books.length+i+1}
            </span>
          ))}
        </div>
        <div className="topBarRowTools">
          <button type="button" onClick={()=>setRoute('deofhet')} className="pill topBarBookPill" style={{ fontWeight:route==='deofhet'?700:500, background:route==='deofhet'?'rgba(255,255,255,0.14)':'var(--panel)', border:'1px solid rgba(255,255,255,0.12)' }}>De of Het</button>
          <button type="button" onClick={()=>setRoute('grammar')} className="pill topBarBookPill" style={{ fontWeight:route==='grammar'?700:500, background:route==='grammar'?'rgba(255,255,255,0.14)':'var(--panel)', border:'1px solid rgba(255,255,255,0.12)' }}>Grammar</button>
        </div>
        <div className="topBarRow2">
          <div className="profilePillWrap" ref={profileWrapRef}>
            <div className="profilePill">
              <button
                type="button"
                className="profilePillMain"
                onClick={()=>{ if(!editingName){ setEditingName(true); setShowUserList(false) } }}
                title="Change name"
              >
                <span className="profilePillIcon" aria-hidden>👤</span>
                {editingName ? (
                  <input
                    ref={profileNameInputRef}
                    className="profileNameInput iosInputFix"
                    defaultValue={displayName}
                    onBlur={saveDisplayName}
                    onKeyDown={e=>{ if(e.key==='Enter') saveDisplayName(); if(e.key==='Escape') setEditingName(false) }}
                    onClick={e=>e.stopPropagation()}
                    autoFocus
                    aria-label="Your name"
                  />
                ) : (
                  <span className="profilePillName">{displayName}</span>
                )}
              </button>
              {!editingName && (
                <button
                  type="button"
                  className="profilePillChevron"
                  onClick={()=>setShowUserList(v=>!v)}
                  title="Switch or add user"
                  aria-haspopup="listbox"
                  aria-expanded={showUserList}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6"/></svg>
                </button>
              )}
            </div>
            {showUserList && (
              <div className="profileUserList" role="listbox">
                {otherUsers.map(u=>(
                  <button
                    key={u}
                    type="button"
                    className="profileUserItem"
                    onClick={()=>{ setCurrentUserId(u); setShowUserList(false) }}
                  >
                    {displayNames[u] ?? (u==='default'?'Guest':u.replace(/_/g,' '))}
                  </button>
                ))}
                <button type="button" className="profileUserItem" onClick={()=>{ const id=(Date.now().toString(36)+'_user'); setUsers(prev=>[...prev,id]); setCurrentUserId(id); setShowUserList(false) }}>+ New user</button>
              </div>
            )}
          </div>
          <div className="topBarRow2Right">
            <div className="pill">Streak {stats.streak}🔥</div>
            <div className="pill">Today {dueCount}</div>
          </div>
        </div>
      </header>
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
    // Prevent the just-answered card from immediately becoming `queue[0]` via `wrongList`,
    // which can happen especially when a card is marked "Difficult".
    const [skipWrongCardId,setSkipWrongCardId]=useState<string | null>(null)
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
      // If there is at least one "main" card to show, don't put the just-answered card
      // as the first retry item. It will come back naturally in later steps.
      const filteredWrongList =
        skipWrongCardId && main.length>0
          ? wrongList.filter(v=>v.id!==skipWrongCardId)
          : wrongList
      const merged = interleaveAfter(main,filteredWrongList,3)

      return studyContinueMode ? merged : merged.slice(0,settings.dailyTarget)
    },[baseDeck,currentBookId,reviewsMap,difficultMap,studySeenSession,sessionWrongIds,skipWrongCardId,now,stats.newToday,settings.newPerDay,settings.dailyTarget,studyContinueMode])

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
      setSkipWrongCardId(null)
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
      saveJSON(sk(LS.stats),s)

      const graduated = (r.learningStep ?? 0) === 0
      if(correct){
        if(graduated) setStudySeenSession(s=>({ ...s, [cur.id]: true }))
        setSessionWrongIds(prev=>{ const n=new Set(prev); n.delete(cur.id); return n })
      } else {
        setSessionWrongIds(prev=>new Set(prev).add(cur.id))
      }
      // Avoid immediate re-show as `queue[0]` via retry lists.
      setSkipWrongCardId(cur.id)
      requestAnimationFrame(()=>setSkipWrongCardId(null))
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
    const [deofhetData] = useState(()=>({ stats: loadJSON<any>(userScopedKey(DEHET_LS_BASE,currentUserId), {correct:0,total:0,mastered:{}}), history: loadJSON<DaySnapshot[]>(userScopedKey(LS.deofhetHistory,currentUserId), []) }))
    const [grammarData] = useState(()=>({ stats: loadJSON<any>(userScopedKey(GRAMMAR_LS_BASE,currentUserId), {correct:0,total:0,mastered:{}}), history: loadJSON<DaySnapshot[]>(userScopedKey(LS.grammarHistory,currentUserId), []) }))
    const deofhetPct = deofhetData.stats.total ? Math.round(100*deofhetData.stats.correct/deofhetData.stats.total) : 0
    const grammarPct = grammarData.stats.total ? Math.round(100*grammarData.stats.correct/grammarData.stats.total) : 0
    const dailyHistory = stats.history || []
    const last14 = dailyHistory.slice(-14)

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
        const learning = seen - mastered
        const unseenPct = total ? Math.round((unseen/total)*100) : 0
        const learningPct = total ? Math.round((learning/total)*100) : 0
        const masteredPct = total ? Math.round((mastered/total)*100) : 0
        return {id:t.id,title:t.title,total,seen,unseen,learning,due,difficult,mastered,unseenPct,learningPct,masteredPct}
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
                  <div className="themeBarSegment unseen" style={{width:`${t.unseenPct}%`}} />
                  <div className="themeBarSegment learning" style={{width:`${t.learningPct}%`}} />
                  <div className="themeBarSegment mastered" style={{width:`${t.masteredPct}%`}} />
                </div>
                <div className="themeNumbers">
                  <span><strong>{t.unseen}</strong> unseen ({t.unseenPct}%)</span>
                  <span><strong>{t.learning}</strong> learning ({t.learningPct}%)</span>
                  <span><strong>{t.mastered}</strong> mastered ({t.masteredPct}%)</span>
                  <span>Due <strong>{t.due}</strong> · Difficult <strong>{t.difficult}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="progressLayout">
        <header className="cockpitHeader">
          <div className="cockpitTitle">Mission control</div>
          <div className="cockpitSubtitle">All app metrics in one place</div>
        </header>

        <div className="cockpitMetrics">
          <div className="cockpitMetric">
            <span className="cockpitMetricValue">{stats.streak}</span>
            <span className="cockpitMetricLabel">Day streak</span>
          </div>
          <div className="cockpitMetric">
            <span className="cockpitMetricValue">{stats.reviewsToday}</span>
            <span className="cockpitMetricLabel">Reviews today</span>
          </div>
          <div className="cockpitMetric">
            <span className="cockpitMetricValue">{acc}%</span>
            <span className="cockpitMetricLabel">Accuracy</span>
          </div>
          <div className="cockpitMetric">
            <span className="cockpitMetricValue">{dueCount}</span>
            <span className="cockpitMetricLabel">Due now</span>
          </div>
          <div className="cockpitMetric">
            <span className="cockpitMetricValue">{stats.newToday}</span>
            <span className="cockpitMetricLabel">New today</span>
          </div>
        </div>

        <div className="cockpitGrid">
          <div className="card cockpitCard">
            <div className="cockpitCardTitle">Daily SRS</div>
            <div className="cockpitCardSubtitle">Reviews & new cards</div>
            <div className="themeBarTrack" style={{marginTop:12,marginBottom:8}}>
              <div className="themeBarSegment mastered" style={{width:`${Math.min(100, Math.round(100*stats.reviewsToday/Math.max(1,settings.dailyTarget)))}%`}} />
            </div>
            <div className="small">Today: <strong>{stats.reviewsToday}</strong> reviews · <strong>{stats.newToday}</strong> new</div>
            <div className="targetGrid" style={{marginTop:12}}>
              <div>
                <div className="small">Daily target</div>
                <input ref={dailyTargetRef} type="number" min={MIN_DAILY_TARGET} max={MAX_DAILY_TARGET} defaultValue={settings.dailyTarget} onBlur={commitDailyTarget} style={{width:'100%'}} className="iosInputFix" />
              </div>
              <div>
                <div className="small">New/day</div>
                <input ref={newPerDayRef} type="number" min={MIN_NEW_PER_DAY} max={MAX_NEW_PER_DAY} defaultValue={settings.newPerDay} onBlur={commitNewPerDay} style={{width:'100%'}} className="iosInputFix" />
              </div>
            </div>
            {last14.length>0 && (
              <div className="cockpitMiniChartWrap">
                <div className="small" style={{marginBottom:6}}>Last 14 days</div>
                <div className="cockpitMiniChart" aria-label="Reviews per day">
                  {last14.map((h:any,i)=>(
                    <div key={h.day||i} className="cockpitMiniBarWrap" title={`${h.day}: ${h.reviews||0} reviews`}>
                      <div className="cockpitMiniBar daily" style={{height:`${Math.min(100, ((h.reviews||0)/Math.max(1,settings.dailyTarget))*100)}%`}} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card cockpitCard">
            <div className="cockpitCardTitle">De of Het</div>
            <div className="cockpitCardSubtitle">Article practice</div>
            <div className="cockpitStatRow">
              <span className="cockpitStatBig">{deofhetPct}%</span>
              <span className="small"><strong>{deofhetData.stats.correct}</strong> / {deofhetData.stats.total} correct · <strong>{Object.keys(deofhetData.stats.mastered||{}).length}</strong> mastered</span>
            </div>
            <div className="themeBarTrack" style={{marginTop:8,marginBottom:8}}>
              <div className="themeBarSegment mastered" style={{width:`${deofhetPct}%`}} />
              <div className="themeBarSegment learning" style={{width:`${100-deofhetPct}%`}} />
            </div>
            {deofhetData.history.length>0 && (
              <div className="cockpitMiniChartWrap">
                <div className="small" style={{marginBottom:6}}>Accuracy over time</div>
                <div className="cockpitMiniChart" aria-label="De of Het accuracy by day">
                  {deofhetData.history.slice(-14).map((h,i)=>(
                    <div key={h.date+i} className="cockpitMiniBarWrap" title={`${h.date}: ${h.total ? Math.round(100*h.correct/h.total) : 0}%`}>
                      <div className="cockpitMiniBar deofhet" style={{height:`${h.total ? (100*h.correct/h.total) : 0}%`}} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card cockpitCard">
            <div className="cockpitCardTitle">Grammar</div>
            <div className="cockpitCardSubtitle">Verb conjugation</div>
            <div className="cockpitStatRow">
              <span className="cockpitStatBig">{grammarPct}%</span>
              <span className="small"><strong>{grammarData.stats.correct}</strong> / {grammarData.stats.total} correct · <strong>{Object.keys(grammarData.stats.mastered||{}).length}</strong> mastered</span>
            </div>
            <div className="themeBarTrack" style={{marginTop:8,marginBottom:8}}>
              <div className="themeBarSegment mastered" style={{width:`${grammarPct}%`}} />
              <div className="themeBarSegment learning" style={{width:`${100-grammarPct}%`}} />
            </div>
            {grammarData.history.length>0 && (
              <div className="cockpitMiniChartWrap">
                <div className="small" style={{marginBottom:6}}>Accuracy over time</div>
                <div className="cockpitMiniChart" aria-label="Grammar accuracy by day">
                  {grammarData.history.slice(-14).map((h,i)=>(
                    <div key={h.date+i} className="cockpitMiniBarWrap" title={`${h.date}: ${h.total ? Math.round(100*h.correct/h.total) : 0}%`}>
                      <div className="cockpitMiniBar grammar" style={{height:`${h.total ? (100*h.correct/h.total) : 0}%`}} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="h1">Vocabulary by book</div>
          <div className="h2">Theme-level progress (Unseen → Learning → Mastered)</div>
          <div className="progressLegend">
            <span className="progressLegendItem"><span className="progressLegendSwatch unseen" /> Unseen</span>
            <span className="progressLegendItem"><span className="progressLegendSwatch learning" /> Learning</span>
            <span className="progressLegendItem"><span className="progressLegendSwatch mastered" /> Mastered</span>
          </div>
          <div className="sep" />
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
        {placeholdersCount > 0 && Array.from({length:placeholdersCount},(_,i)=>(
          <div key={`placeholder-${i}`} className="card progressThemeCard progressBookPlaceholder">
            <div className="h1" style={{fontSize:24}}>Book {books.length+i+1}</div>
            <div className="small" style={{marginTop:8}}>Coming soon</div>
          </div>
        ))}

        <div className="card" style={{marginTop:12}}>
          <button onClick={()=>{
            localStorage.removeItem(sk(LS.reviews))
            localStorage.removeItem(sk(LS.stats))
            localStorage.removeItem(sk(LS.difficult))
            localStorage.removeItem(sk(LS.deofhetHistory))
            localStorage.removeItem(sk(LS.grammarHistory))
            localStorage.removeItem(sk(DEHET_LS_BASE))
            localStorage.removeItem(sk(GRAMMAR_LS_BASE))
            localStorage.removeItem(userScopedKey(SCOPED_KEY_MIGRATED_BASE,currentUserId))
            setReviewsMap({})
            setDifficultMap({})
            setStats(ensureStats(sk(LS.stats)))
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
              ref={ttsUrlRef}
              type="text"
              inputMode="url"
              autoComplete="off"
              defaultValue={settings.ttsBaseUrl}
              onBlur={()=>{
                const v = ttsUrlRef.current?.value.trim()
                if(v) setSettings(s=>({...s,ttsBaseUrl:v}))
              }}
              style={{width:'100%'}}
              className="ttsUrlInput"
            />
            <div className="row" style={{justifyContent:'flex-end', marginTop:10}}>
              <button type="button" onClick={()=>refreshVoices(ttsUrlRef.current?.value.trim()||undefined)}>Refresh</button>
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
                ref={speedRef}
                type="number"
                min="0.6"
                max="1.4"
                step="0.05"
                defaultValue={settings.speed}
                onBlur={commitSpeed}
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
                <input ref={dailyTargetRef} type="number" min={MIN_DAILY_TARGET} max={MAX_DAILY_TARGET} defaultValue={settings.dailyTarget} onBlur={commitDailyTarget} style={{width:'100%'}} className="iosInputFix" />
              </div>
              <div>
                <div className="small">New cards/day</div>
                <input ref={newPerDayRef} type="number" min={MIN_NEW_PER_DAY} max={MAX_NEW_PER_DAY} defaultValue={settings.newPerDay} onBlur={commitNewPerDay} style={{width:'100%'}} className="iosInputFix" />
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

  type DeHetStats = { correct:number; total:number; wrongIds:Record<string,number>; mastered:Record<string,boolean>; streak:Record<string,number> }
  function DeOfHet({ currentUserId, coursesByBookId, reviewsMap, difficultMap, speak }:{
    currentUserId:string; coursesByBookId:Record<string,Course>; reviewsMap:Record<string,Review>; difficultMap:Record<string,boolean>; speak:(t:string)=>Promise<void> }){
    const deofhetLsKey = userScopedKey(DEHET_LS_BASE, currentUserId)
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
      const raw=loadJSON<any>(deofhetLsKey,{correct:0,total:0,wrongIds:{}})
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
    const [chosenArticle,setChosenArticle]=useState<'de'|'het'|null>(null)
    const [sessionWrong,setSessionWrong]=useState<string[]>([])
    const [picksSinceWrong,setPicksSinceWrong]=useState(0)
    const [triggerPick,setTriggerPick]=useState(0)
    const lastShownNlsRef = useRef<string[]>([])

    useEffect(()=>{
      saveJSON(deofhetLsKey,stats)
      updateDayHistory(userScopedKey(LS.deofhetHistory,currentUserId), stats.correct, stats.total)
    },[stats])

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
      const recent = lastShownNlsRef.current.map(n=>n.toLowerCase())
      let pool = activePool.filter(v=>!recent.includes(wrongKey(v)))
      if(pool.length===0) pool = activePool.filter(v=>wrongKey(v)!==cur?.nl?.toLowerCase())
      if(pool.length===0) pool = activePool
      const wrongReady = sessionWrong.filter(nl=>!cur?.nl||nl.toLowerCase()!==cur.nl.toLowerCase())
      const shouldRetry = wrongReady.length>0 && picksSinceWrong>=2
      if(shouldRetry && wrongReady.length>0){
        const idx = Math.floor(Math.random()*wrongReady.length)
        const nl = wrongReady[idx]
        setSessionWrong(w=>w.filter(x=>x.toLowerCase()!==nl.toLowerCase()))
        setPicksSinceWrong(0)
        return pool.find(v=>wrongKey(v)===nl.toLowerCase()) ?? pool[Math.floor(Math.random()*pool.length)]
      }
      const byWrong = [...pool].sort((a,b)=>{
        const wa=stats.wrongIds[wrongKey(a)]??0
        const wb=stats.wrongIds[wrongKey(b)]??0
        return wb-wa
      })
      const topWrong = byWrong.filter(v=>(stats.wrongIds[wrongKey(v)]??0)>0)
      if(topWrong.length>0 && Math.random()<0.6){
        const weights = topWrong.slice(0,12).map(v=>(stats.wrongIds[wrongKey(v)]??0)+1)
        const total = weights.reduce((s,w)=>s+w,0)
        let r = Math.random()*total
        for(let i=0;i<weights.length;i++){
          r-=weights[i]
          if(r<=0) return topWrong[i]
        }
        return topWrong[0]
      }
      const difficultInPool = pool.filter(v=>difficultNls.has(wrongKey(v)))
      if(difficultInPool.length>0 && Math.random()<0.6) return difficultInPool[Math.floor(Math.random()*difficultInPool.length)]
      return pool[Math.floor(Math.random()*pool.length)]
    },[activePool,learnedPool,unlearnedPool,stats.wrongIds,sessionWrong,picksSinceWrong,cur?.nl,difficultNls])

    useEffect(()=>{
      const next = pickNext()
      if(next){
        lastShownNlsRef.current = [next.nl.toLowerCase(), cur?.nl?.toLowerCase()].filter(Boolean).slice(0,2)
      }
      setCur(next ?? null)
      setFeedback(null)
      setChosenArticle(null)
    },[triggerPick,activePool.length,learnedPool.length,unlearnedPool.length])

    function answer(guess:'de'|'het'){
      if(!cur) return
      setChosenArticle(guess)
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
                  className={`deofhetBtn de${feedback&&cur.article==='de' ? ' feedback-correct' : ''}${feedback&&chosenArticle==='de'&&cur.article==='het' ? ' feedback-wrong' : ''}`}
                  onClick={()=>feedback===null&&answer('de')}
                  disabled={feedback!==null}
                >
                  De
                </button>
                <button
                  className={`deofhetBtn het${feedback&&cur.article==='het' ? ' feedback-correct' : ''}${feedback&&chosenArticle==='het'&&cur.article==='de' ? ' feedback-wrong' : ''}`}
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

  type GrammarStats = { correct:number; total:number; wrongIds:Record<string,number>; mastered:Record<string,boolean>; streak:Record<string,number>; mode?:'mc'|'typing' }
  type GrammarItem = { verb:GrammarVerb; tense:'present'|'past'|'perfect'|'future'|'conditional'; person?:string; correct:string; key:string }
  function Grammar({ currentUserId, speak }:{ currentUserId:string; speak:(t:string)=>Promise<void> }){
    const grammarLsKey = userScopedKey(GRAMMAR_LS_BASE, currentUserId)
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
      const raw=loadJSON<any>(grammarLsKey,{correct:0,total:0,wrongIds:{},mastered:{},streak:{},mode:'mc'})
      return { correct:raw.correct??0, total:raw.total??0, wrongIds:raw.wrongIds??{}, mastered:raw.mastered??{}, streak:raw.streak??{}, mode:raw.mode??'mc' }
    })
    const [card,setCard]=useState<{ cur:GrammarItem|null; options:string[] }>({ cur:null, options:[] })
    const cur = card.cur
    const options = card.options
    const [feedback,setFeedback]=useState<'correct'|'wrong'|null>(null)
    const [chosenOption,setChosenOption]=useState<string|null>(null)
    const typedAnswerRef = useRef<HTMLInputElement>(null)
    const [sessionWrong,setSessionWrong]=useState<string[]>([])
    const [picksSinceWrong,setPicksSinceWrong]=useState(0)
    const [triggerPick,setTriggerPick]=useState(0)
    const [lastPickedVerbIds,setLastPickedVerbIds]=useState<string[]>([])
    const curKeyRef = useRef<string|null>(null)
    const lastPickedVerbIdsRef = useRef<string[]>([])
    const lastShownKeysRef = useRef<string[]>([])

    useEffect(()=>{
      saveJSON(grammarLsKey,stats)
      updateDayHistory(userScopedKey(LS.grammarHistory,currentUserId), stats.correct, stats.total)
    },[stats])

    const activePool = useMemo(()=>fullPool.filter(i=>!stats.mastered[i.key]),[fullPool,stats.mastered])

    const pickNext = useCallback(()=>{
      if(activePool.length===0) return null
      const avoid = lastPickedVerbIdsRef.current
      const avoidSameVerb = activePool.filter(i=>!avoid.includes(i.verb.id))
      let pool = avoidSameVerb.length>0 ? avoidSameVerb : activePool
      // Avoid showing the same item in the last 2 positions (reduces boring repetition)
      const recent = lastShownKeysRef.current
      let freshPool = pool.filter(i=>!recent.includes(i.key))
      if(freshPool.length===0) freshPool = pool.filter(i=>i.key!==curKeyRef.current)
      if(freshPool.length===0) freshPool = pool
      pool = freshPool
      // Retry a wrong item only after at least 2 other cards (more variety)
      const wrongReady = sessionWrong.filter(k=>!curKeyRef.current||k!==curKeyRef.current)
      const shouldRetry = wrongReady.length>0 && picksSinceWrong>=2
      if(shouldRetry && wrongReady.length>0){
        const k = wrongReady[Math.floor(Math.random()*wrongReady.length)]
        setSessionWrong(w=>w.filter(x=>x!==k))
        setPicksSinceWrong(0)
        return pool.find(i=>i.key===k) ?? pool[Math.floor(Math.random()*pool.length)]
      }
      // Prefer items with more wrongs (optimize memorization) but weighted so not always same one
      const byWrong = [...pool].sort((a,b)=>(stats.wrongIds[b.key]??0)-(stats.wrongIds[a.key]??0))
      const topWrong = byWrong.filter(i=>(stats.wrongIds[i.key]??0)>0)
      if(topWrong.length>0 && Math.random()<0.6){
        const weights = topWrong.slice(0,12).map(i=>(stats.wrongIds[i.key]??0)+1)
        const total = weights.reduce((s,w)=>s+w,0)
        let r = Math.random()*total
        for(let i=0;i<weights.length;i++){
          r-=weights[i]
          if(r<=0) return topWrong[i]
        }
        return topWrong[0]
      }
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
      if(typedAnswerRef.current) typedAnswerRef.current.value = ''
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
      const oldKey = curKeyRef.current
      curKeyRef.current = next.key
      lastShownKeysRef.current = [next.key, oldKey].filter(Boolean).slice(0,2)
      setCard({ cur:next, options:all })
      // triggerPick: advance after answer timeout. fullPool: run when data first loads.
      // Do NOT depend on pickNext (it changes when stats changes and would wipe feedback).
    },[triggerPick,fullPool])

    function answer(guess:string){
      if(!cur) return
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
                        className={`grammarOptionBtn${showGreen ? ' is-correct' : ''}${showRed ? ' is-wrong' : ''}`}
                        onClick={()=>{
                          if(feedback!==null) return
                          setChosenOption(opt)
                          answer(opt)
                        }}
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
                    ref={typedAnswerRef}
                    type="text"
                    onKeyDown={e=>{ if(e.key==='Enter' && feedback===null){ const v = typedAnswerRef.current?.value??''; answer(v); typedAnswerRef.current&&(typedAnswerRef.current.value='') } }}
                    placeholder="Type the conjugated form"
                    disabled={feedback!==null}
                    style={{width:'100%',maxWidth:320,padding:14,fontSize:18}}
                    className="iosInputFix"
                    autoFocus
                  />
                  <button className="deofhetBtn de" onClick={()=>{ if(feedback!==null) return; const v = typedAnswerRef.current?.value?.trim()??''; if(!v) return; answer(v); typedAnswerRef.current&&(typedAnswerRef.current.value='') }} disabled={feedback!==null}>
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
        {route==='deofhet' && <div className="pagePane"><DeOfHet currentUserId={currentUserId} coursesByBookId={coursesByBookId} reviewsMap={reviewsMap} difficultMap={difficultMap} speak={speak} /></div>}
        {route==='grammar' && <div className="pagePane"><Grammar currentUserId={currentUserId} speak={speak} /></div>}
      </div>
      <div className="sep appFooterSep" />
      <div className="small appFooterText">MVP • local-only • calm UI • private</div>
    </div>
  )
}
