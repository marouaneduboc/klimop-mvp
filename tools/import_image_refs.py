#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COURSE = ROOT / "apps/web/public/content/course.json"
DEFAULT_SRC_DIR = ROOT / "assets_raw/generated_images"
DEFAULT_DEST_DIR = ROOT / "apps/web/public/images/cards"
DEFAULT_PUBLIC_PREFIX = "/images/cards"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def find_image_for_id(src_dir: Path, card_id: str) -> Path | None:
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = src_dir / f"{card_id}{ext}"
        if p.exists():
            return p
    return None


def main() -> None:
    ap = argparse.ArgumentParser(description="Import generated images by card id and update course.json image references.")
    ap.add_argument("--course", default=str(DEFAULT_COURSE), help="Path to course.json")
    ap.add_argument("--src-dir", default=str(DEFAULT_SRC_DIR), help="Folder containing generated images named <card_id>.<ext>")
    ap.add_argument("--dest-dir", default=str(DEFAULT_DEST_DIR), help="Destination folder in web public files")
    ap.add_argument("--public-prefix", default=DEFAULT_PUBLIC_PREFIX, help="Public URL prefix stored in course.json")
    ap.add_argument("--copy", action="store_true", help="Copy files from src-dir to dest-dir")
    args = ap.parse_args()

    course_path = Path(args.course).expanduser().resolve()
    src_dir = Path(args.src_dir).expanduser().resolve()
    dest_dir = Path(args.dest_dir).expanduser().resolve()
    public_prefix = args.public_prefix.rstrip("/")

    if not src_dir.exists():
        raise RuntimeError(f"Source image folder does not exist: {src_dir}")

    if args.copy:
        dest_dir.mkdir(parents=True, exist_ok=True)

    course = load_json(course_path)
    vocab = list(course.get("vocab", []))
    if not vocab:
        raise RuntimeError("No vocab entries in course.json")

    matched = 0
    missing = 0

    for card in vocab:
        card_id = str(card.get("id", ""))
        if not card_id:
            continue
        img = find_image_for_id(src_dir, card_id)
        if img is None:
            missing += 1
            continue

        if args.copy:
            target = dest_dir / img.name
            shutil.copy2(img, target)
            rel_name = target.name
        else:
            rel_name = img.name

        card["image"] = f"{public_prefix}/{rel_name}"
        matched += 1

    course["vocab"] = vocab
    save_json(course_path, course)

    print(f"Updated {matched} cards with image references in {course_path}")
    print(f"Missing images for {missing} cards")
    if args.copy:
        print(f"Copied matched files into {dest_dir}")


if __name__ == "__main__":
    main()
