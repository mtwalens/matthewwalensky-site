#!/usr/bin/env python3
"""
Scans images/gallery/<category>/ for photos, generates web-sized derivatives,
and writes images/gallery/manifest.json.

Run after adding/removing photos:

    python3 generate-manifest.py

What it does
------------
Your originals stay untouched. For each photo it creates two smaller copies
under images/gallery/_web/ — a grid thumbnail and a lightbox-sized version —
because the originals run 10-35 MB each and would make the Stills page
unusable on a phone.

    images/gallery/landscape/DSCF1234.jpg      <- your original, never modified
    images/gallery/_web/landscape/thumb/...    <- ~900px, used in the grid
    images/gallery/_web/landscape/full/...     <- ~2400px, used in the lightbox

The manifest records each photo's dimensions so the mosaic can reserve the
right space before the image loads (no layout shift while scrolling).

Re-runs are incremental: a derivative is only rebuilt if the original is
newer, so adding one photo to a 267-photo library takes about a second.

Ordering and featured picks are preserved across runs — edit manifest.json
directly (or drag-reorder in the admin panel) and this script won't clobber it.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
GALLERY_DIR = ROOT / "images" / "gallery"
WEB_DIR = GALLERY_DIR / "_web"
MANIFEST = GALLERY_DIR / "manifest.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"}

# Longest-edge pixel size and JPEG quality for each derivative.
THUMB_PX, THUMB_Q = 900, 70
FULL_PX,  FULL_Q  = 2400, 82

# Map folder name -> gallery key shown on the site.
# The order here is the order the tabs appear on the Stills page.
CATEGORY_MAP = {
    "wildlife":  "wildlife",
    "landscape": "landscape",
    "sports":    "sports",
    "street":    "street",
    "portrait":  "portrait",
    "product":   "product",
}


def sips(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["sips", *args], capture_output=True, text=True)


def read_dimensions(path: Path) -> tuple[int, int] | None:
    """Pixel width/height of an image, via macOS sips."""
    res = sips("-g", "pixelWidth", "-g", "pixelHeight", str(path))
    if res.returncode != 0:
        return None
    dims = {}
    for line in res.stdout.splitlines():
        if ":" in line:
            key, _, val = line.strip().partition(":")
            if key.strip() in ("pixelWidth", "pixelHeight"):
                dims[key.strip()] = int(val.strip())
    if "pixelWidth" in dims and "pixelHeight" in dims:
        return dims["pixelWidth"], dims["pixelHeight"]
    return None


def needs_rebuild(src: Path, dst: Path) -> bool:
    """True if the derivative is missing or older than the original."""
    return not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime


def build_derivative(src: Path, dst: Path, max_px: int, quality: int) -> bool:
    dst.parent.mkdir(parents=True, exist_ok=True)
    res = sips(
        "-Z", str(max_px),
        "-s", "format", "jpeg",
        "-s", "formatOptions", str(quality),
        str(src), "--out", str(dst),
    )
    if res.returncode != 0:
        print(f"    ⚠️  failed on {src.name}: {res.stderr.strip().splitlines()[-1:]}")
        return False
    return True


def scan_category(folder: Path) -> set[str]:
    """Set of 'folder/filename' entries currently on disk."""
    if not folder.is_dir():
        return set()
    return {
        f"{folder.name}/{e.name}"
        for e in folder.iterdir()
        if e.is_file() and e.suffix.lower() in IMAGE_EXTS and not e.name.startswith(".")
    }


def merge_order(existing: list[dict], on_disk: set[str]) -> tuple[list[str], int, int]:
    """
    Keep photos in their saved order, drop ones no longer on disk, and append
    newly-added files alphabetically at the end.

    Accepts the older manifest format (plain path strings) as well as the
    current one (objects), so upgrading in place just works.
    """
    prior = [e["p"] if isinstance(e, dict) else e for e in existing]
    kept = [p for p in prior if p in on_disk]
    removed = len(prior) - len(kept)
    added = sorted(on_disk - set(kept))
    return kept + added, len(added), removed


def main() -> None:
    if not GALLERY_DIR.exists():
        print(f"❌ Gallery directory not found: {GALLERY_DIR}")
        sys.exit(1)

    if subprocess.run(["which", "sips"], capture_output=True).returncode != 0:
        print("❌ 'sips' not found. This script needs macOS.")
        sys.exit(1)

    # Load the existing manifest to preserve ordering and featured picks.
    existing_manifest: dict[str, list] = {}
    if MANIFEST.exists():
        try:
            existing_manifest = json.loads(MANIFEST.read_text())
        except json.JSONDecodeError:
            print(f"⚠️  Couldn't parse {MANIFEST.name}, starting fresh")

    # Remember which photos were marked featured, keyed by path.
    featured = {
        entry["p"]
        for key, entries in existing_manifest.items()
        if not key.startswith("_")
        for entry in entries
        if isinstance(entry, dict) and entry.get("feat")
    }
    # Keys like _featuredOrder aren't folders — carry them through untouched.
    meta = {k: v for k, v in existing_manifest.items() if k.startswith("_")}

    manifest: dict[str, list[dict]] = {}
    total = built = skipped = 0
    src_bytes = web_bytes = 0

    manifest.update(meta)

    for folder_name, key in CATEGORY_MAP.items():
        on_disk = scan_category(GALLERY_DIR / folder_name)
        order, added, removed = merge_order(existing_manifest.get(key, []), on_disk)

        entries: list[dict] = []
        for rel in order:
            src = GALLERY_DIR / rel
            stem = Path(rel).stem
            thumb = WEB_DIR / folder_name / "thumb" / f"{stem}.jpg"
            full = WEB_DIR / folder_name / "full" / f"{stem}.jpg"

            ok = True
            if needs_rebuild(src, thumb):
                ok &= build_derivative(src, thumb, THUMB_PX, THUMB_Q)
                built += 1
            else:
                skipped += 1
            if needs_rebuild(src, full):
                ok &= build_derivative(src, full, FULL_PX, FULL_Q)
            if not ok:
                continue

            dims = read_dimensions(thumb)
            entry = {"p": rel}
            if dims:
                entry["w"], entry["h"] = dims
            if rel in featured:
                entry["feat"] = True
            entries.append(entry)

            src_bytes += src.stat().st_size
            if thumb.exists():
                web_bytes += thumb.stat().st_size

        manifest[key] = entries
        total += len(entries)

        notes = []
        if added:
            notes.append(f"+{added} new")
        if removed:
            notes.append(f"-{removed} gone")
        n_feat = sum(1 for e in entries if e.get("feat"))
        if n_feat:
            notes.append(f"{n_feat} featured")
        note_str = f"  ({', '.join(notes)})" if notes else ""
        print(f"  {key:<10s} {len(entries):>4d} photos{note_str}")

    MANIFEST.write_text(json.dumps(manifest, indent=2))

    print(f"\n✅ {total} photos → {MANIFEST.relative_to(ROOT)}")
    if built:
        print(f"   Built {built} new derivatives ({skipped} already current)")
    else:
        print(f"   All {skipped} derivatives already current")
    if src_bytes:
        mb = lambda b: b / 1_048_576
        print(
            f"   Grid loads {mb(web_bytes):.0f} MB instead of {mb(src_bytes):.0f} MB "
            f"({src_bytes / max(web_bytes, 1):.0f}x smaller)"
        )
    print("\n   Reorder and pick favourites in the browser: open the Stills page")
    print("   with ?admin=1, then click \u21c5 Arrange photos / the \u2606 on each photo.")


if __name__ == "__main__":
    main()
