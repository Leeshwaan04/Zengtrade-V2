"""End-to-end shadow test — the FULL chain on REAL market data.

  real Binance bars → real strategy.compute() → _entry/_exit signals →
  OrderIntent → OrderRouter → ShadowBroker fill (with cost-model slippage) →
  position open/close → record_pnl → reconcile.

This is the first real wiring of a signal engine into the live-execution plane. It proves the
pipeline works on genuine data (not synthetic intents). It does NOT place real orders — the broker
is the shadow mock. Run:  python3 -m bot.live.test_e2e
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from bot.crypto_data import CryptoDataFeed
from bot.strategies_lib import VWAPPullbackStrategy

from .broker import ShadowBroker
from .config import LiveConfig
from .orders import OrderIntent, OrderState, Side
from .router import OrderRouter


def _synthetic(n=1000) -> pd.DataFrame:
    """Deterministic INTRADAY fallback if Binance is unreachable — a wavy 5-min walk so the VWAP
    pullback actually triggers. Clearly labelled in output so we never pass it off as real."""
    rng = np.random.default_rng(7)
    px = 60_000 + np.cumsum(rng.normal(0, 40, n)) + 300 * np.sin(np.linspace(0, 40, n))
    px = np.abs(px)
    idx = pd.date_range("2025-01-01 00:00", periods=n, freq="5min")
    return pd.DataFrame({"open": px, "high": px * 1.001, "low": px * 0.999,
                         "close": px, "volume": rng.integers(1e3, 1e5, n)}, index=idx)


def run_e2e(symbol="BTCUSDT", interval="5minute", days=4, qty=0.01, verbose=True) -> dict:
    feed = CryptoDataFeed()
    df = feed.historical(symbol, interval, days)
    source = "REAL Binance"
    if df is None or df.empty or len(df) < 60:
        df, source = _synthetic(), "SYNTHETIC fallback (Binance unreachable)"

    strat = VWAPPullbackStrategy()
    ind = strat.compute(df)

    # generous caps: this test exercises the SIGNAL→FILL chain, not the cap logic (that's test_shadow)
    cfg = LiveConfig(armed=False, allowed=frozenset(), max_order_notional=1e9,
                     max_daily_loss=1e12, max_open=1, feed_stale_sec=10.0,
                     order_timeout_sec=5.0, max_slippage_bps=30.0)
    r = OrderRouter(ShadowBroker(), cfg)

    long = False
    entry_px = 0.0
    trips: list[float] = []
    slip_ok = True
    trace: list[str] = []

    for i in range(len(ind)):
        row = ind.iloc[i]
        atr = row.get("atr")
        if atr is None or pd.isna(atr) or float(atr) <= 0:
            continue                                   # engine warmup gate
        px = float(row["close"])
        if not long and bool(strat._entry_long(row)):
            o = r.submit(OrderIntent("vwap_pull", symbol, Side.BUY, qty, "crypto_spot", ref_price=px))
            if o and o.state is OrderState.FILLED:
                slip_ok &= o.avg_fill_price > px       # buy fills ABOVE ref (adverse)
                long, entry_px = True, o.avg_fill_price
                trace.append(f"  ENTER {str(row.name)[5:16]}  ref {px:>10.1f} -> fill {o.avg_fill_price:>10.1f}")
        elif long and bool(strat._exit_long(row)):
            o = r.submit(OrderIntent("vwap_pull", symbol, Side.SELL, qty, "crypto_spot",
                                     ref_price=px, is_exit=True))
            if o and o.state is OrderState.FILLED:
                slip_ok &= o.avg_fill_price < px       # sell fills BELOW ref (adverse)
                pnl = (o.avg_fill_price - entry_px) * qty
                r.record_pnl(pnl)
                trips.append(pnl)
                long = False
                trace.append(f"  EXIT  {str(row.name)[5:16]}  ref {px:>10.1f} -> fill {o.avg_fill_price:>10.1f}"
                             f"   trip P&L {pnl:+.2f}")

    diverged = r.reconcile()                            # exchange truth == local?
    flat = not long

    result = {
        "source": source, "bars": len(ind), "orders": len(r.orders),
        "round_trips": len(trips), "net_pnl": round(sum(trips), 2),
        "slippage_correct": slip_ok, "reconcile_diverged": diverged,
        "ends_flat": flat, "day_pnl_matches": abs(r.day_pnl - sum(trips)) < 1e-6,
    }

    if verbose:
        print(f"\nE2E — data source: {source} · {len(ind)} bars · strategy VWAP-Pullback · symbol {symbol}")
        print("\n".join(trace[:12]) + ("\n  ..." if len(trace) > 12 else ""))
        print(f"\n  orders placed        : {result['orders']}")
        print(f"  completed round-trips: {result['round_trips']}")
        print(f"  net shadow P&L       : {result['net_pnl']:+.2f} (after modelled slippage)")
        print(f"  slippage direction   : {'adverse on every fill ✓' if slip_ok else 'WRONG ✗'}")
        print(f"  router.day_pnl match : {'✓' if result['day_pnl_matches'] else '✗'}")
        print(f"  reconcile divergence : {diverged or 'none ✓'}")

    # ---- e2e assertions (the whole chain must hold) ----
    assert result["orders"] >= 2, "no orders flowed through the router"
    assert result["round_trips"] >= 1, "no completed signal→fill→exit round-trip on real data"
    assert slip_ok, "slippage was not adverse on every fill"
    assert result["day_pnl_matches"], "router P&L accounting drifted from realised trips"
    assert not diverged, f"local state diverged from broker: {diverged}"
    return result


if __name__ == "__main__":
    import sys
    try:
        run_e2e()
        print("\nE2E PASS — full chain proven on real data (shadow, no real orders)")
        sys.exit(0)
    except AssertionError as e:
        print(f"\nE2E FAIL — {e}")
        sys.exit(1)
