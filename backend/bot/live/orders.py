"""Order lifecycle model for the live-execution plane.

A real broker order is NOT the paper harness's instant buy/sell — it has a lifecycle
(NEW → ACK → PARTIAL → FILLED | REJECTED | CANCELLED) that can stall, partial-fill, or
arrive out of order. Modelling it explicitly is what lets shadow mode prove the failure
paths (timeout, duplicate fill, partial) before real money is involved.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

    @property
    def sign(self) -> int:
        return 1 if self is Side.BUY else -1


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"          # marketable-limit with a slippage cap (preferred over raw market)


class OrderState(str, Enum):
    NEW = "NEW"             # created locally, not yet acknowledged
    ACK = "ACK"            # exchange acknowledged
    PARTIAL = "PARTIAL"    # partially filled
    FILLED = "FILLED"      # fully filled (terminal)
    REJECTED = "REJECTED"  # exchange rejected (terminal)
    CANCELLED = "CANCELLED"  # cancelled (terminal)
    ERROR = "ERROR"        # local/transport error (terminal)


TERMINAL = {OrderState.FILLED, OrderState.REJECTED, OrderState.CANCELLED, OrderState.ERROR}


@dataclass(frozen=True)
class OrderIntent:
    """What the signal engine WANTS — book-agnostic. The router turns it into an Order."""
    strategy: str
    symbol: str
    side: Side
    qty: float
    kind: str = "equity_mis"          # cost bucket (drives slippage/cost model)
    order_type: OrderType = OrderType.LIMIT
    ref_price: float = 0.0            # the price the decision was made on (for slippage measurement)
    limit_price: float | None = None
    is_exit: bool = False            # exits are never blocked by max-open (must always de-risk)
    reason: str = ""

    @property
    def notional(self) -> float:
        px = self.limit_price or self.ref_price or 0.0
        return abs(self.qty) * abs(px)


@dataclass
class Fill:
    coid: str
    seq: int                 # per-order fill sequence — dedupes a re-delivered fill event
    qty: float
    price: float


@dataclass
class Order:
    coid: str                # deterministic client-order-id (idempotency key)
    intent: OrderIntent
    state: OrderState = OrderState.NEW
    filled_qty: float = 0.0
    avg_fill_price: float = 0.0
    broker_id: str | None = None
    reject_reason: str = ""
    fills: list[Fill] = field(default_factory=list)
    _seen_fill_seqs: set = field(default_factory=set)

    @property
    def remaining(self) -> float:
        return max(0.0, abs(self.intent.qty) - self.filled_qty)

    @property
    def is_terminal(self) -> bool:
        return self.state in TERMINAL

    def apply_fill(self, fill: Fill) -> bool:
        """Fold a fill in. Returns False (idempotent no-op) if this fill seq was already seen —
        the guard against a broker re-delivering the same execution report (story G3)."""
        if fill.seq in self._seen_fill_seqs:
            return False
        self._seen_fill_seqs.add(fill.seq)
        self.fills.append(fill)
        prior = self.filled_qty
        self.filled_qty = prior + fill.qty
        # running VWAP of fills
        self.avg_fill_price = (
            (self.avg_fill_price * prior + fill.price * fill.qty) / self.filled_qty
            if self.filled_qty else 0.0
        )
        self.state = OrderState.FILLED if self.remaining <= 1e-9 else OrderState.PARTIAL
        return True


def client_order_id(strategy: str, symbol: str, side: Side, seq: int) -> str:
    """Deterministic idempotency key. The SAME logical order retried yields the SAME id, so the
    exchange (or the shadow mock) dedupes it — no double orders on retry/reconnect (stories A2/G4).
    Different (strategy, symbol, side, seq) tuples can never collide."""
    safe_sym = symbol.replace(":", "_").replace("|", "_")
    return f"{strategy}.{safe_sym}.{side.value}.{seq}"
