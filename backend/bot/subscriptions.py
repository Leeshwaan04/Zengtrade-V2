"""Per-strategy deployment ("Deploy / Stop") state — the single source of truth shared
by the dashboard API and the paper harness, so the lifecycle is HONEST: the harness
trades ONLY what the user has actually deployed.

States (keyed by catalog strategy id, e.g. "momentum", "pairs"):
  'paper'  -> deployed; the paper harness trades it (live data, simulated fills)
  'paused' -> deployed but takes NO new entries (open paper positions are kept)
  'live'   -> real-money execution (gated by the two-key ALLOW_LIVE rail; Phase 2)
Absence of an entry = Available (not deployed).

Stored in subscriptions.json at the repo root.
"""
from __future__ import annotations

import json
import os
import time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUBS_FILE = os.path.join(REPO_ROOT, "subscriptions.json")
VALID = {"paper", "paused", "live"}
OFF = {"off", "none", "stopped", "stop", "", None}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def all_subs() -> dict:
    try:
        with open(SUBS_FILE) as f:
            return json.load(f) or {}
    except Exception:
        return {}


def _save(subs: dict) -> None:
    try:
        with open(SUBS_FILE, "w") as f:
            json.dump(subs, f, indent=2)
    except Exception:
        pass


def sub_state(sid: str):
    """Lifecycle state for one strategy, or None if not deployed."""
    return (all_subs().get(sid) or {}).get("state")


def deployed_ids(states=("paper", "live")) -> set:
    """Catalog ids the harness should actively TRADE this cycle (paper/live, NOT paused)."""
    return {k for k, v in all_subs().items() if (v or {}).get("state") in states}


def ensure_seeded(default_ids) -> None:
    """First run ONLY: seed these as 'paper' so an already-running multi-day forward test
    isn't silently stopped. No-op once subscriptions.json exists (respects user choices)."""
    if not os.path.exists(SUBS_FILE):
        _save({sid: {"state": "paper", "since": _now()} for sid in default_ids})


def set_sub(sid: str, state: str) -> dict:
    """Deploy / pause / stop one strategy. 'live' is clamped to its current state unless
    ALLOW_LIVE is armed (same hard rail as the dashboard mode gate)."""
    subs = all_subs()
    if state in OFF:                       # Stop = remove subscription
        subs.pop(sid, None)
        _save(subs)
        return {"id": sid, "state": None}
    if state not in VALID:
        return {"id": sid, "error": f"invalid state {state!r}"}
    if state == "live":
        from bot.safety import live_armed
        if not live_armed():
            return {"id": sid, "state": sub_state(sid) or "paper", "locked": True,
                    "reason": "ALLOW_LIVE not armed — live execution is locked"}
    prev = subs.get(sid) or {}
    since = prev.get("since") if prev.get("state") == state else _now()
    subs[sid] = {"state": state, "since": since or _now()}
    _save(subs)
    return {"id": sid, "state": state, "since": subs[sid]["since"]}
