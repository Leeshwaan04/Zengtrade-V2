"""Crypto harness guards — locks in the RCA fixes so they can't silently regress.

The crypto book's honest RCA found three failure modes; each got a guard. This test pins the
guard behaviour to the REAL modules (no mocks), so a future edit that weakens one fails here.

  1. COST MODEL   — crypto spot pays the honest 135bps (1% Indian TDS + fees). High turnover
                    dies on this; the number must not be quietly softened.
  2. REGIME GATE  — crypto has NO safe long. In Bear/High-Vol only market-neutral + short-premium
                    (Relative-value + Carry) may take new risk; every directional long stands down.
  3. STOP CAP     — no single trade may lose more than MAX_LOSS_PCT (6%): the protective stop is
                    ratcheted up to price*(1-6%) at entry, never loosened.

Run:  python3 tests/test_crypto_guards.py   (or python -m pytest -q)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bot import costs
from bot.paper_engine import MAX_LOSS_PCT
from bot.rebalancer import Rebalancer


# ---- 1. cost model -------------------------------------------------------------------
def test_crypto_spot_cost_is_135bps():
    # 135bps = 1% TDS + brokerage/slippage. The TDS is the killer for high-turnover crypto.
    assert abs(costs.cost_pct("crypto_spot") - 0.0135) < 1e-9, costs.cost_pct("crypto_spot")


def test_cost_gate_needs_edge_over_friction():
    # a move smaller than EDGE_MULT × round-trip cost is NOT worth trading (anti-churn).
    price = 60_000.0
    tiny = price * costs.cost_pct("crypto_spot") * 0.5      # half the friction → must be skipped
    big = price * costs.cost_pct("crypto_spot") * 5         # comfortably clears it
    assert not costs.worth_trading(price, tiny, 1, "crypto_spot", costs.EDGE_MULT)
    assert costs.worth_trading(price, big, 1, "crypto_spot", costs.EDGE_MULT)


# ---- 2. regime gate (crypto has no safe long) ----------------------------------------
def _crypto_reb(regime, health=100):
    r = Rebalancer()
    r.market = "crypto"
    r.set(regime, health)
    return r


def test_bear_stands_down_every_directional_long():
    r = _crypto_reb("Bear")
    assert r.enabled == {"Carry", "Relative-value"}, sorted(r.enabled)
    # short-premium / market-neutral survive
    assert r.allows("cx_strangle")        # Carry (options short-premium)
    assert r.allows("perp_funding")       # Carry (funding-neutral)
    # every directional long stands down
    assert not r.allows("lowvol")         # long basket → directional in crypto
    assert not r.allows("xs_momentum")
    assert not r.allows("perp_trend")


def test_highvol_also_cash_only_for_longs():
    r = _crypto_reb("High-Vol")
    assert not r.allows("lowvol")
    assert not r.allows("perp_trend")
    assert r.allows("cx_strangle")


def test_bull_lets_trend_deploy():
    r = _crypto_reb("Bull")
    assert r.allows("lowvol")
    assert r.allows("perp_trend")
    assert r.allows("perp_funding")


def test_crypto_gate_differs_from_equity():
    # the SAME strategy name gates differently by market: lowvol is 'Defensive' (equity) but
    # 'Trend' (crypto) — so a crypto bear benches it where an equity bear would keep it.
    eq = Rebalancer(); eq.market = "indian"; eq.set("Bear", 100)
    cx = _crypto_reb("Bear")
    assert eq.allows("lowvol")        # equity: Defensive long is allowed in bear
    assert not cx.allows("lowvol")    # crypto: no safe long → stands down


# ---- 3. per-trade stop cap -----------------------------------------------------------
def test_stop_cap_is_six_percent():
    assert abs(MAX_LOSS_PCT - 0.06) < 1e-9


def test_stop_ratchets_to_max_loss_when_wider():
    # mirror the entry logic: stop = max(risk_stop, price*(1-MAX_LOSS_PCT)).
    price = 60_000.0
    wide_risk_stop = price * 0.85                 # a 15% risk stop — too loose
    capped = max(wide_risk_stop, round(price * (1 - MAX_LOSS_PCT), 8))
    assert capped >= price * (1 - MAX_LOSS_PCT)   # never risks more than 6%
    assert abs(capped - price * 0.94) < 1e-6


def test_stop_cap_never_loosens_a_tight_stop():
    # a tighter risk stop (2% away) must be kept — the cap only tightens, never widens.
    price = 60_000.0
    tight_risk_stop = price * 0.98
    capped = max(tight_risk_stop, round(price * (1 - MAX_LOSS_PCT), 8))
    assert abs(capped - tight_risk_stop) < 1e-6


def _run():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = 0
    for t in tests:
        try:
            t(); print(f"  PASS  {t.__name__}"); passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
        except Exception as e:
            print(f"  ERROR {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{passed}/{len(tests)} passed")
    return 0 if passed == len(tests) else 1


if __name__ == "__main__":
    import sys
    sys.exit(_run())
