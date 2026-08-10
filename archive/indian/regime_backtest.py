"""Regime-segmented backtest — the honest 'all market scenarios' test.

Classifies ~4 years of clean Kite daily history into market regimes
(Bull / Bear / Choppy / High-Vol) from an equal-weight index of the universe,
then measures each strategy's trades bucketed BY the regime that was live at
entry. Shows which strategy actually works in which scenario — because none
works in all of them.

    python3 regime_backtest.py
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from bot.config import load_env, require
from bot import auth
from bot.data import DataFeed
from bot.backtest import Backtester
from bot.risk import RiskConfig, RiskManager
from bot.strategy import MeanReversionConfig, MeanReversionStrategy
from bot.strategy_momentum import MomentumConfig, MomentumStrategy
from bot.strategies_lib import (MACrossStrategy, RSI2Strategy, SupertrendStrategy)

UNIVERSE = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "AXISBANK",
            "TATASTEEL", "JSWSTEEL", "HINDALCO", "LT", "MARUTI", "WIPRO", "ADANIENT"]
REGIMES = ["Bull", "Bear", "Choppy", "High-Vol"]


def classify_regime(idx: pd.Series) -> pd.Series:
    sma200 = idx.rolling(200).mean()
    vol = idx.pct_change().rolling(20).std() * np.sqrt(252)
    vol_hi = vol.quantile(0.75)
    dist = idx / sma200 - 1
    reg = pd.Series("warmup", index=idx.index, dtype=object)
    for d in idx.index:
        if pd.isna(sma200[d]):
            continue
        if not pd.isna(vol[d]) and vol[d] >= vol_hi:
            reg[d] = "High-Vol"
        elif abs(dist[d]) < 0.02:
            reg[d] = "Choppy"
        elif dist[d] > 0:
            reg[d] = "Bull"
        else:
            reg[d] = "Bear"
    return reg


def bucket(strat, risk, cache, regime) -> dict:
    out = {r: [] for r in REGIMES}
    for sym, df in cache.items():
        if df.empty or len(df) < 230:
            continue
        for t in Backtester(strat, RiskManager(risk), cost_bps=15).run(df).trades:
            r = regime.asof(t.entry_time)
            if r in out:
                out[r].append(t.return_pct)
    return out


def line(name, buckets):
    cells = []
    for r in REGIMES:
        rs = buckets[r]
        if rs:
            avg = np.mean(rs); win = sum(1 for x in rs if x > 0) / len(rs) * 100
            cells.append(f"{avg:+5.2f}% ({len(rs):>2d}/{win:.0f}%)")
        else:
            cells.append(f"{'—':>13s}")
    print(f"{name:16s} " + " ".join(f"{c:>15s}" for c in cells))


def main() -> None:
    load_env()
    kite = auth.make_kite(require("KITE_API_KEY"), require("KITE_ACCESS_TOKEN"))
    data = DataFeed(kite, exchange="NSE")
    data.load_instruments()

    cache = {}
    for sym in UNIVERSE:
        cache[sym] = data.historical(data.token_for(sym), "day", 1500)

    closes = pd.DataFrame({s: d["close"] for s, d in cache.items() if not d.empty}).dropna()
    idx = (closes / closes.iloc[0] * 100).mean(axis=1)
    regime = classify_regime(idx)
    counts = regime.value_counts()
    span = f"{idx.index[0].date()} → {idx.index[-1].date()}"

    print(f"\n=== REGIME-SEGMENTED BACKTEST (clean Kite daily, {span}, 15bps) ===")
    print("Regime mix (trading days): " +
          " · ".join(f"{r} {int(counts.get(r,0))}" for r in REGIMES))
    print("\nCell = avg trade return (num trades / win%) in that regime\n")
    print(f"{'strategy':16s} " + " ".join(f"{r:>15s}" for r in REGIMES))
    print("-" * 80)
    trend_risk = RiskConfig(capital=25_000, target_atr_mult=0, stop_atr_mult=2.5)
    mr_risk = RiskConfig(capital=25_000)
    line("Momentum(Donch)", bucket(MomentumStrategy(MomentumConfig()), trend_risk, cache, regime))
    line("MA-Cross(50/200)", bucket(MACrossStrategy(), trend_risk, cache, regime))
    line("Supertrend", bucket(SupertrendStrategy(), trend_risk, cache, regime))
    line("MeanRev(BB+RSI)", bucket(MeanReversionStrategy(MeanReversionConfig()), mr_risk, cache, regime))
    line("RSI2(Connors)", bucket(RSI2Strategy(), mr_risk, cache, regime))
    print("\nRead: a real edge is POSITIVE with enough trades. Trend strategies "
          "should win in Bull/Bear; mean-reversion in Choppy. Pick the best per regime.")


if __name__ == "__main__":
    main()
