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
    # INDIAN RESIDENT crypto reality (this is the honesty layer that protects real capital):
    #   1% TDS on EVERY sell (Sec 194S) = 100bps — a turnover tax you pay whether you win or lose,
    #   once yearly sell-volume crosses ₹10k (active trading of even ₹5k hits that fast). This is the
    #   dominant real cost and it dwarfs exchange fees. Separate from the 30% tax on net GAINS,
    #   which is a year-end haircut on profit (modelled in readiness, not here).
    "crypto_spot": 135.0,  # 1% TDS sell (100) + taker ~0.10%/side (20) + ~15bps slippage = ~1.35%
    "crypto_perp": 60.0,   # taker ~0.05%/side (10) + ~15bps slippage + conservative TDS hedge (VDA-derivative treatment unsettled)
    "futures":     10.0,   # index futures: low bps commission + STT sell + ~slippage
}
DEFAULT_KIND = "equity_cnc"

# options: the dominant real cost is crossing the (wide) bid-ask on EACH leg at entry AND exit,
# plus flat brokerage. Modelled as a fraction of the premium transacted per round-trip.
OPT_COST_FRAC = {"nse": 0.10, "crypto": 0.25}   # crypto: thin books (wide spreads) + 1% TDS on the sell leg


def notional_cost(entry: float, exit_px: float, qty: float, kind: str = DEFAULT_KIND) -> float:
    """Round-trip cost (currency) for a directional position closed at exit_px."""
    try:
        notional = (abs(float(entry)) + abs(float(exit_px))) * abs(float(qty)) / 2.0
        return round(notional * BPS.get(kind, BPS[DEFAULT_KIND]) / 10_000.0, 2)
    except Exception:
        return 0.0


# ---- trade-selection gates: don't feed the broker ---------------------------------------
# The quiet way to bleed an account is paying round-trip friction on trades whose edge can't
# cover it. EDGE_MULT = how many times the round-trip cost the EXPECTED favourable move must
# clear before a trade is (a) worth entering and (b) a booked profit counts as "real". This is
# cost-PROPORTIONAL by construction: barely touches cheap equity-MIS (~0.12%) and bites hard on
# crypto (~1.35% with 1% TDS) — caution scales with exactly where the friction actually hurts.
EDGE_MULT = 2.0


def cost_pct(kind: str = DEFAULT_KIND) -> float:
    """Round-trip cost as a fraction of notional (e.g. 0.0135 for crypto_spot)."""
    return BPS.get(kind, BPS[DEFAULT_KIND]) / 10_000.0


def worth_trading(price, exp_move, qty=1.0, kind: str = DEFAULT_KIND, edge_mult: float = EDGE_MULT) -> bool:
    """True only if the expected favourable move clears edge_mult × the round-trip cost.
    The entry gate that refuses marginal trades which only feed the broker. Fails safe by
    *blocking* on a bad input (0/neg move) and *allowing* on an internal calc error."""
    try:
        price = abs(float(price)); exp_move = abs(float(exp_move)); qty = abs(float(qty))
        if price <= 0 or exp_move <= 0 or qty <= 0:
            return False
        exp_win = exp_move * qty
        rt_cost = notional_cost(price, price + exp_move, qty, kind)
        return exp_win >= edge_mult * max(rt_cost, 1e-9)
    except Exception:
        return True


def options_cost(credit_currency: float, venue: str = "nse") -> float:
    """Round-trip cost (currency) for an options structure, as a fraction of the premium
    transacted (spread-crossing on every leg both ways dominates; scales with premium)."""
    try:
        return round(abs(float(credit_currency)) * OPT_COST_FRAC.get(venue, 0.10), 2)
    except Exception:
        return 0.0
