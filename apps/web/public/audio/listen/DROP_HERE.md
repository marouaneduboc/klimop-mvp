# Listening audio placeholders

Drop MP3 files here: `apps/web/public/audio/listen/*.mp3`

## Naming (match vocab / phrase ids)

| Filename | Example phrase |
|---|---|
| `t01_0000.mp3` | "wie" (vocab id) |
| `phrase_hallo.mp3` | Hallo! Hoe gaat het? |
| `phrase_markt.mp3` | Ik ga naar de markt. |
| `phrase_fiets.mp3` | Waar is mijn fiets? |
| `phrase_koffie.mp3` | Mag ik een koffie, alstublieft? |
| `phrase_tram.mp3` | Ik neem de tram. |
| `story_s01_markt.mp3` | Optional full story read-aloud |

## Specs
- Format: **MP3**, mono or stereo, 64–128 kbps is fine
- Language: Dutch (nl-NL)
- Length: short phrases 1–4 s; stories ≤ 45 s

Until files exist, Listening mode uses **Web Speech Synthesis** (browser TTS) as fallback.

## Status
Seeded 2026-09-29 with macOS `say -v Xander` (nl_NL) → ffmpeg MP3s — see `../../assets/ATTRIBUTION.md`. Replace clips to customize.
