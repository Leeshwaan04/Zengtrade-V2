"""Options forward-paper engines — Iron Condor (defined-risk) & Short Strangle.

WHY forward-paper only: Kite stores each option contract's short life, so a clean
HISTORICAL backtest across rebuilt chains isn't possible (the catalog says so
honestly). The honest evidence for premium-selling is a live forward paper test —
which is exactly what this does: real spot, real weekly chain, real per-leg LTPs,
simulated fills, no money at risk.

State shape mirrors the other engines ({realised, positions}) and EXIT lines use the
same `[name] EXIT ... pnl=±N (reason)` format, so forward_closed / forward_stats
(accuracy + the go-live gate) and realised P&L all work in the dashboard. Open
structures self-mark (they don't fit the single-stock marker) and persist their credit.

EVERY cycle is fully wrapped — an options engine can NEVER crash the shared harness.
"""
from __future__ import annotations

import datetime as _dt
import logging

import pandas as pd

from . import indicators
from . import paper_engine as _pe

log = logging.getLogger("paper")

LOT = {"NIFTY": 75, "BANKNIFTY": 35, "FINNIFTY": 65}
STRIKE_STEP = {"NIFTY": 50, "BANKNIFTY": 100, "FINNIFTY": 50}


def _round_to(x, step):
    return int(round(x / step) * step)


class OptionsPaperEngine:
    """Sells index premium (condor or strangle) on the nearest weekly expiry, marks the
    structure to the live chain each cycle, and manages it to a target / stop / expiry."""

    def __init__(self, name, kind, kite, capital, underlying="NIFTY",
                 short_pct=0.02, wing_pts=200, take_profit=0.5, stop_mult=2.0,
                 lots=1, data=None, adx_max=30.0, ext_atr_max=2.5, trend_period=20):
        self.name = name
        self.kind = kind                  # 'iron_condor' | 'strangle'
        self.kite = kite
        self.data = data                  # index daily history → the regime gate (skip selling into a trend)
        self.adx_max = adx_max            # skip NEW premium sells when the index ADX says a strong trend
        self.ext_atr_max = ext_atr_max    # skip when the index is already stretched >N ATRs from its MA
        self.trend_period = trend_period
        self._idx_token = None
        self.capital = capital
        self.underlying = underlying
        self.short_pct = short_pct        # short strikes ~this far OTM
        self.wing_pts = wing_pts          # condor wing width (points)
        self.take_profit = take_profit    # close when this fraction of credit is captured
        self.stop_mult = stop_mult        # stop when loss = stop_mult × credit (condor capped by wings)
        self.lots = lots
        self.lot = LOT.get(underlying, 75)
        self.step = STRIKE_STEP.get(underlying, 50)
        self.interval = "day"
        self.history_days = 5
        self.min_bars = 0
        self.positions: dict[str, dict] = {}   # at most one structure, keyed by expiry
        self.realised = 0.0
        self.open_mark = 0.0
        self._nfo = None
        self._nfo_t = 0.0

    # ---- chain helpers (defensive: any failure returns None, never raises) ----
    def _instruments(self):
        import time as _t
        if self._nfo is not None and _t.time() - self._nfo_t < 3600:
            return self._nfo
        self._nfo = self.kite.instruments("NFO")
        self._nfo_t = _t.time()
        return self._nfo

    def _spot(self):
        key = {"NIFTY": "NSE:NIFTY 50", "BANKNIFTY": "NSE:NIFTY BANK",
               "FINNIFTY": "NSE:NIFTY FIN SERVICE"}.get(self.underlying, "NSE:" + self.underlying)
        d = (self.kite.ohlc([key]) or {}).get(key, {}) or {}
        return d.get("last_price")

    def _index_regime(self, spot):
        """(adx, extension-in-ATRs) of the underlying index from daily bars — the regime gate.
        Premium selling (short gamma) survives on RANGE days and dies in a runaway trend, so we
        skip opening a NEW structure when the index is strongly trending or already stretched.
        Returns (None, None) when history is unavailable → caller falls back to selling (green path)."""
        if self.data is None:
            return None, None
        try:
            key = {"NIFTY": "NSE:NIFTY 50", "BANKNIFTY": "NSE:NIFTY BANK",
                   "FINNIFTY": "NSE:NIFTY FIN SERVICE"}.get(self.underlying, "NSE:" + self.underlying)
            if self._idx_token is None:
                q = self.kite.ltp([key]) or {}
                self._idx_token = (q.get(key) or {}).get("instrument_token")
            if not self._idx_token:
                return None, None
            df = self.data.historical(self._idx_token, "day", self.trend_period + 20)
            if df is None or getattr(df, "empty", True) or len(df) < self.trend_period + 1:
                return None, None
            adx, _p, _m = indicators.adx(df["high"], df["low"], df["close"], 14)
            atr = indicators.atr(df["high"], df["low"], df["close"], 14)
            a = adx.iloc[-1]; at = atr.iloc[-1]
            ma = float(df["close"].tail(self.trend_period).mean())
            ext = abs(spot - ma) / at if (at and not pd.isna(at)) else 0.0
            return (None if pd.isna(a) else float(a)), float(ext)
        except Exception:
            return None, None

    def _weekly_expiry(self, opts):
        exps = sorted({i["expiry"] for i in opts if i.get("expiry") and i["expiry"] >= _dt.date.today()})
        return exps[0] if exps else None

    def _leg(self, opts, expiry, strike, typ):
        for i in opts:
            if i.get("expiry") == expiry and int(i.get("strike") or 0) == strike and i["instrument_type"] == typ:
                return i
        return None

    def _ltps(self, tsyms):
        keys = ["NFO:" + t for t in tsyms]
        q = self.kite.ltp(keys) or {}
        return {k.split(":", 1)[1]: (v or {}).get("last_price") for k, v in q.items()}

    def _build_legs(self, opts, expiry, spot):
        atm = _round_to(spot, self.step)
        sc = _round_to(spot * (1 + self.short_pct), self.step)      # short call strike
        sp = _round_to(spot * (1 - self.short_pct), self.step)      # short put strike
        legs = [("CE", sc, -1), ("PE", sp, -1)]                      # sells (credit)
        if self.kind == "iron_condor":
            legs += [("CE", sc + self.wing_pts, +1), ("PE", sp - self.wing_pts, +1)]   # bought wings
        out = []
        for typ, strike, sign in legs:
            ins = self._leg(opts, expiry, strike, typ)
            if not ins:
                return None
            out.append({"ts": ins["tradingsymbol"], "type": typ, "strike": strike, "sign": sign})
        return out

    def _net_cost(self, legs, ltps):
        """Cost to be in the structure now (negative = we're net SHORT premium = a credit)."""
        cost = 0.0
        for lg in legs:
            px = ltps.get(lg["ts"])
            if px is None:
                return None
            cost += lg["sign"] * px         # +buy, -sell
        return cost

    def _intrinsic_cost(self, legs, spot):
        """Net cost to close AT EXPIRY, valued at intrinsic vs the cash settlement (spot).
        Dead contracts have no LTP, so this is the honest expiry settlement — a fully OTM
        short structure settles at 0 intrinsic → the seller keeps the whole credit."""
        if not spot:
            return 0.0
        cost = 0.0
        for lg in legs:
            strike = lg["strike"]
            intrinsic = max(0.0, spot - strike) if lg["type"] == "CE" else max(0.0, strike - spot)
            cost += lg["sign"] * intrinsic
        return cost

    # ---- cycle (fully guarded) ----
    def run_cycle(self, square_off: bool = False) -> None:
        try:
            opts = [i for i in self._instruments()
                    if i["name"] == self.underlying and i["instrument_type"] in ("CE", "PE")]
            spot = self._spot()
            if not opts or not spot:
                return
            # manage / exit existing structure
            for key in list(self.positions):
                pos = self.positions[key]
                exp = _dt.date.fromisoformat(pos["expiry"])
                expired = _dt.date.today() >= exp
                ltps = self._ltps([lg["ts"] for lg in pos["legs"]])
                cost = self._net_cost(pos["legs"], ltps)
                if cost is None:
                    # dead contracts (expired → no LTP) can't be priced live: settle at INTRINSIC vs spot,
                    # never leave the structure stranded showing a frozen ₹0.
                    if expired:
                        self._exit(key, pos["credit"] + self._intrinsic_cost(pos["legs"], spot), "expiry-settle")
                    continue
                # P&L per unit credit: credit received + current net cost (cost is negative when still a credit)
                pnl_pts = pos["credit"] + cost
                hit_tp = pnl_pts >= self.take_profit * pos["credit"]
                hit_sl = pnl_pts <= -self.stop_mult * pos["credit"]
                if square_off or expired or hit_tp or hit_sl:
                    reason = "square-off" if square_off else "expiry" if expired else "target" if hit_tp else "stop"
                    self._exit(key, pnl_pts, reason)
            # mark any STILL-OPEN structure to the live chain → real unrealised P&L (was hard-zeroed before)
            mark_pts = 0.0
            for pos in self.positions.values():
                ltps = self._ltps([lg["ts"] for lg in pos["legs"]])
                c = self._net_cost(pos["legs"], ltps)
                if c is not None:
                    mark_pts += pos["credit"] + c
            self.open_mark = round(mark_pts * self.lot * self.lots, 2)
            # one structure at a time
            if square_off or self.positions:
                return
            # regime gate: never SELL premium into a strong trend / breakout (the short-gamma killer)
            adx, ext = self._index_regime(spot)
            if adx is not None and adx >= self.adx_max:
                log.info("[%s] SKIP — index ADX %.1f ≥ %.0f (strong trend; won't sell premium into it)",
                         self.name, adx, self.adx_max)
                return
            if ext is not None and ext >= self.ext_atr_max:
                log.info("[%s] SKIP — index stretched %.1f ATR from MA ≥ %.1f (breakout risk)",
                         self.name, ext, self.ext_atr_max)
                return
            legs = self._build_legs(opts, self._weekly_expiry(opts), spot)
            if not legs:
                return
            ltps = self._ltps([lg["ts"] for lg in legs])
            cost = self._net_cost(legs, ltps)
            if cost is None or cost >= 0:        # must be a net credit (cost < 0)
                return
            credit = -cost                        # positive premium collected (points)
            if credit <= 0:
                return
            expiry = self._weekly_expiry(opts)
            self.positions[expiry.isoformat()] = {
                "legs": legs, "credit": round(credit, 2), "expiry": expiry.isoformat(),
                "spot_at_entry": round(spot, 2), "regime": _pe.CURRENT_REGIME}
            log.info("[%s] ENTER %s %s credit=%.2f x%d (lot %d) legs=%s regime=%s",
                     self.name, self.underlying, expiry.isoformat(), credit, self.lots, self.lot,
                     "/".join(f"{l['type']}{l['strike']}{'+' if l['sign']>0 else '-'}" for l in legs),
                     _pe.CURRENT_REGIME)
        except Exception:
            log.exception("[%s] cycle error (options) — skipped, harness unaffected", self.name)

    def _exit(self, key, pnl_pts, reason):
        pos = self.positions.pop(key)
        pnl = pnl_pts * self.lot * self.lots
        self.realised += pnl
        log.info("[%s] EXIT  %s qty=%d @%.2f pnl=%+.0f (%s) regime=%s",
                 self.name, self.underlying, self.lot * self.lots, pos.get("credit", 0), pnl, reason,
                 pos.get("regime", "—"))

    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "positions": self.positions,
                "openMark": round(self.open_mark, 2)}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.positions = s.get("positions", {})
