#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
echo "== Klimop MVP bootstrap =="
echo "Root: $ROOT"

# ---------- CONFIG ----------
SHERPA_BIN="/Users/fmjduboc/.openclaw/tools/sherpa-onnx-tts/runtime/bin/sherpa-onnx-offline-tts"
SHERPA_MODELS="/Users/fmjduboc/.openclaw/tools/sherpa-onnx-tts/models"
AUDIO_SRC="$ROOT/assets_raw/audio/Klim op audio 2019"
WEB="$ROOT/apps/web"
API="$ROOT/apps/api"

# ---------- CHECKS ----------
if [[ ! -x "$SHERPA_BIN" ]]; then
  echo "ERROR: sherpa binary not found or not executable:"
  echo "  $SHERPA_BIN"
  exit 1
fi

if [[ ! -d "$SHERPA_MODELS" ]]; then
  echo "ERROR: sherpa models dir not found:"
  echo "  $SHERPA_MODELS"
  exit 1
fi

if [[ ! -d "$AUDIO_SRC" ]]; then
  echo "ERROR: audio source folder not found:"
  echo "  $AUDIO_SRC"
  exit 1
fi

mkdir -p "$WEB" "$API" "$ROOT/tools"

# ---------- API (FastAPI) ----------
mkdir -p "$API"
cat > "$API/requirements.txt" <<'REQ'
fastapi
uvicorn
pydantic
REQ

cat > "$API/main.py" <<PY
from __future__ import annotations
from fastapi import FastAPI, Response
from pydantic import BaseModel
from pathlib import Path
import subprocess
import tempfile
import os

BIN = os.environ.get("SHERPA_TTS_BIN", "${SHERPA_BIN}")
MODELS_DIR = os.environ.get("SHERPA_TTS_MODELS_DIR", "${SHERPA_MODELS}")

app = FastAPI(title="Klimop Local TTS")

class SpeakReq(BaseModel):
    text: str
    voice: str
    speed: float = 1.0

def _safe_voice_dir(voice: str) -> Path:
    base = Path(MODELS_DIR).resolve()
    p = (base / voice).resolve()
    if base not in p.parents and p != base:
        raise ValueError("Invalid voice path")
    return p

@app.get("/tts/voices")
def voices():
    base = Path(MODELS_DIR)
    if not base.exists():
        return {"voices": []}
    voices = [p.name for p in base.iterdir() if p.is_dir()]
    voices.sort()
    return {"voices": voices}

@app.post("/tts/speak")
def speak(req: SpeakReq):
    voice_dir = _safe_voice_dir(req.voice)
    model = voice_dir / "model.onnx"
    tokens = voice_dir / "tokens.txt"
    if not model.exists() or not tokens.exists():
        return Response(
            content=f"Missing model.onnx/tokens.txt in {voice_dir}".encode("utf-8"),
            media_type="text/plain",
            status_code=400,
        )

    speed = float(req.speed)
    speed = 0.6 if speed < 0.6 else (1.4 if speed > 1.4 else speed)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        out = tmp.name

    cmd = [
        BIN,
        "--vits-model", str(model),
        "--vits-tokens", str(tokens),
        "--vits-data-dir", str(voice_dir),
        "--output-filename", out,
        "--text", req.text,
        "--speed", str(speed),
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        data = Path(out).read_bytes()
        return Response(content=data, media_type="audio/wav")
    except subprocess.CalledProcessError as e:
        return Response(content=(e.stderr or b"TTS failed"), media_type="text/plain", status_code=500)
    finally:
        try:
            Path(out).unlink(missing_ok=True)
        except Exception:
            pass
PY

# ---------- WEB (Vite + React TS) ----------
mkdir -p "$WEB/src" "$WEB/public/audio" "$WEB/public/content"
cat > "$WEB/package.json" <<'PKG'
{
  "name": "klimop-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.2"
  }
}
PKG

cat > "$WEB/vite.config.ts" <<'VITE'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true }
})
VITE

cat > "$WEB/tsconfig.json" <<'TSC'
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
TSC

cat > "$WEB/index.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Klim op — Dutch Practice</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML

cat > "$WEB/src/main.tsx" <<'MAIN'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
MAIN

cat > "$WEB/src/styles.css" <<'CSS'
:root{
  --bg:#0b0f14;
  --panel:rgba(255,255,255,0.06);
  --panel2:rgba(255,255,255,0.10);
  --text:rgba(255,255,255,0.92);
  --muted:rgba(255,255,255,0.66);
  --border:rgba(255,255,255,0.12);
  --accent:#7dd3fc;
  font-synthesis:none;
  text-rendering:optimizeLegibility;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
}
html,body{height:100%;margin:0;background:
  radial-gradient(1200px 800px at 30% 10%, rgba(125,211,252,0.20), transparent 55%),
  radial-gradient(900px 700px at 70% 30%, rgba(134,239,172,0.12), transparent 60%),
  var(--bg);
  color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
}
.container{max-width:1100px;margin:0 auto;padding:24px}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.card{background:var(--panel);border:1px solid var(--border);border-radius:20px;padding:16px;backdrop-filter:blur(10px)}
.h1{font-size:28px;margin:0 0 10px 0}
.h2{font-size:16px;color:var(--muted);margin:0}
.sep{height:1px;background:var(--border);margin:12px 0}
.pill{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid var(--border);font-size:12px;color:var(--muted)}
button,select,input{font:inherit;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:10px 12px}
button:hover{border-color:rgba(255,255,255,0.20);background:var(--panel2);cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.bigword{font-size:44px;font-weight:700;text-align:center}
.small{font-size:12px;color:var(--muted)}
CSS

cat > "$WEB/src/App.tsx" <<'APP'
import { useEffect, useMemo, useState } from 'react'

type Vocab = { id:string; theme:number; nl:string; en?:string|null; article?:'de'|'het'|null }
type Review = { id:string; due:number; interval:number; ease:number; reps:number; lapses:number }
type Stats = { streak:number; lastDay:string|null; minutesToday:number; reviewsToday:number; correctToday:number; history:{day:string;minutes:number;reviews:number;correct:number}[] }
type Settings = { ttsBaseUrl:string; autoSpeak:boolean; voice:string; speed:number }
type Course = { version:string; themes:{id:number;title:string}[]; vocab:Vocab[]; audio:{groups:Record<string, any>} }

const LS = { reviews:'klimop.reviews.v1', stats:'klimop.stats.v1', settings:'klimop.settings.v1' }
const todayISO = ()=> new Date().toISOString().slice(0,10)
const loadJSON = <T,>(k:string, f:T):T => { try{ const s=localStorage.getItem(k); return s? JSON.parse(s):f }catch{return f} }
const saveJSON = (k:string,v:any)=> localStorage.setItem(k, JSON.stringify(v))

function ensureStats():Stats{
  const s = loadJSON<Stats>(LS.stats,{streak:0,lastDay:null,minutesToday:0,reviewsToday:0,correctToday:0,history:[]})
  const day=todayISO()
  if(s.lastDay!==day){
    if(s.lastDay){
      s.history=[...s.history,{day:s.lastDay,minutes:s.minutesToday,reviews:s.reviewsToday,correct:s.correctToday}].slice(-31)
      const prev=new Date(s.lastDay), cur=new Date(day)
      const diff=Math.round((cur.getTime()-prev.getTime())/86400000)
      s.streak = diff===1 ? s.streak+1 : 1
    }else s.streak=1
    s.lastDay=day; s.minutesToday=0; s.reviewsToday=0; s.correctToday=0
    saveJSON(LS.stats,s)
  }
  return s
}

function upsertReview(map:Record<string,Review>, id:string):Review{
  if(!map[id]) map[id]={id,due:Date.now(),interval:0,ease:2.5,reps:0,lapses:0}
  return map[id]
}
function grade(r:Review, quality:0|1|2|3){
  const q=[0,3,4,5][quality]
  r.reps+=1
  if(q<3){
    r.lapses+=1; r.interval=0; r.ease=Math.max(1.3,r.ease-0.2); r.due=Date.now()+10*60*1000; return
  }
  r.ease=Math.max(1.3, r.ease + (0.1 - (5-q)*(0.08 + (5-q)*0.02)))
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
  const [settings,setSettings]=useState<Settings>(()=>loadJSON(LS.settings,{ttsBaseUrl:'http://127.0.0.1:8787',autoSpeak:false,voice:'',speed:1.0}))
  const [voices,setVoices]=useState<string[]>([])
  const [err,setErr]=useState('')

  useEffect(()=>{ fetchJSON<Course>('/content/course.json').then(setCourse).catch(e=>setErr(String(e))) },[])
  useEffect(()=>saveJSON(LS.reviews,reviewsMap),[reviewsMap])
  useEffect(()=>saveJSON(LS.settings,settings),[settings])

  const dueCount = useMemo(()=>{
    if(!course) return 0
    const now=Date.now()
    return course.vocab.filter(v=>!reviewsMap[v.id] || reviewsMap[v.id].due<=now).length
  },[course,reviewsMap])

  async function refreshVoices(){
    setErr('')
    try{
      const r=await fetchJSON<{voices:string[]}>(`${settings.ttsBaseUrl}/tts/voices`)
      setVoices(r.voices||[])
      if(!settings.voice && r.voices?.length) setSettings(s=>({...s,voice:r.voices[0]}))
    }catch(e:any){ setErr(String(e?.message??e)) }
  }
  useEffect(()=>{ refreshVoices() },[settings.ttsBaseUrl])

  async function speak(text:string){
    if(!settings.voice){ setErr('No voice selected. Go to TTS tab.'); return }
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
          <div className="pill">Due {dueCount}</div>
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
    return (
      <div className="row" style={{alignItems:'stretch'}}>
        <div className="card" style={{flex:2}}>
          <div className="h1">Daily calm practice</div>
          <div className="h2">Flashcards + SRS. Translations hidden by default.</div>
          <div className="sep" />
          <div className="row">
            <button onClick={()=>setRoute('study')}>Start Daily</button>
            <button onClick={()=>speak('Hallo! Hoe gaat het?')}>🔊 Test Speak</button>
          </div>
          <div className="sep" />
          <div className="small">Tip: reveal translation only to confirm. Keep Dutch in your head.</div>
        </div>
        <div className="card" style={{flex:1}}>
          <div className="h1">Status</div>
          <div className="h2">Local-only progress.</div>
          <div className="sep" />
          <div className="row">
            <div className="pill">Reviews today {stats.reviewsToday}</div>
            <div className="pill">Accuracy {stats.reviewsToday? Math.round(100*stats.correctToday/stats.reviewsToday):0}%</div>
          </div>
        </div>
      </div>
    )
  }

  function Study(){
    if(!course) return null
    const now=Date.now()
    const deck=course.vocab
    const due=deck.filter(v=>!reviewsMap[v.id] || reviewsMap[v.id].due<=now)
    const [idx,setIdx]=useState(0)
    const [show,setShow]=useState(false)
    const queue=due
    const cur=queue[idx]

    useEffect(()=>{
      if(cur && settings.autoSpeak) speak(cur.article? `${cur.article} ${cur.nl}`:cur.nl)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },[idx,settings.autoSpeak])

    function answer(q:0|1|2|3){
      if(!cur) return
      const map={...reviewsMap}
      const r=upsertReview(map,cur.id); grade(r,q)
      setReviewsMap(map)
      const s={...stats}; s.reviewsToday+=1; if(q>=2) s.correctToday+=1; setStats(s); saveJSON(LS.stats,s)
      setShow(false); setIdx(i=>i+1)
    }

    if(!cur){
      return <div className="card"><div className="h1">No cards due</div><div className="h2">Nice. Come back later.</div></div>
    }

    return (
      <div className="row" style={{alignItems:'stretch'}}>
        <div className="card" style={{flex:2}}>
          <div className="row" style={{justifyContent:'space-between'}}>
            <div>
              <div className="h1">Daily SRS</div>
              <div className="h2">{idx+1} / {queue.length} due</div>
            </div>
            <div className="row">
              <button onClick={()=>speak(cur.article?`${cur.article} ${cur.nl}`:cur.nl)}>🔊</button>
              <button onClick={()=>setShow(s=>!s)}>{show?'Hide':'Reveal'}</button>
            </div>
          </div>
          <div className="sep" />
          <div className="bigword">{cur.article? `${cur.article} `:''}{cur.nl}</div>
          {show && <div className="small" style={{textAlign:'center',marginTop:10}}>{cur.en ?? '—'}</div>}
          <div className="sep" />
          <div className="row" style={{justifyContent:'center'}}>
            <button onClick={()=>answer(0)}>Again</button>
            <button onClick={()=>answer(1)}>Hard</button>
            <button onClick={()=>answer(2)}>Good</button>
            <button onClick={()=>answer(3)}>Easy</button>
          </div>
        </div>
        <div className="card" style={{flex:1}}>
          <div className="h1">Queue</div>
          <div className="h2">Due now: {queue.length}</div>
          <div className="sep" />
          <div className="small" style={{maxHeight:360,overflow:'auto'}}>
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
        <div className="h2">Streak, accuracy, due. Simple and honest.</div>
        <div className="sep" />
        <div className="row">
          <div className="pill">Streak {stats.streak}🔥</div>
          <div className="pill">Due {dueCount}</div>
          <div className="pill">Reviews today {stats.reviewsToday}</div>
          <div className="pill">Accuracy {acc}%</div>
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
          <div className="row">
            <div style={{flex:1}}>
              <div className="small">API base URL</div>
              <input value={settings.ttsBaseUrl} onChange={e=>setSettings(s=>({...s,ttsBaseUrl:e.target.value}))} style={{width:'100%'}} />
            </div>
            <button onClick={refreshVoices}>Refresh</button>
          </div>
          <div className="sep" />
          <div className="row">
            <div style={{flex:1}}>
              <div className="small">Voice</div>
              <select value={settings.voice} onChange={e=>setSettings(s=>({...s,voice:e.target.value}))} style={{width:'100%'}}>
                {voices.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div style={{width:160}}>
              <div className="small">Speed</div>
              <input type="number" min="0.6" max="1.4" step="0.05" value={settings.speed}
                onChange={e=>setSettings(s=>({...s,speed:Number(e.target.value)}))} style={{width:'100%'}} />
            </div>
            <div style={{width:180}}>
              <div className="small">Auto-speak</div>
              <select value={settings.autoSpeak?'yes':'no'} onChange={e=>setSettings(s=>({...s,autoSpeak:e.target.value==='yes'}))} style={{width:'100%'}}>
                <option value="no">No</option><option value="yes">Yes</option>
              </select>
            </div>
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
      {route==='home' && <Home />}
      {route==='study' && <Study />}
      {route==='progress' && <Progress />}
      {route==='tts' && <TTS />}
      <div className="sep" />
      <div className="small">MVP • local-only • calm UI • private</div>
    </div>
  )
}
APP

# ---------- Tools: audio + minimal content ----------
cat > "$ROOT/tools/import_audio.py" <<'PY'
import argparse, os, re, json, shutil
from pathlib import Path

PAT = re.compile(r'^KLIMOP-(\d{3})_(.+)\.mp3$', re.IGNORECASE)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="Path to 'Klim op audio 2019' folder")
    args = ap.parse_args()

    src = Path(args.src)
    out_audio = Path("apps/web/public/audio")
    out_audio.mkdir(parents=True, exist_ok=True)

    files = []
    groups = {}

    for theme_dir in sorted(src.glob("Thema *")):
        if not theme_dir.is_dir(): 
            continue
        dest = out_audio / theme_dir.name
        dest.mkdir(parents=True, exist_ok=True)
        for f in sorted(theme_dir.glob("*.mp3")):
            shutil.copy2(f, dest / f.name)
            url = f"/audio/{theme_dir.name}/{f.name}"
            files.append(url)
            m = PAT.match(f.name)
            if m:
                theme = int(m.group(1))
                code = m.group(2)
                first = code.split("_")[0]
                groups.setdefault(theme, {}).setdefault(first, []).append(url)

    out_content = Path("apps/web/public/content")
    out_content.mkdir(parents=True, exist_ok=True)
    (out_content / "audio_manifest.json").write_text(json.dumps({"groups": groups, "all": files}, indent=2), encoding="utf-8")
    print("OK: audio copied + audio_manifest.json written.")

if __name__ == "__main__":
    main()
PY

cat > "$ROOT/tools/extract_content.py" <<'PY'
import json
from pathlib import Path

THEMES = [
  (1, "Kennismaken"),
  (2, "Hoe gaat het?"),
  (3, "Familie"),
  (4, "Dagelijkse activiteiten"),
  (5, "De tijd"),
  (6, "Afspreken"),
  (7, "Eten en drinken"),
  (8, "Boodschappen doen"),
  (9, "Winkelen"),
  (10, "Gezondheid"),
]

def main():
  # MVP: empty vocab placeholder (you’ll enrich later from PDFs)
  # Still works: you can add vocab manually in public/content/course.json.
  audio = {}
  am = Path("apps/web/public/content/audio_manifest.json")
  if am.exists():
    audio = json.loads(am.read_text(encoding="utf-8")).get("groups", {})
  course = {
    "version": "mvp-0.1",
    "themes": [{"id":t,"title":name} for t,name in THEMES],
    "vocab": [],
    "audio": {"groups": audio}
  }
  out = Path("apps/web/public/content/course.json")
  out.parent.mkdir(parents=True, exist_ok=True)
  out.write_text(json.dumps(course, indent=2, ensure_ascii=False), encoding="utf-8")
  print("OK: wrote course.json (vocab empty by design in this bootstrap).")

if __name__ == "__main__":
  main()
PY

# ---------- INSTALL ----------
echo "Installing web dependencies…"
cd "$WEB"
npm install >/dev/null

echo "Creating Python venv…"
cd "$API"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt >/dev/null

# ---------- BUILD CONTENT ----------
cd "$ROOT"
python3 tools/import_audio.py --src "$AUDIO_SRC"
python3 tools/extract_content.py

echo "== DONE =="
echo ""
echo "Run API:"
echo "  cd apps/api && source .venv/bin/activate && uvicorn main:app --reload --host 127.0.0.1 --port 8787"
echo ""
echo "Run WEB:"
echo "  cd apps/web && npm run dev"
echo ""
echo "Open: http://127.0.0.1:5173"
