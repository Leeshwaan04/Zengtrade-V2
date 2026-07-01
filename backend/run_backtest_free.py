"""FREE backtest on Yahoo Finance data — no Kite/5paisa subscription needed.

    python run_backtest_free.py                 # all settings.SYMBOLS, 3y daily
    python run_backtest_free.py RELIANCE INFY   # specific symbols
    python run_backtest_free.py --period 5y --interval 1d

This is Phase 0: validate whether the mean-reversion strategy has any real edge
on actual NSE history, across multiple market regimes, before spending a rupee.
Reports in-sample vs out-of-sample so you can spot curve-fitting.
"""
from __future__ import annotations

import argparse

import settings
from bot.yf_data import history
from bot.backtest import Backtester
from bot.risk import RiskManager
from bot.strategy import MeanReversionStrategy


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("symbols", nargs="*", help="NSE symbols (default: settings.SYMBOLS)")
    ap.add_argument("--period", default="3y")
    ap.add_argument("--interval", default="1d")
    ap.add_argument("--oos", action="store_true", help="show in-sample vs out-of-sample split")
    args = ap.parse_args()

    symbols = args.symbols or settings.SYMBOLS
    strategy = MeanReversionStrategy(settings.STRATEGY)

    agg_trades = 0
    agg_wins = 0
    agg_return = 0.0
    for symbol in symbols:
        df = history(symbol, period=args.period, interval=args.interval)
        if df.empty or len(df) < settings.STRATEGY.trend_period + 30:
            print(f"\n{symbol}: not enough data ({len(df)} bars) — skipping")
            continue
        bt = Backtester(strategy, RiskManager(settings.RISK))
        print(f"\n===== {symbol} ({args.interval}, {len(df)} bars, "
              f"{df.index[0].date()} → {df.index[-1].date()}) =====")
        if args.oos:
            ins, oos = bt.out_of_sample(df)
            print("--- IN-SAMPLE (first 70%) ---")
            print(ins.summary())
            print("\n--- OUT-OF-SAMPLE (last 30%, the honest test) ---")
            print(oos.summary())
            r = oos
        else:
            r = bt.run(df)
            print(r.summary())
        agg_trades += r.num_trades
        agg_wins += sum(1 for t in r.trades if t.pnl > 0)
        agg_return += r.total_return_pct

    if agg_trades:
        print("\n" + "=" * 45)
        print(f"PORTFOLIO ({'OOS' if args.oos else 'full'}): {agg_trades} trades, "
              f"{agg_wins/agg_trades*100:.0f}% win rate, "
              f"avg {agg_return/len(symbols):+.1f}% per symbol")


if __name__ == "__main__":
    main()
