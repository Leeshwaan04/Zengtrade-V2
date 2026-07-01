"""FREE backtest of the momentum/breakout strategy on yfinance data.

    python run_momentum_free.py                       # default universe, 5y daily, OOS
    python run_momentum_free.py --period 5y --interval 1d

Long-only breakout, so daily delivery is fine and we get years of free history
across multiple regimes — a fair test.
"""
from __future__ import annotations

import argparse

from bot.yf_data import history
from bot.backtest import Backtester
from bot.risk import RiskConfig, RiskManager
from bot.strategy_momentum import MomentumConfig, MomentumStrategy

UNIVERSE = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
            "TATAMOTORS", "TATASTEEL", "HINDALCO", "SBIN", "AXISBANK",
            "BAJFINANCE", "ADANIENT", "JSWSTEEL", "MARUTI", "LT"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--period", default="5y")
    ap.add_argument("--interval", default="1d")
    args = ap.parse_args()

    symbols = args.symbols or UNIVERSE
    strat = MomentumStrategy(MomentumConfig())
    # target_atr_mult=0 -> no fixed target, let the Donchian exit ride the trend
    risk = RiskConfig(capital=25_000, target_atr_mult=0.0, stop_atr_mult=2.5)

    n = trades = wins = 0
    sum_ret = 0.0
    rows = []
    for sym in symbols:
        df = history(sym, period=args.period, interval=args.interval)
        if df.empty or len(df) < 130:
            continue
        oos = Backtester(strat, RiskManager(risk)).out_of_sample(df)[1]
        n += 1
        trades += oos.num_trades
        wins += sum(1 for t in oos.trades if t.pnl > 0)
        sum_ret += oos.total_return_pct
        rows.append((sym, oos.num_trades, oos.win_rate, oos.total_return_pct,
                     oos.max_drawdown_pct))

    print(f"\n=== MOMENTUM / BREAKOUT — OUT-OF-SAMPLE ({args.interval}, {args.period}) ===")
    print(f"{'symbol':12s} {'trades':>7s} {'win%':>6s} {'OOS%':>8s} {'maxDD%':>8s}")
    for sym, t, w, r, dd in rows:
        print(f"{sym:12s} {t:>7d} {w:>5.0f}% {r:>+7.2f}% {dd:>7.2f}%")
    if trades:
        print("-" * 45)
        print(f"PORTFOLIO: {trades} trades, {wins/trades*100:.0f}% win, "
              f"avg {sum_ret/n:+.2f}%/symbol, total {sum_ret:+.1f}%")


if __name__ == "__main__":
    main()
