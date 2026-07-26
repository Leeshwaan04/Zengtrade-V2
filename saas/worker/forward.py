#!/usr/bin/env python3
"""zengtrade — forward-paper tracker for the PROVEN strategies.

Runs the validated engine (engine.step) on LIVE Binance data going forward — out-of-sample, the
honest test that must pass before a single dollar is real. Unlike the backtest/replay, this only
ever acts on the LATEST bar, so the track record it builds is genuine forward evidence. State +
trade log persist to disk so it survives restarts and accumulates over days/weeks.

  python forward.py --once     # one live cycle
  python forward.py            # continuous (checks hourly; strategies are daily-bar)
"""
from __future__ import annotations
import os, sys, json, time, argparse, warnings
from datetime import datetime, timezone
warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
import engine as E
import strategies as X
from strategies import BOT  # ensures bot path on sys.path
from bot.crypto_data import CryptoDataFeed

UNIVERSE = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]
FEATURED = ["trend_follow", "momo"]          # only proven-edge, low-turnover strategies
STATE = os.path.join(HERE, "forward_state.json")
LOG   = os.path.join(HERE, "forward_track.jsonl")
FEED = CryptoDataFeed()

def _load():
    try: return json.load(open(STATE))
    except Exception: return {"positions": {}, "realised": {}, "closed": 0, "started": None}

def _save(s): json.dump(s, open(STATE, "w"), indent=2)

def cycle(verbose=True):
    s = _load()
    if not s["started"]: s["started"] = datetime.now(timezone.utc).isoformat()
    opened = closed = 0
    for key in FEATURED:
        strat = X.make(key); ivl = X.interval(key); cfg = X.cfg_for(key, E.DEFAULTS)
        pos = s["positions"].setdefault(key, {})
        for sym in UNIVERSE:
            df = FEED.historical(sym, ivl, 300)
            if df is None or df.empty or len(df) < 60: continue
            ind = strat.compute(df); row = ind.iloc[-1]
            had = sym in pos
            t = E.step(strat, row, sym, pos, {}, str(row.name), len(ind) - 1, cfg)
            if t:
                s["realised"][key] = round(s["realised"].get(key, 0.0) + t["pnl"], 4)
                s["closed"] += 1; closed += 1
                rec = dict(t, strategy=key, at=datetime.now(timezone.utc).isoformat())
                open(LOG, "a").write(json.dumps(rec) + "\n")
            elif not had and sym in pos:
                opened += 1
    _save(s)
    tot = round(sum(s["realised"].values()), 2)
    openpos = sum(len(p) for p in s["positions"].values())
    if verbose:
        print(f"  {datetime.now().strftime('%H:%M')} · forward net ${tot} · {s['closed']} closed · "
              f"{openpos} open · +{opened} entries/-{closed} exits this cycle")
    return tot

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--once", action="store_true")
    ap.add_argument("--interval", type=int, default=3600); a = ap.parse_args()
    print(f"forward-paper tracker · {', '.join(FEATURED)} · universe={len(UNIVERSE)} · global costs ~35bps")
    if a.once: cycle()
    else:
        while True:
            try: cycle()
            except Exception as e: print("  cycle error:", str(e)[:100])
            time.sleep(a.interval)

if __name__ == "__main__": main()
