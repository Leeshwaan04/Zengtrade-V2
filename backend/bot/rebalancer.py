"""Strategy Rebalancing Engine — regime-driven capital rotation, capital-preservation first.

Each cycle it decides which strategy STYLES are allowed to take new risk in the current
regime, and stands the rest DOWN TO CASH. The point (and the user's #1 need): avoid losses
by not deploying strategies into regimes where they bleed — e.g. trend/breakout bots are
stood down in Choppy, where they chop. Cash is a deliberate position, not leftovers.

Posture is PRESERVATION by default: when portfolio health is weak, the enabled set shrinks
to the defensive sleeves and cash rises. It NEVER hides a loss — it tries to not take one.
"""
from __future__ import annotations

import json
import os
from datetime import datetime

_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_FILE = os.path.join(_REPO, "rebalance_state.json")

# harness engine name → style
STRATEGY_STYLE = {
    "mean-rev": "Reversion", "momentum": "Trend", "rsi2": "Reversion", "macross": "Trend",
    "supertrend": "Trend", "ema_cross": "Trend", "adx_trend": "Trend", "nr7": "Breakout",
    "bollinger": "Reversion", "zscore": "Reversion", "xs_momentum": "Trend", "lowvol": "Defensive",
    "orb": "Breakout", "vwap_rev": "Reversion", "vwap_mom": "Trend", "ema_scalp": "Trend",
    "bb_breakout": "Breakout", "opportunity": "Decision", "moonshot": "Moonshot",
    "iron_condor": "Carry", "strangle": "Carry", "pairs": "Relative-value",
    # Wave-5 active intraday equity bots
    "st_intraday": "Trend", "vwap_pull": "Trend", "open_drive": "Trend",
    "relvol_brk": "Breakout", "rsi_intraday": "Reversion",
    "fut_trend": "Trend", "basis": "Carry",
}

# styles allowed to take NEW risk per regime (capital-preservation tuned).
# Decision/Moonshot self-gate on conviction, so they're allowed broadly but trade little in chop.
REGIME_ENABLED = {
    "Bull":     {"Trend", "Breakout", "Carry", "Decision", "Moonshot", "Relative-value", "Defensive"},
    "Bear":     {"Defensive", "Relative-value", "Reversion"},
    "Choppy":   {"Reversion", "Relative-value", "Carry", "Decision", "Moonshot", "Defensive"},
    "High-Vol": {"Reversion", "Defensive", "Relative-value"},
}
BASE_CASH = {"Bull": 10, "Choppy": 40, "Bear": 60, "High-Vol": 55}
# conviction floor the meta-engines should demand per regime (harder evidence in worse tape)
CONVICTION_FLOOR = {"Bull": 70, "Choppy": 80, "Bear": 82, "High-Vol": 85}
SAFE_STYLES = {"Defensive", "Relative-value"}

# CRYPTO has NO defensive LONG — a low-volatility crypto basket is still 100% long crypto and falls
# with the market in a bear. The "Defensive" label is equity logic; here it caused lowvol (−$20.5k,
# our biggest loss) to keep trading through the bear. Reclassify the long-only crypto baskets as
# directional so they stand down in a crypto bear like every other long.
CRYPTO_STYLE = {
    "lowvol": "Trend", "xs_momentum": "Trend",                       # long baskets = directional → stand down in bear
    "cx_strangle": "Carry", "cx_strangle_eth": "Carry", "cx_condor": "Carry",  # short-premium → the bear survivors, keep on
    "perp_funding": "Carry", "perp_funding_eth": "Carry",            # funding carry = market-neutral-ish → keep on
    "perp_trend": "Trend", "perp_trend_eth": "Trend",                # directional perps → stand down in bear
}


class Rebalancer:
    def __init__(self, preservation: bool = True):
        self.preservation = preservation
        self.market = "indian"      # the crypto harness sets this to "crypto" for crypto-specific gating
        self.regime = "Bull"
        self.health = 100
        self.enabled: set = set(REGIME_ENABLED["Bull"])
        self.cash_pct = 10
        self.note = ""
        self.culled: set = set()      # strategies auto-benched for negative expectancy over a real sample
        self.regime_fit: dict = {}    # {strategy: 'fit'|'unfit'|'gathering'} for the CURRENT regime (data-driven)

    def set(self, regime: str, health: float) -> None:
        self.regime = regime or "Bull"
        self.health = health if health is not None else 100
        enabled = set(REGIME_ENABLED.get(self.regime, REGIME_ENABLED["Bull"]))
        cash = BASE_CASH.get(self.regime, 20)
        # capital preservation: weak portfolio health → shrink to the safe sleeves, raise cash
        if self.health < 40:
            enabled &= SAFE_STYLES
            cash = max(cash, 75)
            self.note = f"preservation — health {self.health}: defensive sleeves only, {cash}% cash"
        elif self.health < 60:
            cash = max(cash, 45)
            self.note = f"cautious — health {self.health}: trimmed risk, {cash}% cash"
        else:
            self.note = f"{self.regime} regime: {', '.join(sorted(enabled))}"
        if self.market == "crypto" and self.regime in ("Bear", "High-Vol"):
            # crypto has no safe long — go to CASH; only market-neutral (pairs) + short-premium survive.
            # SET (not intersect): Carry isn't in the equity Bear base set, so an intersect would drop it.
            enabled = {"Relative-value", "Carry"}
            self.note = f"crypto {self.regime} — cash; only market-neutral + short-premium"
        elif self.preservation and self.regime in ("Bear", "High-Vol"):
            enabled &= (SAFE_STYLES | {"Reversion"})    # extra-defensive in the worst regimes (equity)
        self.enabled = enabled
        self.cash_pct = cash

    def set_culled(self, names) -> None:
        """Bench a set of strategies (negative expectancy over a meaningful sample) — they take
        NO new risk until they earn their place back. Managing existing positions is unaffected."""
        self.culled = set(names or [])

    def set_regime_fit(self, fit: dict) -> None:
        """Feed the data-driven per-regime verdicts for the CURRENT regime (from regime_fit)."""
        self.regime_fit = dict(fit or {})

    def _style(self, name: str) -> str:
        """Gating style — crypto overrides the equity-style label (no defensive long in crypto)."""
        if self.market == "crypto" and name in CRYPTO_STYLE:
            return CRYPTO_STYLE[name]
        return STRATEGY_STYLE.get(name, "Trend")

    def allows(self, name: str) -> bool:
        if name in self.culled:
            return False                       # auto-culled overall → stand down
        fit = self.regime_fit.get(name)
        if fit == "unfit":
            return False                       # PROVEN to lose in THIS regime → bench it here
        if fit == "fit":
            return True                        # PROVEN to win in THIS regime → deploy (override the prior)
        return self._style(name) in self.enabled   # no evidence yet → safe heuristic prior

    def conviction_floor(self) -> float:
        base = CONVICTION_FLOOR.get(self.regime, 75)
        return base + (8 if self.health < 50 else 0)     # demand even more when health is weak

    def plan(self, names: list[str]) -> dict:
        enabled, stood = [], []
        for n in names:
            (enabled if self.allows(n) else stood).append({"name": n, "style": self._style(n)})
        return {"regime": self.regime, "health": self.health, "cashPct": self.cash_pct,
                "preservation": self.preservation, "convictionFloor": self.conviction_floor(),
                "enabledStyles": sorted(self.enabled), "note": self.note,
                "enabled": enabled, "stoodDown": stood, "culled": sorted(self.culled),
                "regimeFit": dict(self.regime_fit)}

    def persist(self, names: list[str]) -> None:
        try:
            d = self.plan(names); d["updated"] = datetime.now().isoformat(); d["real"] = True
            json.dump(d, open(STATE_FILE, "w"), indent=2, default=str)
        except Exception:
            pass


REBALANCER = Rebalancer(preservation=True)
