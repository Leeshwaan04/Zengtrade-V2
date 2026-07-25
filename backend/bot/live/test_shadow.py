"""Phase-0 shadow-execution tests — one test per built user story.

Run standalone (no pytest needed):  python3 -m bot.live.test_shadow
Each test maps to a story ID in USER_STORIES.md and asserts the real logic against the mock
exchange. Green here == the execution spine is proven with zero capital at risk.
"""
from __future__ import annotations

from .binance_client import BinanceRestClient
from .broker import ShadowBroker
from .config import LiveConfig
from .orders import Order, OrderIntent, OrderState, Side
from .router import OrderRouter


def _cfg(**kw) -> LiveConfig:
    base = dict(armed=False, allowed=frozenset(), max_order_notional=10_000.0,
                max_daily_loss=1_000.0, max_open=1, feed_stale_sec=10.0,
                order_timeout_sec=5.0, max_slippage_bps=30.0)
    base.update(kw)
    return LiveConfig(**base)


def _intent(strategy="lowvol", symbol="BTCUSDT", side=Side.BUY, qty=0.01,
            kind="crypto_spot", ref=60_000.0, is_exit=False):
    return OrderIntent(strategy=strategy, symbol=symbol, side=side, qty=qty,
                       kind=kind, ref_price=ref, is_exit=is_exit)


# ---- A1: submit -> fill, position + adverse slippage ---------------------------------
def test_A1_submit_and_fill():
    r = OrderRouter(ShadowBroker(), _cfg())
    o = r.submit(_intent(qty=0.01))
    assert o.state is OrderState.FILLED, o.state
    assert abs(r.positions["BTCUSDT"] - 0.01) < 1e-9
    # buy fills ABOVE ref (adverse slippage), by ~half the round-trip cost
    assert o.avg_fill_price > 60_000.0, o.avg_fill_price
    assert abs(o.avg_fill_price - 60_000.0 * (1 + 0.0135 / 2)) < 1.0


# ---- A2 / G4: idempotent resend never double-fills -----------------------------------
def test_A2_idempotent_resend():
    r = OrderRouter(ShadowBroker(), _cfg())
    o = r.submit(_intent(qty=0.01))
    filled_before = o.filled_qty
    again = r.submit(o.intent, resend_of=o)          # retry the SAME order
    assert again is o
    assert o.filled_qty == filled_before             # no second fill
    assert abs(r.positions["BTCUSDT"] - 0.01) < 1e-9  # position not doubled
    # two DIFFERENT orders get DIFFERENT coids
    r2 = OrderRouter(ShadowBroker(), _cfg(max_open=5))
    a = r2.submit(_intent(symbol="ETHUSDT", ref=3000, qty=0.1))
    b = r2.submit(_intent(symbol="BNBUSDT", ref=600, qty=1))
    assert a.coid != b.coid


# ---- A3 / G5: hard caps refuse -------------------------------------------------------
def test_A3_caps():
    # over-notional
    r = OrderRouter(ShadowBroker(), _cfg(max_order_notional=500.0))
    assert r.submit(_intent(qty=0.01, ref=60_000)) is None       # 600 notional > 500 cap
    assert "BTCUSDT" not in r.positions
    # max-open blocks a 2nd DISTINCT entry, but never an exit
    r2 = OrderRouter(ShadowBroker(), _cfg(max_open=1))
    r2.submit(_intent(symbol="BTCUSDT", qty=0.01))
    assert r2.submit(_intent(symbol="ETHUSDT", ref=3000, qty=0.1)) is None   # 2nd name refused
    exit_o = r2.submit(_intent(symbol="BTCUSDT", side=Side.SELL, qty=0.01, is_exit=True))
    assert exit_o is not None and exit_o.state is OrderState.FILLED           # exit allowed
    assert "BTCUSDT" not in r2.positions                                       # flat again


# ---- A4: two-key live gate fails safe ------------------------------------------------
def test_A4_live_gate_fails_safe():
    # live mode + NOT armed -> refused
    r = OrderRouter(ShadowBroker(), _cfg(armed=False), mode="live")
    assert r.submit(_intent()) is None
    # live mode + armed but strategy not on the allowlist -> refused
    r2 = OrderRouter(ShadowBroker(), _cfg(armed=True, allowed=frozenset({"other"})), mode="live")
    assert r2.submit(_intent(strategy="lowvol")) is None
    # live mode + armed + allowlisted -> allowed
    r3 = OrderRouter(ShadowBroker(), _cfg(armed=True, allowed=frozenset({"lowvol"})), mode="live")
    assert r3.submit(_intent(strategy="lowvol")).state is OrderState.FILLED


# ---- B2: injected reject -------------------------------------------------------------
def test_B2_reject():
    b = ShadowBroker(); b.inject_reject("BTCUSDT")
    r = OrderRouter(b, _cfg())
    o = r.submit(_intent())
    assert o.state is OrderState.REJECTED
    assert "BTCUSDT" not in r.positions


# ---- C2: partial fill then completion ------------------------------------------------
def test_C2_partial_fill():
    b = ShadowBroker(); b.inject_partial("BTCUSDT")
    r = OrderRouter(b, _cfg())
    o = r.submit(_intent(qty=0.01))
    assert o.state is OrderState.PARTIAL
    assert abs(o.filled_qty - 0.005) < 1e-9
    assert abs(r.positions["BTCUSDT"] - 0.005) < 1e-9
    b.complete_partial(o.coid); r.on_partial_complete(o)
    assert o.state is OrderState.FILLED
    assert abs(r.positions["BTCUSDT"] - 0.01) < 1e-9


# ---- C1: reconcile takes broker truth ------------------------------------------------
def test_C1_reconcile():
    b = ShadowBroker()
    r = OrderRouter(b, _cfg())
    b.seed_position("ETHUSDT", 0.5)          # exchange has a position the router doesn't know
    diverged = r.reconcile()
    assert diverged == ["ETHUSDT"]
    assert abs(r.positions["ETHUSDT"] - 0.5) < 1e-9


# ---- C3: ambiguous state -> query before resend --------------------------------------
def test_C3_timeout_query_before_resend():
    b = ShadowBroker()
    r = OrderRouter(b, _cfg())
    o = r.submit(_intent(qty=0.01))          # already ACK/FILLED on the exchange
    filled = o.filled_qty
    r.submit(o.intent, resend_of=o)          # a timeout-triggered resend
    assert o.filled_qty == filled            # status showed it exists -> NOT resent
    # the "exchange never saw it" branch: a fresh, unplaced order -> status NEW -> proceeds
    ghost = Order(coid="lowvol.XRPUSDT.BUY.99", intent=_intent(symbol="XRPUSDT", ref=0.5, qty=10))
    r.orders[ghost.coid] = ghost
    r.submit(ghost.intent, resend_of=ghost)
    assert ghost.state is OrderState.FILLED


# ---- G3: duplicate execution report deduped ------------------------------------------
def test_G3_duplicate_fill_deduped():
    b = ShadowBroker()
    r = OrderRouter(b, _cfg())
    o = r.submit(_intent(qty=0.01))
    dup = b.redeliver_last_fill(o.coid)      # exchange re-sends the same fill
    applied = o.apply_fill(dup)              # router folds an incoming fill
    r._sync_position_from(o)
    assert applied is False                  # dedup by fill seq
    assert abs(r.positions["BTCUSDT"] - 0.01) < 1e-9   # NOT doubled


# ---- E2 / F2: daily-loss kill-switch flattens + disables -----------------------------
def test_E2_kill_switch():
    r = OrderRouter(ShadowBroker(), _cfg(max_daily_loss=500.0, max_open=3))
    r.submit(_intent(symbol="BTCUSDT", qty=0.01))
    assert "BTCUSDT" in r.positions
    r.record_pnl(-600.0)                     # breach
    assert r.killed is True
    assert "BTCUSDT" not in r.positions      # flattened
    assert r.submit(_intent(symbol="ETHUSDT", ref=3000, qty=0.1)) is None  # entries disabled
    r.reset()
    assert r.killed is False


# ---- F1: config is env-sourced and has NO setter -------------------------------------
def test_F1_config_no_setter():
    c = _cfg()
    assert not hasattr(c, "__setattr__") or _is_frozen(c)   # dataclass(frozen=True)
    assert c.allows_strategy("x") is False


def _is_frozen(c) -> bool:
    try:
        object.__setattr__  # noqa
        c.max_open = 999
        return False
    except Exception:
        return True


# ---- B3: real adapter refuses until armed --------------------------------------------
def test_B3_real_adapter_refuses_unarmed():
    # the REAL Binance adapter: any signed/live call must fail safe unless the two-key OS lock is armed.
    c = BinanceRestClient()
    try:
        c.new_order({"symbol": "BTCUSDT", "side": "BUY", "type": "MARKET", "quantity": 0.01})
        assert False, "should have refused a signed order while unarmed"
    except (PermissionError, NotImplementedError):
        pass


def run_all() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
        except Exception as e:
            print(f"  ERROR {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{passed}/{len(tests)} passed")
    return 0 if passed == len(tests) else 1


if __name__ == "__main__":
    import sys
    sys.exit(run_all())
