#!/usr/bin/env python3
"""
Scans videos/<project>/<tab>/ folders and builds videos/links.json.

Each folder may contain:
  - .mp4/.mov/.webm files       (local video, will get auto poster + size warning)
  - _links.txt                  (one YouTube/Vimeo URL per line — '#' for comments)

Filenames sort alphabetically (use 01-, 02- prefixes to control order).
Local files appear before URLs in the resulting manifest.

Requires ffmpeg for poster extraction (skipped if not installed):
    brew install ffmpeg

Run after adding/removing media:
    python3 generate-videos.py
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
VIDEOS_DIR = ROOT / "videos"
MANIFEST   = VIDEOS_DIR / "links.json"
SIZE_WARN_MB = 80
VIDEO_EXTS   = {".mp4", ".mov", ".webm", ".m4v"}

# Resolve an ffmpeg binary: prefer system, fall back to the imageio-ffmpeg pip wheel.
def _resolve_ffmpeg() -> str | None:
    path = shutil.which("ffmpeg")
    if path:
        return path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None

FFMPEG = _resolve_ffmpeg()
HAVE_FFMPEG = FFMPEG is not None

# Which subfolders correspond to which projects/tab slugs.
# Edit here only if you rename categories.
PROJECTS = {
    "redsox":    ["music-videos", "highlights", "community", "social-media"],
    "usc":       ["water-polo", "basketball", "womens-soccer", "trojans-radio"],
    "brew":      ["cheap-vs-expensive", "tap-water", "smoothies", "doughnuts"],
    "freelance": None,   # flat list, no sub-tabs
}

def youtube_id(url: str):
    m = re.search(r'(?:youtube\.com/(?:embed/|watch\?v=|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})', url)
    return m.group(1) if m else None

def vimeo_id(url: str):
    m = re.search(r'vimeo\.com/(?:video/|channels/[^/]+/)?(\d+)', url)
    return m.group(1) if m else None

def auto_poster_for_url(url: str):
    yt = youtube_id(url)
    if yt: return f"https://img.youtube.com/vi/{yt}/maxresdefault.jpg"
    return None

def extract_poster(mp4: Path) -> Path | None:
    """Extract a poster frame at 1s into mp4_dir/mp4_stem.jpg. Returns path or None."""
    poster = mp4.with_suffix(".jpg")
    if poster.exists():
        return poster
    if not HAVE_FFMPEG:
        return None
    try:
        subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error",
             "-ss", "1", "-i", str(mp4),
             "-frames:v", "1", "-q:v", "3", str(poster)],
            check=True, timeout=60,
        )
        return poster if poster.exists() else None
    except Exception as e:
        print(f"  ⚠️  ffmpeg failed on {mp4.name}: {e}")
        return None

def detect_dimensions(mp4: Path) -> tuple[int, int] | None:
    """Return (width, height) of the video stream, or None on failure."""
    if not HAVE_FFMPEG:
        return None
    try:
        # Parse `ffmpeg -i` stderr for `Stream ... Video: ... 1920x1080`
        proc = subprocess.run(
            [FFMPEG, "-i", str(mp4)],
            capture_output=True, text=True, timeout=10,
        )
        m = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", proc.stderr)
        if m:
            return int(m.group(1)), int(m.group(2))
    except Exception:
        pass
    return None

def read_links_txt(folder: Path) -> list[str]:
    f = folder / "_links.txt"
    if not f.exists(): return []
    urls = []
    for line in f.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        urls.append(line)
    return urls

def scan_folder(folder: Path, prev_entries: list[dict]) -> tuple[list[dict], list[str]]:
    """
    Return (entries, warnings) for one project-tab folder.
    Existing manual edits (title, poster overrides) are preserved by matching url.
    """
    if not folder.is_dir():
        return [], []

    prev_by_url = {e.get("url"): e for e in prev_entries if isinstance(e, dict)}
    entries: list[dict] = []
    warnings: list[str] = []

    # Local files first (sorted)
    mp4s = sorted(p for p in folder.iterdir()
                  if p.is_file() and p.suffix.lower() in VIDEO_EXTS)
    for mp4 in mp4s:
        rel = mp4.relative_to(ROOT).as_posix()
        size_mb = mp4.stat().st_size / (1024 * 1024)
        if size_mb > SIZE_WARN_MB:
            warnings.append(f"{rel}  ({size_mb:.0f}MB) — too big for Netlify; upload to Vimeo")

        poster_path = extract_poster(mp4)
        poster_rel  = poster_path.relative_to(ROOT).as_posix() if poster_path else None
        dims        = detect_dimensions(mp4)

        prev = prev_by_url.get(rel, {})
        entry = {
            "url":   rel,
            "title": prev.get("title") or mp4.stem.replace("-", " ").replace("_", " ").title(),
        }
        if poster_rel or prev.get("poster"):
            entry["poster"] = prev.get("poster") or poster_rel
        if dims:
            entry["w"], entry["h"] = dims
        elif prev.get("w") and prev.get("h"):
            entry["w"], entry["h"] = prev["w"], prev["h"]
        entries.append(entry)

    # URLs from _links.txt
    for url in read_links_txt(folder):
        prev = prev_by_url.get(url, {})
        entry = {"url": url, "title": prev.get("title") or "Untitled"}
        poster = prev.get("poster") or auto_poster_for_url(url)
        if poster: entry["poster"] = poster
        entries.append(entry)

    return entries, warnings

def main() -> None:
    if not VIDEOS_DIR.exists():
        VIDEOS_DIR.mkdir(parents=True)

    # Load previous manifest to preserve manual edits.
    prev: dict = {}
    if MANIFEST.exists():
        try:
            prev = json.loads(MANIFEST.read_text())
        except json.JSONDecodeError:
            print(f"⚠️  Couldn't parse existing {MANIFEST.name}; starting fresh")

    out: dict = {
        "_README": [
            "Auto-generated by generate-videos.py.",
            "Drop MP4s into videos/<project>/<tab>/, list URLs in _links.txt, then rerun.",
            "Manual edits to title or poster persist across re-runs (matched by url).",
        ]
    }
    all_warnings: list[str] = []

    for project, tabs in PROJECTS.items():
        if tabs is None:
            # Flat freelance folder
            folder = VIDEOS_DIR / project
            prev_list = prev.get(project) if isinstance(prev.get(project), list) else []
            entries, warns = scan_folder(folder, prev_list or [])
            out[project] = entries
            all_warnings += warns
            print(f"  {project:<10s} {len(entries):>3d} videos")
        else:
            out[project] = {}
            total = 0
            for tab in tabs:
                folder = VIDEOS_DIR / project / tab
                prev_tab = (prev.get(project) or {}).get(tab) or []
                entries, warns = scan_folder(folder, prev_tab)
                out[project][tab] = entries
                total += len(entries)
                all_warnings += warns
            print(f"  {project:<10s} {total:>3d} videos across {len(tabs)} tabs")

    MANIFEST.write_text(json.dumps(out, indent=2))

    if not HAVE_FFMPEG:
        print("\n⚠️  ffmpeg not installed — local MP4s won't get auto-poster thumbnails.")
        print("   Install: brew install ffmpeg")

    if all_warnings:
        print(f"\n⚠️  {len(all_warnings)} oversized file(s) — too big for Netlify, host on Vimeo:")
        for w in all_warnings:
            print(f"     {w}")

    print(f"\n✅ Wrote {MANIFEST.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
