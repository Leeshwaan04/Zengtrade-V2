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


class Rebalancer:
    def __init__(self, preservation: bool = True):
        self.preservation = preservation
        self.regime = "Bull"
        self.health = 100
        self.enabled: set = set(REGIME_ENABLED["Bull"])
        self.cash_pct = 10
        self.note = ""
        self.culled: set = set()      # strategies auto-benched for negative expectancy over a real sample

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
        if self.preservation and self.regime in ("Bear", "High-Vol"):
            enabled &= (SAFE_STYLES | {"Reversion"})    # extra-defensive in the worst regimes
        self.enabled = enabled
        self.cash_pct = cash

    def set_culled(self, names) -> None:
        """Bench a set of strategies (negative expectancy over a meaningful sample) — they take
        NO new risk until they earn their place back. Managing existing positions is unaffected."""
        self.culled = set(names or [])

    def allows(self, name: str) -> bool:
        if name in self.culled:
            return False           # auto-culled → stand down, no new entries
        return STRATEGY_STYLE.get(name, "Trend") in self.enabled

    def conviction_floor(self) -> float:
        base = CONVICTION_FLOOR.get(self.regime, 75)
        return base + (8 if self.health < 50 else 0)     # demand even more when health is weak

    def plan(self, names: list[str]) -> dict:
        enabled, stood = [], []
        for n in names:
            (enabled if self.allows(n) else stood).append({"name": n, "style": STRATEGY_STYLE.get(n, "?")})
        return {"regime": self.regime, "health": self.health, "cashPct": self.cash_pct,
                "preservation": self.preservation, "convictionFloor": self.conviction_floor(),
                "enabledStyles": sorted(self.enabled), "note": self.note,
                "enabled": enabled, "stoodDown": stood, "culled": sorted(self.culled)}

    def persist(self, names: list[str]) -> None:
        try:
            d = self.plan(names); d["updated"] = datetime.now().isoformat(); d["real"] = True
            json.dump(d, open(STATE_FILE, "w"), indent=2, default=str)
        except Exception:
            pass


REBALANCER = Rebalancer(preservation=True)
