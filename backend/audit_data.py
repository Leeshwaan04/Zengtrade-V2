"""DATA INTEGRITY AUDIT — verify yfinance data before trusting any backtest.

Checks per symbol (5y daily): coverage, gaps, NaNs, duplicate dates, zero-volume
days, corporate actions (splits/bonus), and whether RAW prices have unadjusted
discontinuities that would corrupt a backtest. Flags anything suspicious.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import yfinance as yf

SYMBOLS = sorted(set([
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "TATAMOTORS", "TATASTEEL",
    "HINDALCO", "SBIN", "AXISBANK", "BAJFINANCE", "ADANIENT", "JSWSTEEL", "MARUTI",
    "LT", "KOTAKBANK", "WIPRO", "VEDL", "ONGC",
]))


def audit(sym: str) -> dict:
    t = yf.Ticker(sym + ".NS")
    raw = t.history(period="5y", interval="1d", auto_adjust=False)
    adj = t.history(period="5y", interval="1d", auto_adjust=True)
    if raw.empty:
        return {"symbol": sym, "status": "NO DATA (404?)"}

    bars = len(raw)
    nan = int(raw[["Open", "High", "Low", "Close", "Volume"]].isna().sum().sum())
    dups = int(raw.index.duplicated().sum())
    zero_vol = int((raw["Volume"] == 0).sum())

    # biggest single-day move on ADJUSTED close (clean) vs RAW close (may have jumps)
    adj_max = float(adj["Close"].pct_change().abs().max() * 100)
    raw_max = float(raw["Close"].pct_change().abs().max() * 100)

    # how many days raw and adjusted close diverge >2% -> corporate actions present
    div = ((raw["Close"] - adj["Close"]).abs() / raw["Close"])
    corp_days = int((div > 0.02).sum())

    # explicit corporate actions in window
    try:
        splits = t.splits
        splits = splits[splits.index >= raw.index[0]]
        n_splits = int((splits != 0).sum())
    except Exception:
        n_splits = -1

    # trading-day coverage sanity (expect ~250/yr)
    yrs = (raw.index[-1] - raw.index[0]).days / 365.25
    per_yr = bars / yrs if yrs else 0

    flags = []
    if raw_max > 25:
        flags.append(f"RAW jump {raw_max:.0f}%")
    if adj_max > 25:
        flags.append(f"ADJ jump {adj_max:.0f}%")
    if zero_vol:
        flags.append(f"{zero_vol} zero-vol")
    if nan or dups:
        flags.append("NaN/dup")
    if per_yr < 230 or per_yr > 260:
        flags.append(f"{per_yr:.0f} bars/yr")

    return {
        "symbol": sym, "bars": bars, "per_yr": per_yr, "nan": nan, "dups": dups,
        "zero_vol": zero_vol, "raw_maxret": raw_max, "adj_maxret": adj_max,
        "corp_days": corp_days, "splits": n_splits, "flags": ", ".join(flags) or "ok",
    }


def main() -> None:
    print(f"\n=== DATA AUDIT (5y daily, yfinance) ===")
    print(f"{'symbol':11s} {'bars':>5s} {'b/yr':>5s} {'NaN':>4s} {'0vol':>5s} "
          f"{'rawMax%':>8s} {'adjMax%':>8s} {'corpDay':>7s} {'splits':>6s}  flags")
    for sym in SYMBOLS:
        r = audit(sym)
        if r.get("status"):
            print(f"{sym:11s}  --> {r['status']}")
            continue
        print(f"{r['symbol']:11s} {r['bars']:>5d} {r['per_yr']:>5.0f} {r['nan']:>4d} "
              f"{r['zero_vol']:>5d} {r['raw_maxret']:>7.1f}% {r['adj_maxret']:>7.1f}% "
              f"{r['corp_days']:>7d} {r['splits']:>6d}  {r['flags']}")


if __name__ == "__main__":
    main()
