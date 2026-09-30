# Share the app with students (GitHub Pages)

## What this does
- Publishes the web UI (`apps/web`) to GitHub Pages via GitHub Actions.
- Ensures the app loads its data from `content/*` using relative paths (`vite` `base: './'`), so it works on GitHub Pages subpaths.
- Leaves **voice/TTS** as-is for now. Students may see errors on the `TTS` tab; everything else should work.

## Student access
- URL: https://marouaneduboc.github.io/klimop-mvp/

## Maintainer: keep Pages in sync
- Workflow: `.github/workflows/deploy-github-pages.yml`
- Deploys on every push to:
  - `share/github-pages` (canonical Pages branch)
  - `retention-local-app` (active app tip — auto-publishes)
  - `lichte-klimop` (design/integration branch)
- Prefer pushing app work to `retention-local-app` (Pages updates automatically). Periodically merge that tip into `share/github-pages` and `lichte-klimop` so those branches stay aligned.
