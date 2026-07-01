"""Capital Allocation Engine — opportunity competition + capital allocation.

The separation principle: strategies generate PROPOSALS (an idea + its expected value,
risk and conviction). They do NOT decide to trade. The Allocator collects every proposal,
ranks them by expected value · diversification benefit · regime fit, then funds the best
set that fits the portfolio budget AND clears the Risk Governor — sizing each by conviction.
Proposals that don't get capital are recorded with the reason (outranked / budget exhausted
/ governor veto), so the competition is fully auditable.

Bots propose · the Governor constrains · the Allocator decides who gets capital.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime

from .governor import GOVERNOR, sector_of

_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOC_FILE = os.path.join(_REPO, "allocation_state.json")


@dataclass
class Proposal:
    bot: str
    symbol: str
    price: float
    confidence: float
    exp_return: float = 0.0       # estimated favourable move %
    risk: float = 0.0             # 0-100 (higher = riskier)
    atr: float = 0.0
    reasons: list = field(default_factory=list)
    regime: str = ""


def alloc_pct(conf: float) -> float:
    """Conviction → fraction of portfolio budget for this single position."""
    if conf >= 90: return 0.30
    if conf >= 85: return 0.22
    if conf >= 80: return 0.16
    if conf >= 75: return 0.11
    if conf >= 70: return 0.07
    return 0.04


def _composite(p: Proposal, sector_load: dict) -> float:
    """Ranking score: conviction + expected value − risk, with a diversification penalty
    for piling into an already-heavy sector (correlation-aware competition)."""
    base = p.confidence + p.exp_return * 4.0 - p.risk * 0.10
    load = sector_load.get(sector_of(p.symbol), 0.0)     # % of book already in this sector
    div_penalty = max(0.0, load - 20.0) * 0.6            # penalise adding to a >20% sector
    return base - div_penalty


class CapitalAllocator:
    """Runs the competition for one book. capital = portfolio budget; it funds the best
    proposals greedily until the budget or position cap is hit, each gated by the Governor."""

    def __init__(self, capital: float, max_positions: int = 6, min_conf: float = 70.0,
                 max_deploy: float = 0.90):
        self.capital = capital
        self.max_positions = max_positions
        self.min_conf = min_conf
        self.max_deploy = max_deploy        # cap total deployed fraction of the budget

    def allocate(self, proposals: list[Proposal], open_count: int = 0) -> dict:
        # health snapshot for the diversification penalty (current book sector loads)
        sector_load = GOVERNOR.health().get("sectors", {})
        # dedup by symbol — if several bots propose the same name it's ONE trade (combine conviction)
        by_sym: dict[str, Proposal] = {}
        backers: dict[str, list] = {}
        for p in proposals:
            if p.confidence < self.min_conf or p.price <= 0:
                continue
            backers.setdefault(p.symbol, []).append(p.bot)
            cur = by_sym.get(p.symbol)
            if cur is None or p.confidence > cur.confidence:
                by_sym[p.symbol] = p
        ranked = sorted(by_sym.values(), key=lambda p: _composite(p, sector_load), reverse=True)

        funded, skipped = [], []
        slots = max(0, self.max_positions - open_count)
        deployed = 0.0
        for p in ranked:
            row = {"bot": p.bot, "symbol": p.symbol, "sector": sector_of(p.symbol),
                   "confidence": round(p.confidence, 1), "expReturn": p.exp_return,
                   "score": round(_composite(p, sector_load), 1), "backers": backers.get(p.symbol, []),
                   "reasons": p.reasons}
            if len(funded) >= slots:
                skipped.append({**row, "reason": "outranked — no open slot"})
                continue
            want = self.capital * alloc_pct(p.confidence)
            if deployed + want > self.capital * self.max_deploy:
                want = self.capital * self.max_deploy - deployed
            if want < p.price:           # can't afford a whole share within budget
                skipped.append({**row, "reason": "budget exhausted"})
                continue
            gd = GOVERNOR.review(p.bot, p.symbol, want)   # the Governor still has the final say
            if not gd["approved"]:
                skipped.append({**row, "reason": f"governor veto — {gd['reason']}"})
                continue
            value = want * gd["scale"]
            qty = int(value // p.price)
            if qty < 1:
                skipped.append({**row, "reason": "size rounds to 0"})
                continue
            deployed += qty * p.price
            funded.append({**row, "qty": qty, "price": p.price, "value": round(qty * p.price, 0),
                           "allocPct": round(qty * p.price / self.capital * 100, 1),
                           "scale": gd["scale"], "atr": p.atr})
        return {"funded": funded, "skipped": skipped, "ranked": len(ranked),
                "deployed": round(deployed, 0), "budget": self.capital}


def persist_competition(result: dict) -> None:
    try:
        result = dict(result)
        result["updated"] = datetime.now().isoformat()
        json.dump(result, open(ALLOC_FILE, "w"), indent=2, default=str)
    except Exception:
        pass
