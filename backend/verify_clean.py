"""Verify the worst anomaly + re-run pairs on CLEANED data to measure how much
data quality changes the conclusion. CSO-grade: trust nothing until cleaned.
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
import yfinance as yf

warnings.simplefilter("ignore")

from bot.pairs import run_pair, out_of_sample

PAIRS = [
    ("HDFCBANK", "ICICIBANK"), ("ICICIBANK", "AXISBANK"), ("SBIN", "AXISBANK"),
    ("HDFCBANK", "KOTAKBANK"), ("TCS", "INFY"), ("INFY", "WIPRO"),
    ("TATASTEEL", "JSWSTEEL"), ("HINDALCO", "VEDL"), ("RELIANCE", "ONGC"),
]

_cache: dict[str, pd.Series] = {}


def clean_close(sym: str) -> pd.Series | None:
    """Dividend+split adjusted, NaN-dropped, zero-volume rows removed."""
    if sym in _cache:
        return _cache[sym]
    df = yf.Ticker(sym + ".NS").history(period="5y", interval="1d", auto_adjust=True)
    if df.empty:
        _cache[sym] = None
        return None
    df = df.dropna(subset=["Open", "High", "Low", "Close", "Volume"])
    df = df[df["Volume"] > 0]
    _cache[sym] = df["Close"]
    return df["Close"]


def main() -> None:
    # 1) Expose the VEDL anomaly
    print("=== VEDL: 5 biggest single-day moves (adjusted) ===")
    v = yf.Ticker("VEDL.NS").history(period="5y", interval="1d", auto_adjust=True)["Close"]
    r = v.pct_change(fill_method=None)
    for dt in r.abs().sort_values(ascending=False).head(5).index:
        print(f"  {dt.date()}  {v.shift(1)[dt]:8.1f} -> {v[dt]:8.1f}   "
              f"({r[dt]*100:+.1f}%)")

    # 2) Re-run pairs on CLEANED data, realistic cost (15 bps/leg/side)
    print("\n=== PAIRS on CLEANED data — OOS, realistic cost (15bps/leg) ===")
    print(f"{'pair':22s} {'OOS_ret':>8s} {'OOS_shrp':>8s} {'trades':>6s} {'win%':>5s}")
    sharpes = []
    for a_sym, b_sym in PAIRS:
        a, b = clean_close(a_sym), clean_close(b_sym)
        if a is None or b is None:
            print(f"{a_sym}/{b_sym}: missing")
            continue
        bt = run_pair(a, b, window=30, entry_z=2.0, exit_z=0.5, cost_bps=15.0)
        if bt is None:
            continue
        _, oos = out_of_sample(bt)
        sharpes.append(oos["sharpe"])
        print(f"{a_sym+'/'+b_sym:22s} {oos['total']:>+7.1f}% {oos['sharpe']:>8.2f} "
              f"{oos['n_trades']:>6d} {oos['win_rate']:>4.0f}%")
    if sharpes:
        print("-" * 54)
        print(f"Mean OOS Sharpe (cleaned, real cost): {np.mean(sharpes):+.2f}")
        print(f"  vs earlier (raw, 5bps cost):        +0.54")


if __name__ == "__main__":
    main()
