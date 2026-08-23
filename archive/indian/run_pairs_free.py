"""FREE backtest of pairs trading on correlated NSE stocks (yfinance, 5y daily).

    python run_pairs_free.py

Tests sector pairs, reports correlation + in-sample vs out-of-sample Sharpe and
return. Judge by the OUT-OF-SAMPLE column. A real pairs edge shows a positive,
consistent OOS Sharpe across several pairs — not one lucky pair.
"""
from __future__ import annotations

import numpy as np

from bot.yf_data import history
from bot.pairs import run_pair, out_of_sample

PAIRS = [
    ("HDFCBANK", "ICICIBANK"),
    ("ICICIBANK", "AXISBANK"),
    ("SBIN", "AXISBANK"),
    ("HDFCBANK", "KOTAKBANK"),
    ("TCS", "INFY"),
    ("INFY", "WIPRO"),
    ("TATASTEEL", "JSWSTEEL"),
    ("HINDALCO", "VEDL"),
    ("MARUTI", "TATAMOTORS"),
    ("RELIANCE", "ONGC"),
]


def main() -> None:
    closes: dict[str, object] = {}

    def close(sym):
        if sym not in closes:
            df = history(sym, period="5y", interval="1d")
            closes[sym] = df["close"] if not df.empty else None
        return closes[sym]

    print(f"\n=== PAIRS TRADING — IN-SAMPLE vs OUT-OF-SAMPLE (5y daily) ===")
    print(f"{'pair':22s} {'corr':>5s} | {'IS_ret':>7s} {'IS_shrp':>7s} | "
          f"{'OOS_ret':>7s} {'OOS_shrp':>8s} {'OOS_tr':>6s} {'win%':>5s}")

    oos_sharpes = []
    for a_sym, b_sym in PAIRS:
        a, b = close(a_sym), close(b_sym)
        if a is None or b is None:
            print(f"{a_sym}/{b_sym}: missing data")
            continue
        corr = np.corrcoef(
            np.log(a).reindex(b.index).dropna().align(np.log(b).dropna(), join="inner")[0],
            np.log(b).reindex(a.index).dropna().align(np.log(a).dropna(), join="inner")[0],
        )[0, 1]
        bt = run_pair(a, b, window=30, entry_z=2.0, exit_z=0.5)
        if bt is None:
            continue
        is_m, oos_m = out_of_sample(bt)
        oos_sharpes.append(oos_m["sharpe"])
        print(f"{a_sym+'/'+b_sym:22s} {corr:>5.2f} | "
              f"{is_m['total']:>+6.1f}% {is_m['sharpe']:>7.2f} | "
              f"{oos_m['total']:>+6.1f}% {oos_m['sharpe']:>8.2f} "
              f"{oos_m['n_trades']:>6d} {oos_m['win_rate']:>4.0f}%")

    if oos_sharpes:
        print("-" * 78)
        print(f"Mean OOS Sharpe across {len(oos_sharpes)} pairs: {np.mean(oos_sharpes):+.2f}  "
              f"(>0.8 would be worth pursuing; ~0 = no edge)")


if __name__ == "__main__":
    main()
