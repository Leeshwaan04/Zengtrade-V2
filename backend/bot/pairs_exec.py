"""Live/paper 2-leg stat-arb executor for the run_bot.py live runner.

PairsPaperEngine (paper_engine.py) only *simulates* the spread P&L. This engine
additionally ROUTES BOTH LEGS through the Broker abstraction, so the same code path
paper-trades (PaperBroker) or places REAL orders (KiteBroker) depending solely on the
two-key safety gate in run_bot.py.

Why P&L is tracked internally rather than read from the broker: a market-neutral pair
holds one long + one SHORT leg, and a naked short is not a single trackable position in
the PaperBroker. So this engine owns the spread bookkeeping (entry/exit prices × qty ×
side) and uses the broker purely to place the four orders (2 in, 2 out). In live mode
those internal marks reconcile against kite.positions().

Default product is MIS (intraday — the only way to short the *cash* leg, squared off the
same session). For overnight market-neutral pairs, pass stock-futures tradingsymbols and
product='NRML' (requires F&O / stock futures enabled on the account).
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

log = logging.getLogger("pairs")


class PairsExecEngine:
    def __init__(self, pairs, data, broker, capital, product="MIS",
                 window=30, entry_z=2.0, exit_z=0.5, stop_z=4.0):
        self.pairs = pairs
        self.data = data
        self.broker = broker
        self.product = product
        self.cap_per = capital / max(len(pairs), 1)
        self.window, self.entry_z, self.exit_z, self.stop_z = window, entry_z, exit_z, stop_z
        self.state_d: dict[str, dict] = {
            f"{a}/{b}": dict(pos=0, ea=0.0, eb=0.0, qa=0, qb=0) for a, b in pairs}
        self.realised = 0.0
        # expose the open legs as "positions" so the runner's shutdown log/monitor works
        self.positions = self.state_d

    def market_open(self):  # parity with TradingEngine's interface
        from bot.paper_engine import market_open
        return market_open()

    def run_cycle(self, square_off: bool = False) -> None:
        for a, b in self.pairs:
            key = f"{a}/{b}"
            try:
                da = self.data.historical(self.data.token_for(a), "day", 120)
                db = self.data.historical(self.data.token_for(b), "day", 120)
                if da.empty or db.empty:
                    continue
                j = pd.concat([da["close"], db["close"]], axis=1, keys=["a", "b"]).dropna()
                if len(j) < self.window + 2:
                    continue
                spread = np.log(j["a"]) - np.log(j["b"])
                z = (spread - spread.rolling(self.window).mean()) / spread.rolling(self.window).std(ddof=0)
                zi = float(z.iloc[-1]); pa = float(j["a"].iloc[-1]); pb = float(j["b"].iloc[-1])
                if np.isnan(zi):
                    continue
                st = self.state_d[key]
                if st["pos"] == 0 and not square_off:
                    if zi <= -self.entry_z:
                        self._enter(a, b, key, 1, pa, pb, zi)    # long spread: long A / short B
                    elif zi >= self.entry_z:
                        self._enter(a, b, key, -1, pa, pb, zi)   # short spread: short A / long B
                elif st["pos"] != 0 and (square_off or abs(zi) <= self.exit_z or abs(zi) >= self.stop_z):
                    self._exit(a, b, key, pa, pb, zi, "square-off" if square_off else "signal")
            except Exception:
                log.exception("[pairs] error on %s", key)

    def _enter(self, a, b, key, side, pa, pb, zi):
        qa = max(int((self.cap_per / 2) / pa), 1)
        qb = max(int((self.cap_per / 2) / pb), 1)
        if side > 0:                      # long spread → BUY A, SELL B
            self.broker.buy(a, qa, pa, self.product)
            self.broker.sell(b, qb, pb, self.product)
        else:                             # short spread → SELL A, BUY B
            self.broker.sell(a, qa, pa, self.product)
            self.broker.buy(b, qb, pb, self.product)
        self.state_d[key] = dict(pos=side, ea=pa, eb=pb, qa=qa, qb=qb)
        log.info("[pairs] ENTER %s %s z=%.2f  A=%s@%.2f×%d  B=%s@%.2f×%d",
                 key, "long-spread" if side > 0 else "short-spread", zi, a, pa, qa, b, pb, qb)

    def _exit(self, a, b, key, pa, pb, zi, reason):
        st = self.state_d[key]
        side, qa, qb = st["pos"], st["qa"], st["qb"]
        if side > 0:                      # close long A / short B
            self.broker.sell(a, qa, pa, self.product)
            self.broker.buy(b, qb, pb, self.product)
        else:                             # close short A / long B
            self.broker.buy(a, qa, pa, self.product)
            self.broker.sell(b, qb, pb, self.product)
        pnl_a = (pa - st["ea"]) * qa * side       # long-leg P&L (sign flips for short spread)
        pnl_b = (st["eb"] - pb) * qb * side       # short-leg P&L
        pnl = pnl_a + pnl_b
        self.realised += pnl
        log.info("[pairs] EXIT  %s pnl=%+.0f z=%.2f (%s)", key, pnl, zi, reason)
        self.state_d[key] = dict(pos=0, ea=0.0, eb=0.0, qa=0, qb=0)

    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "pairs": self.state_d}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.state_d = s.get("pairs", self.state_d)
        self.positions = self.state_d
