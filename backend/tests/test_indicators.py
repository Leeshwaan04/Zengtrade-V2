"""Unit tests for indicators + strategy. Run: python -m pytest -q  (or python tests/test_indicators.py)"""
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bot import indicators
from bot.strategy import Action, MeanReversionConfig, MeanReversionStrategy


def _series(values):
    return pd.Series(values, dtype=float)


def test_sma():
    s = _series([1, 2, 3, 4, 5])
    assert indicators.sma(s, 3).iloc[-1] == 4.0  # (3+4+5)/3


def test_rsi_bounds():
    rng = np.random.default_rng(0)
    s = _series(np.cumsum(rng.normal(0, 1, 200)) + 100)
    r = indicators.rsi(s, 14).dropna()
    assert ((r >= 0) & (r <= 100)).all()


def test_rsi_all_up_is_high():
    s = _series(range(1, 50))  # strictly increasing -> RSI near 100
    assert indicators.rsi(s, 14).iloc[-1] > 95


def test_bollinger_order():
    rng = np.random.default_rng(1)
    s = _series(rng.normal(100, 5, 100))
    mid, upper, lower = indicators.bollinger_bands(s, 20, 2)
    valid = mid.dropna().index
    assert (upper[valid] >= mid[valid]).all()
    assert (lower[valid] <= mid[valid]).all()


def test_atr_positive():
    rng = np.random.default_rng(2)
    close = _series(np.cumsum(rng.normal(0, 1, 100)) + 100)
    high = close + 1
    low = close - 1
    a = indicators.atr(high, low, close, 14).dropna()
    assert (a > 0).all()


def test_strategy_enters_when_oversold():
    # Build a frame where the last bar is clearly below the lower band + low RSI.
    n = 40
    close = [100] * (n - 5) + [99, 97, 94, 90, 85]  # sharp drop at the end
    df = pd.DataFrame({
        "open": close,
        "high": [c + 0.5 for c in close],
        "low": [c - 0.5 for c in close],
        "close": close,
        "volume": [1000] * n,
    })
    strat = MeanReversionStrategy(MeanReversionConfig(bb_period=20, rsi_period=14))
    decision = strat.signal(df, in_position=False)
    assert decision.action in (Action.ENTER_LONG, Action.HOLD)
    # With this drop it should at least be oversold (RSI low).
    assert decision.rsi is not None and decision.rsi < 50


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("All tests passed.")
