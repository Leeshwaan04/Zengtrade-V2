"""Mean-reversion strategy logic.

Idea: prices oscillate around a moving mean. When price stretches too far
*below* the mean (oversold) we go long, and we exit when it reverts back to
the mean (or momentum turns). This is a LONG-ONLY strategy by default, which
is what equity *delivery* (CNC) allows. Intraday (MIS) could also short, but
we keep it long-only for safety; flip `allow_short` only if you know the risk.

The class produces:
  - `compute(df)`  -> df enriched with indicator columns
  - `signal(df)`   -> a Decision for the *latest completed bar* (live trading)
  - `signals(df)`  -> a position Series over history (backtesting)
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import pandas as pd

from . import indicators


class Action(str, Enum):
    ENTER_LONG = "ENTER_LONG"
    EXIT = "EXIT"
    HOLD = "HOLD"


@dataclass
class Decision:
    action: Action
    price: float
    reason: str
    rsi: float | None = None
    zscore: float | None = None
    lower_band: float | None = None
    mid_band: float | None = None


@dataclass
class MeanReversionConfig:
    # Bollinger Bands
    use_bbands: bool = True
    bb_period: int = 20
    bb_std: float = 2.0
    # RSI confirmation
    use_rsi: bool = True
    rsi_period: int = 14
    rsi_oversold: float = 30.0
    rsi_exit: float = 55.0
    # Z-score (optional alternative/additional filter)
    use_zscore: bool = False
    zscore_period: int = 20
    zscore_entry: float = -2.0
    # Exit behaviour
    exit_at_mean: bool = True  # exit when price reverts up to the SMA mid band
    # Trend / regime filter — the single most important safety control here.
    # Mean reversion's #1 way to lose money is buying dips in a stock that just
    # keeps falling. We can't use "price above the long SMA" because that
    # contradicts "buy below the lower band" on the same timeframe. Instead we
    # require the long SMA itself to be flat-or-RISING (slope >= 0): fade dips
    # only when the broader regime isn't falling. For an even stronger guard,
    # run this on a higher timeframe's trend (e.g. daily) — see README.
    use_trend_filter: bool = True
    trend_period: int = 200
    trend_slope_lookback: int = 20  # SMA must not be lower than this many bars ago
    # Volatility (for stop/target sizing in risk manager + backtest)
    atr_period: int = 14
    allow_short: bool = False  # keep False for cash/delivery


class MeanReversionStrategy:
    def __init__(self, config: MeanReversionConfig | None = None):
        self.cfg = config or MeanReversionConfig()

    # ----- indicator computation -------------------------------------------------
    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return a copy of df with indicator columns added.

        df must have columns: open, high, low, close, volume.
        """
        out = df.copy()
        c = out["close"]
        mid, upper, lower = indicators.bollinger_bands(
            c, self.cfg.bb_period, self.cfg.bb_std
        )
        out["bb_mid"] = mid
        out["bb_upper"] = upper
        out["bb_lower"] = lower
        out["rsi"] = indicators.rsi(c, self.cfg.rsi_period)
        out["zscore"] = indicators.zscore(c, self.cfg.zscore_period)
        out["atr"] = indicators.atr(
            out["high"], out["low"], out["close"], self.cfg.atr_period
        )
        out["trend_sma"] = indicators.sma(c, self.cfg.trend_period)
        out["trend_slope"] = out["trend_sma"].diff(self.cfg.trend_slope_lookback)
        return out

    # ----- entry / exit predicates ----------------------------------------------
    def _entry_long(self, row) -> bool:
        # Regime gate first: don't fade dips when the long trend is falling.
        if self.cfg.use_trend_filter:
            slope = row.get("trend_slope")
            if slope is None or pd.isna(slope) or slope < 0:
                return False
        conditions = []
        if self.cfg.use_bbands:
            conditions.append(row["close"] < row["bb_lower"])
        if self.cfg.use_rsi:
            conditions.append(row["rsi"] < self.cfg.rsi_oversold)
        if self.cfg.use_zscore:
            conditions.append(row["zscore"] < self.cfg.zscore_entry)
        # Need at least one enabled filter, and ALL enabled filters must agree.
        return bool(conditions) and all(conditions)

    def _exit_long(self, row) -> bool:
        conditions = []
        if self.cfg.exit_at_mean:
            conditions.append(row["close"] >= row["bb_mid"])
        if self.cfg.use_rsi:
            conditions.append(row["rsi"] > self.cfg.rsi_exit)
        # Exit if ANY reversion condition is met.
        return any(conditions)

    # ----- live: decide on the latest bar ---------------------------------------
    def signal(self, df: pd.DataFrame, in_position: bool) -> Decision:
        """Decide what to do given history `df` and whether we already hold."""
        data = self.compute(df)
        row = data.iloc[-1]
        if pd.isna(row.get("bb_lower")) or pd.isna(row.get("rsi")):
            return Decision(Action.HOLD, float(row["close"]), "warming up (not enough bars)")

        common = dict(
            price=float(row["close"]),
            rsi=float(row["rsi"]),
            zscore=float(row["zscore"]),
            lower_band=float(row["bb_lower"]),
            mid_band=float(row["bb_mid"]),
        )
        if in_position:
            if self._exit_long(row):
                return Decision(Action.EXIT, reason="reverted to mean / momentum up", **common)
            return Decision(Action.HOLD, reason="holding, no exit trigger", **common)

        if self._entry_long(row):
            return Decision(Action.ENTER_LONG, reason="oversold below band", **common)
        return Decision(Action.HOLD, reason="no entry trigger", **common)

    # ----- backtest: vectorised-ish position series -----------------------------
    def signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Walk history bar by bar, returning a DataFrame with a 'position'
        column (1 = long, 0 = flat). Stops/targets are applied by the backtester,
        not here; this captures pure entry/exit *signal* logic.
        """
        data = self.compute(df)
        position = 0
        positions = []
        for _, row in data.iterrows():
            if pd.isna(row.get("bb_lower")) or pd.isna(row.get("rsi")):
                positions.append(0)
                continue
            if position == 0 and self._entry_long(row):
                position = 1
            elif position == 1 and self._exit_long(row):
                position = 0
            positions.append(position)
        data["position"] = positions
        return data
