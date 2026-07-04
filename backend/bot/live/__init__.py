"""Live-execution plane (Phase 0: shadow mode).

Turns a strategy's intent into a broker order with the full real-order lifecycle, hard risk
rails, idempotency, reconciliation and a kill-switch — validated against a mock exchange so
every path is proven before real money. See USER_STORIES.md and ../../LIVE_EXECUTION_SPEC.md.
"""
from .broker import BinanceBrokerAdapter, BrokerAdapter, KiteBrokerAdapter, ShadowBroker
from .config import LiveConfig, load
from .orders import Order, OrderIntent, OrderState, OrderType, Side
from .router import OrderRouter, Refusal

__all__ = [
    "OrderRouter", "Refusal", "ShadowBroker", "BrokerAdapter",
    "KiteBrokerAdapter", "BinanceBrokerAdapter", "LiveConfig", "load",
    "Order", "OrderIntent", "OrderState", "OrderType", "Side",
]
