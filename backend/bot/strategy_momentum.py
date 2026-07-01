"""Momentum / breakout strategy (Donchian channel, Turtle-style).

Opposite hypothesis to mean reversion: buy STRENGTH, not weakness. Go long when
price breaks above its N-bar high (a fresh breakout) while in an uptrend; exit
when it breaks below its M-bar low or hits an ATR stop. Long-only, so it's
valid for equity delivery (CNC) too.

Exposes the same interface (compute / _entry_long / _exit_long) as the
mean-reversion strategy, so it plugs straight into the existing Backtester.
Use it with RiskConfig(target_atr_mult=0) to let winners run to the Donchian exit.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from . import indicators


@dataclass
class MomentumConfig:
    breakout_period: int = 20   # entry: break above this many bars' high
    exit_period: int = 10       # exit: break below this many bars' low
    use_trend_filter: bool = True
    trend_period: int = 100     # only go long above this SMA (trend confirmation)
    atr_period: int = 14
    bb_period: int = 20         # unused; kept for runner compatibility


class MomentumStrategy:
    def __init__(self, config: MomentumConfig | None = None):
        self.cfg = config or MomentumConfig()

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        out = df.copy()
        # shift(1) so the breakout level is from PRIOR bars (no look-ahead)
        out["donchian_high"] = out["high"].rolling(self.cfg.breakout_period).max().shift(1)
        out["donchian_low"] = out["low"].rolling(self.cfg.exit_period).min().shift(1)
        out["atr"] = indicators.atr(out["high"], out["low"], out["close"], self.cfg.atr_period)
        out["trend_sma"] = indicators.sma(out["close"], self.cfg.trend_period)
        out["bb_lower"] = out["donchian_high"]  # alias for Backtester's warmup NaN-check
        return out

    def _entry_long(self, row) -> bool:
        if self.cfg.use_trend_filter:
            trend = row.get("trend_sma")
            if trend is None or pd.isna(trend) or row["close"] < trend:
                return False
        dh = row.get("donchian_high")
        return dh is not None and not pd.isna(dh) and row["close"] > dh

    def _exit_long(self, row) -> bool:
        dl = row.get("donchian_low")
        return dl is not None and not pd.isna(dl) and row["close"] < dl
