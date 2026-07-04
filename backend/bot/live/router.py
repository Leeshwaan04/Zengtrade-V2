"""OrderRouter — the one gate every real order passes through.

Responsibilities (all enforced BEFORE anything reaches a broker):
  • preconditions: kill-switch, live gate (ALLOW_LIVE), per-strategy allowlist, hard caps
  • idempotency: deterministic client-order-ids so retries/reconnects never double-send
  • fills & positions: fold (partial) fills, dedupe re-delivered execution reports
  • reconcile(): the exchange is the source of truth for real money
  • kill(): one call flattens + disables; auto-fires on daily-loss breach

In shadow mode the broker is ShadowBroker, so all of the above runs for real with zero capital.
"""
from __future__ import annotations

import logging

from .broker import BrokerAdapter
from .config import LiveConfig, load
from .orders import Order, OrderIntent, OrderState, Side, client_order_id

log = logging.getLogger("live")


class Refusal(Exception):
    """Raised (and caught/logged) when a submit is refused by a rail. Not an error — a guardrail."""


class OrderRouter:
    def __init__(self, broker: BrokerAdapter, config: LiveConfig | None = None,
                 mode: str = "shadow"):
        self.broker = broker
        self.cfg = config or load()
        self.mode = mode                       # "shadow" | "live"
        self.orders: dict[str, Order] = {}
        self.positions: dict[str, float] = {}  # local view; reconcile() trues it to the exchange
        self.day_pnl = 0.0
        self.killed = False
        self.kill_reason = ""
        self._seq: dict[tuple, int] = {}       # (strategy,symbol,side) -> monotonic order counter

    # ---- preconditions -----------------------------------------------------------------
    def _open_count(self) -> int:
        return sum(1 for q in self.positions.values() if abs(q) > 1e-9)

    def _precheck(self, intent: OrderIntent) -> None:
        if self.killed:
            raise Refusal(f"kill-switch active ({self.kill_reason})")
        if intent.qty <= 0:
            raise Refusal("non-positive qty")
        # the two-key live gate — only enforced in live mode; shadow deliberately skips ALLOW_LIVE
        if self.mode == "live":
            if not self.cfg.armed:
                raise Refusal("ALLOW_LIVE not armed -> fails safe to paper")
            if not self.cfg.allows_strategy(intent.strategy):
                raise Refusal(f"'{intent.strategy}' not in LIVE_ALLOWED_STRATEGIES")
        # hard caps (enforced in BOTH shadow and live so the soak proves them)
        if intent.notional > self.cfg.max_order_notional:
            raise Refusal(f"notional {intent.notional:.0f} > cap {self.cfg.max_order_notional:.0f}")
        # max-open never blocks an EXIT — you must always be able to reduce risk
        if not intent.is_exit and self._open_count() >= self.cfg.max_open \
                and abs(self.positions.get(intent.symbol, 0.0)) < 1e-9:
            raise Refusal(f"max_open {self.cfg.max_open} reached")

    # ---- submit ------------------------------------------------------------------------
    def submit(self, intent: OrderIntent, resend_of: Order | None = None) -> Order | None:
        # RESEND — recovery of an order the router already committed to. Only the kill-switch
        # applies (never re-run ENTRY caps on a recovery), and we ALWAYS query the exchange
        # before re-placing so a slow ack can't cause a double-fill (stories A2/C3).
        if resend_of is not None:
            if self.killed:
                log.info("[%s] REFUSE resend %s — kill-switch (%s)",
                         intent.strategy, resend_of.coid, self.kill_reason)
                return None
            order = resend_of
            st = self.broker.status(order.coid)
            if st is not OrderState.NEW:
                log.info("[%s] resend skipped — exchange already has %s (%s)",
                         intent.strategy, order.coid, st.value)
                order.state = st
                return order
            self.broker.place(order)           # exchange never saw it -> safe to (re)place
            self._sync_position_from(order)
            self._check_daily_loss()
            return order

        # FRESH order — full pre-flight, then mint the next deterministic coid
        try:
            self._precheck(intent)
        except Refusal as r:
            log.info("[%s] REFUSE %s %s — %s", intent.strategy, intent.side.value, intent.symbol, r)
            return None
        key = (intent.strategy, intent.symbol, intent.side)
        self._seq[key] = self._seq.get(key, 0) + 1
        coid = client_order_id(intent.strategy, intent.symbol, intent.side, self._seq[key])
        order = Order(coid=coid, intent=intent)
        self.orders[coid] = order

        self.broker.place(order)               # shadow: mock exchange; live: real (guarded)
        self._sync_position_from(order)
        log.info("[%s] %s %s %s qty=%.4f -> %s @%.4f (coid=%s)", intent.strategy, self.mode,
                 intent.side.value, intent.symbol, intent.qty, order.state.value,
                 order.avg_fill_price, order.coid)
        self._check_daily_loss()
        return order

    def on_partial_complete(self, order: Order) -> None:
        """Called when the remaining qty of a PARTIAL fills (feed/broker driven). Re-syncs position."""
        self._sync_position_from(order)

    def _sync_position_from(self, order: Order) -> None:
        """Recompute this symbol's local position from the order's *net* filled qty since we last
        synced it. Uses the order's fill ledger so a re-delivered (deduped) fill can't double-count."""
        # recompute the symbol position from ALL known orders' filled qty (authoritative, dedup-safe)
        net = 0.0
        for o in self.orders.values():
            if o.intent.symbol == order.intent.symbol:
                net += o.intent.side.sign * o.filled_qty
        if abs(net) < 1e-9:
            self.positions.pop(order.intent.symbol, None)
        else:
            self.positions[order.intent.symbol] = net

    # ---- reconciliation ----------------------------------------------------------------
    def reconcile(self) -> list[str]:
        """Pull the broker's positions and true local state to them. Exchange wins. Returns the
        list of symbols that diverged (logged loudly)."""
        broker_pos = self.broker.positions()
        diverged = []
        for sym in set(broker_pos) | set(self.positions):
            b = broker_pos.get(sym, 0.0)
            l = self.positions.get(sym, 0.0)
            if abs(b - l) > 1e-9:
                diverged.append(sym)
                log.warning("RECONCILE %s: local %.4f != broker %.4f -> taking broker truth", sym, l, b)
                if abs(b) < 1e-9:
                    self.positions.pop(sym, None)
                else:
                    self.positions[sym] = b
        return diverged

    # ---- kill-switch -------------------------------------------------------------------
    def record_pnl(self, delta: float) -> None:
        self.day_pnl += delta
        self._check_daily_loss()

    def _check_daily_loss(self) -> None:
        if not self.killed and self.day_pnl <= -abs(self.cfg.max_daily_loss):
            self.kill(f"daily loss {self.day_pnl:.0f} <= -{self.cfg.max_daily_loss:.0f}")

    def kill(self, reason: str) -> dict:
        """Flatten everything and disable new entries until reset(). One call, hard stop."""
        self.killed = True
        self.kill_reason = reason
        flatten = []
        for sym, q in list(self.positions.items()):
            if abs(q) < 1e-9:
                continue
            side = Side.SELL if q > 0 else Side.BUY
            coid = f"KILL.{sym}.{side.value}"
            o = Order(coid=coid, intent=OrderIntent(
                strategy="kill", symbol=sym, side=side, qty=abs(q), is_exit=True))
            try:
                self.broker.place(o)
                self.orders[coid] = o
                flatten.append(sym)
            except Exception:
                log.exception("kill: flatten failed for %s", sym)
        self.positions = {s: q for s, q in self.broker.positions().items() if abs(q) > 1e-9}
        log.error("KILL-SWITCH: %s — flattened %s", reason, flatten)
        return {"killed": True, "reason": reason, "flattened": flatten}

    def reset(self) -> None:
        """Manual re-enable after a kill. Deliberately NOT callable from the API."""
        self.killed = False
        self.kill_reason = ""
        self.day_pnl = 0.0
