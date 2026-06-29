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

Drop-in replacement for `python3 -m http.server` — just run this instead. Zero deps.
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


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] in ("/", "/index.html"):
            return self._serve_index()
        return super().do_GET()

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
        # hashed assets can cache hard — the hash changes when the file does
        if self.path.startswith("/assets/") and "?v=" in self.path:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    def log_message(self, *a):  # quiet
        pass


def main():
    os.chdir(HERE)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"TradePro on http://localhost:{PORT}  —  auto cache-busting (no more ?v bumps; just edit + reload)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")


if __name__ == "__main__":
    main()
