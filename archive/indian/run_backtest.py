"""Backtest the strategy on historical Kite data before risking capital.

    python run_backtest.py RELIANCE            # one symbol
    python run_backtest.py                      # all symbols in settings.SYMBOLS
    python run_backtest.py RELIANCE --oos       # honest out-of-sample split

Uses settings.STRATEGY / settings.RISK so what you backtest == what you trade.
The --oos flag splits history 70/30 and reports each half separately: judge the
strategy by the OUT-OF-SAMPLE numbers, since that's data it wasn't tuned on.
"""
from __future__ import annotations

import sys

import settings
from bot.config import load_env, require
from bot import auth
from bot.backtest import Backtester
from bot.data import DataFeed
from bot.risk import RiskManager
from bot.strategy import MeanReversionStrategy


def main() -> None:
    load_env()
    kite = auth.make_kite(require("KITE_API_KEY"), require("KITE_ACCESS_TOKEN"))
    data = DataFeed(kite, exchange="NSE")
    data.load_instruments()

    strategy = MeanReversionStrategy(settings.STRATEGY)
    args = sys.argv[1:]
    oos = "--oos" in args
    symbols = [a for a in args if not a.startswith("--")] or settings.SYMBOLS

    for symbol in symbols:
        token = data.token_for(symbol)
        df = data.historical(token, settings.INTERVAL, settings.HISTORY_DAYS)
        if df.empty:
            print(f"{symbol}: no data")
            continue
        bt = Backtester(strategy, RiskManager(settings.RISK))
        print(f"\n===== {symbol} ({settings.INTERVAL}, {len(df)} bars) =====")
        if oos:
            in_s, out_s = bt.out_of_sample(df)
            print("--- IN-SAMPLE (first 70%, for tuning) ---")
            print(in_s.summary())
            print("\n--- OUT-OF-SAMPLE (last 30%, the honest test) ---")
            print(out_s.summary())
        else:
            print(bt.run(df).summary())


if __name__ == "__main__":
    main()
