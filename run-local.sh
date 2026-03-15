#!/usr/bin/env bash
set -euo pipefail

# Starts both the local API and the web dev server.
# Usage: ./run-local.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
PROJECT_ROOT="$ROOT"

# Start API in background
cd "$API_DIR"
if [[ ! -d "$PROJECT_ROOT/.venv" ]]; then
  echo "Virtualenv not found in $PROJECT_ROOT/.venv. Run 'python -m venv .venv' and install requirements."
  exit 1
fi

# Use the venv python directly to avoid requiring activation in this shell
VENV_PY="$PROJECT_ROOT/.venv/bin/python"
VENV_UVICORN="$PROJECT_ROOT/.venv/bin/uvicorn"

if [[ ! -x "$VENV_UVICORN" ]]; then
  echo "uvicorn not found in venv. Install requirements: pip install -r requirements.txt" >&2
  exit 1
fi

# Run uvicorn in background, logs to a temp file
API_LOG="$API_DIR/__api.log"
echo "Starting API (http://0.0.0.0:8000) -> logs: $API_LOG"
nohup "$VENV_UVICORN" main:app --host 0.0.0.0 --port 8000 >"$API_LOG" 2>&1 &
API_PID=$!

# Start web dev server
cd "$WEB_DIR"

# Prefer binding to all interfaces so your phone can connect via your Mac's LAN IP
PORT=5174
while [[ $PORT -le 5180 ]]; do
  if lsof -i :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    PORT=$((PORT+1))
    continue
  fi
  break
done

echo "Starting web dev server (http://0.0.0.0:$PORT/)"
npm run dev -- --host 192.168.68.107 --port $PORT &
WEB_PID=$!

# Try to open local browser
open "http://localhost:$PORT/"

# Print a helpful tip for connecting from another device
LAN_IP="192.168.68.107"
echo "To access from a phone on the same Wi-Fi, open: http://$LAN_IP:$PORT/"
echo "Running. To stop, run: kill $API_PID $WEB_PID"
