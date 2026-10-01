#!/usr/bin/env python3
"""TradePro static server with AUTOMATIC cache-busting.

    python3 serve.py                 # serves this folder on http://localhost:8011
    PORT=8755 python3 serve.py        # custom port

Why: the old `?v=NN` in index.html had to be bumped by hand on every edit, and a
missed bump = the browser serves a stale build (which bit us twice). This server
rewrites the `?v=` on every asset to a CONTENT HASH at request time, so:
  * the index.html is never cached (always re-evaluated), and
  * each asset URL changes the instant its file content changes → a plain reload
    always gets the fresh build, and unchanged assets still cache hard.

Drop-in replacement for `python3 -m http.server` - just run this instead. Zero deps.
"""
from __future__ import annotations

import hashlib
import http.server
import os
import re
import socketserver

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8011"))
# match  assets/<file>  (optionally already carrying ?v=...) right before a closing quote
ASSET_RE = re.compile(r'(assets/[\w./-]+?)(?:\?v=[\w.]+)?(?=")')


def _hash(rel: str) -> str:
    try:
        with open(os.path.join(HERE, rel), "rb") as f:
            return hashlib.sha1(f.read()).hexdigest()[:10]
    except OSError:
        return "0"


DIST = os.path.join(HERE, "deploy", "landing", "dist")


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = path.split("?", 1)[0].split("#", 1)[0].strip("/")
        if clean in ("home", "landing"):
            return os.path.join(DIST, "index.html")
        if clean in ("", "index.html", "dashboard"):
            return os.path.join(HERE, "index.html")

        # 1. Exact match in HERE (assets, etc.)
        p_here = os.path.join(HERE, clean)
        if os.path.exists(p_here):
            return p_here

        # 2. Match in DIST (clean directory with index.html or clean file)
        p_dist_idx = os.path.join(DIST, clean, "index.html")
        if os.path.isfile(p_dist_idx):
            return p_dist_idx
        p_dist = os.path.join(DIST, clean)
        if os.path.exists(p_dist):
            return p_dist

        # 3. Match in saas/web/ (e.g. app.html, login.html, ops.html)
        p_saas = os.path.join(HERE, "saas", "web", clean + ".html")
        if os.path.isfile(p_saas):
            return p_saas

        return p_here

    def do_GET(self):
        clean = self.path.split("?", 1)[0].split("#", 1)[0].strip("/")
        if clean in ("", "index.html", "dashboard"):
            return self._serve_index()

        # Dynamic pSEO fall-through if file not written in DIST
        p_dist_idx = os.path.join(DIST, clean, "index.html")
        if not os.path.isfile(p_dist_idx):
            if clean.startswith(("strategies/", "indicators/", "regimes/", "compare/")):
                rendered = self._render_dynamic_pseo(clean)
                if rendered:
                    return self._serve_html_str(rendered)

        return super().do_GET()

    def _render_dynamic_pseo(self, clean: str) -> str | None:
        try:
            import sys
            if HERE not in sys.path:
                sys.path.insert(0, HERE)
            import seo.pseo_engine as pseo
            from deploy.landing.build import shell, coins
            roster = pseo.build_pseo_coin_roster(coins if coins else [], target_count=1000)
            return pseo.resolve_pseo_page(clean, shell, roster)
        except Exception:
            return None

    def _serve_html_str(self, html: str):
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_index(self):
        try:
            html = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
        except OSError:
            return self.send_error(404)
        html = ASSET_RE.sub(lambda m: f"{m.group(1)}?v={_hash(m.group(1))}", html)
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")  # always fresh index
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # hashed assets can cache hard - the hash changes when the file does
        if self.path.startswith("/assets/") and "?v=" in self.path:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    def log_message(self, *a):  # quiet
        pass


def main():
    os.chdir(HERE)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"zengtrade on http://localhost:{PORT} (auto cache-busting and clean URL routing)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")


if __name__ == "__main__":
    main()
