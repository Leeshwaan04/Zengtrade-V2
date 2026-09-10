#!/usr/bin/env python3
"""Publish read-only snapshots of the LOCAL engine for the customer Algo Studio.

LEGACY (2026-09-10): this pipeline needed backend/bot_api.py (localhost:8756), which has been
removed along with the rest of the Indian-market local dev harness. The live worker
(saas/worker/worker.py) now writes engine_state directly to Supabase every cycle, so studio.js's
engineGet() almost always reads that live row and only falls back to these static JSON files if a
key is ever missing. Kept as a documented fallback-refresh path, not currently runnable without a
new crypto-only local API server, not rebuilt here since production no longer depends on it.

Run on the operator's Mac while bot_api (localhost:8756) is up:

    python3 deploy/landing/snapshot.py

Writes deploy/landing/studio_data/*.json (committed to the repo; build.py copies
them into dist/dashboard/data/). The deployed Studio's fetch-shim (studio.js)
serves these files wherever the terminal would have called the local engine.

SAFETY: this is the wall between the operator's account and the public product.
 - Only the endpoints listed below are captured (no holdings, no quotes/candles/
   depth/chain: personal data never leaves the Mac).
 - strip() removes any key that smells like money/identity, recursively, from
   every payload (funds, margin, cash, balance, token, email, user...).
"""
from __future__ import annotations
import json, os, urllib.request

BOT = "http://127.0.0.1:8756"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "studio_data")

# Endpoint -> filename is mechanical: strip leading /, replace / with _.
ENDPOINTS = [
    "api/strategies", "api/market", "api/monitor", "api/trades", "api/stopped",
    "api/regime-fit", "api/readiness", "api/readiness/book",
    "api/opportunities", "api/decisions", "api/learning", "api/risk",
    "api/allocation", "api/analytics", "api/rebalance", "api/positions",
    "api/correlation", "api/status",
    "api/crypto/monitor", "api/crypto/risk", "api/crypto/forward",
    "api/crypto/analytics", "api/crypto/allocation",
]

SENSITIVE = ("fund", "margin", "cash", "balance", "token", "secret", "email",
             "phone", "user", "client_id", "account")

def strip(x):
    """Recursively drop keys whose name suggests personal/broker data."""
    if isinstance(x, dict):
        return {k: strip(v) for k, v in x.items()
                if not any(s in k.lower() for s in SENSITIVE)}
    if isinstance(x, list):
        return [strip(v) for v in x]
    return x

def main():
    os.makedirs(OUT, exist_ok=True)
    ok = miss = 0
    for ep in ENDPOINTS:
        fn = os.path.join(OUT, ep.replace("/", "_") + ".json")
        try:
            with urllib.request.urlopen(f"{BOT}/{ep}", timeout=20) as r:
                data = json.loads(r.read().decode())
        except Exception as e:
            print(f"  ✗ {ep}: {e}")
            miss += 1
            continue
        json.dump(strip(data), open(fn, "w"), separators=(",", ":"))
        print(f"  ✓ {ep} -> {os.path.basename(fn)} ({os.path.getsize(fn)}B)")
        ok += 1
    print(f"snapshot: {ok} captured, {miss} missing -> {OUT}")

if __name__ == "__main__":
    main()
