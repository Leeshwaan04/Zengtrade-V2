"""Learning Engine — improves the Opportunity-score weights from the REAL decision log.

It reads completed (entry→exit) paper trades, measures which confirmation signals
actually preceded profitable outcomes, and nudges each signal's weight toward what the
evidence says. Honest by construction:

  • needs a MINIMUM sample before it changes anything (no overfitting to a few trades),
  • each signal's weight is SHRUNK toward its prior by that signal's sample size,
  • learned weights are RENORMALISED to the prior total, so the 0-100 score and the
    execute/watch bands stay stable — learning shifts *relative* importance, not the scale,
  • it is descriptive ("these signals have paid so far"), applied forward cautiously.

No prediction, no magic — just evidence-weighted scoring that updates as the book grows.
"""
from __future__ import annotations

import json
import os
from datetime import datetime

_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECISIONS_FILE = os.path.join(_REPO, "decisions.jsonl")
WEIGHTS_FILE = os.path.join(_REPO, "learned_weights.json")

MIN_TRADES = 15     # total closed trades before ANY learning is applied
MIN_PER = 6         # per-signal closed trades before that signal's weight is allowed to move
FULL_CONF_N = 40    # sample size at which the learned value is fully trusted (shrinkage anchor)


def load_decisions() -> list[dict]:
    recs = []
    if os.path.exists(DECISIONS_FILE):
        try:
            with open(DECISIONS_FILE) as f:
                for ln in f:
                    try:
                        recs.append(json.loads(ln))
                    except Exception:
                        pass
        except Exception:
            pass
    return recs


def completed_trades(decisions: list[dict]) -> list[dict]:
    """Pair ENTERs with their EXITs (FIFO per bot+symbol) → closed trades carrying the
    confirmation components present AT ENTRY, the regime, confidence, and realised return%."""
    open_by: dict = {}
    trades = []
    for r in decisions:
        key = (r.get("bot"), r.get("symbol"))
        if r.get("action") == "ENTER":
            open_by.setdefault(key, []).append(r)
        elif r.get("action") == "EXIT":
            q = open_by.get(key)
            if q:
                e = q.pop(0)
                entry = e.get("entry") or 0
                qty = e.get("qty") or 0
                pnl = r.get("pnl", 0) or 0
                ret = (pnl / (entry * qty) * 100) if (entry and qty) else 0.0
                trades.append({"regime": e.get("regime"), "confidence": e.get("confidence"),
                               "components": e.get("components") or {}, "pnl": pnl,
                               "ret": ret, "win": pnl > 0})
    return trades


def compute_learning(priors: dict) -> dict:
    """Return the full learning report: per-signal edge stats + the (possibly) adjusted weights."""
    trades = completed_trades(load_decisions())
    n = len(trades)
    comps = list(priors.keys())
    avg_all = (sum(t["ret"] for t in trades) / n) if n else 0.0

    stats = {}
    for c in comps:
        fired = [t for t in trades if (t["components"] or {}).get(c, 0) > 0]
        nf = len(fired)
        avg = (sum(t["ret"] for t in fired) / nf) if nf else 0.0
        win = (sum(1 for t in fired if t["win"]) / nf * 100) if nf else None
        stats[c] = {"n": nf, "avgRet": round(avg, 2),
                    "winPct": (round(win) if win is not None else None),
                    "edge": round(avg - avg_all, 2)}

    if n < MIN_TRADES:
        return {"status": "gathering", "applied": False, "nTrades": n, "minTrades": MIN_TRADES,
                "weights": dict(priors), "priors": dict(priors), "stats": stats,
                "avgRet": round(avg_all, 2)}

    # evidence-weighted, shrunk toward priors, then renormalised to the prior total
    raw = {}
    for c in comps:
        st = stats[c]
        if st["n"] >= MIN_PER:
            mult = 1.0 + max(-0.6, min(1.0, st["edge"] / 2.0))     # bounded edge → multiplier
            learned = priors[c] * mult
            shrink = min(1.0, st["n"] / FULL_CONF_N)               # trust grows with sample
            raw[c] = priors[c] + (learned - priors[c]) * shrink
        else:
            raw[c] = priors[c]                                     # too few → keep the prior
    tot_prior = sum(priors.values()) or 1
    tot_raw = sum(raw.values()) or 1
    weights = {c: round(raw[c] * tot_prior / tot_raw, 1) for c in comps}
    return {"status": "active", "applied": True, "nTrades": n, "minTrades": MIN_TRADES,
            "weights": weights, "priors": dict(priors), "stats": stats,
            "avgRet": round(avg_all, 2)}


def save_weights(weights: dict) -> None:
    try:
        json.dump({"weights": weights, "updated": datetime.now().isoformat()},
                  open(WEIGHTS_FILE, "w"), indent=2)
    except Exception:
        pass


def load_weights(priors: dict) -> dict:
    """The weights score_symbol should use right now — learned if present & shaped like the
    priors, else the priors themselves. Safe: never returns a malformed weight set."""
    if os.path.exists(WEIGHTS_FILE):
        try:
            d = json.load(open(WEIGHTS_FILE))
            w = d.get("weights") or {}
            if set(w) == set(priors):
                return {k: float(v) for k, v in w.items()}
        except Exception:
            pass
    return dict(priors)
