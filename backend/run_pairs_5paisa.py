"""Validate the survivor pairs on CLEAN 5paisa data (the real-money test).

    python run_pairs_5paisa.py                 # daily, ~2y
    python run_pairs_5paisa.py --interval 5m   # intraday (5paisa gives ~6 months)

This is the honest validation the yfinance screen could NOT provide: clean,
point-in-time, properly-adjusted broker data — the SAME feed you'd trade on.
Judge by OUT-OF-SAMPLE Sharpe with realistic costs. Needs FIVEPAISA_* in .env.
"""
from __future__ import annotations

import argparse

import numpy as np

from bot.config import load_env
from bot.fivepaisa_scrips import scrip_for

# the least-bad candidates from the free screen — validate THESE on clean data
SURVIVOR_PAIRS = [
    ("TATASTEEL", "JSWSTEEL"),
    ("INFY", "WIPRO"),
    ("HDFCBANK", "ICICIBANK"),
    ("ICICIBANK", "AXISBANK"),
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", default="1d")
    ap.add_argument("--from", dest="frm", default="2024-01-01")
    ap.add_argument("--to", default="2026-06-24")
    ap.add_argument("--cost", type=float, default=15.0, help="bps per leg per side")
    args = ap.parse_args()

    load_env()
    from bot.fivepaisa_data import make_client, history
    from bot.pairs import run_pair, out_of_sample

    client = make_client()
    closes: dict[str, object] = {}

    def close(sym):
        if sym not in closes:
            df = history(client, scrip_for(sym), interval=args.interval,
                         frm=args.frm, to=args.to)
            closes[sym] = df["close"] if df is not None and not df.empty else None
        return closes[sym]

    print(f"\n=== PAIRS on CLEAN 5paisa data — OOS ({args.interval}, "
          f"{args.frm}→{args.to}, {args.cost}bps/leg) ===")
    print(f"{'pair':22s} {'OOS_ret':>8s} {'OOS_shrp':>8s} {'trades':>6s} {'win%':>5s}")
    sharpes = []
    for a_sym, b_sym in SURVIVOR_PAIRS:
        a, b = close(a_sym), close(b_sym)
        if a is None or b is None:
            print(f"{a_sym}/{b_sym}: missing data")
            continue
        bt = run_pair(a, b, window=30, entry_z=2.0, exit_z=0.5, cost_bps=args.cost)
        if bt is None:
            print(f"{a_sym}/{b_sym}: too few bars")
            continue
        _, oos = out_of_sample(bt)
        sharpes.append(oos["sharpe"])
        print(f"{a_sym+'/'+b_sym:22s} {oos['total']:>+7.1f}% {oos['sharpe']:>8.2f} "
              f"{oos['n_trades']:>6d} {oos['win_rate']:>4.0f}%")
    if sharpes:
        print("-" * 54)
        print(f"Mean OOS Sharpe (clean data, real cost): {np.mean(sharpes):+.2f}")
        print("Decision bar: >0.8 consistent across pairs = worth paper-trading; "
              "~0 = no edge, stop.")


if __name__ == "__main__":
    main()
