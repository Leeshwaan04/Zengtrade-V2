"""Crypto PERPETUAL-FUTURES forward-paper engines (Binance USDT-M perps, public data).

Perps are the dominant crypto market and give two edges spot can't:
  • direction  — you can go SHORT, so the trend engine works in a bear tape too.
  • funding     — longs pay shorts (or vice-versa) every 8h. When funding is richly
                  positive, SHORTING the perp harvests that carry (delta assumed hedged;
                  flagged honestly, like the Indian basis engine — the hedge leg isn't
                  executed here, so only the funding + mark move is booked, never fabricated).

  'trend'   : long the perp above its N-day MA, SHORT it below (ADX-gated so it sits out chop).
  'funding' : short when annualised funding ≥ hi (collect carry); long when ≤ lo (backwardation).

State mirrors the other engines ({realised, positions, openMark}) and EXIT lines use the shared
`[name] EXIT ... pnl=±N (reason)` format, so forward accuracy + the go-live gate work unchanged.
EVERY cycle is fully wrapped — a perp engine can NEVER crash the harness. Prices are REAL Binance
perp marks; fills are simulated (paper only).
"""
from __future__ import annotations

import logging
import time as _time

import pandas as pd
import requests

from . import indicators
from . import paper_engine as _pe

log = logging.getLogger("crypto")

FAPI = ["https://fapi.binance.com", "https://fapi.binance.us"]
_HDRS = {"User-Agent": "tradepro-paper/1.0"}
_IVL = {"day": "1d", "5minute": "5m", "15minute": "15m", "60minute": "1h", "hour": "1h"}
FUND_PER_YEAR = 3 * 365   # funding settles every 8h → 1095 periods/yr (to annualise a rate)


def _fget(path: str, params: dict, timeout: float = 8.0):
    last = None
    for base in FAPI:
        try:
            r = requests.get(f"{base}{path}", params=params, headers=_HDRS, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}"
        except Exception as e:
            last = e
    log.debug("perp GET %s failed: %s", path, last)
    return None


class CryptoPerpEngine:
    def __init__(self, name, kind, symbol="BTCUSDT", capital=500_000.0,
                 trend_period=20, adx_min=18.0, fund_hi=0.12, fund_lo=-0.03,
                 alloc_pct=0.12, lots=1):
        self.name = name
        self.kind = kind                    # 'trend' | 'funding'
        self.symbol = symbol
        self.capital = capital
        self.trend_period = trend_period
        self.adx_min = adx_min              # trend: only hold in a REAL trend, not chop
        self.fund_hi = fund_hi              # funding: SHORT above this ANNUALISED funding rate
        self.fund_lo = fund_lo              # funding: LONG below this (funding pays longs)
        self.alloc_pct = alloc_pct          # notional per position as a fraction of capital
        self.lots = lots
        self.interval = "day"
        self.history_days = trend_period + 40
        self.min_bars = 0
        self.positions: dict[str, dict] = {}   # at most one, keyed by symbol
        self.realised = 0.0
        self.open_mark = 0.0
        self._kl: tuple | None = None          # (ts, df) cache

    # ---- data (guarded) ----
    def _klines(self):
        if self._kl and (_time.time() - self._kl[0]) < 240:
            return self._kl[1]
        raw = _fget("/fapi/v1/klines", {"symbol": self.symbol, "interval": _IVL.get(self.interval, "1d"),
                                        "limit": min(1000, self.history_days + 5)})
        if not raw:
            return self._kl[1] if self._kl else None
        try:
            rows = [(float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5])) for k in raw]
            df = pd.DataFrame(rows, columns=["open", "high", "low", "close", "volume"])
            self._kl = (_time.time(), df)
            return df
        except Exception:
            return self._kl[1] if self._kl else None

    def _premium(self):
        """Live mark, index and the latest funding rate (per-8h)."""
        d = _fget("/fapi/v1/premiumIndex", {"symbol": self.symbol})
        if not isinstance(d, dict):
            return None
        try:
            return {"mark": float(d["markPrice"]), "index": float(d.get("indexPrice") or d["markPrice"]),
                    "funding": float(d.get("lastFundingRate") or 0.0),
                    "nextFunding": int(d.get("nextFundingTime") or 0)}
        except Exception:
            return None

    def _qty(self, price):
        if price <= 0:
            return 0
        return max(0, int((self.capital * self.alloc_pct) // price)) * self.lots

    # ---- cycle (fully guarded) ----
    def run_cycle(self, square_off: bool = False) -> None:
        try:
            prem = self._premium()
            if not prem:
                return
            mark, funding, nxt = prem["mark"], prem["funding"], prem["nextFunding"]
            ann_fund = funding * FUND_PER_YEAR    # annualised funding rate

            # ---- manage the open position ----
            for key in list(self.positions):
                pos = self.positions[key]
                side = pos["side"]
                # accrue funding whenever an 8h settlement boundary has passed since we last checked
                if nxt and pos.get("nextFunding") and nxt > pos["nextFunding"]:
                    # short collects when funding>0; long pays. sign = -side * rate * notional
                    fpnl = -side * pos["qty"] * mark * funding
                    pos["fundAccrued"] = pos.get("fundAccrued", 0.0) + fpnl
                    pos["nextFunding"] = nxt
                price_pnl = (mark - pos["entry"]) * side * pos["qty"]
                self.open_mark = round(price_pnl + pos.get("fundAccrued", 0.0), 2)
                if self.kind == "trend":
                    df = self._klines()
                    flip = False
                    if df is not None and len(df) > self.trend_period:
                        ma = float(df["close"].tail(self.trend_period).mean())
                        last = float(df["close"].iloc[-1])
                        flip = (side > 0 and last < ma) or (side < 0 and last > ma)
                    if square_off or flip:
                        self._exit(key, price_pnl + pos.get("fundAccrued", 0.0),
                                   "square-off" if square_off else "trend-flip")
                else:   # funding-carry: exit when the carry edge is gone (funding normalised)
                    gone = (side < 0 and ann_fund < self.fund_hi * 0.4) or (side > 0 and ann_fund > self.fund_lo * 0.4)
                    if square_off or gone:
                        self._exit(key, price_pnl + pos.get("fundAccrued", 0.0),
                                   "square-off" if square_off else "carry-normalised")

            if square_off or self.positions:
                if not self.positions:
                    self.open_mark = 0.0
                return

            # ---- entry ----
            qty = self._qty(mark)
            if qty < 1:
                return
            if self.kind == "trend":
                df = self._klines()
                if df is None or len(df) < self.trend_period + 1:
                    return
                ma = float(df["close"].tail(self.trend_period).mean())
                last = float(df["close"].iloc[-1])
                adx = None
                try:
                    a, _p, _m = indicators.adx(df["high"], df["low"], df["close"], 14)
                    adx = None if pd.isna(a.iloc[-1]) else float(a.iloc[-1])
                except Exception:
                    adx = None
                strong = adx is None or adx >= self.adx_min
                if not strong:
                    log.info("[%s] SKIP perp trend — ADX %.1f < %.0f (chop)", self.name, adx or 0, self.adx_min)
                    return
                if last > ma:
                    self._enter(mark, +1, nxt, {"adx": adx})
                elif last < ma:
                    self._enter(mark, -1, nxt, {"adx": adx})
            else:   # funding
                if ann_fund >= self.fund_hi:
                    self._enter(mark, -1, nxt, {"annFund": round(ann_fund, 3)})   # short → collect funding
                elif ann_fund <= self.fund_lo:
                    self._enter(mark, +1, nxt, {"annFund": round(ann_fund, 3)})
        except Exception:
            log.exception("[%s] cycle error (perp) — skipped, harness unaffected", self.name)

    def _enter(self, price, side, nxt, extra):
        self.positions[self.symbol] = {"side": side, "entry": round(price, 4),
                                       "qty": self._qty(price), "regime": _pe.CURRENT_REGIME,
                                       "nextFunding": nxt, "fundAccrued": 0.0}
        self.open_mark = 0.0
        log.info("[%s] ENTER %s %s qty=%d @%.2f (%s%s) regime=%s", self.name, self.symbol,
                 "LONG" if side > 0 else "SHORT", self.positions[self.symbol]["qty"], price, self.kind,
                 (" annFund=%.1f%%" % (extra.get("annFund", 0) * 100)) if self.kind == "funding" else "",
                 _pe.CURRENT_REGIME)

    def _exit(self, key, pnl, reason):
        pos = self.positions.pop(key)
        self.realised += pnl
        self.open_mark = 0.0
        log.info("[%s] EXIT  %s qty=%d @%.2f pnl=%+.0f (%s) regime=%s", self.name, self.symbol,
                 pos["qty"], pos.get("entry", 0), pnl, reason, pos.get("regime", "—"))

    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "positions": self.positions,
                "openMark": round(self.open_mark, 2)}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.positions = s.get("positions", {})
        self.open_mark = s.get("openMark", 0.0)
