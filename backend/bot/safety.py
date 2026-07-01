"""Single source of truth for the paper <-> live execution gate.

Real orders are placed ONLY when ALL of the two-key conditions hold:
  1. settings.PAPER is False          -- the operator's config intent
  2. ALLOW_LIVE is armed in the OS env -- the hard arming key
  3. the dashboard mode file says live -- the UI intent

ANY missing key FAILS SAFE to paper. So:
  * a dashboard click alone can never place real orders (no ALLOW_LIVE),
  * flipping settings.PAPER alone can never place real orders (no ALLOW_LIVE),
  * arming ALLOW_LIVE alone does nothing until you also run the live runner.
Both bot_api.py (UI) and run_bot.py (execution) import THIS module, so the
gate can never drift between what the UI shows and what the bot actually does.
"""
from __future__ import annotations

import json
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODE_FILE = os.path.join(REPO_ROOT, "mode.json")


def live_armed() -> bool:
    """The hard arming key. Real orders are impossible unless ALLOW_LIVE is set
    in the bot's own OS environment (not the browser, not a config file)."""
    return os.environ.get("ALLOW_LIVE", "").lower() in ("1", "true", "yes")


def get_mode() -> str:
    try:
        return json.load(open(MODE_FILE)).get("mode", "paper")
    except Exception:
        return "paper"


def set_mode(mode: str) -> dict:
    """Persist the dashboard's requested mode. 'live' is only ever stored as the
    EFFECTIVE mode when ALLOW_LIVE is armed; otherwise it is clamped to paper and
    reported back as locked."""
    armed = live_armed()
    effective = mode if (mode == "paper" or armed) else "paper"
    try:
        json.dump({"mode": effective, "requested": mode, "armed": armed}, open(MODE_FILE, "w"))
    except Exception:
        pass
    return {"mode": effective, "requested": mode, "liveArmed": armed,
            "locked": mode == "live" and not armed}


def live_execution_allowed(settings_paper: bool) -> tuple[bool, str]:
    """The execution-layer gate run_bot.py MUST consult before choosing a broker.
    Returns (go_live, human_reason). Fails safe to paper on ANY missing key."""
    if settings_paper:
        return False, "settings.PAPER=True -> PAPER"
    if not live_armed():
        return False, "ALLOW_LIVE not armed in environment -> forced PAPER (safety)"
    if get_mode() != "live":
        return False, "dashboard mode is not 'live' -> forced PAPER"
    return True, "two-key gate satisfied (settings.PAPER=False + ALLOW_LIVE + mode=live)"
