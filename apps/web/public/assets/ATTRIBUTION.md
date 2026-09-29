# Public asset attribution — Lichte Klimop

Free / open-licensed binaries only. No proprietary Duolingo/Babbel art. No AI-generated characters.

## Microsoft Fluent Emoji (MIT License)
- Upstream: https://github.com/microsoft/fluentui-emoji
- License: MIT (see `vendor/` copies and upstream `LICENSE`)
- Downloaded 2026-09-29 from `main` via raw.githubusercontent.com

| File | Upstream asset | Notes |
|---|---|---|
| `lion-mascot.png` / `lion-mascot-sm.png` | `assets/Lion/3D/lion_3d.png` | Resized with ImageMagick |
| `listen-icon.png` | `assets/Headphone/3D/headphone_3d.png` | On cream circle |
| `speak-icon.png` | `assets/Microphone/3D/microphone_3d.png` | On cream circle |
| `story-icon.png` | `assets/Books/3D/books_3d.png` | On cream circle |
| `sync-icon.png` | `assets/Counterclockwise arrows button/3D/…_3d.png` | On cream circle |
| `home-hero.png` | Lion 3D + Tulip 3D composite | Soft sky/bank banner |
| `og-cover.png` | Lion 3D + typography | 1200×630 share card |
| `favicon.png` / `icon-512.png` (+ `../icon-192.png`, `../icon-512.png`) | Lion 3D on cream/orange plate | PWA icons |
| `vendor/*_flat.svg`, `vendor/lion_3d.png` | Matching Flat/3D upstream files | Source copies |

Vendored Flat SVGs: `vendor/lion_flat.svg`, `headphone_flat.svg`, `microphone_flat.svg`, `books_flat.svg`, `counterclockwise_arrows_button_flat.svg`, `tulip_flat.svg`.

## Listening audio (`../audio/listen/*.mp3`)
- Generated locally on macOS with system TTS: `say -v Xander` (nl_NL) → AIFF → `ffmpeg` MP3 (mono, 22.05 kHz, 96 kbps).
- Voice: Apple “Xander” (Dutch Netherlands). Not a third-party recorded corpus.
- Seeded clips: `phrase_*.mp3`, matching vocab ids (`t01_0000`, `t03_0030`, …), optional `story_s01_markt.mp3`.
- Browser Web Speech Synthesis remains the fallback when an MP3 is missing.

## Also used in-app (SVG React illustrations)
See `apps/web/src/assets/ATTRIBUTION.md` for Lucide / Phosphor / project CC0 geometric motifs and the inlined Fluent Flat lion paths.
