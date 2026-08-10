"""Phase-3 F&O validation — Index Futures Trend.

Runs the SAME regime-segmented, cost-netted test the equity strategies passed,
but on the indices that index futures track (NIFTY 50, NIFTY BANK). Index futures
move with spot (small, predictable basis), so a trend edge measured on the index
is a faithful proxy; we net 15 bps/side to cover futures cost + slippage.

    python3 validate_fut_trend.py

Prints per-regime average trade return so we can honestly decide whether
'Index Futures Trend' earns a 'validated' badge — or stays a candidate.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from bot.config import load_env, require
from bot import auth
from bot.data import DataFeed
from bot.backtest import Backtester
from bot.risk import RiskConfig, RiskManager
from bot.strategy_momentum import MomentumConfig, MomentumStrategy
from bot.strategies_lib import MACrossStrategy, SupertrendStrategy
from regime_backtest import classify_regime, REGIMES

INDICES = {"NIFTY 50": "NIFTY 50", "NIFTY BANK": "NIFTY BANK"}


def index_tokens(kite):
    ins = kite.instruments("NSE")
    want = {}
    for i in ins:
        if i.get("segment") == "INDICES" and i["tradingsymbol"] in INDICES:
            want[i["tradingsymbol"]] = i["instrument_token"]
    return want


def bucket_one(strat, risk, df, regime):
    out = {r: [] for r in REGIMES}
    for t in Backtester(strat, RiskManager(risk), cost_bps=15).run(df).trades:
        r = regime.asof(t.entry_time)
        if r in out:
            out[r].append(t.return_pct)
    return out


def summarise(name, buckets):
    allr = [x for r in REGIMES for x in buckets[r]]
    if not allr:
        print(f"{name:18s} no trades")
        return None
    overall = np.mean(allr)
    win = sum(1 for x in allr if x > 0) / len(allr) * 100
    cells = []
    fit = {}
    for r in REGIMES:
        rs = buckets[r]
        if rs:
            avg = np.mean(rs); w = sum(1 for x in rs if x > 0) / len(rs) * 100
            tone = "good" if avg > 0.15 else ("weak" if avg > -0.1 else "bad")
            fit[r] = [round(avg, 2), len(rs), tone]
            cells.append(f"{avg:+5.2f}%({len(rs)}/{w:.0f}%)")
        else:
            cells.append(f"{'—':>10s}")
    print(f"{name:18s} overall {overall:+.2f}%  win {win:.0f}%  n={len(allr):3d}  | " + " ".join(cells))
    return {"overall": round(overall, 2), "win": round(win), "n": len(allr), "fit": fit}


def main():
    load_env()
    kite = auth.make_kite(require("KITE_API_KEY"), require("KITE_ACCESS_TOKEN"))
    data = DataFeed(kite, exchange="NSE")
    data.load_instruments()
    toks = index_tokens(kite)
    print("Resolved index tokens:", toks)

    results = {}
    for label, tok in toks.items():
        df = data.historical(tok, "day", 1500)
        if df.empty or len(df) < 230:
            print(f"{label}: insufficient history ({len(df)})"); continue
        regime = classify_regime(df["close"])
        span = f"{df.index[0].date()} → {df.index[-1].date()}"
        print(f"\n=== {label} index futures · {span} · {len(df)} bars · 15bps/side ===")
        trend_risk = RiskConfig(capital=150000, product="NRML",
                                target_atr_mult=0.0, stop_atr_mult=2.5)
        for nm, strat in [("Momentum(Donch)", MomentumStrategy(MomentumConfig())),
                          ("MA-Cross(50/200)", MACrossStrategy()),
                          ("Supertrend", SupertrendStrategy())]:
            res = summarise(nm, bucket_one(strat, trend_risk, df, regime))
            if res:
                results[f"{label} · {nm}"] = res

    print("\n=== VERDICT INPUT (pick the best, honest config) ===")
    for k, v in sorted(results.items(), key=lambda x: -x[1]["overall"]):
        print(f"  {k:34s} {v['overall']:+.2f}%/trade  win {v['win']}%  n={v['n']}")


if __name__ == "__main__":
    main()
