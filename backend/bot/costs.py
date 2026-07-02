"""Round-trip transaction-cost model — the honesty layer between paper and live.

Paper fills at the bar close with ZERO friction. Live pays brokerage, statutory charges
(STT/GST/exchange/SEBI/stamp) and — the big one — SLIPPAGE (you don't get the close; you
cross the spread and move the book). Live P&L is reliably WORSE than paper, and for fast
intraday/scalping strategies the gap can erase the entire edge. Booking these costs at every
exit is what makes the forward-paper track record an honest predictor of live results.

These are ESTIMATES, deliberately conservative, not fabricated precision — a single
round-trip cost in basis points of traded notional, tuned per instrument/product. Tune the
numbers in one place as real fills teach you the true slippage.
"""
from __future__ import annotations

# total ROUND-TRIP cost in basis points of the average traded notional (entry+exit legs)
BPS = {
    "equity_mis":  12.0,   # intraday: brokerage 0.03%×2 + STT 0.025% sell + txn+GST ≈6bps + ~6bps slippage
    "equity_cnc":  22.0,   # delivery: STT 0.1% sell dominant + stamp + txn+GST ≈14bps + ~8bps slippage
    "crypto_spot": 25.0,   # Binance taker ~0.10%/side (20bps) + ~5bps slippage
    "crypto_perp": 15.0,   # perp taker ~0.05%/side (10bps) + ~5bps slippage (funding modelled separately)
    "futures":     10.0,   # index futures: low bps commission + STT sell + ~slippage
}
DEFAULT_KIND = "equity_cnc"

# options: the dominant real cost is crossing the (wide) bid-ask on EACH leg at entry AND exit,
# plus flat brokerage. Modelled as a fraction of the premium transacted per round-trip.
OPT_COST_FRAC = {"nse": 0.10, "crypto": 0.15}   # crypto option books are thinner → wider spreads


def notional_cost(entry: float, exit_px: float, qty: float, kind: str = DEFAULT_KIND) -> float:
    """Round-trip cost (currency) for a directional position closed at exit_px."""
    try:
        notional = (abs(float(entry)) + abs(float(exit_px))) * abs(float(qty)) / 2.0
        return round(notional * BPS.get(kind, BPS[DEFAULT_KIND]) / 10_000.0, 2)
    except Exception:
        return 0.0


def options_cost(credit_currency: float, venue: str = "nse") -> float:
    """Round-trip cost (currency) for an options structure, as a fraction of the premium
    transacted (spread-crossing on every leg both ways dominates; scales with premium)."""
    try:
        return round(abs(float(credit_currency)) * OPT_COST_FRAC.get(venue, 0.10), 2)
    except Exception:
        return 0.0
