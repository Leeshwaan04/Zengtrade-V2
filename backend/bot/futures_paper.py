"""Index-futures forward-paper engines — Trend (directional) & Basis Carry.

WHY forward-paper only: like the options engines, near-month index futures roll every
month, so a clean continuous HISTORICAL backtest of the *traded contract* isn't honest.
The real evidence is a live forward paper test — real spot, real near-month future LTP,
real lot size, simulated fills, no money at risk.

  'trend' : hold 1 lot of the near-month index future LONG while the underlying INDEX
            holds above its N-day moving average; flat on a close back below (or roll).
  'basis' : when the future trades at a rich ANNUALISED premium to spot, SELL the future
            and hold to convergence — harvest the basis. P&L is marked on the BASIS
            (fut-spot) change, i.e. the carry-leg P&L that ASSUMES the offsetting cash/ETF
            leg. Flagged honestly (the cash leg isn't executed here) — never fabricated.

State shape mirrors OptionsPaperEngine ({realised, positions, openMark}) and EXIT lines use
the shared `[name] EXIT ... pnl=±N (reason)` format, so forward accuracy + the go-live gate
work unchanged. EVERY cycle is fully wrapped — a futures engine can NEVER crash the harness.
"""
from __future__ import annotations

import datetime as _dt
import logging

from . import paper_engine as _pe

log = logging.getLogger("paper")

LOT = {"NIFTY": 75, "BANKNIFTY": 35, "FINNIFTY": 65}
SPOT_KEY = {"NIFTY": "NSE:NIFTY 50", "BANKNIFTY": "NSE:NIFTY BANK",
            "FINNIFTY": "NSE:NIFTY FIN SERVICE"}


class FuturesPaperEngine:
    def __init__(self, name, kind, kite, data, capital, underlying="NIFTY",
                 trend_period=20, basis_hi=0.10, basis_lo=-0.02, lots=1):
        self.name = name
        self.kind = kind                    # 'trend' | 'basis'
        self.kite = kite
        self.data = data
        self.capital = capital
        self.underlying = underlying
        self.trend_period = trend_period
        self.basis_hi = basis_hi            # SHORT the future above this annualised premium
        self.basis_lo = basis_lo            # LONG the future below this (backwardation)
        self.lots = lots
        self.lot = LOT.get(underlying, 75)
        self.interval = "day"
        self.history_days = trend_period + 12
        self.min_bars = 0
        self.positions: dict[str, dict] = {}   # at most one, keyed by the future tradingsymbol
        self.realised = 0.0
        self.open_mark = 0.0
        self._nfo = None
        self._nfo_t = 0.0
        self._idx_token = None

    # ---- resolution helpers (defensive: any failure returns None, never raises) ----
    def _instruments(self):
        import time as _t
        if self._nfo is not None and _t.time() - self._nfo_t < 3600:
            return self._nfo
        self._nfo = self.kite.instruments("NFO")
        self._nfo_t = _t.time()
        return self._nfo

    def _near_future(self):
        today = _dt.date.today()
        futs = [i for i in self._instruments()
                if i.get("name") == self.underlying and i.get("instrument_type") == "FUT"
                and i.get("expiry") and i["expiry"] >= today]
        futs.sort(key=lambda i: i["expiry"])
        return futs[0] if futs else None

    def _ltp(self, nfo_symbol):
        key = "NFO:" + nfo_symbol
        q = self.kite.ltp([key]) or {}
        return (q.get(key) or {}).get("last_price")

    def _spot(self):
        key = SPOT_KEY.get(self.underlying, "NSE:" + self.underlying)
        d = (self.kite.ohlc([key]) or {}).get(key, {}) or {}
        return d.get("last_price")

    def _index_ma(self):
        """Continuous INDEX daily closes -> the trend signal (the future tracks the index;
        this avoids the roll gaps a per-contract future history would introduce)."""
        key = SPOT_KEY.get(self.underlying, "NSE:" + self.underlying)
        if self._idx_token is None:
            q = self.kite.ltp([key]) or {}
            self._idx_token = (q.get(key) or {}).get("instrument_token")
        if not self._idx_token:
            return None, None
        df = self.data.historical(self._idx_token, "day", self.history_days)
        if df is None or getattr(df, "empty", True) or len(df) < self.trend_period + 1:
            return None, None
        closes = df["close"]
        return float(closes.iloc[-1]), float(closes.tail(self.trend_period).mean())

    # ---- cycle (fully guarded) ----
    def run_cycle(self, square_off: bool = False) -> None:
        try:
            fut = self._near_future()
            if not fut:
                return
            ts = fut["tradingsymbol"]
            fut_ltp = self._ltp(ts)
            spot = self._spot()
            if fut_ltp is None or spot is None:
                return
            exp = fut["expiry"]
            dte = max((exp - _dt.date.today()).days, 0)
            basis = fut_ltp - spot

            # ---- manage the open position ----
            for key in list(self.positions):
                pos = self.positions[key]
                side = pos["side"]                       # +1 long future, -1 short future
                if self.kind == "trend":
                    self.open_mark = round((fut_ltp - pos["entry"]) * side * self.lot * self.lots, 2)
                    last, ma = self._index_ma()
                    flip = (last is not None and ma is not None
                            and ((side > 0 and last < ma) or (side < 0 and last > ma)))
                    if square_off or _dt.date.today() >= exp or flip:
                        reason = "square-off" if square_off else "expiry/roll" if _dt.date.today() >= exp else "trend-flip"
                        self._exit(key, (fut_ltp - pos["entry"]) * side, reason)
                else:                                     # basis: P&L = convergence of (fut-spot)
                    pnl_pts = (pos["entry_basis"] - basis) * (-side)   # short fut -> profit as basis falls
                    self.open_mark = round(pnl_pts * self.lot * self.lots, 2)
                    converged = abs(basis) <= max(spot * 0.0005, 2.0)
                    if square_off or _dt.date.today() >= exp or converged:
                        reason = "square-off" if square_off else "expiry" if _dt.date.today() >= exp else "converged"
                        self._exit(key, pnl_pts, reason)

            # one position at a time
            if square_off or self.positions:
                if not self.positions:
                    self.open_mark = 0.0
                return

            # ---- entry ----
            if self.kind == "trend":
                last, ma = self._index_ma()
                if last is None or ma is None:
                    return
                if last > ma:
                    self._enter(ts, fut_ltp, +1, exp, {})
            else:                                          # basis
                if dte <= 0 or spot <= 0:
                    return
                ann = (basis / spot) / (dte / 365.0)
                if ann >= self.basis_hi:
                    self._enter(ts, fut_ltp, -1, exp, {"entry_basis": round(basis, 2), "ann": round(ann, 3)})
                elif ann <= self.basis_lo:
                    self._enter(ts, fut_ltp, +1, exp, {"entry_basis": round(basis, 2), "ann": round(ann, 3)})
        except Exception:
            log.exception("[%s] cycle error (futures) — skipped, harness unaffected", self.name)

    def _enter(self, ts, price, side, expiry, extra):
        pos = {"side": side, "entry": round(price, 2), "qty": self.lot * self.lots,
               "expiry": expiry.isoformat(), "regime": _pe.CURRENT_REGIME}
        if self.kind == "basis":
            pos["entry_basis"] = extra.get("entry_basis", 0.0)
        self.positions[ts] = pos
        self.open_mark = 0.0
        log.info("[%s] ENTER %s %s qty=%d @%.2f (%s%s) regime=%s", self.name, self.underlying,
                 "LONG" if side > 0 else "SHORT", self.lot * self.lots, price, self.kind,
                 (" basis=%.1f ann=%.1f%%" % (extra.get("entry_basis", 0), extra.get("ann", 0) * 100))
                 if self.kind == "basis" else "", _pe.CURRENT_REGIME)

    def _exit(self, key, pnl_pts, reason):
        pos = self.positions.pop(key)
        pnl = pnl_pts * self.lot * self.lots
        self.realised += pnl
        self.open_mark = 0.0
        log.info("[%s] EXIT  %s qty=%d @%.2f pnl=%+.0f (%s) regime=%s", self.name, self.underlying,
                 pos["qty"], pos.get("entry", 0), pnl, reason, pos.get("regime", "—"))

    # ---- persistence (identical shape to OptionsPaperEngine) ----
    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "positions": self.positions,
                "openMark": round(self.open_mark, 2)}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.positions = s.get("positions", {})
        self.open_mark = s.get("openMark", 0.0)
