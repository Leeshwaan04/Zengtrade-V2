"""Offline demo — runs the FULL backtest on synthetic mean-reverting data so
you can see the engine work end-to-end WITHOUT any Kite credentials.

    python demo_backtest.py

Once you have Kite API keys, use `run_backtest.py` for real historical data.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from bot.backtest import Backtester
from bot.risk import RiskConfig, RiskManager
from bot.strategy import MeanReversionConfig, MeanReversionStrategy


def synthetic_mean_reverting(n: int = 1500, seed: int = 7) -> pd.DataFrame:
    """Ornstein-Uhlenbeck-ish series that oscillates around a drifting mean —
    the ideal habitat for a mean-reversion strategy."""
    rng = np.random.default_rng(seed)
    mean = 100.0
    theta, sigma = 0.05, 1.2  # pull strength, noise
    price = mean
    closes = []
    for _ in range(n):
        mean += rng.normal(0, 0.02)  # slow drift
        price += theta * (mean - price) + rng.normal(0, sigma)
        closes.append(price)
    close = pd.Series(closes)
    idx = pd.date_range("2025-01-01 09:15", periods=n, freq="5min")
    noise = rng.normal(0, 0.3, n)
    return pd.DataFrame(
        {
            "open": close.shift(1).fillna(close).values,
            "high": close.values + np.abs(noise) + 0.2,
            "low": close.values - np.abs(noise) - 0.2,
            "close": close.values,
            "volume": rng.integers(1000, 5000, n),
        },
        index=idx,
    )


def main() -> None:
    df = synthetic_mean_reverting()
    strategy = MeanReversionStrategy(MeanReversionConfig())
    risk = RiskManager(RiskConfig(capital=100_000))
    result = Backtester(strategy, risk, cost_bps=5).run(df)

    print("=== Demo backtest on synthetic mean-reverting data ===")
    print(f"Bars: {len(df)}  ({df.index[0]} -> {df.index[-1]})\n")
    print(result.summary())
    print("\nFirst few trades:")
    for t in result.trades[:5]:
        print(f"  {t.entry_time:%Y-%m-%d %H:%M} buy {t.qty} @ {t.entry:.2f} "
              f"-> {t.exit:.2f} ({t.reason}, {t.return_pct:+.2f}%)")


if __name__ == "__main__":
    main()
