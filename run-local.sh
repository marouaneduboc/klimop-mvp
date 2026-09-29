#!/usr/bin/env bash
set -euo pipefail

# Starts API + Vite bound to 0.0.0.0 so phones on the same LAN can connect.
# Usage: ./run-local.sh
# Frontend starts even if the API venv is missing or broken.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
PROJECT_ROOT="$ROOT"
HOST="0.0.0.0"
API_PID=""
WEB_PID=""

VENV_PY="$PROJECT_ROOT/.venv/bin/python"
API_LOG="$API_DIR/__api.log"
WEB_LOG="$WEB_DIR/__web.log"

lan_ip() {
  # Prefer en0 (Wi-Fi / Ethernet on Mac), fall back to first non-loopback IPv4
  local ip=""
  if command -v ipconfig >/dev/null 2>&1; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
    if [[ -z "$ip" ]]; then
      ip="$(ipconfig getifaddr en1 2>/dev/null || true)"
    fi
  fi
  if [[ -z "$ip" ]] && command -v ifconfig >/dev/null 2>&1; then
    ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" { print $2; exit }')"
  fi
  echo "${ip:-127.0.0.1}"
}

detach_run() {
  local cwd="$1" logfile="$2" pidfile="$3"
  shift 3
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
    echo "API already listening on port 8000 — leaving it running."
    API_PID="$(lsof -iTCP:8000 -sTCP:LISTEN -t | head -n1)"
    return 0
  fi

  if [[ ! -x "$VENV_PY" ]]; then
    echo "WARN: API skipped — no usable venv python at $VENV_PY" >&2
    echo "      python3 -m venv .venv && .venv/bin/python -m pip install -r apps/api/requirements.txt" >&2
    return 1
  fi

  if ! "$VENV_PY" -c "import uvicorn, fastapi" >/dev/null 2>&1; then
    echo "WARN: API skipped — fastapi/uvicorn not importable. Fix:" >&2
    echo "      .venv/bin/python -m pip install -r apps/api/requirements.txt" >&2
    return 1
  fi

  echo "Starting API (http://0.0.0.0:8000) -> logs: $API_LOG"
  API_PID="$(detach_run "$API_DIR" "$API_LOG" "$API_DIR/__api.pid" \
    "$VENV_PY" -m uvicorn main:app --host 0.0.0.0 --port 8000)"
  sleep 0.5
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "WARN: API exited immediately. See $API_LOG" >&2
    API_PID=""
    return 1
  fi
  sleep 0.3
  return 0
}

# --- API (best-effort) ---
cd "$API_DIR"
set +e
start_api
set -e

# --- Web ---
cd "$WEB_DIR"

PORT=5175
while [[ $PORT -le 5180 ]]; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    if [[ $PORT -eq 5175 ]]; then
      LAN="$(lan_ip)"
      echo "Web already listening on port $PORT — leaving it running."
      echo "Open on this Mac:  http://localhost:$PORT/"
      echo "Open on phone LAN: http://$LAN:$PORT/"
      if [[ -n "${API_PID}" ]]; then
        echo "API: http://$LAN:8000/docs  (PID $API_PID)"
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

echo "Starting web (http://0.0.0.0:$PORT/) -> logs: $WEB_LOG"
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

LAN="$(lan_ip)"
open "http://localhost:$PORT/" 2>/dev/null || true

echo ""
echo "============================================"
echo " Lichte Klimop — local + phone LAN"
echo "============================================"
echo " Mac:   http://localhost:$PORT/"
echo " Phone: http://$LAN:$PORT/   ← same Wi‑Fi"
echo " API:   http://$LAN:8000/docs"
echo " Pair:  open Sync tool on Mac → Create code → Join on phone"
echo "============================================"
if [[ -n "${API_PID}" ]]; then
  echo "PIDs — API: $API_PID  WEB: $WEB_PID"
  echo "Stop: kill $API_PID $WEB_PID"
else
  echo "WEB PID: $WEB_PID (API skipped — see warnings)"
  echo "Stop web: kill $WEB_PID"
fi
