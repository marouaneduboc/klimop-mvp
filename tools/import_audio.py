import argparse, os, re, json, shutil
from pathlib import Path

PAT = re.compile(r'^KLIMOP-(\d{3})_(.+)\.mp3$', re.IGNORECASE)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="Path to 'Klim op audio 2019' folder")
    args = ap.parse_args()

    src = Path(args.src)
    out_audio = Path("apps/web/public/audio")
    out_audio.mkdir(parents=True, exist_ok=True)

    files = []
    groups = {}

    for theme_dir in sorted(src.glob("Thema *")):
        if not theme_dir.is_dir(): 
            continue
        dest = out_audio / theme_dir.name
        dest.mkdir(parents=True, exist_ok=True)
        for f in sorted(theme_dir.glob("*.mp3")):
            shutil.copy2(f, dest / f.name)
            url = f"/audio/{theme_dir.name}/{f.name}"
            files.append(url)
            m = PAT.match(f.name)
            if m:
                theme = int(m.group(1))
                code = m.group(2)
                first = code.split("_")[0]
                groups.setdefault(theme, {}).setdefault(first, []).append(url)

    out_content = Path("apps/web/public/content")
    out_content.mkdir(parents=True, exist_ok=True)
    (out_content / "audio_manifest.json").write_text(json.dumps({"groups": groups, "all": files}, indent=2), encoding="utf-8")
    print("OK: audio copied + audio_manifest.json written.")

if __name__ == "__main__":
    main()
