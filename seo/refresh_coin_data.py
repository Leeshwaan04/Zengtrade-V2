#!/usr/bin/env python3
"""Refresh seo/coin_data_cache.json from live CoinGecko + Binance data.

This is the ONLY place that should make the ~1360 sequential, deliberately-paced Binance klines
calls (up to 600 candidate coins x 4 timeframes) that make a full live fetch take 15-19 minutes -
see generate.fetch_coins()'s docstring for why that pacing is hard-won and non-negotiable (a past
unpaced run silently produced zero coin pages, and a retry under the same burst pattern took 1h45m
and still produced none).

Run this on its own schedule (.github/workflows/pages.yml's cron trigger, every 6h) so a normal
code push doesn't pay this cost - see seo/generate.py's CACHE_PATH comment for the full picture.
Writing the cache is intentionally separate from the site build itself: build.py/generate.py never
need to know HOW the cache file got into the workspace, only that it might be there.

Usage: python3 seo/refresh_coin_data.py
Exits non-zero WITHOUT touching any existing cache file if the fetch looks broken (too few coins
in the universe, or too few fetched successfully) - never overwrite a good cache with a bad one.
"""
from __future__ import annotations
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate as G

CACHE_PATH = G.CACHE_PATH
MIN_COINS = 200   # sanity floor - the real ceiling is ~488 under the 600 cap; well below that is a red flag


def main() -> int:
    print("Rebuilding coin universe from live CoinGecko market-cap ranking...")
    universe = G.build_coin_universe(600)
    if len(universe) < MIN_COINS:
        print(f"  ! universe only {len(universe)} coins (< {MIN_COINS}), aborting without touching the cache")
        return 1

    print(f"  {len(universe)} coins in universe, fetching tickers + klines "
          f"(this is the slow part, ~15-19 min)...")
    G.COINS = universe   # fetch_coins() reads the module-level COINS dict
    rows = G.fetch_coins()
    if len(rows) < MIN_COINS:
        print(f"  ! only {len(rows)} coins fetched successfully (< {MIN_COINS}), aborting without touching the cache")
        return 1

    payload = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "universe": {sym: list(v) for sym, v in universe.items()},
        "coins": [[r[0], r[1], r[2], r[3], r[4], r[5]] for r in rows],
    }
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    size_kb = os.path.getsize(CACHE_PATH) / 1024
    print(f"  wrote {CACHE_PATH}: {len(rows)} coins, {size_kb:.0f} KB, generated_at={payload['generated_at']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
