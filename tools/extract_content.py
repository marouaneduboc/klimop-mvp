#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import json
from pathlib import Path
from typing import Dict, List, Tuple, Any, Optional

def _get_pdf_reader(path: Path):
    # Prefer pypdf, fallback to PyPDF2.
    try:
        from pypdf import PdfReader as Reader  # type: ignore
        return Reader(str(path))
    except Exception:
        try:
            from PyPDF2 import PdfReader as Reader  # type: ignore
            return Reader(str(path))
        except Exception as e:
            raise RuntimeError(
                "No PDF reader available. Install `pypdf` (preferred) or `PyPDF2`."
            ) from e

ROOT = Path(__file__).resolve().parents[1]

PDF_WORDLIST = ROOT / "assets_raw/pdfs/klim_op_-_woordenlijst_engels_2025.pdf"
PDF_ANTWOORDEN = ROOT / "assets_raw/pdfs/klim_op_antwoorden-2024.pdf"
AUDIO_MANIFEST = ROOT / "apps/web/public/content/audio_manifest.json"

OUT_COURSE = ROOT / "apps/web/public/content/course.json"
OUT_REVIEW = ROOT / "apps/web/public/content/needs_review.json"

THEME_TITLES = {
    1: "Kennismaken",
    2: "Hoe gaat het?",
    3: "Familie",
    4: "Dagelijkse activiteiten",
    5: "De tijd",
    6: "Afspreken",
    7: "Eten en drinken",
    8: "Boodschappen doen",
    9: "Winkelen",
    10: "Gezondheid",
}

RE_THEME = re.compile(r"\bThema\s+(\d+)\b", re.IGNORECASE)
RE_NL_EN_MARKER = re.compile(r"Nederlands\s+Engels", re.IGNORECASE)

def pdf_text(path: Path) -> str:
    out: List[str] = []
    r = _get_pdf_reader(path)
    for p in r.pages:
        out.append(p.extract_text() or "")
    return "\n".join(out)

def clean_line(s: str) -> str:
    s = s.replace("\uFFFD", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def split_by_themes(text: str) -> Dict[int, str]:
    # split the big text into theme sections using "Thema X"
    idxs = [(m.start(), int(m.group(1))) for m in RE_THEME.finditer(text)]
    sections: Dict[int, str] = {}
    for i, (pos, theme) in enumerate(idxs):
        end = idxs[i+1][0] if i+1 < len(idxs) else len(text)
        sections[theme] = text[pos:end]
    return sections

def tokenize_lines(block: str) -> List[str]:
    lines = []
    for raw in block.splitlines():
        t = clean_line(raw)
        if not t:
            continue
        # ignore obvious headers/footers
        if t.lower().startswith("klim op"):
            continue
        if "© Boom" in t:
            continue
        lines.append(t)
    return lines

def parse_wordlist_vocab(wordlist_text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Extract vocab from Woordenlijst Engels:
    Theme block contains:
      <Dutch lines ...> Nederlans Engels <English lines ...>
    We pair them positionally.
    """
    review: List[Dict[str, Any]] = []
    vocab: List[Dict[str, Any]] = []

    by_theme = split_by_themes(wordlist_text)
    for theme, block in sorted(by_theme.items()):
        if theme not in THEME_TITLES:
            continue

        # Make sure marker is separable even if stuck to adjacent word
        block = re.sub(r"([A-Za-zÀ-ÿ])Nederlands\s+Engels", r"\1\nNederlands Engels", block)

        m = RE_NL_EN_MARKER.search(block)
        if not m:
            review.append({"type": "wordlist_missing_marker", "theme": theme})
            continue

        dutch_part = block[:m.start()]
        eng_part = block[m.end():]

        nl_lines = tokenize_lines(dutch_part)
        en_lines = tokenize_lines(eng_part)

        # Remove the "Thema X ..." header line if present in nl_lines
        nl_lines = [l for l in nl_lines if not l.lower().startswith("thema ")]
        # Some pages contain artifacts like lone "het" / "de" lines; keep them (they’re legit vocab)
        # But remove stray "Nederlands" "Engels" if they leaked
        nl_lines = [l for l in nl_lines if l.lower() not in ("nederlands", "engels")]
        en_lines = [l for l in en_lines if l.lower() not in ("nederlands", "engels")]

        pair_n = min(len(nl_lines), len(en_lines))
        if abs(len(nl_lines) - len(en_lines)) >= 3:
            review.append({
                "type": "wordlist_pair_count_mismatch",
                "theme": theme,
                "nl_count": len(nl_lines),
                "en_count": len(en_lines),
                "paired": pair_n
            })

        for i in range(pair_n):
            nl = nl_lines[i]
            en = en_lines[i]

            article = None
            nl_word = nl

            # detect article prefix "de ..." / "het ..."
            m2 = re.match(r"^(de|het)\s+(.+)$", nl, re.IGNORECASE)
            if m2:
                article = m2.group(1).lower()
                nl_word = m2.group(2).strip()

            vid = f"t{theme:02d}_{i:04d}"
            vocab.append({
                "id": vid,
                "theme": theme,
                "nl": nl_word,
                "article": article,
                "en": en,
                "tags": []
            })

    return vocab, review

def parse_wordlist_vocab_layout(path: Path) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Robust layout parsing for the Woordenlijst PDF using x/y coordinates.
    We pair Dutch (left column) and English (right column) lines by nearest y.
    """
    review: List[Dict[str, Any]] = []
    r = _get_pdf_reader(path)

    theme_titles = set(THEME_TITLES.values())
    ignore_left = {
        "K",
        "Klim op",
        "Woordenlijst Engels",
        "Sandra Duenk",
        "In eenvoudige stappen",
        "van NT2-niveau 0 naar A1",
    }

    rows: List[Dict[str, Any]] = []
    current_theme: Optional[int] = None
    previous_pair: Optional[Dict[str, Any]] = None

    for pnum, page in enumerate(r.pages, start=1):
        left: List[Tuple[float, str]] = []
        right: List[Tuple[float, str]] = []

        def visitor(text, cm, tm, font_dict, font_size):
            t = clean_line(text or "")
            if not t:
                return
            x = float(tm[4])
            y = float(tm[5])
            if y < 60:
                return  # footer/page number band
            if "Woordenlijst Engels" in t:
                return
            if pnum == 1:
                return  # cover
            if x < 200:
                left.append((y, t))
            else:
                right.append((y, t))

        page.extract_text(visitor_text=visitor)
        left.sort(key=lambda z: -z[0])
        right.sort(key=lambda z: -z[0])
        used = [False] * len(right)

        for y, nl in left:
            # Theme marker rows can be "Thema 4 Dagelijkse activiteiten"
            m = re.search(r"\bThema\s*(\d+)\b", nl, re.IGNORECASE)
            if m:
                t = int(m.group(1))
                current_theme = t if t in THEME_TITLES else None
                continue

            if nl in ignore_left or nl in theme_titles:
                continue

            best: Optional[Tuple[float, int, float, str]] = None
            for i, (yr, en) in enumerate(right):
                if used[i]:
                    continue
                d = abs(yr - y)
                if best is None or d < best[0]:
                    best = (d, i, yr, en)

            if best is None or best[0] > 1.5:
                review.append({
                    "type": "wordlist_unpaired_left",
                    "page": pnum,
                    "theme": current_theme,
                    "nl": nl
                })
                continue

            _, i, yr, en = best
            used[i] = True

            if current_theme is None:
                review.append({
                    "type": "wordlist_no_theme_for_pair",
                    "page": pnum,
                    "nl": nl,
                    "en": en
                })
                continue

            row = {"theme": current_theme, "nl_raw": nl, "en": en, "page": pnum, "y": y, "yr": yr}
            rows.append(row)
            previous_pair = row

        for i, (yr, en) in enumerate(right):
            if used[i]:
                continue
            if en == "Engels":
                continue
            # Known PDF wrap artifact: "the toasted ham and cheese" + next-line "sandwich"
            if previous_pair and previous_pair["theme"] == 7 and en == "sandwich":
                previous_pair["en"] = f"{previous_pair['en']} sandwich"
                continue
            review.append({
                "type": "wordlist_unpaired_right",
                "page": pnum,
                "theme": current_theme,
                "en": en
            })

    by_theme: Dict[int, List[Dict[str, Any]]] = {t: [] for t in THEME_TITLES}
    for row in rows:
        by_theme[row["theme"]].append(row)

    vocab: List[Dict[str, Any]] = []
    for theme in sorted(by_theme.keys()):
        for i, row in enumerate(by_theme[theme]):
            nl = row["nl_raw"]
            article = None
            nl_word = nl
            m2 = re.match(r"^(de|het)\s+(.+)$", nl, re.IGNORECASE)
            if m2:
                article = m2.group(1).lower()
                nl_word = m2.group(2).strip()
            vid = f"t{theme:02d}_{i:04d}"
            vocab.append({
                "id": vid,
                "theme": theme,
                "nl": nl_word,
                "article": article,
                "en": row["en"],
                "tags": []
            })

    return vocab, review

def parse_antwoorden_exercises(antw_text: str) -> Tuple[Dict[int, List[Dict[str, Any]]], List[Dict[str, Any]]]:
    """
    Parse Antwoorden into theme->exercises.
    We look for lines like:
      Antwoorden Thema 1  Kennismaken
      2 Luisteren en lezen
      1 Bas komt uit Nederland. waar niet waar
      ...
    We'll create:
      {theme: [{num, title, lines, items}]}
    items: if numbered lines exist, capture (n, text)
    """
    review: List[Dict[str, Any]] = []
    exercises_by_theme: Dict[int, List[Dict[str, Any]]] = {t: [] for t in THEME_TITLES.keys()}

    # normalize
    lines = [clean_line(l) for l in antw_text.splitlines()]
    lines = [l for l in lines if l and not l.lower().startswith("klim op") and "© Boom" not in l]

    current_theme: Optional[int] = None
    current_ex: Optional[Dict[str, Any]] = None

    def flush():
        nonlocal current_ex
        if current_theme and current_ex:
            exercises_by_theme[current_theme].append(current_ex)
        current_ex = None

    # Theme markers appear as "Antwoorden Thema X"
    re_theme_hdr = re.compile(r"\bAntwoorden\s+Thema\s+(\d+)\b", re.IGNORECASE)
    re_ex_hdr = re.compile(r"^(\d+)\s+(.+)$")   # exercise header candidate
    re_item = re.compile(r"^(\d+)\s+(.+)$")     # numbered item inside exercise

    for l in lines:
        mt = re_theme_hdr.search(l)
        if mt:
            flush()
            t = int(mt.group(1))
            current_theme = t if t in THEME_TITLES else None
            continue

        # If we don't know theme yet, skip
        if not current_theme:
            continue

        mh = re_ex_hdr.match(l)
        if mh:
            # Heuristic: new exercise starts when title contains letters and looks like section title
            num = int(mh.group(1))
            title = mh.group(2).strip()
            # Exercise titles typically contain words like "Luisteren", "Lezen", "Woorden", "Grammatica", "Dictee"
            if re.search(r"(Luisteren|Lezen|Woorden|Grammatica|Dictee)", title, re.IGNORECASE):
                flush()
                current_ex = {
                    "num": num,
                    "title": title,
                    "lines": [],
                    "items": []
                }
                continue

        if current_ex:
            current_ex["lines"].append(l)
            mi = re_item.match(l)
            # Only treat as item if it starts with a number and then non-empty text
            if mi:
                n = int(mi.group(1))
                txt = mi.group(2).strip()
                # avoid catching "11 Grammaticanaam land ..." as item
                if n <= 100 and txt:
                    current_ex["items"].append({"n": n, "text": txt})

    flush()

    # Remove empty theme lists
    for t in list(exercises_by_theme.keys()):
        exercises_by_theme[t] = [e for e in exercises_by_theme[t] if e.get("title")]

    # If a theme has zero exercises, flag it
    for t in THEME_TITLES:
        if not exercises_by_theme[t]:
            review.append({"type": "antwoorden_no_exercises_found", "theme": t})

    return exercises_by_theme, review

def load_audio_groups() -> Dict[int, Dict[str, List[str]]]:
    if not AUDIO_MANIFEST.exists():
        return {}
    data = json.loads(AUDIO_MANIFEST.read_text(encoding="utf-8"))
    # stored as ints in our importer; but be defensive
    groups_raw = data.get("groups", {})
    groups: Dict[int, Dict[str, List[str]]] = {}
    for k, v in groups_raw.items():
        try:
            theme = int(k)
        except:
            continue
        groups[theme] = v
    return groups

def wire_audio(exercises_by_theme: Dict[int, List[Dict[str, Any]]], audio_groups: Dict[int, Dict[str, List[str]]]) -> List[Dict[str, Any]]:
    review: List[Dict[str, Any]] = []
    for theme, exs in exercises_by_theme.items():
        g = audio_groups.get(theme, {})
        for ex in exs:
            title = ex["title"]
            num = str(ex["num"])
            wants_audio = bool(re.search(r"(Luisteren|Dictee)", title, re.IGNORECASE))
            if not wants_audio:
                ex["audio"] = []
                continue

            # Primary mapping: exercise number -> first-code group
            audio = g.get(num, [])

            # Fallback seen in some content: if 2 luister... has no audio, try 1
            if not audio and num == "2":
                audio = g.get("1", [])

            ex["audio"] = audio
            if wants_audio and not audio:
                review.append({"type":"missing_audio_for_exercise", "theme": theme, "exercise": ex["num"], "title": title})
    return review

def main():
    review: List[Dict[str, Any]] = []

    # 1) Parse Woordenlijst
    vocab, rev1 = parse_wordlist_vocab_layout(PDF_WORDLIST)
    review.extend(rev1)

    # 2) Parse Antwoorden exercises
    antw_text = pdf_text(PDF_ANTWOORDEN)
    oefeningen, rev2 = parse_antwoorden_exercises(antw_text)
    review.extend(rev2)

    # 3) Wire audio
    audio_groups = load_audio_groups()
    rev3 = wire_audio(oefeningen, audio_groups)
    review.extend(rev3)

    course = {
        "version": "mvp-0.2",
        "themes": [{"id": t, "title": THEME_TITLES[t]} for t in sorted(THEME_TITLES.keys())],
        "vocab": vocab,
        "oefeningen": oefeningen,
        "audio": {"groups": audio_groups}
    }

    OUT_COURSE.parent.mkdir(parents=True, exist_ok=True)
    OUT_COURSE.write_text(json.dumps(course, indent=2, ensure_ascii=False), encoding="utf-8")
    OUT_REVIEW.write_text(json.dumps({"review": review}, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"OK: wrote {OUT_COURSE}")
    print(f"  vocab: {len(vocab)}")
    total_ex = sum(len(v) for v in oefeningen.values())
    print(f"  oefeningen: {total_ex}")
    print(f"OK: wrote {OUT_REVIEW} (review items: {len(review)})")

if __name__ == "__main__":
    main()
