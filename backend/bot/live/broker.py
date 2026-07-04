"""Broker adapters for the live-execution plane.

  BrokerAdapter  — the uniform contract (place / cancel / status / open_orders / positions)
  ShadowBroker   — deterministic MOCK exchange for Phase-0 shadow soak (no network, no money)
  KiteBrokerAdapter / BinanceBrokerAdapter — real adapters (NEXT increment; refuse until armed)

The shadow mock is the workhorse of Phase 0: it exercises ack, (partial) fills with realistic
adverse slippage, rejects, idempotent de-dup, and keeps its OWN order book + positions so the
router's reconcile() has an authoritative "exchange" to reconcile against.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from bot import costs

from .orders import Fill, Order, OrderState, Side


class BrokerAdapter(ABC):
    @abstractmethod
    def place(self, order: Order) -> None: ...
    @abstractmethod
    def cancel(self, coid: str) -> None: ...
    @abstractmethod
    def status(self, coid: str) -> OrderState: ...
    @abstractmethod
    def open_orders(self) -> list[str]: ...
    @abstractmethod
    def positions(self) -> dict[str, float]: ...   # symbol -> signed qty


class ShadowBroker(BrokerAdapter):
    """A deterministic simulated exchange. NOT a real broker — places NO real orders.

    Slippage is modelled (adverse half of the round-trip cost) and DETERMINISTIC so tests are
    stable. Fills can be forced to PARTIAL or REJECT per-symbol via inject_* to exercise the
    router's failure handling.
    """

    def __init__(self):
        self._book: dict[str, Order] = {}          # coid -> order (its own copy = exchange truth)
        self._pos: dict[str, float] = {}           # symbol -> signed qty
        self._partial_once: set[str] = set()       # symbols that fill HALF on first touch
        self._reject: set[str] = set()             # symbols the exchange rejects
        self._fill_seq = 0

    # ---- fault injection (shadow-only) -------------------------------------------------
    def inject_partial(self, symbol: str) -> None:
        self._partial_once.add(symbol)

    def inject_reject(self, symbol: str) -> None:
        self._reject.add(symbol)

    # ---- BrokerAdapter -----------------------------------------------------------------
    def place(self, order: Order) -> None:
        existing = self._book.get(order.coid)
        if existing is not None:
            # idempotency: the exchange already knows this client-order-id. Do NOT create a
            # second order; reflect the known state back onto the caller's order object.
            order.state = existing.state
            order.filled_qty = existing.filled_qty
            order.avg_fill_price = existing.avg_fill_price
            order.broker_id = existing.broker_id
            return

        order.broker_id = f"SHDW-{len(self._book) + 1:06d}"
        order.state = OrderState.ACK
        self._book[order.coid] = order

        if order.intent.symbol in self._reject:
            order.state = OrderState.REJECTED
            order.reject_reason = "shadow: injected reject"
            return

        qty = abs(order.intent.qty)
        first_qty = qty / 2.0 if order.intent.symbol in self._partial_once else qty
        self._emit_fill(order, first_qty)

    def _emit_fill(self, order: Order, qty: float) -> None:
        self._fill_seq += 1
        px = self._fill_price(order)
        f = Fill(coid=order.coid, seq=self._fill_seq, qty=qty, price=px)
        order.apply_fill(f)
        sgn = order.intent.side.sign
        self._pos[order.intent.symbol] = self._pos.get(order.intent.symbol, 0.0) + sgn * qty
        if abs(self._pos[order.intent.symbol]) < 1e-9:
            self._pos.pop(order.intent.symbol, None)

    def complete_partial(self, coid: str) -> None:
        """Deliver the remaining qty of a partially-filled order (test drives this)."""
        order = self._book.get(coid)
        if order and order.state is OrderState.PARTIAL and order.remaining > 0:
            self._emit_fill(order, order.remaining)

    def redeliver_last_fill(self, coid: str) -> Fill:
        """Simulate the exchange re-sending an execution report (duplicate). Returns the SAME
        fill object (same seq) so the router's dedup can be tested (story G3)."""
        return self._book[coid].fills[-1]

    def _fill_price(self, order: Order) -> float:
        ref = order.intent.limit_price or order.intent.ref_price or 0.0
        half_bps = costs.cost_pct(order.intent.kind) * 10_000.0 / 2.0   # adverse HALF of round-trip
        adverse = order.intent.side.sign * (half_bps / 10_000.0) * ref  # buys fill higher, sells lower
        return round(ref + adverse, 6)

    def cancel(self, coid: str) -> None:
        o = self._book.get(coid)
        if o and not o.is_terminal:
            o.state = OrderState.CANCELLED

    def status(self, coid: str) -> OrderState:
        o = self._book.get(coid)
        return o.state if o else OrderState.NEW      # NEW == "exchange never saw it" (safe to send)

    def open_orders(self) -> list[str]:
        return [c for c, o in self._book.items() if not o.is_terminal]

    def positions(self) -> dict[str, float]:
        return dict(self._pos)

    # ---- test/recon helper: force an exchange-side position the router doesn't know about ----
    def seed_position(self, symbol: str, qty: float) -> None:
        self._pos[symbol] = qty


class _Unarmed(BrokerAdapter):
    """Base for real adapters — hard-refuses every call unless ALLOW_LIVE is armed. Prevents a
    half-built adapter from ever reaching a real exchange by accident."""

    name = "real"

    def _guard(self):
        from bot.safety import live_armed
        if not live_armed():
            raise PermissionError(f"{self.name}: refusing — ALLOW_LIVE not armed (fails safe to paper)")
        raise NotImplementedError(f"{self.name} adapter not built yet (Phase-0 next increment)")

    def place(self, order): self._guard()
    def cancel(self, coid): self._guard()
    def status(self, coid): self._guard()
    def open_orders(self): self._guard()
    def positions(self): self._guard()


class KiteBrokerAdapter(_Unarmed):
    name = "kite"


class BinanceBrokerAdapter(_Unarmed):
    name = "binance"
