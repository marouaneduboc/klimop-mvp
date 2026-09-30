# Public asset attribution — Lichte Klimop

Free / open-licensed binaries only. No proprietary Duolingo/Babbel art. No AI-generated characters.

## Microsoft Fluent Emoji (MIT License)
- Upstream: https://github.com/microsoft/fluentui-emoji
- License: MIT (see `vendor/` copies and upstream `LICENSE`)
- Downloaded 2026-09-29 (seed) and 2026-09-30 (Progress / Dutch motifs) from `main` via raw.githubusercontent.com

| File | Upstream asset | Notes |
|---|---|---|
| `lion-mascot.png` / `lion-mascot-sm.png` | `assets/Lion/3D/lion_3d.png` | Resized with ImageMagick |
| `listen-icon.png` | `assets/Headphone/3D/headphone_3d.png` | On cream circle |
| `speak-icon.png` | `assets/Microphone/3D/microphone_3d.png` | On cream circle |
| `story-icon.png` | `assets/Books/3D/books_3d.png` | On cream circle |
| `sync-icon.png` | `assets/Counterclockwise arrows button/3D/…_3d.png` | On cream circle |
| `progress-icon.png` | `assets/Chart increasing/3D/chart_increasing_3d.png` | On cream circle |
| `bike-icon.png` | `assets/Bicycle/3D/bicycle_3d.png` | On cream circle |
| `houses-icon.png` | `assets/Houses/3D/houses_3d.png` | On cream circle (canal-house stand-in) |
| `tulip-icon.png` | `assets/Tulip/3D/tulip_3d.png` | On cream circle |
| `molen-icon.png` | Icons8 3D Fluency Windmill (see below) | On cream circle |
| `progress-hero.png` | Chart increasing + Bicycle + Tulip + Seedling 3D composite | Soft sky/bank Progress banner |
| `home-hero.png` | Lion 3D + Tulip 3D composite | Soft sky/bank banner |
| `og-cover.png` | Lion 3D + typography | 1200×630 share card |
| `favicon.png` / `icon-512.png` (+ `../icon-192.png`, `../icon-512.png`) | Lion 3D on cream/orange plate | PWA icons |
| `vendor/*_flat.svg`, `vendor/*_3d.png` | Matching Flat/3D upstream files | Source copies |

Vendored Fluent assets include: `lion_flat.svg`, `lion_3d.png`, `headphone_flat.svg`, `microphone_flat.svg`, `books_flat.svg`, `counterclockwise_arrows_button_flat.svg`, `tulip_flat.svg`, `tulip_3d.png`, `bicycle_flat.svg`, `bicycle_3d.png`, `chart_increasing_flat.svg`, `chart_increasing_3d.png`, `bar_chart_flat.svg`, `bar_chart_3d.png`, `seedling_flat.svg`, `seedling_3d.png`, `house_flat.svg`, `house_3d.png`, `houses_flat.svg`, `houses_3d.png`, `house_with_garden_flat.svg`, `house_with_garden_3d.png`, `trophy_3d.png`, `fire_3d.png`.

## Icons8 3D Fluency — Windmill / molen (free with attribution)
- Upstream: https://icons8.com/icons/set/windmill--style-3d-fluency (Icons by [Icons8](https://icons8.com))
- Direct asset: https://img.icons8.com/3d-fluency/512/windmill.png
- License: Icons8 free license — personal/commercial use with attribution link to icons8.com (see https://icons8.com/license)
- Files: `vendor/molen_3d.png` (512×512 PNG), `molen-icon.png` (cream-circle badge), note `vendor/ICONS8-WINDMILL-NOTE.txt`
- Wired into Home / Onboard / blinkuit book cover; planted on the tan ground/bank like Fluent tulips (Fluent Emoji has no windmill Unicode asset).
- Chosen over IBM Carbon Amsterdam pictogram (kept under `vendor/amsterdam_windmill.svg` + `CARBON-PICTOGRAMS-LICENSE.txt` as unused reference) because the flat Carbon mark looked thin next to Fluent 3D lion/tulip/bike.

## Listening audio (`../audio/listen/*.mp3`)
- Generated locally on macOS with system TTS: `say -v Xander` (nl_NL) → AIFF → `ffmpeg` MP3 (mono, 22.05 kHz, 96 kbps).
- Voice: Apple “Xander” (Dutch Netherlands). Not a third-party recorded corpus.
- Seeded clips: `phrase_*.mp3`, matching vocab ids (`t01_0000`, `t03_0030`, …), optional `story_s01_markt.mp3`.
- Browser Web Speech Synthesis remains the fallback when an MP3 is missing.

## Also used in-app (SVG React illustrations)
See `apps/web/src/assets/ATTRIBUTION.md` for Lucide / Phosphor references and inlined Fluent Flat lion paths.
Hero scenes wire Fluent / Icons8 molen rasters via `<image href>` / `<img>` — no homemade bike/house/molen/tulip geometry.
