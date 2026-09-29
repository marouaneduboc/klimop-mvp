from __future__ import annotations

from fastapi import FastAPI, Response, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
import subprocess
import tempfile
import os
import json
import sqlite3
import secrets
import string
import time
from typing import Any

BIN = os.environ.get(
    "SHERPA_TTS_BIN",
    "/Users/fmjduboc/.openclaw/tools/sherpa-onnx-tts/runtime/bin/sherpa-onnx-offline-tts",
)
MODELS_DIR = os.environ.get(
    "SHERPA_TTS_MODELS_DIR",
    "/Users/fmjduboc/.openclaw/tools/sherpa-onnx-tts/models",
)

DATA_DIR = Path(os.environ.get("KLIMOP_DATA_DIR", Path(__file__).resolve().parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "klimop_sync.sqlite"

app = FastAPI(title="Klimop Local API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with _db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
              id TEXT PRIMARY KEY,
              display_name TEXT NOT NULL,
              local_user_id TEXT,
              created_at REAL NOT NULL,
              updated_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS progress (
              profile_id TEXT PRIMARY KEY,
              blob_json TEXT NOT NULL,
              updated_at REAL NOT NULL,
              FOREIGN KEY(profile_id) REFERENCES profiles(id)
            );
            CREATE TABLE IF NOT EXISTS pair_codes (
              code TEXT PRIMARY KEY,
              profile_id TEXT NOT NULL,
              token TEXT NOT NULL,
              expires_at REAL NOT NULL,
              FOREIGN KEY(profile_id) REFERENCES profiles(id)
            );
            CREATE TABLE IF NOT EXISTS tokens (
              token TEXT PRIMARY KEY,
              profile_id TEXT NOT NULL,
              device_label TEXT,
              created_at REAL NOT NULL,
              FOREIGN KEY(profile_id) REFERENCES profiles(id)
            );
            """
        )


_init_db()


def _new_id(prefix: str = "p") -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def _pair_code(n: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    # Avoid ambiguous chars
    alphabet = alphabet.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(n))


def _auth_profile(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    with _db() as conn:
        row = conn.execute("SELECT profile_id FROM tokens WHERE token=?", (token,)).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid token")
    return str(row["profile_id"])


class SpeakReq(BaseModel):
    text: str
    voice: str
    speed: float = 1.0


class PairCreateReq(BaseModel):
    display_name: str = "Learner"
    local_user_id: str = "default"
    progress: dict[str, Any] = Field(default_factory=dict)


class PairJoinReq(BaseModel):
    code: str
    device_label: str = "phone"


class ProgressPut(BaseModel):
    profile_id: str
    progress: dict[str, Any]
    display_name: str | None = None
    local_user_id: str | None = None


@app.get("/health")
def health():
    return {"ok": True, "service": "klimop-local", "sync_db": str(DB_PATH)}


@app.post("/sync/pair/create")
def pair_create(req: PairCreateReq):
    now = time.time()
    profile_id = _new_id("prof")
    token = secrets.token_urlsafe(24)
    code = _pair_code(6)
    expires = now + 15 * 60
    with _db() as conn:
        conn.execute(
            "INSERT INTO profiles(id, display_name, local_user_id, created_at, updated_at) VALUES (?,?,?,?,?)",
            (profile_id, req.display_name, req.local_user_id, now, now),
        )
        conn.execute(
            "INSERT INTO progress(profile_id, blob_json, updated_at) VALUES (?,?,?)",
            (profile_id, json.dumps(req.progress), now),
        )
        conn.execute(
            "INSERT INTO pair_codes(code, profile_id, token, expires_at) VALUES (?,?,?,?)",
            (code, profile_id, token, expires),
        )
        conn.execute(
            "INSERT INTO tokens(token, profile_id, device_label, created_at) VALUES (?,?,?,?)",
            (token, profile_id, "mac-host", now),
        )
    # Also mirror JSON for easy inspection
    (DATA_DIR / f"{profile_id}.json").write_text(json.dumps(req.progress, indent=2), encoding="utf-8")
    return {
        "profile_id": profile_id,
        "code": code,
        "token": token,
        "expires_minutes": 15,
    }


@app.post("/sync/pair/join")
def pair_join(req: PairJoinReq):
    code = req.code.strip().upper()
    now = time.time()
    with _db() as conn:
        row = conn.execute(
            "SELECT profile_id, token, expires_at FROM pair_codes WHERE code=?",
            (code,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Unknown pairing code")
        if float(row["expires_at"]) < now:
            raise HTTPException(status_code=410, detail="Pairing code expired — create a new one on the Mac")
        profile_id = str(row["profile_id"])
        # Issue a device-specific token (keep host token too)
        device_token = secrets.token_urlsafe(24)
        conn.execute(
            "INSERT INTO tokens(token, profile_id, device_label, created_at) VALUES (?,?,?,?)",
            (device_token, profile_id, req.device_label, now),
        )
        prog = conn.execute(
            "SELECT blob_json FROM progress WHERE profile_id=?",
            (profile_id,),
        ).fetchone()
        prof = conn.execute(
            "SELECT display_name, local_user_id FROM profiles WHERE id=?",
            (profile_id,),
        ).fetchone()
    progress = json.loads(prog["blob_json"]) if prog else {}
    return {
        "profile_id": profile_id,
        "token": device_token,
        "progress": progress,
        "display_name": (prof["display_name"] if prof else None),
        "local_user_id": (prof["local_user_id"] if prof else None),
    }


@app.put("/sync/progress")
def progress_put(req: ProgressPut, authorization: str | None = Header(default=None)):
    pid = _auth_profile(authorization)
    if pid != req.profile_id:
        raise HTTPException(status_code=403, detail="Token/profile mismatch")
    now = time.time()
    blob = json.dumps(req.progress)
    # Keep profiles.display_name / local_user_id in sync: explicit PUT fields, then blob
    cur_user = req.local_user_id if isinstance(req.local_user_id, str) and req.local_user_id.strip() else None
    if not cur_user:
        blob_user = req.progress.get("klimop.currentUser")
        if isinstance(blob_user, str) and blob_user.strip():
            cur_user = blob_user.strip()
    names = req.progress.get("klimop.userDisplayNames") or {}
    disp = req.display_name.strip() if isinstance(req.display_name, str) and req.display_name.strip() else None
    if not disp and cur_user and isinstance(names, dict):
        n = names.get(cur_user)
        if isinstance(n, str) and n.strip():
            disp = n.strip()
    with _db() as conn:
        conn.execute(
            "INSERT INTO progress(profile_id, blob_json, updated_at) VALUES (?,?,?) "
            "ON CONFLICT(profile_id) DO UPDATE SET blob_json=excluded.blob_json, updated_at=excluded.updated_at",
            (pid, blob, now),
        )
        if disp and cur_user:
            conn.execute(
                "UPDATE profiles SET display_name=?, local_user_id=?, updated_at=? WHERE id=?",
                (disp, cur_user, now, pid),
            )
        elif cur_user:
            conn.execute(
                "UPDATE profiles SET local_user_id=?, updated_at=? WHERE id=?",
                (cur_user, now, pid),
            )
        elif disp:
            conn.execute(
                "UPDATE profiles SET display_name=?, updated_at=? WHERE id=?",
                (disp, now, pid),
            )
        else:
            conn.execute("UPDATE profiles SET updated_at=? WHERE id=?", (now, pid))
    (DATA_DIR / f"{pid}.json").write_text(json.dumps(req.progress, indent=2), encoding="utf-8")
    return {"ok": True, "updated_at": now}


@app.get("/sync/progress/{profile_id}")
def progress_get(profile_id: str, authorization: str | None = Header(default=None)):
    pid = _auth_profile(authorization)
    if pid != profile_id:
        raise HTTPException(status_code=403, detail="Token/profile mismatch")
    with _db() as conn:
        row = conn.execute(
            "SELECT blob_json, updated_at FROM progress WHERE profile_id=?",
            (profile_id,),
        ).fetchone()
        prof = conn.execute(
            "SELECT display_name, local_user_id FROM profiles WHERE id=?",
            (profile_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="No progress")
    return {
        "profile_id": profile_id,
        "progress": json.loads(row["blob_json"]),
        "updated_at": row["updated_at"],
        "display_name": (prof["display_name"] if prof else None),
        "local_user_id": (prof["local_user_id"] if prof else None),
    }


@app.get("/sync/profiles")
def list_profiles():
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, display_name, local_user_id, created_at, updated_at FROM profiles ORDER BY updated_at DESC"
        ).fetchall()
    return {
        "profiles": [
            {
                "id": r["id"],
                "display_name": r["display_name"],
                "local_user_id": r["local_user_id"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in rows
        ]
    }


def _safe_voice_dir(voice: str) -> Path:
    base = Path(MODELS_DIR).resolve()
    p = (base / voice).resolve()
    if base not in p.parents and p != base:
        raise ValueError("Invalid voice path")
    return p


def _resolve_voice_assets(voice_dir: Path) -> tuple[Path | None, Path | None, Path]:
    model = next(iter(voice_dir.glob("*.onnx")), None)
    if model is None:
        model = next(iter(voice_dir.rglob("*.onnx")), None)

    tokens = voice_dir / "tokens.txt"
    if not tokens.exists():
        token_candidates = list(voice_dir.glob("tokens*.txt"))
        if not token_candidates:
            token_candidates = list(voice_dir.rglob("tokens*.txt"))
        tokens = token_candidates[0] if token_candidates else None

    data_dir = voice_dir / "espeak-ng-data"
    if not data_dir.exists():
        data_dir = voice_dir

    return model, tokens, data_dir


@app.get("/tts/voices")
def voices():
    base = Path(MODELS_DIR)
    if not base.exists():
        return {"voices": []}
    voices = []
    for p in base.iterdir():
        if not p.is_dir():
            continue
        model, tokens, _ = _resolve_voice_assets(p)
        if model is not None and tokens is not None:
            voices.append(p.name)
    voices.sort()
    return {"voices": voices}


@app.post("/tts/speak")
def speak(req: SpeakReq):
    voice_dir = _safe_voice_dir(req.voice)
    model, tokens, data_dir = _resolve_voice_assets(voice_dir)
    if model is None or tokens is None:
        return Response(
            content=f"Missing .onnx model or tokens.txt in {voice_dir}".encode("utf-8"),
            media_type="text/plain",
            status_code=400,
        )

    speed = float(req.speed)
    speed = 0.6 if speed < 0.6 else (1.4 if speed > 1.4 else speed)
    length_scale = 1.0 / speed

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        out = tmp.name

    cmd = [
        BIN,
        f"--vits-model={model}",
        f"--vits-tokens={tokens}",
        f"--vits-data-dir={data_dir}",
        f"--output-filename={out}",
        f"--vits-length-scale={length_scale}",
        req.text,
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
