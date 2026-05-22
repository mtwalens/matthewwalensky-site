#!/usr/bin/env python3
"""
Scans images/gallery/<category>/ for image files and writes
images/gallery/manifest.json. Run after adding/removing photos:

    python3 generate-manifest.py

The site's gallery loads from this manifest at runtime.
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).parent
GALLERY_DIR = ROOT / "images" / "gallery"
MANIFEST = GALLERY_DIR / "manifest.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic"}

# Map folder name → gallery key shown on the site.
# Add/rename folders here if you ever change the category set.
CATEGORY_MAP = {
    "environmental": "nature",
    "sports":        "sports",
    "product":       "product",
    "street":        "street",
    "portrait":      "portrait",
}

def scan_category(folder: Path) -> set[str]:
    """Return the set of 'folder/filename' entries currently on disk."""
    if not folder.is_dir():
        return set()
    files = set()
    for entry in folder.iterdir():
        if entry.is_file() and entry.suffix.lower() in IMAGE_EXTS:
            if entry.name.startswith("."):
                continue
            files.add(f"{folder.name}/{entry.name}")
    return files

def merge_order(existing: list[str], on_disk: set[str]) -> tuple[list[str], int, int]:
    """
    Keep existing files in their saved order, drop ones no longer on disk,
    and append any newly-added files (alphabetically) at the end.

    Returns (new_order, added, removed).
    """
    kept = [p for p in existing if p in on_disk]
    removed = len(existing) - len(kept)
    new_files = sorted(on_disk - set(kept))
    return kept + new_files, len(new_files), removed

def main() -> None:
    if not GALLERY_DIR.exists():
        print(f"❌ Gallery directory not found: {GALLERY_DIR}")
        return

    # Load existing manifest (if any) to preserve manual ordering.
    existing_manifest: dict[str, list[str]] = {}
    if MANIFEST.exists():
        try:
            existing_manifest = json.loads(MANIFEST.read_text())
        except json.JSONDecodeError:
            print(f"⚠️  Couldn't parse existing {MANIFEST.name}, starting fresh")

    manifest: dict[str, list[str]] = {}
    total = 0
    for folder_name, key in CATEGORY_MAP.items():
        on_disk = scan_category(GALLERY_DIR / folder_name)
        existing = existing_manifest.get(key, [])
        merged, added, removed = merge_order(existing, on_disk)
        manifest[key] = merged
        total += len(merged)

        notes = []
        if added:   notes.append(f"+{added} new")
        if removed: notes.append(f"-{removed} gone")
        note_str = f"  ({', '.join(notes)})" if notes else ""
        print(f"  {key:<10s} {len(merged):>4d} photos{note_str}")

    MANIFEST.write_text(json.dumps(manifest, indent=2))
    print(f"\n✅ Wrote {total} photos to {MANIFEST.relative_to(ROOT)}")
    print("   Edit that file directly to reorder — the script preserves your order.")

if __name__ == "__main__":
    main()
