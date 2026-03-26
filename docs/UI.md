# UI layout and expansion logic

This document describes how the top bar and navigation are structured so the app can grow in a consistent way.

## Top bar structure (top to bottom)

1. **Row 1 – Main nav**  
   Home, Daily, Progress, TTS. Primary app sections; always at the top.

2. **Row 2 – Books**  
   One pill per vocabulary book (e.g. Klim Op, Wind mee).  
   - **Placeholders:** `content/books.json` has a `placeholders` number (e.g. `2`). That many “Book 3”, “Book 4”, … pills are shown as non-clickable, muted “Coming soon” slots.  
   - **When book names are known:** Add the real book entries to `books` in `books.json`; remove or reduce `placeholders`. The new titles replace the generic “Book N” placeholders in the same row. No layout change.

3. **Row 3 – Tools / modules**  
   De of Het, Grammar, and future modules (e.g. listening, writing, conversation).  
   - **Adding modules:** New sectors go here, next to De of Het and Grammar. Add a route and a pill in `topBarRowTools`; the row wraps as needed. This is the expansion area for extra practice sectors to support fluency.
   - **Grammar is now book/chapter-linked:** Grammar practice is split by selected book and chapter/theme to keep progression homogeneous with vocabulary themes.

4. **Row 4 – User and stats**  
   Profile (name + chevron for switch/edit user) on the left; Streak and Today on the right.

## Data and config

- **Books (and placeholders):** `public/content/books.json` → `books[]` and `placeholders`.  
- **Routes:** `home` | `study` | `progress` | `tts` | `deofhet` | `grammar`. New modules = new route + pill in row 3.
- **Grammar tracks:** In Grammar, learners can switch between:
  - `Conjugation drills` (verb forms), and
  - `Grammar nuance drills` (theme-linked topics such as inversion, om...te, niet/geen, de/het/een, etc.).

## Summary

- **Books row:** Real books from `books.json`; remaining slots filled by “Book N” placeholders until those books exist.  
- **Tools row:** De of Het, Grammar, and future fluency modules live here and expand horizontally/wrap as needed.
