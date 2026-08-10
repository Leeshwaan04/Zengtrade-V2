#!/usr/bin/env python3
"""Crypto-only HTTP API for zengtrade — no Kite / Indian market dependencies.

    python3 crypto_api.py            # serves on http://localhost:8756

Exposes crypto paper-trading, strategy deploy, harness control, and analytics.
Use this instead of bot_api.py when targeting crypto markets exclusively.
"""
from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

PORT = int(os.environ.get("PORT", "8756"))

# Reuse battle-tested crypto payloads from bot_api (import does not start Kite threads).
from bot_api import (  # noqa: E402
    STRATEGIES,
    _CRYPTO_KEY_TO_ID,
    _CRYPTO_NAMES,
    book_readiness_payload,
    crypto_allocation_payload,
    crypto_analytics_payload,
    crypto_backtest_payload,
    crypto_forward_payload,
    crypto_harness_status,
    crypto_monitor_payload,
    crypto_recent_trades,
    crypto_risk_payload,
    crypto_status_payload,
    crypto_strategies_payload,
    framework_payload,
    regime_fit_payload,
    start_crypto_harness,
    stop_crypto_harness,
)
from bot.crypto_alloc import set_weight  # noqa: E402
from bot.subscriptions import set_sub  # noqa: E402

_CRYPTO_IDS = {_CRYPTO_KEY_TO_ID.get(k, k) for k in _CRYPTO_NAMES}


def _health():
    return {"ok": True, "product": "crypto"}


class Handler(BaseHTTPRequestHandler):
    def _cors_origin(self):
        origin = self.headers.get("Origin")
        if not origin:
            return None
        if origin.startswith("http://localhost:") or origin.startswith("http://127.0.0.1:"):
            return origin
        return None

    def _send(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        o = self._cors_origin()
        if o:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        o = self._cors_origin()
        if o:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        path, qs = u.path, parse_qs(u.query)
        try:
            routes = {
                "/api/health": _health,
                "/api/status": crypto_status_payload,
                "/api/strategies": crypto_strategies_payload,
                "/api/framework": lambda: framework_payload((qs.get("regime") or [None])[0]),
                "/api/crypto/monitor": crypto_monitor_payload,
                "/api/crypto/risk": crypto_risk_payload,
                "/api/crypto/forward": crypto_forward_payload,
                "/api/crypto/analytics": crypto_analytics_payload,
                "/api/crypto/allocation": crypto_allocation_payload,
                "/api/trades": crypto_recent_trades,
                "/api/harness": crypto_harness_status,
                "/api/analytics": crypto_analytics_payload,
                "/api/stopped": lambda: {"stopped": [], "count": 0, "totalFlattenPnl": 0},
            }
            if path == "/api/crypto/backtest":
                return self._send(crypto_backtest_payload(
                    (qs.get("strategy") or ["momentum"])[0],
                    (qs.get("period") or ["1Y"])[0],
                ))
            if path == "/api/readiness/book":
                return self._send(book_readiness_payload((qs.get("market") or ["crypto"])[0]))
            if path == "/api/regime-fit":
                return self._send(regime_fit_payload((qs.get("market") or ["crypto"])[0]))
            fn = routes.get(path)
            if fn is None:
                return self._send({"error": "not found", "product": "crypto"}, 404)
            self._send(fn())
        except Exception as e:
            self._send({"error": str(e)[:120], "product": "crypto"}, 500)

    def do_POST(self):
        path = self.path.split("?")[0]
        if self.headers.get("Origin") and self._cors_origin() is None:
            return self._send({"error": "forbidden origin"}, 403)
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
            if path == "/api/crypto/allocation":
                sid = str(body.get("id", ""))
                if not sid:
                    return self._send({"error": "missing strategy id"}, 400)
                w = float(body.get("weight", 1.0))
                alloc = set_weight(sid, w)
                return self._send({"ok": True, "id": sid, "weight": max(0.0, min(1.0, w)), "allocation": alloc})
            if path == "/api/strategy":
                sid = body.get("id", "")
                if sid not in _CRYPTO_IDS:
                    return self._send({"error": f"unknown strategy {sid!r}"}, 400)
                return self._send(set_sub(sid, body.get("state", "paper")))
            if path == "/api/harness":
                action = body.get("action", "start")
                if action == "stop":
                    return self._send(stop_crypto_harness())
                return self._send(start_crypto_harness())
            return self._send({"error": "not found", "product": "crypto"}, 404)
        except Exception as e:
            self._send({"error": str(e)[:120], "product": "crypto"}, 500)

    def log_message(self, *a):
        pass


def main() -> None:
    print(f"zengtrade crypto API on http://localhost:{PORT}")
    print("  /api/health  /api/strategies  /api/crypto/monitor  /api/harness  /api/strategy")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
