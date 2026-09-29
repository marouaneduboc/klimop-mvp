#!/usr/bin/env bash
set -euo pipefail

# Starts API + Vite bound to 0.0.0.0 so phones on the same LAN can connect.
# Default: HTTPS (mkcert preferred) so Speech Recognition works on the phone.
# Escape hatch: KLIMOP_HTTP=1 ./run-local.sh  → plain HTTP (localhost mic still OK).
# Usage: ./run-local.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"
CERT_DIR="$WEB_DIR/certs"
CERT_FILE="$CERT_DIR/local-cert.pem"
KEY_FILE="$CERT_DIR/local-key.pem"
CA_PUBLIC="$WEB_DIR/public/mkcert-rootCA.pem"
PROJECT_ROOT="$ROOT"
HOST="0.0.0.0"
API_PID=""
WEB_PID=""
USE_HTTPS=1
[[ "${KLIMOP_HTTP:-}" == "1" ]] && USE_HTTPS=0

VENV_PY="$PROJECT_ROOT/.venv/bin/python"
API_LOG="$API_DIR/__api.log"
WEB_LOG="$WEB_DIR/__web.log"
MKCERT_BIN=""

lan_ip() {
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

find_mkcert() {
  if [[ -x "$ROOT/tools/mkcert" ]]; then
    echo "$ROOT/tools/mkcert"
    return 0
  fi
  if command -v mkcert >/dev/null 2>&1; then
    command -v mkcert
    return 0
  fi
  return 1
}

ensure_mkcert_bin() {
  if MKCERT_BIN="$(find_mkcert)"; then
    return 0
  fi
  mkdir -p "$ROOT/tools"
  local archurl=""
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) archurl="mkcert-v1.4.4-darwin-arm64" ;;
    Darwin-x86_64) archurl="mkcert-v1.4.4-darwin-amd64" ;;
    Linux-x86_64|Linux-amd64) archurl="mkcert-v1.4.4-linux-amd64" ;;
    Linux-aarch64|Linux-arm64) archurl="mkcert-v1.4.4-linux-arm64" ;;
    *) return 1 ;;
  esac
  echo "Downloading mkcert ($archurl) → tools/mkcert …"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$ROOT/tools/mkcert" \
      "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/${archurl}"
  else
    return 1
  fi
  chmod +x "$ROOT/tools/mkcert"
  MKCERT_BIN="$ROOT/tools/mkcert"
  return 0
}

ensure_certs() {
  mkdir -p "$CERT_DIR"
  local lan
  lan="$(lan_ip)"
  local names=(localhost 127.0.0.1 ::1)
  # Include every non-loopback IPv4 so multi-homed Macs (en0/en1/bridges) work.
  local all_ips=""
  if command -v ifconfig >/dev/null 2>&1; then
    all_ips="$(ifconfig 2>/dev/null | awk "/inet / && \$2 != \"127.0.0.1\" { print \$2 }" | sort -u)"
  fi
  local ip
  for ip in $all_ips $lan; do
    [[ -z "$ip" || "$ip" == "127.0.0.1" ]] && continue
    local seen=0
    local n
    for n in "${names[@]}"; do
      [[ "$n" == "$ip" ]] && seen=1 && break
    done
    [[ "$seen" -eq 0 ]] && names+=("$ip")
  done

  if ! ensure_mkcert_bin; then
    echo "WARN: mkcert not available — Vite will use @vitejs/plugin-basic-ssl (browser warning)." >&2
    echo "      Install: brew install mkcert && mkcert -install   (or see LOCAL_RUN.md)" >&2
    rm -f "$CERT_FILE" "$KEY_FILE"
    return 1
  fi

  # Regenerate when missing, or when LAN IP is not already in the cert.
  local need=1
  if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    if command -v openssl >/dev/null 2>&1; then
      if openssl x509 -in "$CERT_FILE" -noout -text 2>/dev/null | grep -q "IP Address:${lan}\|DNS:${lan}\|${lan}"; then
        need=0
      fi
    else
      need=0
    fi
  fi

  if [[ "$need" -eq 1 ]]; then
    echo "Generating mkcert TLS cert for: ${names[*]}"
    # -install may fail without sudo/GUI; certs still work after manual trust (see LOCAL_RUN.md).
    "$MKCERT_BIN" -install >/dev/null 2>&1 || true
    "$MKCERT_BIN" -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "${names[@]}"
  fi

  local caroot
  caroot="$("$MKCERT_BIN" -CAROOT 2>/dev/null || true)"
  if [[ -n "$caroot" && -f "$caroot/rootCA.pem" ]]; then
    cp -f "$caroot/rootCA.pem" "$CA_PUBLIC"
    echo "mkcert CA copy for phone install: ${CA_PUBLIC#$ROOT/}"
  fi
  return 0
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

  local api_scheme="http"
  local ssl_args=()
  if [[ "$USE_HTTPS" -eq 1 && -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    api_scheme="https"
    ssl_args=(--ssl-certfile "$CERT_FILE" --ssl-keyfile "$KEY_FILE")
  fi

  echo "Starting API (${api_scheme}://0.0.0.0:8000) -> logs: $API_LOG"
  API_PID="$(detach_run "$API_DIR" "$API_LOG" "$API_DIR/__api.pid" \
    "$VENV_PY" -m uvicorn main:app --host 0.0.0.0 --port 8000 "${ssl_args[@]}")"
  sleep 0.5
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "WARN: API exited immediately. See $API_LOG" >&2
    API_PID=""
    return 1
  fi
  sleep 0.3
  return 0
}

# --- Certs (before API so SSL can share them) ---
SCHEME="http"
if [[ "$USE_HTTPS" -eq 1 ]]; then
  if ensure_certs; then
    SCHEME="https"
  else
    # basicSsl plugin path — still HTTPS for Vite; API stays HTTP (Sync may warn).
    SCHEME="https"
    echo "WARN: API will stay on HTTP (no mkcert files). Prefer mkcert for Sync + mic." >&2
  fi
else
  echo "KLIMOP_HTTP=1 — plain HTTP mode (Speech OK on localhost only)."
fi

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
      echo "Open on this Mac:  ${SCHEME}://localhost:$PORT/"
      echo "Open on phone LAN: ${SCHEME}://$LAN:$PORT/"
      if [[ -n "${API_PID}" ]]; then
        echo "API: ${SCHEME}://$LAN:8000/docs  (PID $API_PID)"
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

echo "Starting web (${SCHEME}://0.0.0.0:$PORT/) -> logs: $WEB_LOG"
if [[ "$USE_HTTPS" -eq 1 ]]; then
  WEB_PID="$(detach_run "$WEB_DIR" "$WEB_LOG" "$WEB_DIR/__web.pid" \
    npm run dev -- --host "$HOST" --port "$PORT")"
else
  WEB_PID="$(detach_run "$WEB_DIR" "$WEB_LOG" "$WEB_DIR/__web.pid" \
    env KLIMOP_HTTP=1 npm run dev -- --host "$HOST" --port "$PORT")"
fi

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
open "${SCHEME}://localhost:$PORT/" 2>/dev/null || true

echo ""
echo "============================================"
echo " Lichte Klimop — local + phone LAN (TLS)"
echo "============================================"
echo " Mac:   ${SCHEME}://localhost:$PORT/"
if [[ "$SCHEME" == "https" ]]; then
  echo "        (http://localhost also OK via KLIMOP_HTTP=1 if you prefer)"
fi
echo " Phone: ${SCHEME}://$LAN:$PORT/   ← same Wi‑Fi + trust cert (LOCAL_RUN.md)"
echo " API:   ${SCHEME}://$LAN:8000/docs"
if [[ -f "$CA_PUBLIC" ]]; then
  echo " CA:    ${SCHEME}://$LAN:$PORT/mkcert-rootCA.pem  (install on phone once)"
fi
echo " Pair:  open Sync tool on Mac → Create code → Join on phone"
echo "============================================"
if [[ -n "${API_PID}" ]]; then
  echo "PIDs — API: $API_PID  WEB: $WEB_PID"
  echo "Stop: kill $API_PID $WEB_PID"
else
  echo "WEB PID: $WEB_PID (API skipped — see warnings)"
  echo "Stop web: kill $WEB_PID"
fi
