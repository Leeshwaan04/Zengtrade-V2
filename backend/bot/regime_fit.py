"""Strategy × Regime expectancy — learn which strategy actually PROFITS in which market
condition, from the net-of-cost forward log.

The Rebalancer's regime rulebook (REGIME_ENABLED) is a hand-written PRIOR — a sensible guess
at which STYLE suits each regime. This module turns that guess into EVIDENCE: every forward
trade is tagged with the regime it happened in and its net-of-cost P&L, so we can measure each
strategy's real edge PER REGIME and let the live regime deploy only the strategies proven to
win in *these* conditions — benching the ones proven to lose here.

Safety-first design (Bayesian): data OVERRIDES the heuristic only once a (strategy, regime) cell
has a meaningful sample; until then the safe hand-written prior stands. It never chases a lucky
streak, and benching a proven loser is always allowed (removing risk can't hurt).
"""
from __future__ import annotations

import os
import re

MIN_CELL = 10      # trades in a (strategy, regime) cell before its verdict is trusted
FIT_PF = 1.1       # proven-fit needs a real profit-factor margin (not a coin flip)

_EXIT = re.compile(r"\[([\w-]+)\] EXIT")


def _cell_stats(pnls: list[float]) -> dict:
    n = len(pnls)
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    gw, gl = sum(wins), -sum(losses)
    exp = sum(pnls) / n if n else 0.0
    pf = (gw / gl) if gl > 0 else (99.0 if gw > 0 else 0.0)
    if n >= MIN_CELL and exp > 0 and pf >= FIT_PF:
        verdict = "fit"
    elif n >= MIN_CELL and (exp < 0 or pf < 1.0):
        verdict = "unfit"
    else:
        verdict = "gathering"
    return {"n": n, "winPct": round(len(wins) / n * 100, 1) if n else None,
            "pf": round(pf, 2), "expectancy": round(exp, 2), "net": round(sum(pnls), 2),
            "verdict": verdict}


def matrix_from_log(logpath: str) -> dict:
    """{ strategy: { regime: {n, winPct, pf, expectancy, net, verdict} } } from the net-of-cost log."""
    cells: dict[tuple, list] = {}
    if os.path.exists(logpath):
        try:
            with open(logpath) as f:
                for ln in f:
                    if "] EXIT" not in ln or "pnl=" not in ln:
                        continue
                    m = _EXIT.search(ln)
                    if not m:
                        continue
                    try:
                        pnl = float(ln.split("pnl=", 1)[1].split()[0].rstrip(")"))
                    except (ValueError, IndexError):
                        continue
                    reg = "—"
                    if "regime=" in ln:
                        parts = ln.split("regime=", 1)[1].split()
                        if parts:
                            reg = parts[0]
                    cells.setdefault((m.group(1), reg), []).append(pnl)
        except Exception:
            pass
    out: dict = {}
    for (key, reg), pnls in cells.items():
        out.setdefault(key, {})[reg] = _cell_stats(pnls)
    return out


def regime_verdicts(logpath: str, regime: str) -> dict:
    """{strategy: 'fit'|'unfit'|'gathering'} for ONE regime — what the Rebalancer consults live."""
    mat = matrix_from_log(logpath)
    out = {}
    for key, regs in mat.items():
        cell = regs.get(regime)
        if cell:
            out[key] = cell["verdict"]
    return out
