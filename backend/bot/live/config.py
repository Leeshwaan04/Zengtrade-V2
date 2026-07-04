"""Live-execution config — OS-environment ONLY.

Every hard risk rail lives here and is read from the process environment, never from a
config file the UI can write or a browser request. The API may READ live status; it can
NEVER arm live or change a cap. That asymmetry is the safety property (story F1).
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from bot.safety import live_armed


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _i(name: str, default: int) -> int:
    try:
        return int(float(os.environ.get(name, default)))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class LiveConfig:
    armed: bool                    # ALLOW_LIVE — the hard OS arming key (bot/safety.py)
    allowed: frozenset             # LIVE_ALLOWED_STRATEGIES — per-strategy opt-in allowlist
    max_order_notional: float      # refuse any single order above this
    max_daily_loss: float          # kill-switch trigger (positive number = loss magnitude)
    max_open: int                  # max concurrent open positions
    feed_stale_sec: float          # halt entries if newest tick older than this
    order_timeout_sec: float       # query status before resend after this
    max_slippage_bps: float        # marketable-limit buffer cap

    def allows_strategy(self, name: str) -> bool:
        return name in self.allowed


def load() -> LiveConfig:
    """Snapshot the environment. Deliberately has NO setter — config changes require a real
    OS-env change + restart, which the browser/API can never do."""
    allowed = os.environ.get("LIVE_ALLOWED_STRATEGIES", "")
    return LiveConfig(
        armed=live_armed(),
        allowed=frozenset(s.strip() for s in allowed.split(",") if s.strip()),
        max_order_notional=_f("LIVE_MAX_ORDER_NOTIONAL", 5_000.0),
        max_daily_loss=_f("LIVE_MAX_DAILY_LOSS", 1_000.0),
        max_open=_i("LIVE_MAX_OPEN", 1),
        feed_stale_sec=_f("FEED_STALE_SEC", 10.0),
        order_timeout_sec=_f("ORDER_TIMEOUT_SEC", 5.0),
        max_slippage_bps=_f("LIVE_MAX_SLIPPAGE_BPS", 30.0),
    )
