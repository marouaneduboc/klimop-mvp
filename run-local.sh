#!/usr/bin/env bash
set -euo pipefail

# Starts the web dev server, and the local API when the venv is usable.
# Usage: ./run-local.sh
# Frontend is started even if the API venv is missing or broken.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
PROJECT_ROOT="$ROOT"
HOST="localhost"
API_PID=""
WEB_PID=""

VENV_PY="$PROJECT_ROOT/.venv/bin/python"
API_LOG="$API_DIR/__api.log"
WEB_LOG="$WEB_DIR/__web.log"

# Detach a command into its own session so it survives the parent shell exiting
# (and tooling that tears down the script's process group).
detach_run() {
  # Args: cwd  logfile  pidfile  cmd...
  local cwd="$1" logfile="$2" pidfile="$3"
  shift 3
  # Prefer python for start_new_session (portable on macOS; no setsid required)
  if [[ -x "$VENV_PY" ]]; then
    DETACH_PY="$VENV_PY"
  else
    DETACH_PY="$(command -v python3)"
  fi
  "$DETACH_PY" - "$cwd" "$logfile" "$pidfile" "$@" <<'PY'
import os, sys, subprocess
cwd, logfile, pidfile, cmd = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
os.makedirs(os.path.dirname(logfile) or ".", exist_ok=True)
with open(logfile, "w") as log, open(os.devnull, "r") as devnull:
    p = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdin=devnull,
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
with open(pidfile, "w") as f:
    f.write(str(p.pid))
print(p.pid)
PY
}

start_api() {
  if lsof -iTCP:8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "API already listening on http://localhost:8000 — leaving it running."
    API_PID="$(lsof -iTCP:8000 -sTCP:LISTEN -t | head -n1)"
    return 0
  fi

  if [[ ! -x "$VENV_PY" ]]; then
    echo "WARN: API skipped — no usable venv python at $VENV_PY" >&2
    echo "      To start API later:" >&2
    echo "        python3 -m venv .venv && .venv/bin/python -m pip install -r apps/api/requirements.txt" >&2
    echo "        (cd \"$API_DIR\" && \"$PROJECT_ROOT/.venv/bin/python\" -m uvicorn main:app --host 127.0.0.1 --port 8000)" >&2
    return 1
  fi

  # Prefer python -m uvicorn so relocated venvs with stale console-script shebangs still work.
  if ! "$VENV_PY" -c "import uvicorn" >/dev/null 2>&1; then
    echo "WARN: API skipped — uvicorn not importable in .venv (broken/incomplete install)." >&2
    echo "      Quick fix:" >&2
    echo "        .venv/bin/python -m pip install -r apps/api/requirements.txt" >&2
    echo "      Or recreate:" >&2
    echo "        rm -rf .venv && python3 -m venv .venv && .venv/bin/python -m pip install -r apps/api/requirements.txt" >&2
    return 1
  fi

  echo "Starting API (http://localhost:8000) -> logs: $API_LOG"
  API_PID="$(detach_run "$API_DIR" "$API_LOG" "$API_DIR/__api.pid" \
    "$VENV_PY" -m uvicorn main:app --host 127.0.0.1 --port 8000)"
  sleep 0.5
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "WARN: API exited immediately. See $API_LOG" >&2
    API_PID=""
    return 1
  fi
  if ! lsof -iTCP:8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    # give it a moment more to bind
    sleep 0.5
  fi
  return 0
}

# --- API (best-effort; never blocks frontend) ---
cd "$API_DIR"
set +e
start_api
set -e

# --- Web (always attempt) ---
cd "$WEB_DIR"

PORT=5175
while [[ $PORT -le 5180 ]]; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    if [[ $PORT -eq 5175 ]]; then
      echo "Web already listening on http://$HOST:$PORT/ — leaving it running."
      echo "Open locally: http://$HOST:$PORT/"
      if [[ -n "${API_PID}" ]]; then
        echo "API PID: $API_PID (stop with: kill $API_PID)"
      else
        echo "API not running. Start later with:"
        echo "  (cd \"$API_DIR\" && \"$VENV_PY\" -m uvicorn main:app --host 127.0.0.1 --port 8000)"
      fi
      exit 0
    fi
    PORT=$((PORT + 1))
    continue
  fi
  break
done

if [[ $PORT -gt 5180 ]]; then
  echo "ERROR: no free port in 5175-5180" >&2
  exit 1
fi

echo "Starting web dev server (http://$HOST:$PORT/) -> logs: $WEB_LOG"
WEB_PID="$(detach_run "$WEB_DIR" "$WEB_LOG" "$WEB_DIR/__web.pid" \
  npm run dev -- --host "$HOST" --port "$PORT")"

for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "ERROR: web server exited early. See $WEB_LOG" >&2
    exit 1
  fi
  sleep 0.3
done

open "http://$HOST:$PORT/" 2>/dev/null || true

echo "Open locally: http://$HOST:$PORT/"
if [[ -n "${API_PID}" ]]; then
  echo "Running. PIDs — API: $API_PID  WEB: $WEB_PID"
  echo "To stop: kill $API_PID $WEB_PID"
else
  echo "Running. WEB PID: $WEB_PID (API skipped — see warnings above)"
  echo "To stop web: kill $WEB_PID"
  echo "To start API later:"
  echo "  (cd \"$API_DIR\" && \"$VENV_PY\" -m uvicorn main:app --host 127.0.0.1 --port 8000)"
fi
