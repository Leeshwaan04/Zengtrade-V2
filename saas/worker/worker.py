#!/usr/bin/env python3
"""zengtrade — multi-tenant paper worker.

For every ACTIVE paper deployment (all users), runs the strategy on LIVE Binance data through the
SHARED engine (engine.step) — so what trades live is exactly what the evaluator validated — and
writes each user's results into their own rows. Powers the honest track record = the no-CAC engine.

  DATABASE_URL=... python worker.py --once        # one live cycle
  DATABASE_URL=... python worker.py --replay 800  # backfill real history (demo/seed)
  DATABASE_URL=... python worker.py               # continuous
"""
from __future__ import annotations
import os, sys, time, json, argparse, warnings
warnings.filterwarnings("ignore")
import psycopg2
import engine as E
import strategies as X

# Self-contained env loading: supervisors (launchd/systemd) don't reliably run shell
# export tricks, and a silent fallback to the dev DB is exactly the failure we never
# want in production. Load .env beside this file, THEN resolve, and say which DB won.
if "DATABASE_URL" not in os.environ:
    _envp = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(_envp):
        for _line in open(_envp):
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k, _v)
DATABASE_URL = os.environ.get("DATABASE_URL", "dbname=zengtrade_dev")
print("db:", "supabase" if "supabase.com" in DATABASE_URL else DATABASE_URL, flush=True)
UNIVERSE = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"]
from strategies import BOT  # ensures bot path added
from bot.crypto_data import CryptoDataFeed
FEED = CryptoDataFeed()

def db():
    return psycopg2.connect(DATABASE_URL)

def db_with_retry(attempts=5, delay=4):
    """Railway/Render cold starts can lag DNS — retry before exiting."""
    last = None
    for i in range(attempts):
        try:
            c = db()
            c.autocommit = False
            return c
        except Exception as e:
            last = e
            if i < attempts - 1:
                print(f"  db connect retry {i + 1}/{attempts}: {e}", flush=True)
                time.sleep(delay)
    raise last
def active(cur):
    cur.execute("select user_id, strategy_key, params from deployment where mode='paper' and status='running'")
    return cur.fetchall()
def load_book(cur, uid, skey):
    cur.execute("select positions, realised from book_state where user_id=%s and strategy_key=%s",(uid,skey))
    r=cur.fetchone()
    if not r: return {},0.0
    return (r[0] if isinstance(r[0],dict) else json.loads(r[0] or "{}")), float(r[1] or 0)
def save_book(cur, uid, skey, pos, real):
    cur.execute("""insert into book_state (user_id,strategy_key,positions,realised,updated_at)
        values (%s,%s,%s,%s,now()) on conflict (user_id,strategy_key)
        do update set positions=excluded.positions, realised=excluded.realised, updated_at=now()""",
        (uid,skey,json.dumps(pos),real))
def write_trade(cur, uid, skey, t):
    cur.execute("""insert into trade (user_id,strategy_key,symbol,side,qty,entry,exit,pnl,cost,is_live,opened_at,closed_at)
        values (%s,%s,%s,'BUY',%s,%s,%s,%s,%s,false,%s,%s)""",
        (uid,skey,t["sym"],t["qty"],t["entry"],t["exit"],t["pnl"],t["cost"],t["opened"],t["closed"]))

def _process(cur, uid, skey, params=None, replay_days=None):
    universe = UNIVERSE
    if params:                                    # user-composed strategy (Builder spec)
        spec = X.validate_spec(params if isinstance(params, dict) else json.loads(params))
        if not spec: return 0
        strat = X.RuleStrategy(spec); ivl = spec["interval"]
        base = dict(E.DEFAULTS)
        cfg = dict(base, target_atr=0.0, stop_atr=3.0, cooldown_bars=12) if spec["style"] == "trend" \
              else dict(base, target_atr=3.0, stop_atr=2.0)
        if spec["universe"]: universe = [s for s in UNIVERSE if s in spec["universe"]] or UNIVERSE
    elif skey in X.REGISTRY:
        strat=X.make(skey); ivl=X.interval(skey); cfg=X.cfg_for(skey, E.DEFAULTS)
    else:
        return 0
    limit = (max(replay_days,4) if "min" in ivl else max(replay_days,250)) if replay_days else (4 if "min" in ivl else 300)
    pos, real = load_book(cur, uid, skey); n=0
    for sym in universe:
        df=FEED.historical(sym, ivl, limit)
        if df is None or df.empty or len(df)<60: continue
        ind=strat.compute(df)
        rng = range(len(ind)) if replay_days else [len(ind)-1]
        for i in rng:
            t=E.step(strat, ind.iloc[i], sym, pos, {}, str(ind.iloc[i].name), i, cfg)
            if t: real+=t["pnl"]; n+=1; write_trade(cur,uid,skey,t)
    save_book(cur, uid, skey, pos, round(real,4)); return n

def heartbeat(cur, deps, trades):
    """Prove the worker is alive EVERY cycle, even with zero deployments — so the admin
    'Worker: Live' signal reflects the process, not whether any customer has deployed."""
    cur.execute("""insert into engine_state (key, value, updated_at)
        values ('_worker_heartbeat', %s::jsonb, now())
        on conflict (key) do update set value=excluded.value, updated_at=now()""",
        (json.dumps({"deployments": deps, "trades": trades}),))

def run_cycle(conn, replay_days=None):
    cur=conn.cursor(); deps=active(cur); tot=0
    for uid,skey,params in deps: tot+=_process(cur,uid,skey,params,replay_days)
    heartbeat(cur, len(deps), tot)
    conn.commit(); return len(deps), tot

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--once",action="store_true")
    ap.add_argument("--replay",type=int); ap.add_argument("--interval",type=int,default=300)
    a=ap.parse_args(); conn=db_with_retry()
    print(f"zengtrade worker · {len(X.FEATURED)} featured strategies · universe={len(UNIVERSE)}", flush=True)
    try:
        # Prove the process is alive before the first 5-min cycle (Railway deploy health).
        cur = conn.cursor()
        heartbeat(cur, 0, 0)
        conn.commit()
        print("  startup heartbeat ok", flush=True)
        if a.replay: d,n=run_cycle(conn,a.replay); print(f"  replay {a.replay}d: {n} trades across {d} deployments")
        elif a.once: d,n=run_cycle(conn); print(f"  cycle: {d} deployments · {n} closed")
        else:
            while True: run_cycle(conn); time.sleep(a.interval)
    finally: conn.close()

if __name__=="__main__": main()
