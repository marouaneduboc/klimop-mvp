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
type GrammarThemePlan = { id:number; title:string; subjects:string[] }
const GRAMMAR_BOOK_THEMES:Record<string,GrammarThemePlan[]> = {
  klimop: [
    { id:1, title:'Kennismaken', subjects:['werkwoord enkelvoud','persoonlijk voornaamwoord enkelvoud','vragen stellen'] },
    { id:2, title:'Hoe gaat het?', subjects:['werkwoord meervoud','persoonlijk voornaamwoord meervoud','vragen stellen'] },
    { id:3, title:'Familie', subjects:['enkelvoud en meervoud van het zelfstandig naamwoord','bezittelijk voornaamwoord','vragen'] },
    { id:4, title:'Dagelijkse activiteiten', subjects:['werkwoorden in de tegenwoordige tijd','hulpwerkwoorden'] },
    { id:5, title:'De tijd', subjects:['werkwoorden in de tegenwoordige tijd','inversie','vragen','hulpwerkwoorden','en/of'] },
    { id:6, title:'Afspreken', subjects:['zullen','want','maar','inversie'] },
    { id:7, title:'Eten en drinken', subjects:['niet en geen'] },
    { id:8, title:'Boodschappen doen', subjects:['meervoud','de/het/een','bijvoeglijk naamwoord','vergelijken'] },
    { id:9, title:'Winkelen', subjects:['meervoud','de/het/een','verwijswoorden','bijvoeglijk naamwoord','vergelijken','er als plaats'] },
    { id:10, title:'Gezondheid', subjects:['meervoud','dus','advies met moeten','oorzaak en gevolg met want','verleden tijd'] },
  ],
  windmee: [
    { id:1, title:'Wonen', subjects:['niet en geen','meervoud','er als onbepaald onderwerp','er als plaats','verleden tijd','inversie','verwijswoorden','scheidbare werkwoorden','voorzetsels van plaats en positiewerkwoorden'] },
    { id:2, title:'Sociale contacten', subjects:['verleden tijd','om...te','persoonlijke voornaamwoorden','scheidbare werkwoorden'] },
    { id:3, title:'Onderwijs', subjects:['verleden tijd','inversie','scheidbare werkwoorden'] },
    { id:4, title:'Werk zoeken', subjects:['omdat','scheidbare werkwoorden'] },
    { id:5, title:'Een dag op het werk', subjects:['verleden tijd','om...te','scheidbare werkwoorden'] },
    { id:6, title:'Officiele instanties', subjects:['om...te','verleden tijd'] },
    { id:7, title:'Op reis door Nederland', subjects:['om...te','inversie','zullen we','verleden tijd','bijvoeglijk naamwoord','scheidbare werkwoorden'] },
    { id:8, title:'Geld', subjects:['om...te','er + getal','scheidbare werkwoorden'] },
    { id:9, title:'Geschiedenis', subjects:['verleden tijd','toen','scheidbare werkwoorden'] },
    { id:10, title:'Samen leven', subjects:['als','dat'] },
  ],
}

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

function interleaveAlternating<T>(a:T[], b:T[]):T[]{
  if(a.length===0) return b
  if(b.length===0) return a
  const out:T[]=[]
  const n = Math.max(a.length,b.length)
  for(let i=0;i<n;i++){
    if(i<a.length) out.push(a[i])
    if(i<b.length) out.push(b[i])
  }
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
    fetchJSON<BooksManifest>('content/books.json')
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
        fetchJSON<Course>('content/course.json')
          .then(c=>{
            setBooks([{id:'klimop',title:'Klim Op',levels:'A0 naar A1',url:'content/course.json'}])
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

  function refreshVoices(){
    setErr('')
    try{
      if(typeof window === 'undefined' || !('speechSynthesis' in window)){
        setVoices([])
        setErr('Browser TTS (speech synthesis) is not supported on this device.')
        return
      }
      const synth = window.speechSynthesis
      const available = synth.getVoices() || []
      // Prefer Dutch voices so pronunciation is decent without any setup.
      // Different iOS/macOS/browser engines expose different fields, so we combine `lang` and name heuristics.
      const dutch = available.filter(v=>{
        const lang = (v.lang || '').toLowerCase()
        const name = (v.name || '').toLowerCase()
        return (
          lang.startsWith('nl') ||
          name.includes('dutch') ||
          name.includes('nederlands') ||
          name.includes('nederland')
        )
      })
      const candidates = dutch.length>0 ? dutch : available
      const names = [...new Set(candidates.map(v=>v.name).filter((n): n is string => !!n))]
      setVoices(names)
      setSettings(s=>({
        ...s,
        voice: names.includes(s.voice) ? s.voice : (names[0] || '')
      }))
    }catch(e:any){ setErr(String(e?.message??e)) }
  }
  useEffect(()=>{
    // Device voices can load async (especially on iOS Safari). Re-run when they change.
    if(typeof window === 'undefined' || !('speechSynthesis' in window)) return
    refreshVoices()
    const synth = window.speechSynthesis
    // Not all browsers support the event API typing, so we guard it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anySynth = synth as any
    if(typeof anySynth.addEventListener === 'function'){
      anySynth.addEventListener('voiceschanged', refreshVoices)
      return ()=> anySynth.removeEventListener('voiceschanged', refreshVoices)
    }
    return
  },[])

  async function speak(text:string){
    setErr('')
    try{
      if(typeof window === 'undefined' || !('speechSynthesis' in window)){
        setErr('Browser TTS is not supported on this device.')
        return
      }
      const synth = window.speechSynthesis
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'nl-NL'
      // UI speed is already clamped between 0.6..1.4.
      utter.rate = Math.min(1.4, Math.max(0.6, settings.speed))

      const all = synth.getVoices() || []
      const byName = all.find(v=>v.name===settings.voice)
      const byNl = all.find(v=>v.lang && v.lang.toLowerCase().startsWith('nl'))
      utter.voice = byName || byNl || all[0] || null

      synth.cancel()
      synth.speak(utter)
    }catch(e:any){ setErr(String(e?.message??e)) }
  }

  function Top(){
    const displayName = displayNames[currentUserId] ?? (currentUserId==='default'?'Guest':currentUserId.replace(/_/g,' '))
    const [editingName,setEditingName]=useState(false)
    const [showUserList,setShowUserList]=useState(false)
    const profileWrapRef = useRef<HTMLDivElement>(null)
    const goRoute = (next:'home'|'study'|'progress'|'tts')=>{
      if(route===next) return
      setRoute(next)
      window.scrollTo({ top:0, behavior:'auto' })
    }
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
          <button type="button" className="topBarNavBtn" onClick={()=>goRoute('home')} style={{fontWeight:route==='home'?700:400}}>Home</button>
          <button type="button" className="topBarNavBtn" onClick={()=>goRoute('study')} style={{fontWeight:route==='study'?700:400}}>Daily</button>
          <button type="button" className="topBarNavBtn" onClick={()=>goRoute('progress')} style={{fontWeight:route==='progress'?700:400}}>Progress</button>
          <button type="button" className="topBarNavBtn" onClick={()=>goRoute('tts')} style={{fontWeight:route==='tts'?700:400}}>TTS</button>
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
            <div className="pill">Today vocab {dueCount}</div>
          </div>
        </div>
      </header>
    )
  }

  function Home(){
    if(!course) return null
    const now = Date.now()
    const sk=(id:string)=>scopedKey(currentBookId,id)
    const startTheme = (themeId:number)=>{
      setStudyTheme(themeId)
      setRoute('study')
      window.scrollTo({ top:0, behavior:'auto' })
    }
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
              <button
                key={t.id}
                onClick={()=>startTheme(t.id)}
                type="button"
                className="card"
                style={{padding:12, textAlign:'left', width:'100%', cursor:'pointer'}}
                title={`Start theme ${t.title}`}
              >
                <div style={{fontWeight:700}}>{t.title}</div>
                <div className="small" style={{marginTop:6}}>Due reviews: {t.dueReview}</div>
                <div className="small">Unseen: {t.unseen}</div>
                <div className="small">Total: {t.total}</div>
              </button>
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
    type StudyCard =
      | { kind:'vocab'; id:string; theme:number; title:string; vocab:Vocab }
      | { kind:'grammar'; id:string; theme:number; title:string; prompt:string; correct:string; options:string[]; subject:string }
    const [practiceMode,setPracticeMode]=useState<'mixed'|'vocab'|'grammar'>('mixed')
    const [showTranslation,setShowTranslation]=useState(false)
    const [showClue,setShowClue]=useState(false)
    const [sessionWrongIds,setSessionWrongIds]=useState<Set<string>>(new Set())
    const [skipWrongCardId,setSkipWrongCardId]=useState<string | null>(null)
    const [grammarFeedback,setGrammarFeedback]=useState<'correct'|'wrong'|null>(null)
    const [grammarChosen,setGrammarChosen]=useState<string | null>(null)
    const touchHandledRef = useRef(false)
    const bindTap = (fn:()=>void)=>({
      onTouchEnd: (e:React.TouchEvent)=>{
        e.preventDefault()
        touchHandledRef.current = true
        fn()
      },
      onClick: ()=>{
        if(touchHandledRef.current){
          touchHandledRef.current = false
          return
        }
        fn()
      },
    })
    const setPractice = (next:'mixed'|'vocab'|'grammar')=>{
      setPracticeMode(next)
      setSessionWrongIds(new Set())
      setSkipWrongCardId(null)
      setStudySeenSession({})
      setGrammarFeedback(null)
      setGrammarChosen(null)
    }
    const sk=(id:string)=>scopedKey(currentBookId,id)
    const themesInScope = useMemo(
      ()=> studyTheme===0 ? course.themes.map(t=>t.id) : [studyTheme],
      [studyTheme, course]
    )

    const vocabDeck = useMemo<StudyCard[]>(
      ()=>course.vocab
        .filter(v=>themesInScope.includes(v.theme))
        .map(v=>({ kind:'vocab', id:sk(v.id), theme:v.theme, title:v.en ?? v.nl, vocab:v })),
      [course,themesInScope,currentBookId]
    )
    const grammarDeck = useMemo<StudyCard[]>(()=>{
      const plans = GRAMMAR_BOOK_THEMES[currentBookId] || []
      const out:StudyCard[] = []
      for(const p of plans){
        if(!themesInScope.includes(p.id)) continue
        for(const subject of p.subjects){
          const ex = topicExercise(p.title, subject, `${currentBookId}:${p.id}`)
          out.push({
            kind:'grammar',
            id:`grammar:${currentBookId}:${p.id}:${ex.key}`,
            theme:p.id,
            title:`${p.title} - ${subject}`,
            prompt:ex.prompt,
            correct:ex.correct,
            options:ex.options,
            subject,
          })
        }
      }
      return out
    },[currentBookId,themesInScope])
    const activeDeck = useMemo(()=>{
      if(practiceMode==='vocab') return vocabDeck
      if(practiceMode==='grammar') return grammarDeck
      return interleaveAlternating(vocabDeck, grammarDeck)
    },[practiceMode,vocabDeck,grammarDeck])

    const queue = useMemo(()=>{
      const now = Date.now()
      const sessionWrongRetry = activeDeck.filter(c=>sessionWrongIds.has(c.id))
      const dueReviews = activeDeck
        .filter(c=>{
          if(sessionWrongIds.has(c.id)) return false
          const r=reviewsMap[c.id]
          if(!r || r.due>now) return false
          const step = r.learningStep ?? 0
          if(step>0) return true
          return !studySeenSession[c.id]
        })
        .sort((a,b)=>{
          const ra=reviewsMap[a.id], rb=reviewsMap[b.id]
          const sa=ra?.learningStep??0, sb=rb?.learningStep??0
          if((sa>0)!==(sb>0)) return sa>0?-1:1
          return (ra?.due??0)-(rb?.due??0)
        })
      const difficultPart = activeDeck
        .filter(c=>{
          if(sessionWrongIds.has(c.id)) return false
          if(!difficultMap[c.id]) return false
          if(studySeenSession[c.id]) return false
          const r = reviewsMap[c.id]
          if(r && (r.learningStep ?? 0) > 0) return false
          return !r || r.due>now
        })
        .sort((a,b)=>(reviewsMap[a.id]?.due||Number.MAX_SAFE_INTEGER)-(reviewsMap[b.id]?.due||Number.MAX_SAFE_INTEGER))
      const unseenVocab = activeDeck.filter(c=>c.kind==='vocab' && !reviewsMap[c.id] && !studySeenSession[c.id] && !sessionWrongIds.has(c.id))
      const unseenGrammar = activeDeck.filter(c=>c.kind==='grammar' && !reviewsMap[c.id] && !studySeenSession[c.id] && !sessionWrongIds.has(c.id))
      const newSlotsVocab = Math.max(0, settings.newPerDay - stats.newToday)
      const newVocabPart = studyContinueMode ? unseenVocab : unseenVocab.slice(0,newSlotsVocab)
      // Grammar items are exercise drills; they should not be blocked by vocab new-card caps.
      const newPart = [...newVocabPart, ...unseenGrammar]
      const seen = new Set<string>()
      const main = [...difficultPart, ...dueReviews, ...newPart].filter(c=>{
        if(seen.has(c.id)) return false
        seen.add(c.id)
        return true
      })
      const wrongList = sessionWrongRetry.filter(c=>!seen.has(c.id))
      const mainWithoutSkip = skipWrongCardId ? main.filter(c=>c.id!==skipWrongCardId) : main
      const shouldSkip = !!skipWrongCardId && mainWithoutSkip.length>0
      const effectiveMain = shouldSkip ? mainWithoutSkip : main
      const effectiveWrongList = shouldSkip && skipWrongCardId ? wrongList.filter(c=>c.id!==skipWrongCardId) : wrongList
      const merged = interleaveAfter(effectiveMain,effectiveWrongList,3)
      return studyContinueMode ? merged : merged.slice(0,settings.dailyTarget)
    },[activeDeck,reviewsMap,difficultMap,studySeenSession,sessionWrongIds,skipWrongCardId,stats.newToday,settings.newPerDay,settings.dailyTarget,studyContinueMode])

    const cur=queue[0]
    const answeredSessionCount = Object.keys(studySeenSession).length
    const plannedTotal = answeredSessionCount + queue.length
    const currentPos = plannedTotal===0 ? 0 : Math.min(plannedTotal, answeredSessionCount + 1)

    useEffect(()=>{
      setShowTranslation(false)
      setShowClue(false)
      setGrammarFeedback(null)
      setGrammarChosen(null)
      if(skipWrongCardId && cur?.id !== skipWrongCardId) setSkipWrongCardId(null)
    },[cur?.id, skipWrongCardId])
    useEffect(()=>{
      setSessionWrongIds(new Set())
      setSkipWrongCardId(null)
      setStudySeenSession({})
      setGrammarFeedback(null)
      setGrammarChosen(null)
    },[studyTheme,practiceMode,currentBookId])
    useEffect(()=>{
      if(cur?.kind==='vocab' && settings.autoSpeak) speak(cur.vocab.nl)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },[settings.autoSpeak,cur?.id])

    function advance(card:StudyCard, correct:boolean){
      const map={...reviewsMap}
      const wasNew = !map[card.id]
      const r=upsertReview(map,card.id)
      gradeBinary(r,correct,difficultMap[card.id])
      setReviewsMap(map)
      const s={...stats}
      s.reviewsToday+=1
      if(correct) s.correctToday+=1
      if(wasNew) s.newToday+=1
      setStats(s)
      saveJSON(sk(LS.stats),s)
      const graduated = (r.learningStep ?? 0) === 0
      if(correct){
        if(graduated) setStudySeenSession(prev=>({ ...prev, [card.id]: true }))
        setSessionWrongIds(prev=>{ const n=new Set(prev); n.delete(card.id); return n })
      } else {
        setSessionWrongIds(prev=>new Set(prev).add(card.id))
      }
      setSkipWrongCardId(card.id)
    }
    function toggleDifficult(){
      if(!cur) return
      setDifficultMap(m=>({ ...m, [cur.id]: !m[cur.id] }))
    }
    const generateClue = (word: string) => {
      if (!word) return ''
      const first = word[0].toUpperCase()
      const rest = word.slice(1).split('').map(() => '_').join(' ')
      return `${first} ${rest}`
    }
    function answerGrammar(guess:string){
      if(!cur || cur.kind!=='grammar') return
      const norm = (v:string)=>v.toLowerCase().trim()
      const correct = norm(guess)===norm(cur.correct)
      setGrammarChosen(guess)
      setGrammarFeedback(correct?'correct':'wrong')
      advance(cur, correct)
      setTimeout(()=>{ setGrammarFeedback(null); setGrammarChosen(null) }, correct ? 1100 : 1700)
    }

    if(!cur){
      return (
        <div className="card">
          <div className="h1">No cards in this plan</div>
          <div className="h2">You reached today&apos;s target for this chapter selection.</div>
          <div className="sep" />
          <div className="row">
            <button onClick={()=>setStudyContinueMode(true)}>Continue beyond target</button>
            <button onClick={()=>setStudyTheme(0)}>Switch to all themes</button>
          </div>
        </div>
      )
    }

    return (
      <div className="studyShell">
        <div className="card studyMain">
          <div className="row" style={{justifyContent:'space-between', alignItems:'flex-end'}}>
            <div>
              <div className="h1">Daily Practice</div>
              <div className="h2">
                {currentPos} / {plannedTotal} planned today
                {studyTheme!==0 ? ` - ${course.themes.find(t=>t.id===studyTheme)?.title ?? ''}` : ' - All themes'}
              </div>
            </div>
            <div className="studyTopActions">
              {cur.kind==='vocab' && <button {...bindTap(()=>{ void speak(cur.vocab.article ? `${cur.vocab.article} ${cur.vocab.nl}` : cur.vocab.nl) })} title="Hear the Dutch word">🔊</button>}
              <button {...bindTap(()=>setStudyContinueMode(v=>!v))}>{studyContinueMode ? 'Planned only' : 'Continue'}</button>
            </div>
          </div>
          <div className="row practiceModeQuick">
            <button type="button" className="topBarNavBtn" style={{fontWeight:practiceMode==='mixed'?700:500}} {...bindTap(()=>setPractice('mixed'))}>Both</button>
            <button type="button" className="topBarNavBtn" style={{fontWeight:practiceMode==='vocab'?700:500}} {...bindTap(()=>setPractice('vocab'))}>Vocabulary</button>
            <button type="button" className="topBarNavBtn" style={{fontWeight:practiceMode==='grammar'?700:500}} {...bindTap(()=>setPractice('grammar'))}>Grammar</button>
          </div>

          <div className="sep" />
          {cur.kind==='vocab' ? (
            <>
              <div className="bigword">{cur.vocab.en ?? '—'}</div>
              <button type="button" className="flipCard" {...bindTap(()=>setShowTranslation(v=>!v))}>
                <div className="small">Flip card</div>
                <div style={{marginTop:6, textAlign:'center'}}>
                  {showTranslation ? (cur.vocab.article ? `${cur.vocab.article} ` : '') + cur.vocab.nl : 'Tap to reveal Dutch'}
                </div>
              </button>
              <button type="button" className="clueCard" {...bindTap(()=>setShowClue(v=>!v))}>
                {!showClue && <div style={{textAlign:'center'}}>Tap to reveal clue</div>}
                {showClue && <div style={{textAlign:'center', fontSize:'2rem', fontWeight:'bold'}}>{generateClue(cur.vocab.nl)}</div>}
              </button>
              <div className="studyBottom">
                <div className="row" style={{justifyContent:'center'}}>
                  <button {...bindTap(toggleDifficult)} style={difficultMap[cur.id] ? { background:'rgba(245, 158, 11, 0.18)', borderColor:'rgba(245, 158, 11, 0.45)', color:'rgba(255, 244, 214, 0.96)' } : undefined}>Difficult</button>
                  <button {...bindTap(()=>advance(cur,false))}>Incorrect</button>
                  <button {...bindTap(()=>advance(cur,true))}>Correct</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="h2" style={{textAlign:'center', marginBottom:8}}>{cur.title}</div>
              <div className="bigword" style={{fontSize:34}}>{cur.prompt}</div>
              {grammarFeedback && (
                <div className={`deofhetFeedback feedback-${grammarFeedback}`}>
                  {grammarFeedback==='correct' ? <span>✓ Correct</span> : <span>✗ The answer is <strong>{cur.correct}</strong></span>}
                </div>
              )}
              <div className="row" style={{justifyContent:'center', marginBottom:10}}>
                <button {...bindTap(toggleDifficult)} style={difficultMap[cur.id] ? { background:'rgba(245, 158, 11, 0.18)', borderColor:'rgba(245, 158, 11, 0.45)', color:'rgba(255, 244, 214, 0.96)' } : undefined}>Difficult</button>
              </div>
              <div className="deofhetActions" style={{flexDirection:'column',gap:8}}>
                {cur.options.map(opt=>{
                  const norm = (s:string)=>s.toLowerCase().trim()
                  const isCorrect = norm(opt)===norm(cur.correct)
                  const isChosenWrong = grammarFeedback && grammarChosen!==null && norm(grammarChosen)===norm(opt) && !isCorrect
                  const showGreen = grammarFeedback && isCorrect
                  const showRed = grammarFeedback && !!isChosenWrong
                  return (
                    <button
                      key={opt}
                      className={`grammarOptionBtn${showGreen ? ' is-correct' : ''}${showRed ? ' is-wrong' : ''}`}
                      {...bindTap(()=>answerGrammar(opt))}
                      disabled={!!grammarFeedback}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="card studyQueue">
          <div className="h1">Queue</div>
          <div className="h2">Planned now: {queue.length} - {practiceMode==='mixed' ? 'Mixed' : (practiceMode==='vocab' ? 'Vocabulary' : 'Grammar')}</div>
          <div className="sep" />
          <div className="row" style={{marginBottom:8}}>
            <button onClick={()=>setStudyTheme(0)} style={{width:'100%',textAlign:'left',padding:'8px 10px',background:studyTheme===0?'rgba(255,255,255,0.14)':'var(--panel)'}}>All themes</button>
          </div>
          <div className="small" style={{maxHeight:'clamp(260px, 34vh, 420px)',overflow:'auto'}}>
            {course.themes.map(t=>{
              const active = studyTheme===t.id
              const count = activeDeck.filter(c=>c.theme===t.id).length
              return (
                <div key={t.id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  <button onClick={()=>setStudyTheme(t.id)} style={{width:'100%',textAlign:'left',padding:'8px 10px',background:active?'rgba(255,255,255,0.14)':'var(--panel)'}}>
                    {t.title}
                  </button>
                  <div className="small" style={{marginTop:4}}>Cards in chapter: {count}</div>
                </div>
              )
            })}
          </div>
          <div className="sep" />
          <div className="small" style={{maxHeight:'clamp(260px, 34vh, 420px)',overflow:'auto'}}>
            {queue.slice(0,20).map(v=><div key={v.id} style={{padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>{v.title}</div>)}
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
            <span className="cockpitMetricLabel">Due vocab now</span>
          </div>
          <div className="cockpitMetric">
            <span className="cockpitMetricValue">{stats.newToday}</span>
            <span className="cockpitMetricLabel">New vocab today</span>
          </div>
        </div>

        <div className="cockpitGrid">
          <div className="card cockpitCard">
            <div className="cockpitCardTitle">Daily Practice</div>
            <div className="cockpitCardSubtitle">Mixed practice (vocabulary + grammar)</div>
            <div className="themeBarTrack" style={{marginTop:12,marginBottom:8}}>
              <div className="themeBarSegment mastered" style={{width:`${Math.min(100, Math.round(100*stats.reviewsToday/Math.max(1,settings.dailyTarget)))}%`}} />
            </div>
            <div className="small">Today: <strong>{stats.reviewsToday}</strong> answers · <strong>{stats.newToday}</strong> new vocabulary</div>
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
            <div className="cockpitCardSubtitle">Standalone drill</div>
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
            <div className="cockpitCardSubtitle">Standalone drill</div>
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
          <div className="h2">Browser TTS (device voices via speechSynthesis)</div>
          <div className="sep" />
          <div className="small" style={{marginBottom:10}}>
            Uses your device voices. No server setup required.
          </div>
          <div className="row" style={{justifyContent:'flex-end', marginTop:0}}>
            <button type="button" onClick={refreshVoices}>Refresh voices</button>
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
        lastShownNlsRef.current = [next.nl.toLowerCase(), cur?.nl?.toLowerCase()].filter((v): v is string => !!v).slice(0,2)
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
  type GrammarConjItem = {
    kind:'conjugation'
    bookId:string
    themeId:number
    themeTitle:string
    verb:GrammarVerb
    tense:'present'|'past'|'perfect'|'future'|'conditional'
    person?:string
    correct:string
    key:string
  }
  type GrammarTopicItem = {
    kind:'topic'
    bookId:string
    themeId:number
    themeTitle:string
    subject:string
    prompt:string
    correct:string
    options:string[]
    key:string
  }
  type GrammarCardItem = GrammarConjItem | GrammarTopicItem

  const hashString = (s:string)=>{
    let h = 0
    for(let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i))>>>0
    return h
  }
  const shuffle = <T,>(arr:T[])=>{
    const out = [...arr]
    for(let i=out.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1))
      ;[out[i],out[j]]=[out[j],out[i]]
    }
    return out
  }
  function topicExercise(themeTitle:string, subject:string, keyBase:string):GrammarTopicItem{
    const s = subject.toLowerCase()
    const subjectSlug = s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'topic'
    const common = { kind:'topic' as const, themeTitle, subject, bookId:keyBase.split(':')[0], themeId:Number(keyBase.split(':')[1]) }
    if(s.includes('niet') && s.includes('geen')){
      return { ...common, key:`${keyBase}:${subjectSlug}:niet-geen`, prompt:`${themeTitle}: kies de juiste zin`, correct:'Ik heb geen geld.', options:shuffle(['Ik heb geen geld.','Ik heb niet geld.','Ik niet heb geld.']) }
    }
    if(s.includes('inversie')){
      return { ...common, key:`${keyBase}:${subjectSlug}:inversie`, prompt:`${themeTitle}: vul in (inversie) — "___ je morgen naar school?"`, correct:'Ga', options:shuffle(['Ga','Gaat','Gaan']) }
    }
    if(s.includes('om...te') || s.includes('om') && s.includes('te')){
      return { ...common, key:`${keyBase}:${subjectSlug}:om-te`, prompt:`${themeTitle}: vul in — "Ik probeer Nederlands ___ leren."`, correct:'te', options:shuffle(['te','om','naar']) }
    }
    if(s.includes('scheidbare')){
      return { ...common, key:`${keyBase}:${subjectSlug}:scheidbaar`, prompt:`${themeTitle}: welke zin is correct?`, correct:'Ik sta om zeven uur op.', options:shuffle(['Ik sta om zeven uur op.','Ik op sta om zeven uur.','Ik sta op om zeven uur ik.']) }
    }
    if(s.includes('de/het/een') || s.includes('de/het')){
      return { ...common, key:`${keyBase}:${subjectSlug}:dehet`, prompt:`${themeTitle}: kies het juiste lidwoord`, correct:'de tafel', options:shuffle(['de tafel','het tafel','een tafel het']) }
    }
    if(s.includes('verleden tijd')){
      return { ...common, key:`${keyBase}:${subjectSlug}:past`, prompt:`${themeTitle}: kies de juiste vorm — "Gisteren ___ ik thuis."`, correct:'was', options:shuffle(['was','ben','is']) }
    }
    if(s.includes('zullen')){
      return { ...common, key:`${keyBase}:${subjectSlug}:zullen`, prompt:`${themeTitle}: kies de juiste zin`, correct:'Zullen we morgen afspreken?', options:shuffle(['Zullen we morgen afspreken?','Zullen we afspreken morgen we?','Zult we morgen afspreken?']) }
    }
    if(s.includes('want') || s.includes('maar') || s.includes('dus') || s.includes('omdat')){
      return { ...common, key:`${keyBase}:${subjectSlug}:conj`, prompt:`${themeTitle}: kies de beste voegwoord-zin`, correct:'Ik blijf thuis, omdat ik moe ben.', options:shuffle(['Ik blijf thuis, omdat ik moe ben.','Ik blijf thuis omdat ben ik moe.','Ik blijf thuis, omdat moe ik ben.']) }
    }
    if(s.includes('er als plaats') || s.includes('er + getal') || s.includes('er als onbepaald onderwerp')){
      return { ...common, key:`${keyBase}:${subjectSlug}:er`, prompt:`${themeTitle}: kies de juiste zin met "er"`, correct:'Er staan drie fietsen buiten.', options:shuffle(['Er staan drie fietsen buiten.','Staan er drie fietsen buiten er.','Er drie fietsen staan buiten.']) }
    }
    if(s.includes('voorzetsels van plaats') || s.includes('positiewerkwoorden')){
      return {
        ...common,
        key:`${keyBase}:${subjectSlug}:plaats`,
        prompt:`${themeTitle}: kies de correcte zin (plaats + positiewerkwoord)`,
        correct:'De lamp hangt boven de tafel.',
        options:shuffle([
          'De lamp hangt boven de tafel.',
          'De lamp ligt boven de tafel.',
          'De lamp staat boven de tafel.'
        ])
      }
    }
    if(s.includes('bijvoeglijk') || s.includes('vergelijken')){
      return { ...common, key:`${keyBase}:${subjectSlug}:adj`, prompt:`${themeTitle}: kies de juiste vergelijking`, correct:'Deze jas is goedkoper dan die jas.', options:shuffle(['Deze jas is goedkoper dan die jas.','Deze jas is goedkoopste dan die jas.','Deze jas is meest goedkoop dan die jas.']) }
    }
    if(s.includes('persoonlijk voornaamwoord')){
      return { ...common, key:`${keyBase}:${subjectSlug}:pron`, prompt:`${themeTitle}: kies het juiste voornaamwoord`, correct:'Wij gaan naar school.', options:shuffle(['Wij gaan naar school.','Ons gaan naar school.','Wij gaat naar school.']) }
    }
    if(s.includes('meervoud')){
      return { ...common, key:`${keyBase}:${subjectSlug}:plural`, prompt:`${themeTitle}: kies het meervoud`, correct:'de kinderen', options:shuffle(['de kinderen','de kinderens','het kinderen']) }
    }
    if(s.includes('als') || s.includes('dat') || s.includes('toen')){
      return { ...common, key:`${keyBase}:${subjectSlug}:alsdat`, prompt:`${themeTitle}: kies de juiste zin`, correct:'Ik denk dat hij morgen komt.', options:shuffle(['Ik denk dat hij morgen komt.','Ik denk als hij morgen komt.','Ik denk dat komt hij morgen.']) }
    }
    return { ...common, key:`${keyBase}:${subjectSlug}:focus`, prompt:`${themeTitle}: welke grammaticale focus hoort bij deze les?`, correct:subject, options:shuffle([subject,'werkwoordvolgorde in bijzin','bezittelijk voornaamwoord']) }
  }

  function Grammar({ currentUserId, currentBookId, speak }:{ currentUserId:string; currentBookId:string; speak:(t:string)=>Promise<void> }){
    const grammarLsKey = userScopedKey(GRAMMAR_LS_BASE, currentUserId)
    const [grammarData,setGrammarData]=useState<GrammarData|null>(null)
    useEffect(()=>{ fetchJSON<GrammarData>('content/grammar.json').then(setGrammarData).catch(()=>{}) },[])
    const bookIds = useMemo(()=>Object.keys(GRAMMAR_BOOK_THEMES),[])
    const selectedBookId = useMemo(()=>bookIds.includes(currentBookId) ? currentBookId : bookIds[0],[bookIds,currentBookId])
    const [selectedThemeId,setSelectedThemeId]=useState<number>(1)
    const [track,setTrack]=useState<'conjugation'|'topics'>('conjugation')
    useEffect(()=>{
      const themes = GRAMMAR_BOOK_THEMES[selectedBookId]||[]
      if(!themes.some(t=>t.id===selectedThemeId)) setSelectedThemeId(themes[0]?.id ?? 1)
    },[selectedBookId,selectedThemeId])

    const conjugationPool = useMemo(()=>{
      if(!grammarData?.verbs) return [] as GrammarConjItem[]
      const out:GrammarConjItem[]=[]
      const persons = ['ik','jij','hij','wij','jullie','zij'] as const
      const singular = ['ik','jij','hij']
      const plural = ['wij','jullie','zij']
      const zullen = grammarData.zullen
      for(const [bookId,themes] of Object.entries(GRAMMAR_BOOK_THEMES)){
        for(const v of grammarData.verbs){
          const t = themes[hashString(`${bookId}:${v.id}`)%themes.length]
          for(const p of persons){
            const form = v.present[p]
            if(form) out.push({ kind:'conjugation', bookId, themeId:t.id, themeTitle:t.title, verb:v, tense:'present', person:p, correct:form, key:`${bookId}:t${t.id}:${v.id}:present:${p}` })
          }
          for(const p of persons){
            const form = v.past[singular.includes(p)?'singular':'plural']
            if(form) out.push({ kind:'conjugation', bookId, themeId:t.id, themeTitle:t.title, verb:v, tense:'past', person:p, correct:form, key:`${bookId}:t${t.id}:${v.id}:past:${p}` })
          }
          out.push({ kind:'conjugation', bookId, themeId:t.id, themeTitle:t.title, verb:v, tense:'perfect', correct:v.perfect, key:`${bookId}:t${t.id}:${v.id}:perfect` })
          if(zullen?.present){
            for(const p of persons){
              const aux = zullen.present[p]
              if(aux) out.push({ kind:'conjugation', bookId, themeId:t.id, themeTitle:t.title, verb:v, tense:'future', person:p, correct:`${aux} ${v.infinitive}`, key:`${bookId}:t${t.id}:${v.id}:future:${p}` })
            }
          }
          if(zullen?.past){
            for(const p of persons){
              const aux = zullen.past[plural.includes(p)?'plural':'singular']
              if(aux) out.push({ kind:'conjugation', bookId, themeId:t.id, themeTitle:t.title, verb:v, tense:'conditional', person:p, correct:`${aux} ${v.infinitive}`, key:`${bookId}:t${t.id}:${v.id}:conditional:${p}` })
            }
          }
        }
      }
      return out
    },[grammarData])

    const topicPool = useMemo(()=>{
      const out:GrammarTopicItem[]=[]
      for(const [bookId,themes] of Object.entries(GRAMMAR_BOOK_THEMES)){
        for(const t of themes){
          t.subjects.forEach((subject,idx)=>{
            out.push(topicExercise(t.title, subject, `${bookId}:${t.id}:${idx}`))
          })
        }
      }
      return out
    },[])

    const [stats,setStats]=useState<GrammarStats>(()=>{
      const raw=loadJSON<any>(grammarLsKey,{correct:0,total:0,wrongIds:{},mastered:{},streak:{},mode:'mc'})
      return { correct:raw.correct??0, total:raw.total??0, wrongIds:raw.wrongIds??{}, mastered:raw.mastered??{}, streak:raw.streak??{}, mode:raw.mode??'mc' }
    })
    const [card,setCard]=useState<{ cur:GrammarCardItem|null; options:string[] }>({ cur:null, options:[] })
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

    const scopedConjugationPool = useMemo(()=>conjugationPool.filter(i=>i.bookId===selectedBookId && i.themeId===selectedThemeId),[conjugationPool,selectedBookId,selectedThemeId])
    const scopedTopicPool = useMemo(()=>topicPool.filter(i=>i.bookId===selectedBookId && i.themeId===selectedThemeId),[topicPool,selectedBookId,selectedThemeId])
    const activePool = useMemo(()=>{
      const pool = track==='conjugation' ? scopedConjugationPool : scopedTopicPool
      return pool.filter(i=>!stats.mastered[i.key])
    },[track,scopedConjugationPool,scopedTopicPool,stats.mastered])

    const pickNext = useCallback(()=>{
      if(activePool.length===0) return null
      let pool = activePool
      if(track==='conjugation'){
        const avoid = lastPickedVerbIdsRef.current
        const avoidSameVerb = activePool.filter(i=>i.kind!=='conjugation' || !avoid.includes(i.verb.id))
        pool = avoidSameVerb.length>0 ? avoidSameVerb : activePool
      }
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
    },[activePool,track,stats.wrongIds,sessionWrong,picksSinceWrong])

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
      if(next.kind==='conjugation'){
        const nextIds = [next.verb.id,...lastPickedVerbIdsRef.current].slice(0,2)
        lastPickedVerbIdsRef.current = nextIds
        setLastPickedVerbIds(nextIds)
      }
      const distractors:string[]=[]
      if(next.kind==='conjugation'){
        const scope = scopedConjugationPool
        const sameVerbOther = scope.filter(i=>i.verb.id===next.verb.id && i.correct!==next.correct).map(i=>i.correct)
        const sameTenseOther = scope.filter(i=>i.verb.id===next.verb.id && i.tense===next.tense && i.correct!==next.correct).map(i=>i.correct)
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
      }
      if(next.kind==='topic'){
        for(const opt of next.options){ if(opt!==next.correct && !distractors.includes(opt)) distractors.push(opt) }
      }
      const all = [next.correct,...distractors.slice(0,2)]
      for(let i=all.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [all[i],all[j]]=[all[j],all[i]] }
      const oldKey = curKeyRef.current
      curKeyRef.current = next.key
      lastShownKeysRef.current = [next.key, oldKey].filter((v): v is string => !!v).slice(0,2)
      setCard({ cur:next, options:all })
      // triggerPick: advance after answer timeout. fullPool: run when data first loads.
      // Do NOT depend on pickNext (it changes when stats changes and would wipe feedback).
    },[triggerPick,track,selectedBookId,selectedThemeId,scopedConjugationPool,scopedTopicPool])

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
      setTimeout(()=>setTriggerPick(t=>t+1),correct?1200:1800)
    }

    const pct = stats.total>0 ? Math.round(100*stats.correct/stats.total) : 0

    if(!grammarData) return <div className="card"><div className="h1">Grammar</div><div className="h2">Loading…</div></div>
    if(conjugationPool.length===0 && topicPool.length===0) return <div className="card"><div className="h1">Grammar</div><div className="h2">No grammar data.</div></div>
    if(activePool.length===0) return (
      <div className="card">
        <div className="h1">Grammar</div>
        <div className="h2">All exercises mastered for this book and theme.</div>
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
            <div className="h2">{selectedBookId==='klimop' ? 'Klim Op' : 'Wind mee'} - book and chapter based progression</div>
            <div className="row" style={{flexWrap:'wrap',gap:8,alignItems:'center'}}>
            <div className="deofhetStats">
              <span className="deofhetStatPill correct">{stats.correct} correct</span>
              <span className="deofhetStatPill total">{stats.total} total</span>
              <span className="deofhetStatPill pct">{pct}%</span>
            </div>
            <select value={selectedThemeId} onChange={e=>setSelectedThemeId(Number(e.target.value))}>
              {(GRAMMAR_BOOK_THEMES[selectedBookId]||[]).map(t=><option key={t.id} value={t.id}>Theme {t.id}: {t.title}</option>)}
            </select>
            <select value={track} onChange={e=>setTrack(e.target.value as 'conjugation'|'topics')}>
              <option value="conjugation">Conjugation drills</option>
              <option value="topics">Grammar nuance drills</option>
            </select>
            <button
              className="pill"
              onClick={()=>setStats(s=>({...s,mode:s.mode==='mc'?'typing':'mc'}))}
              disabled={track!=='conjugation'}
            >
              {stats.mode==='mc' ? 'Switch to typing' : 'Switch to multiple choice'}
            </button>
          </div>
          </div>
          <div className="sep" />
          <div className="small" style={{marginBottom:10}}>
            Focus: {cur?.kind==='topic' ? cur.subject : 'Conjugation'}
          </div>
          {cur && (
            <div key={triggerPick} className="grammarCardContent">
              <div className="h2" style={{marginBottom:8}}>
                {cur.kind==='conjugation'
                  ? `${cur.verb.en} — ${cur.tense}${cur.person ? ` — ${cur.person}` : ''}`
                  : `${cur.themeTitle}`}
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
              {stats.mode==='mc' || cur.kind==='topic' ? (
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
              {cur.kind==='conjugation' && (
                <button className="deofhetSpeak" onClick={()=>speak(cur.person ? `${cur.person} ${cur.correct}` : cur.correct)}>🔊 Hear it</button>
              )}
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
        {route==='grammar' && <div className="pagePane"><Grammar currentUserId={currentUserId} currentBookId={currentBookId} speak={speak} /></div>}
      </div>
      <div className="sep appFooterSep" />
      <div className="small appFooterText">MVP • local-only • calm UI • private</div>
    </div>
  )
}
