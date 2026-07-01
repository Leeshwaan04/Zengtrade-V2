"""Free historical data via Yahoo Finance (yfinance) — no broker/subscription.

For NSE equities, Yahoo uses the `.NS` suffix (RELIANCE -> RELIANCE.NS). Daily
history goes back years for free, which makes it ideal for validating the
strategy across multiple market regimes before paying for any broker data.

Note: intraday (sub-daily) history on Yahoo is limited to ~60 days and is less
clean than a broker feed — use it for daily-bar validation, not live trading.
"""
from __future__ import annotations

import pandas as pd
import yfinance as yf


def history(
    symbol: str, period: str = "3y", interval: str = "1d",
    adjust: bool = True, drop_outliers: float = 0.35,
) -> pd.DataFrame:
    """Return CLEANED OHLCV DataFrame indexed by datetime, columns lowercased.

    Cleaning (lessons from the data audit):
      - adjust=True   -> split + dividend adjusted (no phantom corporate-action jumps)
      - drops NaN rows and zero-volume junk rows yfinance injects
      - drops bars with an absurd single-day move (> drop_outliers, e.g. the
        VEDL demerger -65% artifact) that signal unadjusted corporate actions

    NOTE: yfinance is fine for FREE SCREENING but is NOT clean enough to validate
    a strategy for real money — do that on your broker's historical feed.

    period:   e.g. '1y', '3y', '5y', 'max'
    interval: '1d', '1wk', '1h', '15m', '5m' (intraday is recent-only)
    """
    ticker = symbol if "." in symbol else f"{symbol}.NS"
    df = yf.Ticker(ticker).history(period=period, interval=interval, auto_adjust=adjust)
    if df.empty:
        return df
    df = df.rename(columns=str.lower)
    df.index.name = "datetime"
    keep = ["open", "high", "low", "close", "volume"]
    df = df[keep].dropna()
    df = df[df["volume"] > 0]                      # drop junk/holiday rows
    if drop_outliers:
        ret = df["close"].pct_change(fill_method=None).abs()
        df = df[(ret <= drop_outliers) | ret.isna()]  # drop unadjusted-action bars
    return df
