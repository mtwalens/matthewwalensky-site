#!/usr/bin/env python3
"""
Local dev server for the portfolio site.

Same as `python3 -m http.server 3333` but ALSO accepts a POST to
/api/save-order so the admin can drag-reorder photos and save the new
ordering straight into images/gallery/manifest.json — no copy/paste.

Run:
    python3 dev-server.py
"""

import http.server
import json
import socketserver
from pathlib import Path

PORT = 3333
ROOT = Path(__file__).parent
MANIFEST = ROOT / "images" / "gallery" / "manifest.json"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Avoid stale caching of the manifest while iterating locally.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path == "/api/save-order":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                category = payload["category"]
                paths    = payload["paths"]
                if not isinstance(category, str) or not isinstance(paths, list):
                    raise ValueError("bad payload shape")
            except Exception as e:
                self._json(400, {"ok": False, "error": str(e)})
                return

            manifest = {}
            if MANIFEST.exists():
                try:
                    manifest = json.loads(MANIFEST.read_text())
                except json.JSONDecodeError:
                    pass

            if category == "featured":
                # Featured isn't a folder: the photos live in their own
                # categories and this is purely the order they appear in.
                manifest["_featuredOrder"] = paths
            else:
                # Entries carry dimensions and the featured flag, so reorder
                # the existing objects rather than replacing them with bare
                # paths — otherwise reordering would wipe that metadata.
                existing = manifest.get(category, [])
                by_path = {
                    (e["p"] if isinstance(e, dict) else e): e
                    for e in existing
                }
                manifest[category] = [by_path.get(p, {"p": p}) for p in paths]
            MANIFEST.write_text(json.dumps(manifest, indent=2))

            print(f"[admin] saved {len(paths)} paths for '{category}' → manifest.json")
            self._json(200, {"ok": True, "category": category, "count": len(paths)})
            return

        if self.path == "/api/save-featured":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                path = payload["path"]
                featured = bool(payload["featured"])
            except Exception as e:
                self._json(400, {"ok": False, "error": str(e)})
                return

            manifest = {}
            if MANIFEST.exists():
                try:
                    manifest = json.loads(MANIFEST.read_text())
                except json.JSONDecodeError:
                    pass

            found = False
            for key, entries in manifest.items():
                if key.startswith("_"):
                    continue          # _featuredOrder is a list of paths
                for entry in entries:
                    if isinstance(entry, dict) and entry.get("p") == path:
                        if featured:
                            entry["feat"] = True
                        else:
                            entry.pop("feat", None)
                        found = True
            if not found:
                self._json(404, {"ok": False, "error": f"not in manifest: {path}"})
                return

            MANIFEST.write_text(json.dumps(manifest, indent=2))
            total = sum(
                1
                for key, entries in manifest.items()
                if not key.startswith("_")
                for e in entries
                if isinstance(e, dict) and e.get("feat")
            )
            print(f"[admin] {'★' if featured else '☆'} {path}  ({total} featured)")
            self._json(200, {"ok": True, "featured": featured, "total": total})
            return

        if self.path == "/api/save-captions":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception as e:
                self._json(400, {"ok": False, "error": str(e)})
                return
            captions_path = ROOT / "images" / "gallery" / "captions.json"
            captions_path.write_text(json.dumps(payload, indent=2))
            print(f"[admin] saved captions.json ({len(payload)} entries)")
            self._json(200, {"ok": True})
            return

        if self.path == "/api/save-content":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception as e:
                self._json(400, {"ok": False, "error": str(e)})
                return
            content_path = ROOT / "content.json"
            content_path.write_text(json.dumps(payload, indent=2))
            print(f"[admin] saved content.json ({len(payload.keys())} top-level keys)")
            self._json(200, {"ok": True})
            return

        if self.path == "/api/save-videos":
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                project = payload["project"]            # e.g. "redsox", "freelance"
                tab     = payload.get("tab")            # may be None for flat lists
                videos  = payload["videos"]
                if not isinstance(project, str) or not isinstance(videos, list):
                    raise ValueError("bad payload shape")
            except Exception as e:
                self._json(400, {"ok": False, "error": str(e)})
                return

            video_manifest_path = ROOT / "videos" / "links.json"
            vm = {}
            if video_manifest_path.exists():
                try:
                    vm = json.loads(video_manifest_path.read_text())
                except json.JSONDecodeError:
                    pass

            if tab:
                vm.setdefault(project, {})
                if not isinstance(vm[project], dict):
                    vm[project] = {}
                vm[project][tab] = videos
                where = f"{project}/{tab}"
            else:
                vm[project] = videos
                where = project

            video_manifest_path.write_text(json.dumps(vm, indent=2))
            print(f"[admin] saved {len(videos)} videos for '{where}' → videos/links.json")
            self._json(200, {"ok": True, "where": where, "count": len(videos)})
            return

        self._json(404, {"ok": False, "error": "not found"})

    def _json(self, status, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"📡 dev server on http://localhost:{PORT}")
        print(f"   admin: http://localhost:{PORT}/?admin=1")
        print(f"   save-order endpoint: POST /api/save-order")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 bye")
