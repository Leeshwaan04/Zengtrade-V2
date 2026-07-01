"""Crypto market-data adapter — a drop-in for the Kite `DataFeed` interface, backed by
Binance's PUBLIC REST API (no key, no auth, spot data only).

WHY this exists: the entire strategy library (compute / _entry_long / _exit_long) is
market-agnostic — it only ever touches high/low/close/volume on a DatetimeIndex frame.
So the SAME engines that trade NSE cash can trade crypto unchanged; they just need a feed
that speaks the same four methods. This class IS that feed:

    token_for(sym)               -> the symbol itself (crypto needs no instrument token)
    historical(sym, interval, n) -> DatetimeIndex DataFrame[open,high,low,close,volume]
    ltp([syms])                  -> {sym: last_price}
    ohlc([keys])                 -> {key: {last_price, ...}}  (spot marks; used by no crypto engine today)

Prices are REAL Binance spot data — never simulated. Fills are simulated (paper only).

Every network call is fully guarded and CACHED per (symbol, interval) with a short TTL, so a
cycle that runs 20 strategies over 10 symbols collapses to ~one fetch per symbol+interval —
well inside Binance's public rate limits. Any failure returns an empty frame / prior cache,
never raises, so a data blip can NEVER crash the harness.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone

import pandas as pd
import requests

log = logging.getLogger("crypto")

# public bases tried in order (all key-less); the .vision mirror is the same one the UI uses
BASES = ["https://api.binance.com", "https://data-api.binance.vision", "https://api.binance.us"]
_HEADERS = {"User-Agent": "tradepro-paper/1.0"}

# Kite interval string -> Binance interval string
_IVL = {"minute": "1m", "3minute": "3m", "5minute": "5m", "15minute": "15m",
        "30minute": "30m", "60minute": "1h", "hour": "1h", "day": "1d", "week": "1w"}

# cache TTL (seconds) by interval family — daily bars change slowly, intraday faster
_TTL_DAILY = 300.0
_TTL_INTRADAY = 60.0


def _get(path: str, params: dict, timeout: float = 8.0):
    """GET path?params from the first reachable base. Returns parsed JSON or None."""
    last = None
    for base in BASES:
        try:
            r = requests.get(f"{base}{path}", params=params, headers=_HEADERS, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}"
        except Exception as e:            # try the next base
            last = e
            continue
    log.debug("crypto GET %s failed on all bases: %s", path, last)
    return None


class CryptoDataFeed:
    """Binance-backed feed exposing the exact surface the paper engines call."""

    def __init__(self, quote: str = "USDT"):
        self.kite = None                  # options/futures engines check this; crypto has none
        self.quote = quote
        self._cache: dict[tuple, tuple] = {}   # (sym, binance_ivl) -> (fetched_ts, df)

    # symbol IS the token for crypto — engines pass it straight back to historical()
    def token_for(self, symbol: str) -> str:
        return symbol

    def historical(self, token, interval: str = "day", days: int = 30) -> pd.DataFrame:
        sym = str(token)
        bivl = _IVL.get(interval, "1d")
        ttl = _TTL_DAILY if bivl in ("1d", "1w") else _TTL_INTRADAY
        now = time.time()
        hit = self._cache.get((sym, bivl))
        if hit and (now - hit[0]) < ttl:
            return hit[1]
        # Binance caps a single klines call at 1000 bars. Daily strategies want ~days bars;
        # intraday strategies only need a few hundred recent bars for warmup + the live session.
        limit = min(1000, max(60, days + 5)) if bivl in ("1d", "1w") else 1000
        raw = _get("/api/v3/klines", {"symbol": sym, "interval": bivl, "limit": limit})
        if not raw:
            return hit[1] if hit else pd.DataFrame()   # serve stale over nothing; never raise
        try:
            rows = []
            for k in raw:
                rows.append((datetime.fromtimestamp(k[0] / 1000, tz=timezone.utc).replace(tzinfo=None),
                             float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])))
            df = pd.DataFrame(rows, columns=["datetime", "open", "high", "low", "close", "volume"])
            df = df.set_index("datetime")
            self._cache[(sym, bivl)] = (now, df)
            return df
        except Exception:
            log.exception("crypto klines parse failed for %s %s", sym, bivl)
            return hit[1] if hit else pd.DataFrame()

    def ltp(self, symbols: list[str]) -> dict[str, float]:
        if not symbols:
            return {}
        arr = json.dumps(list(symbols), separators=(",", ":"))
        data = _get("/api/v3/ticker/price", {"symbols": arr})
        out: dict[str, float] = {}
        if isinstance(data, list):
            for d in data:
                try:
                    out[d["symbol"]] = float(d["price"])
                except Exception:
                    continue
        elif isinstance(data, dict) and "price" in data:      # single-symbol shape
            try:
                out[data["symbol"]] = float(data["price"])
            except Exception:
                pass
        return out

    def ohlc(self, keys: list[str]) -> dict:
        """Kite-shaped ohlc() for parity: {key: {last_price}}. Keys may be 'BTCUSDT' or 'X:BTCUSDT'."""
        syms = [k.split(":", 1)[1] if ":" in k else k for k in keys]
        prices = self.ltp(syms)
        out = {}
        for k, s in zip(keys, syms):
            if s in prices:
                out[k] = {"last_price": prices[s]}
        return out
