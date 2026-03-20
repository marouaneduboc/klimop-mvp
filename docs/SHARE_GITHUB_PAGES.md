# Share the app with students (GitHub Pages)

## What this branch does
- Publishes the web UI (`apps/web`) to GitHub Pages via GitHub Actions.
- Ensures the app loads its data from `content/*` using relative paths, so it works on GitHub Pages subpaths.
- Leaves **voice/TTS** as-is for now. Students may see errors on the `TTS` tab; everything else should work.

Last updated: redeploy triggered for Pages validation.

## Student access
- After GitHub Pages finishes deploying, students will get the Pages URL from the workflow logs / GitHub Pages settings.

## Maintainer access (you)
- This is implemented in branch: `share/github-pages`
- Workflow file: `.github/workflows/deploy-github-pages.yml`
- Deployments run on pushes to `share/github-pages`.

