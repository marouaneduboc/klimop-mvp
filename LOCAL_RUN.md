# Local run (Mac + phone on LAN)

Speech recognition (Speaking) needs a **secure context**: `https://…` or `http://localhost`.
Plain `http://192.168.x.x` blocks the mic on desktop and phone. This setup defaults to **HTTPS**
via **mkcert** (preferred) so the phone can open `https://LAN-IP:5175`.

## Quick start
```bash
./run-local.sh
```

| Where | URL |
|---|---|
| This Mac | **https://localhost:5175/** |
| Phone (same Wi‑Fi) | **https://LAN-IP:5175/** |
| API docs | **https://LAN-IP:8000/docs** |
| mkcert CA (phone install) | **https://LAN-IP:5175/mkcert-rootCA.pem** |

The script prints your LAN IP (from `en0` / `en1`). Example: `https://192.168.1.42:5175/`.

Vite and the API bind **`0.0.0.0`**. macOS may ask to allow incoming connections — choose **Allow**.

### Plain HTTP (optional)
Mic still works on **http://localhost** only (not on the phone LAN IP):
```bash
KLIMOP_HTTP=1 ./run-local.sh
```

## One-time: trust the mkcert CA (Mac)

Preferred path so browsers do not show certificate warnings:

```bash
# Option A — Homebrew (needs Xcode license accepted)
brew install mkcert nss
mkcert -install

# Option B — script downloads tools/mkcert automatically on first ./run-local.sh
# Then trust the CA once:
./tools/mkcert -install
# (macOS Keychain may prompt for your password)
```

`./run-local.sh` regenerates `apps/web/certs/local-*.pem` for `localhost` + your current LAN IP.
After changing Wi‑Fi / IP, re-run the script so the cert SAN includes the new address.

If brew/`mkcert -install` fails (sudo/Keychain), generate certs still work — install trust
manually from `$(./tools/mkcert -CAROOT)/rootCA.pem` (double-click → Keychain → Always Trust).

Fallback without mkcert: Vite uses `@vitejs/plugin-basic-ssl` (browser warning every session;
harder to trust on phones). Prefer mkcert.

## Trust on iPhone / iPad (Safari)

1. On the Mac, run `./run-local.sh` so `apps/web/public/mkcert-rootCA.pem` exists.
2. Get the CA onto the phone (pick one):
   - AirDrop `~/Library/Application Support/mkcert/rootCA.pem`, or
   - On the phone open `https://LAN-IP:5175/mkcert-rootCA.pem` (accept the temporary warning once to download), or
   - Mail/Messages the `rootCA.pem` file to yourself.
3. Open the downloaded profile → **Install** (Settings may show “Profile Downloaded”).
4. **Settings → General → About → Certificate Trust Settings** → enable **Full Trust** for the
   mkcert root (toggle on). Without this step Safari still rejects the site.
5. Open **https://LAN-IP:5175/** — Speaking mic should enable (Chrome/Edge on iOS may still
   lack Web Speech Recognition; Safari + typed fallback always work).

## Trust on Android (Chrome)

1. Download `rootCA.pem` the same way (AirDrop alternative: Drive/email, or the
   `https://LAN-IP:5175/mkcert-rootCA.pem` link after accepting the first warning).
2. **Settings → Security → Encryption & credentials → Install a certificate → CA certificate**
   (wording varies by OEM) → select `rootCA.pem` → confirm the warning.
3. Open **https://LAN-IP:5175/** in Chrome. Allow microphone when prompted.
4. If Chrome still warns, clear site data for the LAN IP or use a Private tab after trust is on.

## Phone checklist
1. Mac and phone on the **same Wi‑Fi** (not guest/VPN-isolated).
2. Trust the mkcert CA (sections above) — once per device.
3. Run `./run-local.sh` on the Mac; open the printed **https://** Phone URL.
4. Optional PWA: Share → Add to Home Screen.
5. **Sync:** on Mac open **Sync** → *Create pairing code*. On phone open **Sync** → enter code → Join.

Speech recognition (Speaking) works best in **Chrome** or **Edge** on Android / desktop.
Safari may need mic permission and can be limited for recognition (typing fallback always works).

## If API was skipped / broken venv
```bash
.venv/bin/python -m pip install -r apps/api/requirements.txt
# or recreate:
# rm -rf .venv && python3 -m venv .venv && .venv/bin/python -m pip install -r apps/api/requirements.txt
```

Start API alone (LAN-reachable, with the same mkcert files when present):
```bash
cd apps/api
../../.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 \
  --ssl-certfile ../web/certs/local-cert.pem \
  --ssl-keyfile ../web/certs/local-key.pem
```

## Firewall tip
If the phone cannot load the page, check System Settings → Network → Firewall, or run:
```bash
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
