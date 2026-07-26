"""zengtrade — shared paper engine (the ONE place trading logic lives).

Both the live worker and the backtest evaluator import THIS, so what's measured is exactly what
trades — the honesty principle. It reuses the strategy signals from the bot package and adds the
cautious rails proven to matter: a cost-aware entry gate, an anti-churn cooldown, a breakeven-
after-cost profit lock, and let-a-runner-run at target.

Costs are the GLOBAL crypto rate (no India TDS) because zengtrade's customers are global.
"""
from __future__ import annotations
import math

GLOBAL_BPS   = 35.0      # round-trip: ~0.20% fees + ~0.15% slippage, no TDS
PAPER_NOTIONAL = 1000.0
DEFAULTS = dict(edge_mult=2.0, cooldown_bars=6, stop_atr=2.0, target_atr=3.0)

def cost_pct():                    return GLOBAL_BPS / 10_000.0
def rt_cost(entry, exit_px, qty):  return round((abs(entry)+abs(exit_px))*abs(qty)/2.0*GLOBAL_BPS/10_000.0, 6)

def _num(x):
    try:
        f = float(x); return None if math.isnan(f) else f
    except Exception:
        return None

def worth_trading(price, exp_move, edge_mult):
    """Only trade when the expected favourable move clears edge_mult x the round-trip cost.
    Cost-proportional: refuses marginal trades that only feed fees."""
    if price <= 0 or exp_move <= 0: return False
    return exp_move >= edge_mult * price * cost_pct()

def step(strat, row, sym, positions, cooldown, ts, bar_i, cfg=DEFAULTS):
    """Advance one bar for one symbol. Mutates positions/cooldown. Returns a closed trade or None.

    Entry: strategy signal AND past cooldown AND expected move clears the cost gate.
    Manage: ratchet a breakeven-after-cost stop; at target, let a still-trending winner run.
    Exit:  stop / target(capped) / strategy signal -> book pnl net of honest cost."""
    atr = _num(row.get("atr"))
    if atr is None or atr <= 0: return None
    price = _num(row.get("close"))
    if price is None or price <= 0: return None
    held = positions.get(sym)

    if held:
        entry, qty = held["entry"], held["qty"]
        # profit lock: once the trade clears edge_mult x cost, a real win can't round-trip to a loss
        if price >= entry * (1 + cfg["edge_mult"] * cost_pct()):
            held["stop"] = max(held["stop"], round(entry * (1 + cost_pct()), 8))
        # trend/runner mode (no fixed target): trail the stop up behind price
        if not held["target"]:
            held["stop"] = max(held["stop"], round(price - cfg["stop_atr"] * atr, 8))
        reason = None
        if price <= held["stop"]:
            reason = "stop"
        elif held["target"] and price >= held["target"]:
            if bool(strat._exit_long(row)):            # trend broke -> take the target
                reason = "target"
            else:                                       # trend intact -> uncap & trail (let it run)
                held["target"] = 0.0
                held["stop"] = max(held["stop"], round(entry * (1 + cost_pct()), 8))
        elif bool(strat._exit_long(row)):
            reason = "signal"
        if reason:
            cost = rt_cost(entry, price, qty); pnl = round((price - entry) * qty - cost, 6)
            positions.pop(sym); cooldown[sym] = bar_i + cfg["cooldown_bars"]
            return dict(sym=sym, qty=qty, entry=entry, exit=price, pnl=pnl, cost=cost,
                        opened=held["opened"], closed=ts, reason=reason)
        return None

    # flat -> consider entry
    if bar_i < cooldown.get(sym, -1): return None      # anti-churn cooldown
    if not bool(strat._entry_long(row)): return None
    stop   = round(price - cfg["stop_atr"] * atr, 8)
    target = round(price + cfg["target_atr"] * atr, 8) if cfg["target_atr"] > 0 else 0.0
    exp_move = (target - price) if target > 0 else cfg["stop_atr"] * atr * 1.5
    if not worth_trading(price, exp_move, cfg["edge_mult"]):
        return None                                     # edge gate: not worth the fees
    qty = round(PAPER_NOTIONAL / price, 8)
    positions[sym] = dict(qty=qty, entry=price, stop=stop, target=target, opened=ts)
    return None
