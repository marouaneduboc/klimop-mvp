# Drop user graphics here

Place files in this folder (`apps/web/public/assets/`). Do **not** ask the AI to generate binaries — drop your own.

## Exact filenames (PNG preferred, SVG OK for icons)

| Filename | Size (approx) | Use |
|---|---|---|
| `lion-mascot.png` | 512×512, transparent | Cute Fluent-style Dutch lion (home + celebrate) |
| `lion-mascot-sm.png` | 128×128 | Top bar / favicon alternate |
| `home-hero.png` | 960×420 | Optional home hero banner |
| `listen-icon.png` | 128×128 | Listening tool icon |
| `speak-icon.png` | 128×128 | Speaking tool icon |
| `story-icon.png` | 128×128 | Stories tool icon |
| `sync-icon.png` | 128×128 | Account sync icon |
| `og-cover.png` | 1200×630 | Optional share / PWA splash feel |
| `favicon.png` | 192×192 | PWA icon (also copy as `../icon-192.png`) |
| `icon-512.png` | 512×512 | PWA large icon → also `../icon-512.png` |

## Formats
- **PNG** with transparency for mascots/icons
- **SVG** for simple line icons if you prefer
- Keep file size under ~400 KB each for phone LAN

## After dropping
Restart `./run-local.sh` if the browser cached missing assets. The app falls back to current SVG/CSS art until these files exist.
