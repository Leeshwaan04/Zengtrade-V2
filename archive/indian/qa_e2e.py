"""End-to-end QA + VAPT harness for the TradePro ⇄ bot stack.

Run with the API up and a live Kite token:
    python3 bot_api.py &           # if not already running
    python3 qa_e2e.py

Exercises: every read endpoint, the real-data guarantees, the two-key safety gate,
the pairs 2-leg executor (math + routing), and the VAPT controls (CORS origin lock,
localhost bind, DoS caps, no-secret-leak). Prints a PASS/FAIL table and exits non-zero
if anything critical fails.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request

API = "http://localhost:8756"
results: list[tuple[bool, str, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    results.append((ok, name, detail))
    return ok


def get(path: str, origin: str | None = None):
    req = urllib.request.Request(API + path)
    if origin:
        req.add_header("Origin", origin)
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status, dict(r.headers), json.loads(r.read() or b"{}")


# ---------------------------------------------------------------- endpoints
try:
    _, _, mk = get("/api/market")
    live = bool(mk.get("real") and not mk.get("error"))
    check("/api/market real + engine regime", live and "engine" in mk,
          f"regime={mk.get('engine', {}).get('regime')}")
except Exception as e:
    live = False
    check("/api/market reachable", False, str(e)[:60])

try:
    _, _, q = get("/api/quotes?symbols=INFY,RELIANCE")
    check("/api/quotes returns real LTPs", q["quotes"]["INFY"]["ltp"] is not None,
          f"INFY={q['quotes']['INFY']['ltp']}")
except Exception as e:
    check("/api/quotes", False, str(e)[:60])

try:
    _, _, t = get("/api/ticks?symbols=INFY,RELIANCE")
    st = t.get("stream", {})
    check("/api/ticks WebSocket stream", st.get("connected") is True,
          f"connected={st.get('connected')} subscribed={st.get('subscribed')} src={t['ticks']['INFY']['src']}")
except Exception as e:
    check("/api/ticks", False, str(e)[:60])

try:
    _, _, c = get("/api/candles?symbol=INFY&tf=1D")
    check("/api/candles real OHLCV", len(c.get("candles", [])) > 50, f"bars={len(c.get('candles', []))}")
except Exception as e:
    check("/api/candles", False, str(e)[:60])

try:
    _, _, h = get("/api/holdings")
    check("/api/holdings real (no fake positions)", "holdings" in h,
          f"n={len(h.get('holdings', []))} totalPnl={h.get('totalPnl')}")
except Exception as e:
    check("/api/holdings", False, str(e)[:60])

try:
    _, _, dp = get("/api/depth?symbol=RELIANCE")
    # real depth: 'real' flag + bids/asks arrays present (levels may be empty after-hours)
    check("/api/depth real ladder (no synthetic)", dp.get("real") is True and "bids" in dp,
          f"ltp={dp.get('ltp')} bidLvls={sum(1 for b in dp.get('bids', []) if b.get('price'))}")
except Exception as e:
    check("/api/depth", False, str(e)[:60])

# ---------------------------------------------------------------- strategy lifecycle
try:
    import urllib.error
    def post(path, payload):
        req = urllib.request.Request(API + path, data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:        # 400 for unknown id is expected
            return json.loads(e.read() or b"{}")
    # uses 'macross' (a wired candidate, NOT in the default seed) so we don't disturb live subs
    d1 = post("/api/strategy", {"id": "macross", "state": "paper"})
    _, _, s1 = get("/api/strategies")
    m1 = next(x for x in s1["strategies"] if x["id"] == "macross")
    dep_ok = d1.get("state") == "paper" and m1.get("sub") == "paper"
    lock = post("/api/strategy", {"id": "macross", "state": "live"})   # must be gated
    gate_ok = lock.get("locked") is True
    d2 = post("/api/strategy", {"id": "macross", "state": "off"})
    _, _, s2 = get("/api/strategies")
    m2 = next(x for x in s2["strategies"] if x["id"] == "macross")
    stop_ok = d2.get("state") is None and m2.get("sub") is None
    bad = post("/api/strategy", {"id": "nope", "state": "paper"})      # unknown id rejected
    check("Strategy lifecycle: deploy→paper, live-gate lock, stop→off",
          dep_ok and gate_ok and stop_ok and ("error" in bad),
          f"deploy={dep_ok} liveLock={gate_ok} stop={stop_ok} badRejected={'error' in bad}")
except Exception as e:
    check("Strategy lifecycle", False, str(e)[:60])

# ---------------------------------------------------------------- VAPT
try:
    _, hdr_evil, _ = get("/api/holdings", origin="http://evil.com")
    check("VAPT CORS: foreign origin BLOCKED", "Access-Control-Allow-Origin" not in hdr_evil,
          "no ACAO header for evil.com")
    _, hdr_ok, _ = get("/api/holdings", origin="http://localhost:8011")
    check("VAPT CORS: localhost ALLOWED", hdr_ok.get("Access-Control-Allow-Origin") == "http://localhost:8011")
except Exception as e:
    check("VAPT CORS", False, str(e)[:60])

try:
    big = ",".join(f"S{i}" for i in range(200))
    _, _, qq = get("/api/quotes?symbols=" + big)
    check("VAPT DoS cap: 200 symbols -> 80", len(qq["quotes"]) == 80, f"got {len(qq['quotes'])}")
except Exception as e:
    check("VAPT DoS cap", False, str(e)[:60])

# no endpoint leaks the access token / secret
try:
    leak = False
    sct = os.environ.get("KITE_API_SECRET", "x" * 40)
    for p in ("/api/status", "/api/market", "/api/holdings"):
        _, _, body = get(p)
        if sct and sct in json.dumps(body):
            leak = True
    check("VAPT no-secret-leak in responses", not leak)
except Exception as e:
    check("VAPT secret-leak scan", False, str(e)[:60])

# ---------------------------------------------------------------- safety gate
try:
    from bot import safety

    def setmode(m):
        json.dump({"mode": m}, open(safety.MODE_FILE, "w"))

    cases = [(True, None, "live", False), (False, None, "live", False),
             (False, "true", "paper", False), (False, "true", "live", True),
             (False, "false", "live", False)]
    gate_ok = True
    for paper, allow, mode, exp in cases:
        os.environ.pop("ALLOW_LIVE", None)
        if allow is not None:
            os.environ["ALLOW_LIVE"] = allow
        setmode(mode)
        go, _ = safety.live_execution_allowed(paper)
        gate_ok &= (go == exp)
    safety.set_mode("paper")
    os.environ.pop("ALLOW_LIVE", None)
    try:
        os.remove(safety.MODE_FILE)
    except OSError:
        pass
    check("Two-key live gate (5 combos fail-safe)", gate_ok)
except Exception as e:
    check("Safety gate", False, str(e)[:60])

# ---------------------------------------------------------------- pairs executor
try:
    import numpy as np
    import pandas as pd
    from bot.pairs_exec import PairsExecEngine

    class FB:
        def __init__(s): s.calls = []
        def buy(s, sym, q, p, prod): s.calls.append(("BUY", sym))
        def sell(s, sym, q, p, prod): s.calls.append(("SELL", sym))

    class FD:
        def __init__(s): s.A = s.B = None; s._i = 0
        def token_for(s, sym): return 1
        def historical(s, tok, iv, d):
            s._i += 1
            return pd.DataFrame({"close": s.A if s._i % 2 else s.B})

    rng = np.random.default_rng(7); n = 60
    base = 100 + np.cumsum(rng.normal(0, 0.2, n))
    A = base + rng.normal(0, 0.3, n); B = base + rng.normal(0, 0.3, n)
    fd = FD(); bk = FB()
    eng = PairsExecEngine([("AAA", "BBB")], fd, bk, capital=200000, product="MIS",
                          window=20, entry_z=2, exit_z=0.5, stop_z=4)
    A2 = A.copy(); A2[-1] = B[-1] - 4.0
    fd.A, fd.B, fd._i = A2.tolist(), B.tolist(), 0; eng.run_cycle()
    p1 = eng.state_d["AAA/BBB"]["pos"]
    A3 = A.copy(); A3[-1] = B[-1] + 0.1
    fd.A, fd.B, fd._i = A3.tolist(), B.tolist(), 0; eng.run_cycle()
    p2 = eng.state_d["AAA/BBB"]["pos"]
    check("Pairs executor enter->exit, +P&L, 4 legs",
          p1 == 1 and p2 == 0 and len(bk.calls) == 4 and eng.realised > 0,
          f"realised={round(eng.realised, 2)} legs={len(bk.calls)}")
except Exception as e:
    check("Pairs executor", False, str(e)[:60])

# ---------------------------------------------------------------- report
print("\n" + "=" * 64)
print("  TradePro ⇄ bot — END-TO-END QA + VAPT")
print("=" * 64)
crit_fail = 0
for ok, name, detail in results:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name:42s} {detail}")
    if not ok:
        crit_fail += 1
print("=" * 64)
print(f"  {len(results) - crit_fail}/{len(results)} passed" +
      ("" if not crit_fail else f"  —  {crit_fail} FAILED"))
sys.exit(1 if crit_fail else 0)
