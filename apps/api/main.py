from __future__ import annotations
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import subprocess
import tempfile
import os

BIN = os.environ.get("SHERPA_TTS_BIN", "/Users/fmjduboc/.openclaw/tools/sherpa-onnx-tts/runtime/bin/sherpa-onnx-offline-tts")
MODELS_DIR = os.environ.get("SHERPA_TTS_MODELS_DIR", "/Users/fmjduboc/.openclaw/tools/sherpa-onnx-tts/models")

app = FastAPI(title="Klimop Local TTS")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def _resolve_voice_assets(voice_dir: Path) -> tuple[Path | None, Path | None, Path]:
    # Accept typical sherpa model layouts where names are not fixed.
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
    # sherpa uses vits-length-scale (larger = slower), while UI speed uses larger = faster
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
