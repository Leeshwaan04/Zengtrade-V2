"""Position Intelligence Engine — post-entry management ("now that we own it…").

For every OPEN position it answers, each cycle: is the original thesis still valid, how
much profit should we protect, and should we hold / protect / exit? Three principles:

  1. THESIS-DECAY, not just price-stops. Health = the live Opportunity score of the name
     (trend+momentum+volume+regime…). A strong score means the reason to own it still holds
     — so strong trends are LET RUN. A persistently weak score means the thesis has decayed.
  2. PERSISTENCE, not noise. An exit on decay only fires after the thesis is weak for several
     consecutive checks — so a single down-tick never cuts a winner short.
  3. DYNAMIC PROFIT PROTECTION. As unrealised gains grow, the protective stop ratchets up to
     lock in more profit while still leaving room for continuation.

It never imports at module load from the scorer (avoids a cycle) — score is looked up lazily.
"""
from __future__ import annotations

HEALTH_FLOOR = 50        # live score below this = thesis weakening
DECAY_EXIT_FLOOR = 45    # …and below this, persistently, = exit
PERSIST = 2              # consecutive weak checks required before acting (anti-noise)

# unrealised gain % → fraction of entry locked in as a protective stop (profit ladder)
PROFIT_LADDER = [(35, 0.25), (20, 0.12), (10, 0.05), (5, 0.0)]   # +5% → breakeven, +10% → lock 5%, …


def _profit_stop(entry: float, gain_pct: float) -> float:
    """Protective stop from the profit ladder (0 = ladder not engaged yet)."""
    for thr, lock in PROFIT_LADDER:
        if gain_pct >= thr:
            return round(entry * (1 + lock), 2)
    return 0.0


def assess(symbol: str, pos: dict, df, regime: str, cost_pct: float = 0.0, edge_mult: float = 2.0) -> dict:
    """Return the live decision for one open position: health, action, reason, new stop.

    cost_pct = round-trip friction as a fraction (e.g. 0.0135 for crypto). Once an open trade
    has cleared edge_mult × that cost, we ratchet a breakeven-AFTER-COST stop: a *real* win can
    no longer round-trip back to a loss. Crucially this is a FLOOR, not an exit — the position
    keeps running so a strong trend still captures the full move (cut losers, let winners run)."""
    try:
        from .opportunity import score_symbol      # lazy — avoids import cycle
        d = score_symbol(df, regime)
    except Exception:
        d = None
    price = float(df["close"].iloc[-1]) if len(df) else pos.get("entry", 0)
    entry = pos.get("entry", price) or price
    gain = (price / entry - 1) * 100 if entry else 0.0
    health = int(d["confidence"]) if d else 50
    sub = (d or {}).get("sub")

    # persistence counter for thesis decay
    weak = pos.get("weak", 0)
    weak = weak + 1 if health < HEALTH_FLOOR else 0

    # protective stop = max(existing stop, profit-ladder stop). Trend strength widens the floor:
    # a very strong score earns a looser ladder (let it run); a weak one we don't loosen.
    pstop = _profit_stop(entry, gain)
    # cost-aware first rung: the moment the trade clears edge_mult × its round-trip cost, lock a
    # breakeven-net-of-cost stop. This banks intraday/crypto wins the coarse %-ladder would miss,
    # while still leaving the whole upside open for a runner.
    if cost_pct > 0 and gain >= edge_mult * cost_pct * 100.0:
        pstop = max(pstop, round(entry * (1 + cost_pct), 2))
    new_stop = max(pos.get("stop", 0) or 0, pstop)

    # decide — exit ONLY on persistent decay (anti-noise); else hold, protecting profit
    if health < DECAY_EXIT_FLOOR and weak >= PERSIST:
        action = "exit"
        reason = f"thesis decayed — health {health} for {weak} checks"
    elif new_stop > (pos.get("stop", 0) or 0):
        action = "protect"
        reason = f"+{gain:.1f}% — lock stop ₹{new_stop} (win protected, upside still open)"
    elif health < HEALTH_FLOOR:
        action = "watch"
        reason = f"thesis weakening (health {health}, {weak}/{PERSIST})"
    else:
        action = "hold"
        reason = f"thesis intact (health {health})"
    return {"health": health, "action": action, "reason": reason, "newStop": new_stop,
            "weak": weak, "gainPct": round(gain, 2), "sub": sub}
