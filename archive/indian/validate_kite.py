"""CAPSTONE VALIDATION on clean Kite Connect data — the real-money test.

Runs all three strategies on authoritative broker data (the SAME feed you'd
trade on), out-of-sample, with realistic costs:
  1. Pairs (survivors)  — clean daily
  2. Momentum/breakout  — clean daily
  3. Mean-reversion     — clean 5-min intraday

Needs an active Kite Connect subscription + a fresh access token (run login.py).
"""
from __future__ import annotations

import numpy as np

from bot.config import load_env, require
from bot import auth
from bot.data import DataFeed
from bot.backtest import Backtester
from bot.risk import RiskConfig, RiskManager
from bot.strategy import MeanReversionConfig, MeanReversionStrategy
from bot.strategy_momentum import MomentumConfig, MomentumStrategy
from bot.pairs import out_of_sample, run_pair

PAIRS = [("TATASTEEL", "JSWSTEEL"), ("INFY", "WIPRO"),
         ("HDFCBANK", "ICICIBANK"), ("ICICIBANK", "AXISBANK")]
UNIVERSE = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "TATASTEEL",
            "HINDALCO", "SBIN", "AXISBANK", "JSWSTEEL", "MARUTI", "LT", "WIPRO"]


def main() -> None:
    load_env()
    kite = auth.make_kite(require("KITE_API_KEY"), require("KITE_ACCESS_TOKEN"))
    data = DataFeed(kite, exchange="NSE")
    data.load_instruments()

    daily: dict[str, object] = {}
    intra: dict[str, object] = {}

    def d(sym):
        if sym not in daily:
            daily[sym] = data.historical(data.token_for(sym), "day", 1500)
        return daily[sym]

    def i5(sym):
        if sym not in intra:
            intra[sym] = data.historical(data.token_for(sym), "5minute", 60)
        return intra[sym]

    # 1) PAIRS -----------------------------------------------------------------
    print("\n=== 1) PAIRS (survivors) — clean Kite daily, OOS, 15bps/leg ===")
    print(f"{'pair':22s} {'OOS_ret':>8s} {'OOS_shrp':>8s} {'trades':>6s} {'win%':>5s}")
    sh = []
    for a, b in PAIRS:
        ca, cb = d(a), d(b)
        if ca.empty or cb.empty:
            continue
        bt = run_pair(ca["close"], cb["close"], window=30, entry_z=2.0,
                      exit_z=0.5, cost_bps=15.0)
        if bt is None:
            continue
        _, oos = out_of_sample(bt)
        sh.append(oos["sharpe"])
        print(f"{a+'/'+b:22s} {oos['total']:>+7.1f}% {oos['sharpe']:>8.2f} "
              f"{oos['n_trades']:>6d} {oos['win_rate']:>4.0f}%")
    if sh:
        print(f"  --> mean OOS Sharpe: {np.mean(sh):+.2f}")

    # 2) MOMENTUM --------------------------------------------------------------
    print("\n=== 2) MOMENTUM / breakout — clean Kite daily, OOS, 15bps ===")
    mstrat = MomentumStrategy(MomentumConfig())
    mrisk = RiskConfig(capital=25_000, target_atr_mult=0.0, stop_atr_mult=2.5)
    tr = wins = n = 0
    sret = 0.0
    for sym in UNIVERSE:
        df = d(sym)
        if df.empty or len(df) < 130:
            continue
        oos = Backtester(mstrat, RiskManager(mrisk), cost_bps=15).out_of_sample(df)[1]
        n += 1; tr += oos.num_trades
        wins += sum(1 for t in oos.trades if t.pnl > 0); sret += oos.total_return_pct
    if tr:
        print(f"  {tr} trades, {wins/tr*100:.0f}% win, avg {sret/n:+.2f}%/symbol, "
              f"total {sret:+.1f}%")

    # 3) MEAN-REVERSION --------------------------------------------------------
    print("\n=== 3) MEAN-REVERSION — clean Kite 5-min intraday, OOS, 10bps ===")
    rstrat = MeanReversionStrategy(MeanReversionConfig())
    rrisk = RiskConfig(capital=25_000)
    tr = wins = n = 0
    sret = 0.0
    for sym in UNIVERSE:
        df = i5(sym)
        if df.empty or len(df) < 230:
            continue
        oos = Backtester(rstrat, RiskManager(rrisk), cost_bps=10).out_of_sample(df)[1]
        n += 1; tr += oos.num_trades
        wins += sum(1 for t in oos.trades if t.pnl > 0); sret += oos.total_return_pct
    if tr:
        print(f"  {tr} trades, {wins/tr*100:.0f}% win, avg {sret/n:+.2f}%/symbol, "
              f"total {sret:+.1f}%")

    print("\nDecision bar: pairs OOS Sharpe >0.8 consistent = worth paper-trading; "
          "everything ~0 = no edge, stop.")


if __name__ == "__main__":
    main()
