# Local run (Mac + phone on LAN)

## Quick start
```bash
./run-local.sh
```

| Where | URL |
|---|---|
| This Mac | http://localhost:5175/ |
| Phone (same Wi‑Fi) | http://**LAN-IP**:5175/ |
| API docs | http://**LAN-IP**:8000/docs |

The script prints your LAN IP (from `en0` / `en1`). Example: `http://192.168.1.42:5175/`.

Vite and the API bind **`0.0.0.0`** so other devices on the network can connect. macOS may ask to allow incoming connections — choose **Allow**.

## Phone checklist
1. Mac and phone on the **same Wi‑Fi** (not guest/VPN-isolated).
2. Run `./run-local.sh` on the Mac; note the printed `Phone:` URL.
3. Open that URL in Safari/Chrome on the phone.
4. Optional PWA: Share → Add to Home Screen (manifest + service worker cache shell/content).
5. **Sync:** on Mac open **Sync** → *Create pairing code*. On phone open **Sync** → enter code → Join. Then Push/Pull as needed.

Speech recognition (Speaking) works best in **Chrome** or **Edge**. Safari may need mic permission and can be limited.

## If API was skipped / broken venv
```bash
.venv/bin/python -m pip install -r apps/api/requirements.txt
# or recreate:
# rm -rf .venv && python3 -m venv .venv && .venv/bin/python -m pip install -r apps/api/requirements.txt
```

Start API alone (LAN-reachable):
```bash
cd apps/api
../../.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## Firewall tip
If the phone cannot load the page, check System Settings → Network → Firewall, or run:
```bash
# confirm listeners
lsof -iTCP:5175 -sTCP:LISTEN
lsof -iTCP:8000 -sTCP:LISTEN
```

## Stop
```bash
kill <api-pid> <web-pid>   # PIDs printed by ./run-local.sh
# or:
pkill -f 'uvicorn main:app'
pkill -f 'vite --host'
```

## Drop-in assets (no AI generation)
- Graphics: `apps/web/public/assets/DROP_HERE.md`
- Listening MP3s: `apps/web/public/audio/listen/DROP_HERE.md`

## Sync data location
SQLite + JSON mirrors live under `apps/api/data/` (gitignored).
