# Local run notes

## Quick start
```bash
./run-local.sh
```
- Frontend: http://localhost:5175/
- API (if venv OK): http://127.0.0.1:8000/docs

The script starts Vite even when the API venv is missing or broken (prints a warning and continues).

## If API was skipped / broken venv
The project may have been moved (e.g. out of `.../Nederlands/klimop-mvp`), which can leave stale console-script shebangs in `.venv/bin/*`. Prefer:

```bash
.venv/bin/python -m pip install -r apps/api/requirements.txt
# or recreate:
# rm -rf .venv && python3 -m venv .venv && .venv/bin/python -m pip install -r apps/api/requirements.txt
```

Start API alone:
```bash
cd apps/api
../../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

## Stop
```bash
kill <api-pid> <web-pid>   # PIDs printed by ./run-local.sh
# or:
pkill -f 'uvicorn main:app'
pkill -f 'vite --host localhost --port 5175'
```
