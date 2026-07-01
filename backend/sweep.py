"""FREE strategy sweep: hunt for any configuration with a real out-of-sample edge.

Tests symbols x timeframes x parameter-configs on free yfinance data, judging
each on the OUT-OF-SAMPLE half only. Prints a matrix so we can see whether ANY
combo holds up — and flags the honest caveat (limited intraday history).
"""
from __future__ import annotations

from dataclasses import replace

from bot.yf_data import history
from bot.backtest import Backtester
from bot.risk import RiskConfig, RiskManager
from bot.strategy import MeanReversionConfig, MeanReversionStrategy

LARGE = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"]
MID = ["TATAMOTORS", "TATASTEEL", "HINDALCO", "SBIN", "AXISBANK",
       "BAJFINANCE", "ADANIENT", "JSWSTEEL"]
SYMBOLS = LARGE + MID

TIMEFRAMES = [("5m", "60d"), ("15m", "60d"), ("1h", "2y")]

BASE = MeanReversionConfig()
CONFIGS = {
    "baseline":        BASE,
    "loose_rsi35":     replace(BASE, rsi_oversold=35, rsi_exit=50),
    "tight_2.5std":    replace(BASE, bb_std=2.5, rsi_oversold=25),
    "bands_only":      replace(BASE, use_rsi=False),
    "no_trendfilter":  replace(BASE, use_trend_filter=False),
}

RISK = RiskConfig(capital=25_000)


def main() -> None:
    # fetch each (symbol, timeframe) once, reuse across configs
    cache: dict[tuple[str, str], object] = {}
    for tf, period in TIMEFRAMES:
        for sym in SYMBOLS:
            df = history(sym, period=period, interval=tf)
            cache[(sym, tf)] = df if not df.empty else None

    best = []  # (oos_ret, sym, cfg, tf, trades, win)
    for tf, _ in TIMEFRAMES:
        print(f"\n================ TIMEFRAME {tf} ================")
        print(f"{'config':16s} {'symbols':>7s} {'trades':>7s} {'win%':>6s} "
              f"{'avg_OOS%':>9s} {'sum_OOS%':>9s}")
        for name, cfg in CONFIGS.items():
            strat = MeanReversionStrategy(cfg)
            n_sym = tot_trades = tot_wins = 0
            sum_ret = 0.0
            for sym in SYMBOLS:
                df = cache.get((sym, tf))
                if df is None or len(df) < cfg.trend_period + 30:
                    continue
                oos = Backtester(strat, RiskManager(RISK)).out_of_sample(df)[1]
                n_sym += 1
                tot_trades += oos.num_trades
                tot_wins += sum(1 for t in oos.trades if t.pnl > 0)
                sum_ret += oos.total_return_pct
                if oos.num_trades >= 5:
                    best.append((oos.total_return_pct, sym, name, tf,
                                 oos.num_trades, oos.win_rate))
            if n_sym:
                win = tot_wins / tot_trades * 100 if tot_trades else 0
                print(f"{name:16s} {n_sym:>7d} {tot_trades:>7d} {win:>5.0f}% "
                      f"{sum_ret/n_sym:>+8.2f}% {sum_ret:>+8.2f}%")

    print("\n================ TOP 10 INDIVIDUAL OOS RESULTS (>=5 trades) ================")
    print("(cherry-picked single results — treat as hypotheses, NOT proof)")
    for ret, sym, cfg, tf, n, win in sorted(best, reverse=True)[:10]:
        print(f"  {ret:>+7.2f}%  {sym:11s} {cfg:15s} {tf:4s}  {n:>3d} trades  {win:.0f}% win")


if __name__ == "__main__":
    main()
