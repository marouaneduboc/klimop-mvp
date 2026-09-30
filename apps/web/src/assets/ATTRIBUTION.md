# Visual asset attribution — Lichte Klimop

Free / open-licensed icons only. No paid assets. No homemade Klimmie ivy. No AI-generated characters.

## Microsoft Fluent Emoji — Lion + Dutch motifs (MIT License)
- Source: https://github.com/microsoft/fluentui-emoji
- Flat lion paths inlined in `illustrations.tsx` (`LionFace`); vendored SVG: `icons/lion.svg`
- License file: `icons/FLUENT-EMOJI-LICENSE.txt`
- Scene rasters (via `./assets/vendor/*` and cream badges under `public/assets/`):
  - Bicycle 3D — bike motif (Home, Progress, Empty, book covers)
  - Tulip 3D — planted on ground/bank in covers & heroes
  - Houses / House with garden 3D — canal-house stand-in
  - Chart increasing 3D — Progress hero clarity
  - Seedling 3D — Progress banner accent
- Used as the cute Dutch-lion logo/mascot (brand mark, celebrate, onboard).

## IBM Carbon Pictograms — Amsterdam windmill / molen (Apache-2.0)
- Source: https://github.com/carbon-design-system/carbon (`amsterdam--windmill`)
- Vendored: `public/assets/vendor/amsterdam_windmill.svg`, tinted `molen_colored.png`
- Wired into Home / Onboard / blinkuit book cover (Fluent has no windmill emoji).

## Lucide Icons (MIT License)
- Source: https://lucide.dev / https://github.com/lucide-icons/lucide
- Vendored SVGs in `icons/`: `bike.svg`, `flower-2.svg`, `flower.svg`, `book-open.svg`, `sun.svg`, `sparkles.svg`, `chart-column.svg`
- License file: `icons/LUCIDE-LICENSE.txt`
- Kept as reference; Progress/Home heroes no longer stroke-draw Lucide bike paths.

## Phosphor Icons (MIT License)
- Source: https://phosphoricons.com / https://github.com/phosphor-icons/core
- Vendored SVGs in `icons/`: `phosphor-bicycle.svg`, `phosphor-flower.svg`, `phosphor-flower-lotus.svg`
- License file: `icons/PHOSPHOR-LICENSE.txt`
- Kept as reference / alternate marks.

## Intentionally not used
- Homemade Klimmie ivy / custom animal characters.
- Homemade green+yellow Progress vine / geometric molen / canal-house polygons.
- Confetti spam or over-the-top bobbing animations.
- Paid stock, proprietary icon kits, or AI-generated characters.

## Public PNGs / PWA / listen MP3s
Raster assets live under `apps/web/public/assets/` (Fluent Emoji 3D MIT + Carbon molen Apache-2.0, converted with ImageMagick).
Listening clips live under `apps/web/public/audio/listen/` (macOS `say -v Xander` nl_NL → ffmpeg MP3).
Full table: `apps/web/public/assets/ATTRIBUTION.md`.
