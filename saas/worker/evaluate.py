#!/usr/bin/env python3
"""zengtrade — strategy evaluation harness (the edge-tuning loop).

Replays REAL Binance history through the shared engine and reports honest, cost-adjusted metrics.
Backtest == live because both use engine.step(). Find/tune a strategy that clears the bar — or
prove honestly that none do yet.

  python evaluate.py --days 800      # score every strategy
  python evaluate.py --sweep KEY     # sweep cooldown x edge_mult for one strategy
"""
from __future__ import annotations
import os, sys, argparse, warnings
warnings.filterwarnings("ignore")
BOT = os.path.expanduser("~/kite-mean-reversion-bot")
if BOT not in sys.path: sys.path.insert(0, BOT)

from bot.crypto_data import CryptoDataFeed
from bot import strategies_lib as S
import bot.indicators as IND
import engine as E
import pandas as pd

UNIVERSE = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]

# ---- crypto-native trend follower: breakout entry + engine's trailing (chandelier) exit ----
class TrendFollow:
    def __init__(self, hi=20, trend=100, atr=14): self.hi=hi; self.trend=trend; self.atr=atr
    def compute(self, df):
        out=df.copy(); c=out["close"]
        out["atr"]=IND.atr(out["high"], out["low"], out["close"], self.atr)
        out["hiN"]=c.rolling(self.hi).max().shift(1)
        out["trend_sma"]=c.rolling(self.trend).mean()
        out["bb_lower"]=out["trend_sma"]
        return out
    def _entry_long(self, row):
        h,t,px=row.get("hiN"),row.get("trend_sma"),row.get("close")
        if h is None or t is None or pd.isna(h) or pd.isna(t): return False
        return px>h and px>t
    def _exit_long(self, row): return False
class Momo(TrendFollow):
    def __init__(self): super().__init__(hi=10, trend=50)

STRATS = {
    "vwap_pull":    (S.VWAPPullbackStrategy,  "5minute"),
    "vwap_rev":     (S.VWAPRevStrategy,       "5minute"),
    "vwap_mom":     (S.VWAPMomStrategy,       "5minute"),
    "ema_scalp":    (S.EMAScalpStrategy,      "5minute"),
    "relvol_brk":   (S.RelVolBreakoutStrategy,"5minute"),
    "rsi_intraday": (S.IntradayRSIStrategy,   "5minute"),
    "orb":          (S.ORBStrategy,           "5minute"),
    "bollinger":    (S.BollingerRevStrategy,  "day"),
    "zscore":       (S.ZScoreRevStrategy,     "day"),
    "supertrend":   (S.SupertrendStrategy,    "day"),
    "macross":      (S.MACrossStrategy,       "day"),
    "trend_follow": (TrendFollow,             "day"),
    "momo":         (Momo,                    "day"),
}
TREND = {"supertrend","macross","vwap_mom","ema_scalp","relvol_brk","orb","trend_follow","momo"}
def cfg_for(key, base):
    if key in TREND: return dict(base, target_atr=0.0, stop_atr=3.0)   # ride + trail
    return dict(base, target_atr=3.0, stop_atr=2.0)                     # reversion: target

FEED = CryptoDataFeed(); _CACHE = {}
def bars(sym, ivl, days):
    k=(sym,ivl,days)
    if k not in _CACHE: _CACHE[k]=FEED.historical(sym, ivl, days)
    return _CACHE[k]

def run(key, cfg, days):
    Strat, ivl = STRATS[key]; strat = Strat()
    limit = max(days,4) if "min" in ivl else max(days,250)
    trades=[]
    for sym in UNIVERSE:
        df = bars(sym, ivl, limit)
        if df is None or df.empty or len(df) < 60: continue
        ind = strat.compute(df); positions, cooldown = {}, {}
        for i in range(len(ind)):
            t = E.step(strat, ind.iloc[i], sym, positions, cooldown, str(ind.iloc[i].name), i, cfg)
            if t: trades.append(t)
    return trades

def metrics(trades, days):
    n=len(trades)
    if n==0: return dict(trades=0,per_day=0,win=0,net=0,gross=0,exp=0,pf=0,mdd=0,cost=0)
    pnls=[t["pnl"] for t in trades]; costs=sum(t["cost"] for t in trades)
    wins=[p for p in pnls if p>0]; losses=[p for p in pnls if p<=0]
    net=sum(pnls); eq=peak=mdd=0
    for p in pnls: eq+=p; peak=max(peak,eq); mdd=min(mdd,eq-peak)
    pf=(sum(wins)/abs(sum(losses))) if losses and sum(losses)!=0 else (99.0 if wins else 0)
    return dict(trades=n, per_day=round(n/max(days,1),2), win=round(100*len(wins)/n,1),
                net=round(net,1), gross=round(net+costs,1), exp=round(net/n,3),
                pf=round(pf,2), mdd=round(mdd,1), cost=round(costs,1))

def verdict(m):
    if m["trades"]<20: return "gathering"
    if m["exp"]>0 and m["pf"]>=1.15 and m["net"]>0: return "PROMISING"
    return "unfit"

def show(rows):
    print(f"\n{'strategy':13} {'trades':>7} {'win%':>6} {'net$':>9} {'exp$':>8} {'PF':>6} {'maxDD$':>9}  verdict")
    print("-"*78)
    for key,m in rows:
        v=verdict(m); flag={"PROMISING":"* ","unfit":"  ","gathering":"~ "}.get(v,"")
        print(f"{key:13} {m['trades']:>7} {m['win']:>6} {m['net']:>9} {m['exp']:>8} {m['pf']:>6} {m['mdd']:>9}  {flag}{v}")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=800)
    ap.add_argument("--sweep", metavar="KEY")
    a=ap.parse_args()
    if a.sweep:
        print(f"SWEEP {a.sweep} · {a.days}d real data")
        rows=[]
        for cd in (3,6,12,24):
            for em in (1.5,2.0,3.0):
                cfg=cfg_for(a.sweep, dict(E.DEFAULTS, cooldown_bars=cd, edge_mult=em))
                rows.append((f"cd={cd:>2} edge={em}", metrics(run(a.sweep,cfg,a.days), a.days)))
        show(rows)
    else:
        print(f"ALL STRATEGIES · {a.days}d real Binance data · global costs (~35bps)")
        rows=[(k, metrics(run(k, cfg_for(k,E.DEFAULTS), a.days), a.days)) for k in STRATS]
        rows.sort(key=lambda r: r[1]["net"], reverse=True)
        show(rows)
        print("\n  * PROMISING = >=20 trades, positive net-of-cost expectancy, PF>=1.15")

if __name__=="__main__": main()
