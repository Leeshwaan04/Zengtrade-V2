"""Crypto OPTIONS forward-paper engine (Binance European options, USDT-settled, public data).

Binance options settle in USDT (unlike Deribit's inverse/BTC settlement), so the P&L is clean
and directly comparable to the rest of the crypto book. This is the crypto analog of the Indian
premium-selling desk (iron_condor / strangle):

  'strangle' : SHORT an OTM call + an OTM put on the nearest weekly expiry — collect premium,
               win if price stays between the strikes.
  'condor'   : same, plus BOUGHT wings → defined risk (a short iron condor).

Short gamma dies in a runaway move, so entry is REGIME-GATED (skip in High-Vol / strong trend —
the same survival-first rule as the Indian desk). Managed to a take-profit fraction of the credit,
a stop at a multiple of the credit, or expiry (settled at intrinsic vs the index).

State mirrors the Indian OptionsPaperEngine ({realised, positions, openMark}) so forward accuracy
+ the dashboard work unchanged. Prices are REAL Binance option marks; fills are simulated (paper).
EVERY cycle is fully wrapped — an options engine can NEVER crash the harness.
"""
from __future__ import annotations

import datetime as _dt
import logging
import time as _time

import requests

from . import paper_engine as _pe

log = logging.getLogger("crypto")

EAPI = ["https://eapi.binance.com"]
_HDRS = {"User-Agent": "tradepro-paper/1.0"}
# regimes where selling premium is too dangerous (short gamma into a directional / vol shock)
_SKIP_REGIMES = {"High-Vol"}

# module-level shared caches (all options engines share one exchangeInfo + one mark snapshot/cycle)
_INFO: tuple | None = None
_MARKS: tuple | None = None


def _eget(path: str, params: dict | None = None, timeout: float = 8.0):
    last = None
    for base in EAPI:
        try:
            r = requests.get(f"{base}{path}", params=params or {}, headers=_HDRS, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            last = f"HTTP {r.status_code}"
        except Exception as e:
            last = e
    log.debug("eapi GET %s failed: %s", path, last)
    return None


def _option_symbols():
    global _INFO
    if _INFO and (_time.time() - _INFO[0]) < 3600:
        return _INFO[1]
    d = _eget("/eapi/v1/exchangeInfo")
    syms = (d or {}).get("optionSymbols", []) if isinstance(d, dict) else []
    if syms:
        _INFO = (_time.time(), syms)
    return _INFO[1] if _INFO else []


def _marks():
    global _MARKS
    if _MARKS and (_time.time() - _MARKS[0]) < 60:
        return _MARKS[1]
    d = _eget("/eapi/v1/mark")
    out = {}
    if isinstance(d, list):
        for m in d:
            try:
                out[m["symbol"]] = float(m["markPrice"])
            except Exception:
                continue
    if out:
        _MARKS = (_time.time(), out)
    return _MARKS[1] if _MARKS else {}


class CryptoOptionsEngine:
    def __init__(self, name, kind, underlying="BTCUSDT", capital=500_000.0,
                 short_pct=0.06, wing_pct=0.04, take_profit=0.5, stop_mult=2.0,
                 alloc_pct=0.06, min_dte=2):
        self.name = name
        self.kind = kind                    # 'strangle' | 'condor'
        self.underlying = underlying
        self.base = underlying.replace("USDT", "")   # eapi symbols use the base (BTC, ETH…)
        self.capital = capital
        self.short_pct = short_pct          # short strikes ~this far OTM
        self.wing_pct = wing_pct            # condor wing width (fraction of spot)
        self.take_profit = take_profit
        self.stop_mult = stop_mult
        self.alloc_pct = alloc_pct
        self.min_dte = min_dte
        self.interval = "day"
        self.history_days = 5
        self.min_bars = 0
        self.positions: dict[str, dict] = {}
        self.realised = 0.0
        self.open_mark = 0.0

    # ---- chain helpers (defensive) ----
    def _index(self):
        d = _eget("/eapi/v1/index", {"underlying": self.underlying})
        try:
            return float(d["indexPrice"])
        except Exception:
            return None

    def _chain(self):
        return [s for s in _option_symbols() if s.get("underlying") == self.underlying]

    def _nearest_expiry(self, chain):
        today = _dt.datetime.now(_dt.timezone.utc).date()   # expiries are UTC ms — compare in UTC
        exps = sorted({int(s["expiryDate"]) for s in chain if s.get("expiryDate")})
        for e in exps:
            d = _dt.datetime.utcfromtimestamp(e / 1000).date()
            if (d - today).days >= self.min_dte:
                return e
        return exps[-1] if exps else None

    def _pick(self, chain, expiry, target_strike, side):
        cands = [s for s in chain if int(s["expiryDate"]) == expiry and s.get("side") == side]
        if not cands:
            return None
        return min(cands, key=lambda s: abs(float(s["strikePrice"]) - target_strike))

    def _contracts(self, spot):
        return max(1, int(round(self.capital * self.alloc_pct / spot))) if spot else 0

    def _build_legs(self, chain, expiry, spot):
        sc = self._pick(chain, expiry, spot * (1 + self.short_pct), "CALL")
        sp = self._pick(chain, expiry, spot * (1 - self.short_pct), "PUT")
        if not sc or not sp:
            return None
        legs = [{"sym": sc["symbol"], "type": "CALL", "strike": float(sc["strikePrice"]), "sign": -1},
                {"sym": sp["symbol"], "type": "PUT", "strike": float(sp["strikePrice"]), "sign": -1}]
        if self.kind == "condor":
            lc = self._pick(chain, expiry, spot * (1 + self.short_pct + self.wing_pct), "CALL")
            lp = self._pick(chain, expiry, spot * (1 - self.short_pct - self.wing_pct), "PUT")
            if not lc or not lp:
                return None
            legs += [{"sym": lc["symbol"], "type": "CALL", "strike": float(lc["strikePrice"]), "sign": +1},
                     {"sym": lp["symbol"], "type": "PUT", "strike": float(lp["strikePrice"]), "sign": +1}]
        return legs

    def _net_cost(self, legs, marks):
        """Cost to hold the structure now (negative = net short premium = a credit)."""
        cost = 0.0
        for lg in legs:
            px = marks.get(lg["sym"])
            if px is None:
                return None
            cost += lg["sign"] * px
        return cost

    def _intrinsic(self, legs, spot):
        cost = 0.0
        for lg in legs:
            intr = max(0.0, spot - lg["strike"]) if lg["type"] == "CALL" else max(0.0, lg["strike"] - spot)
            cost += lg["sign"] * intr
        return cost

    def _label(self, legs, contracts):
        shorts = [lg for lg in legs if lg["sign"] < 0]
        p = next((l["strike"] for l in shorts if l["type"] == "PUT"), 0)
        c = next((l["strike"] for l in shorts if l["type"] == "CALL"), 0)
        return f"{self.base} {int(p)}P/{int(c)}C ×{contracts}"

    # ---- cycle (fully guarded) ----
    def run_cycle(self, square_off: bool = False) -> None:
        try:
            chain = self._chain()
            spot = self._index()
            marks = _marks()
            if not chain or not spot or not marks:
                return
            # manage / exit / mark existing structure
            today_utc = _dt.datetime.now(_dt.timezone.utc).date()
            for key in list(self.positions):
                pos = self.positions[key]
                contracts = pos["contracts"]
                expired = _dt.datetime.utcfromtimestamp(int(pos["expiry"]) / 1000).date() <= today_utc
                if expired:
                    # expired-symbol marks are stale/absent — settle at INTRINSIC vs the index, always
                    pnl = (pos["credit"] + self._intrinsic(pos["legs"], spot)) * contracts
                    self._exit(key, pnl, "expiry-settle")
                    continue
                cost = self._net_cost(pos["legs"], marks)
                if cost is None:
                    continue                              # can't mark a LIVE structure this cycle — leave it
                pnl_pts = pos["credit"] + cost            # credit + (negative) cost = profit as premium decays
                self.open_mark = round(pnl_pts * contracts, 2)
                hit_tp = pnl_pts >= self.take_profit * pos["credit"]
                hit_sl = pnl_pts <= -self.stop_mult * pos["credit"]
                if square_off or hit_tp or hit_sl:
                    reason = "square-off" if square_off else "target" if hit_tp else "stop"
                    self._exit(key, pnl_pts * contracts, reason)
            # mark any still-open structure (self-marker) then decide on a new one
            if self.positions:
                mk = 0.0
                for pos in self.positions.values():
                    c = self._net_cost(pos["legs"], marks)
                    if c is not None:
                        mk += (pos["credit"] + c) * pos["contracts"]
                self.open_mark = round(mk, 2)
                return
            if square_off:
                self.open_mark = 0.0
                return
            # ---- entry: regime-gated (never sell premium into a vol shock / strong trend) ----
            if _pe.CURRENT_REGIME in _SKIP_REGIMES:
                log.info("[%s] SKIP — regime %s (won't sell premium into it)", self.name, _pe.CURRENT_REGIME)
                return
            expiry = self._nearest_expiry(chain)
            if not expiry:
                return
            legs = self._build_legs(chain, expiry, spot)
            if not legs:
                return
            cost = self._net_cost(legs, marks)
            if cost is None or cost >= 0:        # must be a net credit
                return
            credit = -cost
            contracts = self._contracts(spot)
            if credit <= 0 or contracts < 1:
                return
            self.positions[str(expiry)] = {"legs": legs, "credit": round(credit, 2),
                                           "expiry": expiry, "contracts": contracts,
                                           "label": self._label(legs, contracts),
                                           "regime": _pe.CURRENT_REGIME}
            self.open_mark = 0.0
            log.info("[%s] ENTER %s %s credit=%.2f x%d legs=%s regime=%s", self.name, self.underlying,
                     self.kind, credit, contracts,
                     "/".join(f"{l['type'][0]}{int(l['strike'])}{'+' if l['sign']>0 else '-'}" for l in legs),
                     _pe.CURRENT_REGIME)
        except Exception:
            log.exception("[%s] cycle error (crypto options) — skipped, harness unaffected", self.name)

    def _exit(self, key, pnl, reason):
        pos = self.positions.pop(key)
        self.realised += pnl
        self.open_mark = 0.0
        log.info("[%s] EXIT  %s %s pnl=%+.0f (%s) regime=%s", self.name, self.underlying,
                 pos.get("label", ""), pnl, reason, pos.get("regime", "—"))

    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "positions": self.positions,
                "openMark": round(self.open_mark, 2)}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.positions = s.get("positions", {})
        self.open_mark = s.get("openMark", 0.0)
