"""Per-strategy capital allocation for the crypto book — the user's dial on how much of each
strategy's NORMAL position size it may use (0-100%). 0% turns a strategy off (no new risk;
existing positions are still managed). The 24/7 harness reads this each cycle, so changes take
effect on the next cycle without a restart. The Governor's concentration/crowding caps still apply
on top — this can only REDUCE risk, never exceed the governed size (honest & safe by construction).
"""
from __future__ import annotations

import json
import os

_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALLOC_FILE = os.path.join(_REPO, "crypto_allocation.json")


def load_alloc() -> dict:
    """{strategy_id: weight 0.0-1.0}. Missing/garbage → empty (everything at 100%)."""
    try:
        raw = json.load(open(ALLOC_FILE))
        return {str(k): _clamp(v) for k, v in raw.items()}
    except Exception:
        return {}


def _clamp(v) -> float:
    try:
        return max(0.0, min(1.0, float(v)))
    except (TypeError, ValueError):
        return 1.0


def weight(sid: str, alloc: dict | None = None) -> float:
    """Capital multiplier for a strategy (default 1.0 = full normal size)."""
    a = alloc if alloc is not None else load_alloc()
    return _clamp(a.get(sid, 1.0))


def set_weight(sid: str, w) -> dict:
    """Persist one strategy's weight (clamped 0-1). Returns the full allocation map."""
    a = load_alloc()
    a[sid] = _clamp(w)
    tmp = ALLOC_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(a, f, indent=2)
    os.replace(tmp, ALLOC_FILE)          # atomic — the 24/7 harness never reads a half-written file
    return a
