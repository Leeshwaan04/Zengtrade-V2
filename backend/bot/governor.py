"""Portfolio Risk Governor — the control layer EVERY trade passes through.

It does NOT generate trades. Bots propose an entry; the Governor validates it against
PORTFOLIO-level limits and approves / scales / rejects it, recording the reason:

  • Symbol concentration   — no single name dominates the book
  • Sector concentration   — no single sector dominates (the "5 banks = one trade" trap)
  • Total exposure         — gross book vs the governed capital
  • Drawdown kill-switch    — tiered: reduce → half → pause → emergency-stop (global)
  • Trade audit             — every approve/reject is logged with a human reason

Bots propose; the Governor disposes. No exceptions. Capital-agnostic concentration
(measured as % of the live book) + a realised-P&L drawdown guardian on the governed pool.
State is persisted so the dashboard (a separate process) can render the Risk tab.
"""
from __future__ import annotations

import json
import os
from datetime import datetime

_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_FILE = os.path.join(_REPO, "governor_state.json")

# sector map for the paper universe (extend as the universe grows)
SECTOR = {
    "RELIANCE": "Energy", "ADANIENT": "Energy", "TCS": "IT", "INFY": "IT", "WIPRO": "IT",
    "HDFCBANK": "Banks", "ICICIBANK": "Banks", "SBIN": "Banks", "AXISBANK": "Banks",
    "TATASTEEL": "Metals", "JSWSTEEL": "Metals", "HINDALCO": "Metals",
    "LT": "Infra", "MARUTI": "Auto",
}

# portfolio limits (concentration as % of the live book; exposure as % of governed capital)
MAX_SYMBOL_PCT = 18.0        # tightened 25→18: no single name dominates (concentration = tail risk)
MAX_SECTOR_PCT = 35.0
MAX_TOTAL_PCT = 150.0
MAX_BOTS_PER_SYMBOL = 2      # at most N distinct bots may crowd the SAME name (correlation cap)
# drawdown tiers on realised P&L vs governed capital → (threshold %, mode, size multiplier)
DD_TIERS = [(8.0, "emergency", 0.0), (6.0, "pause", 0.0), (4.0, "half", 0.5), (2.0, "reduce", 0.75)]


def sector_of(sym: str) -> str:
    return SECTOR.get(sym, "Other")


class RiskGovernor:
    def __init__(self, capital: float = 1_000_000.0):
        self.capital = capital
        self.peak = capital
        self.realised = 0.0
        self.mode = "normal"           # normal | reduce | half | pause | emergency
        self.size_mult = 1.0
        self.by_sym: dict[str, float] = {}
        self.by_sector: dict[str, float] = {}
        self.bots_by_sym: dict[str, set] = {}   # distinct bots holding each name (correlation cap)
        self.total = 0.0
        self.audit: list[dict] = []     # recent approve/reject decisions

    # ---- the harness refreshes the book + drawdown at the start of every cycle ----
    def set_book(self, positions: list[dict], realised: float, capital: float | None = None) -> None:
        if capital:
            self.capital = capital
        self.realised = realised
        equity = self.capital + realised
        self.peak = max(self.peak, equity)
        self.by_sym, self.by_sector, self.total = {}, {}, 0.0
        self.bots_by_sym = {}
        for p in positions:
            v = float(p.get("value") or 0)
            sym = p.get("sym", "?")
            self.by_sym[sym] = self.by_sym.get(sym, 0.0) + v
            self.by_sector[sector_of(sym)] = self.by_sector.get(sector_of(sym), 0.0) + v
            self.total += v
            bot = p.get("bot")
            if bot:
                self.bots_by_sym.setdefault(sym, set()).add(bot)
        # drawdown tier → mode + size multiplier (the global kill-switch)
        dd = (self.peak - equity) / self.peak * 100 if self.peak > 0 else 0.0
        self.dd = round(dd, 2)
        self.mode, self.size_mult = "normal", 1.0
        for thr, mode, mult in DD_TIERS:
            if dd >= thr:
                self.mode, self.size_mult = mode, mult
                break

    def review(self, bot: str, sym: str, value: float) -> dict:
        """Approve / scale / reject one proposed entry (value = qty×price). Records the reason."""
        sec = sector_of(sym)
        # 1) global kill-switch
        if self.mode in ("pause", "emergency"):
            return self._decide(bot, sym, False, 0.0, f"KILL-SWITCH: {self.mode} ({self.dd:.1f}% drawdown)")
        scale = self.size_mult
        v = value * scale
        proj = self.total + v
        cap = self.capital or 1
        # concentration is measured as % of CAPITAL (cash+invested) — not % of the current book,
        # so the very first position isn't trivially "100% of a one-position book".
        # 2) symbol concentration
        if v > 0 and (self.by_sym.get(sym, 0) + v) / cap * 100 > MAX_SYMBOL_PCT:
            pct = (self.by_sym.get(sym, 0) + v) / cap * 100
            return self._decide(bot, sym, False, scale, f"symbol concentration {sym} {pct:.0f}% > {MAX_SYMBOL_PCT:.0f}% of capital")
        # 2b) crowding cap — too many DISTINCT bots on the same name = one correlated bet in disguise
        held = self.bots_by_sym.get(sym, set())
        if v > 0 and bot not in held and len(held) >= MAX_BOTS_PER_SYMBOL:
            return self._decide(bot, sym, False, scale,
                                f"crowding {sym}: {len(held)} bots already hold it (max {MAX_BOTS_PER_SYMBOL})")
        # 3) sector concentration
        if v > 0 and (self.by_sector.get(sec, 0) + v) / cap * 100 > MAX_SECTOR_PCT:
            pct = (self.by_sector.get(sec, 0) + v) / cap * 100
            return self._decide(bot, sym, False, scale, f"sector concentration {sec} {pct:.0f}% > {MAX_SECTOR_PCT:.0f}% of capital")
        # 4) total exposure
        if proj / cap * 100 > MAX_TOTAL_PCT:
            return self._decide(bot, sym, False, scale, f"total exposure {proj/cap*100:.0f}% > {MAX_TOTAL_PCT:.0f}%")
        # approved → add to the running book so later proposals THIS cycle see it
        self.by_sym[sym] = self.by_sym.get(sym, 0) + v
        self.by_sector[sec] = self.by_sector.get(sec, 0) + v
        self.bots_by_sym.setdefault(sym, set()).add(bot)
        self.total += v
        note = "approved" if scale >= 1.0 else f"approved · scaled to {scale:.0%} ({self.mode} mode)"
        return self._decide(bot, sym, True, scale, note)

    def _decide(self, bot, sym, approved, scale, reason) -> dict:
        rec = {"ts": datetime.now().isoformat(), "bot": bot, "symbol": sym, "sector": sector_of(sym),
               "approved": approved, "scale": round(scale, 2), "reason": reason}
        self.audit.append(rec)
        self.audit = self.audit[-200:]
        return rec

    def health(self) -> dict:
        equity = self.capital + self.realised
        cap = self.capital or 1
        top_sym = max(self.by_sym.items(), key=lambda kv: kv[1], default=(None, 0))
        top_sec = max(self.by_sector.items(), key=lambda kv: kv[1], default=(None, 0))
        sym_pct = top_sym[1] / cap * 100      # concentration as % of CAPITAL (consistent with the caps)
        sec_pct = top_sec[1] / cap * 100
        expo_pct = self.total / cap * 100
        nsec = len([s for s, v in self.by_sector.items() if v > 0])
        # composite health 0-100: penalise concentration, exposure, drawdown; reward diversification
        score = 100
        score -= max(0, sym_pct - MAX_SYMBOL_PCT) * 1.5
        score -= max(0, sec_pct - MAX_SECTOR_PCT) * 1.2
        score -= max(0, expo_pct - 100) * 0.4
        score -= self.dd * 3
        score -= max(0, 3 - nsec) * 6
        score = int(max(0, min(100, score)))
        return {"score": score, "mode": self.mode, "sizeMult": self.size_mult,
                "killSwitch": self.mode in ("pause", "emergency"),
                "drawdownPct": self.dd, "exposurePct": round(expo_pct, 1),
                "totalBook": round(self.total, 0), "capital": self.capital, "equity": round(equity, 0),
                "topSymbol": {"sym": top_sym[0], "pct": round(sym_pct, 1)},
                "topSector": {"sector": top_sec[0], "pct": round(sec_pct, 1)},
                "sectors": {s: round(v / cap * 100, 1) for s, v in sorted(self.by_sector.items(), key=lambda kv: -kv[1]) if v > 0},
                "symbols": {s: round(v / cap * 100, 1) for s, v in sorted(self.by_sym.items(), key=lambda kv: -kv[1]) if v > 0},
                "crowding": {s: len(b) for s, b in sorted(self.bots_by_sym.items(), key=lambda kv: -len(kv[1])) if len(b) > 1},
                "limits": {"symbol": MAX_SYMBOL_PCT, "sector": MAX_SECTOR_PCT, "total": MAX_TOTAL_PCT, "botsPerSymbol": MAX_BOTS_PER_SYMBOL},
                "ddTiers": [{"at": t, "mode": m} for t, m, _ in DD_TIERS]}

    def persist(self) -> None:
        try:
            d = self.health()
            d["audit"] = self.audit[-40:][::-1]
            d["updated"] = datetime.now().isoformat()
            json.dump(d, open(STATE_FILE, "w"), indent=2, default=str)
        except Exception:
            pass


GOVERNOR = RiskGovernor()
