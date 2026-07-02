"""Forward paper-trading engines (no real orders, live Kite data).

  LongOnlyPaperEngine  -> any strategy with compute/_entry_long/_exit_long
                          (mean-reversion, momentum) on a single-stock universe
  PairsPaperEngine     -> simulates the 2-leg spread for stat-arb pairs

Both keep a paper book and expose state() for JSON persistence so a multi-day
forward test survives restarts. This generates fresh, selection-bias-free
out-of-sample evidence — the honest test before risking capital.
"""
from __future__ import annotations

import logging
from datetime import datetime, time

import numpy as np
import pandas as pd

from . import costs
from .governor import GOVERNOR
from .position_intel import assess
from .rebalancer import REBALANCER

log = logging.getLogger("paper")
CURRENT_REGIME = "—"   # set each cycle by the harness from /api/market (the same regime the UI shows)

MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)


def market_open(now: datetime | None = None) -> bool:
    now = now or datetime.now()
    return now.weekday() < 5 and MARKET_OPEN <= now.time() <= MARKET_CLOSE


class LongOnlyPaperEngine:
    def __init__(self, name, strategy, risk, data, symbols, interval, history_days):
        self.name = name
        self.strategy = strategy
        self.risk = risk
        self.data = data
        self.symbols = symbols
        self.interval = interval
        self.history_days = history_days
        self.positions: dict[str, dict] = {}
        self.realised = 0.0
        self.closed_trades = 0
        # cost bucket: intraday (MIS) vs delivery (CNC); the crypto harness overrides to crypto_spot
        self.cost_kind = "equity_mis" if getattr(risk.cfg, "product", "CNC") == "MIS" else "equity_cnc"
        self.min_bars = getattr(strategy.cfg, "trend_period", 200) + 5

    def run_cycle(self, square_off: bool = False) -> None:
        for sym in self.symbols:
            try:
                tok = self.data.token_for(sym)
                df = self.data.historical(tok, self.interval, self.history_days)
                if df.empty or len(df) < self.min_bars:
                    continue
                row = self.strategy.compute(df).iloc[-1]
                price = float(row["close"])
                atr = float(row.get("atr") or 0)

                if sym in self.positions:
                    pos = self.positions[sym]
                    if square_off:
                        self._exit(sym, price, "square-off"); continue
                    # ---- Position Intelligence: live thesis health + dynamic profit protection ----
                    pi = assess(sym, pos, df, CURRENT_REGIME)
                    pos["stop"] = max(pos.get("stop", 0) or 0, pi["newStop"])      # ratchet protective stop
                    pos["health"] = pi["health"]; pos["action"] = pi["action"]; pos["reason"] = pi["reason"]
                    pos["weak"] = pi["weak"]; pos["gainPct"] = pi["gainPct"]
                    if pi["action"] == "exit":
                        self._exit(sym, price, "thesis-decay"); continue
                    if pos["stop"] and price <= pos["stop"]:
                        self._exit(sym, price, "stop"); continue
                    if pos["target"] and price >= pos["target"]:
                        self._exit(sym, price, "target"); continue
                    if self.strategy._exit_long(row):
                        self._exit(sym, price, "signal")
                elif (not square_off and REBALANCER.allows(self.name) and self.strategy._entry_long(row)
                      and len(self.positions) < self.risk.cfg.max_positions and atr > 0):
                    stop, target = self.risk.stop_and_target(price, atr)
                    qty = self.risk.position_size(self.risk.cfg.capital, price, stop)
                    if qty > 0:
                        gd = GOVERNOR.review(self.name, sym, qty * price)   # every trade through the Governor
                        if not gd["approved"]:
                            log.info("[%s] VETO %s — %s", self.name, sym, gd["reason"]); continue
                        qty = int(qty * gd["scale"])
                        if qty < 1:
                            continue
                        self.positions[sym] = dict(qty=qty, entry=price, stop=stop, target=target, regime=CURRENT_REGIME)
                        log.info("[%s] ENTER %s qty=%d @%.2f stop=%.2f target=%.2f",
                                 self.name, sym, qty, price, stop, target)
            except Exception:
                log.exception("[%s] error on %s", self.name, sym)

    def _exit(self, sym, price, reason):
        pos = self.positions.pop(sym)
        cost = costs.notional_cost(pos["entry"], price, pos["qty"], self.cost_kind)   # honest friction
        pnl = (price - pos["entry"]) * pos["qty"] - cost
        self.realised += pnl
        self.closed_trades += 1
        log.info("[%s] EXIT  %s qty=%d @%.2f pnl=%+.0f (%s) cost=%.0f regime=%s",
                 self.name, sym, pos["qty"], price, pnl, reason, cost, pos.get("regime", "—"))

    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "positions": self.positions,
                "closed": self.closed_trades}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.positions = s.get("positions", {})
        self.closed_trades = s.get("closed", 0)


class PairsPaperEngine:
    def __init__(self, pairs, data, capital, window=30, entry_z=2.0,
                 exit_z=0.5, stop_z=4.0, cost_bps=15.0):
        self.pairs = pairs
        self.data = data
        self.cap_per = capital / max(len(pairs), 1)
        self.window, self.entry_z, self.exit_z, self.stop_z = window, entry_z, exit_z, stop_z
        self.cost_bps = cost_bps
        self.state_d: dict[str, dict] = {f"{a}/{b}": dict(pos=0, ea=0.0, eb=0.0) for a, b in pairs}
        self.realised = 0.0

    def run_cycle(self) -> None:
        for a, b in self.pairs:
            key = f"{a}/{b}"
            try:
                da = self.data.historical(self.data.token_for(a), "day", 120)
                db = self.data.historical(self.data.token_for(b), "day", 120)
                if da.empty or db.empty:
                    continue
                j = pd.concat([da["close"], db["close"]], axis=1, keys=["a", "b"]).dropna()
                spread = np.log(j["a"]) - np.log(j["b"])
                z = (spread - spread.rolling(self.window).mean()) / spread.rolling(self.window).std(ddof=0)
                zi = float(z.iloc[-1]); pa = float(j["a"].iloc[-1]); pb = float(j["b"].iloc[-1])
                if np.isnan(zi):
                    continue
                st = self.state_d[key]
                if st["pos"] == 0:
                    if zi <= -self.entry_z:
                        self._enter(key, 1, pa, pb, zi)
                    elif zi >= self.entry_z:
                        self._enter(key, -1, pa, pb, zi)
                elif abs(zi) <= self.exit_z or abs(zi) >= self.stop_z:
                    self._exit(key, pa, pb, zi)
            except Exception:
                log.exception("[pairs] error on %s", key)

    def _enter(self, key, side, pa, pb, zi):
        self.state_d[key] = dict(pos=side, ea=pa, eb=pb)
        log.info("[pairs] ENTER %s %s zA=%.2f (A=%.2f B=%.2f)",
                 key, "long-spread" if side > 0 else "short-spread", zi, pa, pb)

    def _exit(self, key, pa, pb, zi):
        st = self.state_d[key]
        ret_a = pa / st["ea"] - 1
        ret_b = pb / st["eb"] - 1
        gross = self.cap_per * st["pos"] * (ret_a - ret_b) / 2
        cost = self.cap_per * self.cost_bps / 10_000 * 2
        pnl = gross - cost
        self.realised += pnl
        log.info("[pairs] EXIT  %s pnl=%+.0f z=%.2f regime=%s", key, pnl, zi, CURRENT_REGIME)
        self.state_d[key] = dict(pos=0, ea=0.0, eb=0.0)

    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "pairs": self.state_d}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.state_d = s.get("pairs", self.state_d)
