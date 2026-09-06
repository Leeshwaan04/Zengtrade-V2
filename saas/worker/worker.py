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
            err = str(e).lower()
            if "password authentication failed" in err or "invalid authorization specification" in err:
                print("  HINT: DATABASE_URL password is wrong — reset in Supabase Connect, update Railway, redeploy", flush=True)
            elif "does not exist" in err and "postgres" in err:
                print("  HINT: use session pooler URI (port 5432) from Supabase Connect — not API keys", flush=True)
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
        # SECURITY FIX (2026-09-06): `deployment.params` is a bare jsonb column with no CHECK
        # constraint requiring it to be an object. Any authenticated user could set it (via a
        # direct REST/PATCH call, bypassing the Builder UI entirely) to a plain jsonb scalar, 
        # a string, number, array, or bool. json.loads() on anything but a dict/str raises
        # TypeError, and json.loads() on a non-JSON string raises JSONDecodeError; either one
        # was previously uncaught here, crashing this whole process, and since the offending
        # deployment row persists with status='running', the worker crash-looped on every
        # restart, taking paper trading down for every customer, not just the one bad row.
        # Now anything that isn't a dict, or a string that doesn't decode to one, is just
        # treated as an invalid spec (same as validate_spec() already does for a malformed-but-
        # well-typed dict) instead of raising.
        if isinstance(params, dict):
            raw_spec = params
        elif isinstance(params, str):
            try:
                raw_spec = json.loads(params)
            except (TypeError, ValueError):
                raw_spec = None
        else:
            raw_spec = None
        spec = X.validate_spec(raw_spec) if isinstance(raw_spec, dict) else None
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
    for uid,skey,params in deps:
        # RELIABILITY FIX (2026-09-06): one deployment's exception (a bug in a specific
        # indicator, a transient data-feed hiccup, a DB write conflict) used to abort this
        # entire loop, silently skipping every OTHER user's strategy for the rest of the cycle
        # and never reaching heartbeat() below, indistinguishable from the worker being fully
        # down. Isolate each deployment so one bad row can only cost that one row's trades.
        try:
            tot += _process(cur, uid, skey, params, replay_days)
        except Exception as e:
            print(f"  ! deployment {uid}/{skey} failed this cycle, skipping: {e}", flush=True)
            conn.rollback()
            cur = conn.cursor()
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
            while True:
                # RELIABILITY FIX (2026-09-06): this loop had no exception handling at all, so
                # any uncaught error from run_cycle() (a DB connection drop mid-cycle, etc.)
                # crashed the whole process. Railway's restart policy then relaunched it, which
                # hits the exact same failure immediately if it's a persistent condition (a bad
                # DATABASE_URL, a poisoned row), producing a silent crash-loop rather than a
                # process that stays up and keeps trying. Log and keep the process alive instead;
                # per-deployment errors are already isolated inside run_cycle() above, so this
                # only catches genuinely unexpected top-of-cycle failures (e.g. connection loss).
                try:
                    run_cycle(conn)
                except Exception as e:
                    print(f"  ! cycle failed: {e}", flush=True)
                    try:
                        conn.rollback()
                    except Exception:
                        conn = db_with_retry()
                time.sleep(a.interval)
    finally: conn.close()

if __name__=="__main__": main()
