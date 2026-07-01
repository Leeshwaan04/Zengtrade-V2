"""Broker abstraction with a Paper (simulated) and a live Kite implementation.

ALWAYS test against PaperBroker first. KiteBroker places REAL orders with REAL
money. The interface is intentionally tiny: place a market order and read back
positions/holdings.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Position:
    symbol: str
    qty: int
    avg_price: float
    stop: float = 0.0
    target: float = 0.0
    opened_at: datetime = field(default_factory=datetime.now)


@dataclass
class Fill:
    symbol: str
    side: str           # "BUY" | "SELL"
    qty: int
    price: float
    order_id: str
    at: datetime = field(default_factory=datetime.now)


class Broker(ABC):
    @abstractmethod
    def buy(self, symbol: str, qty: int, price: float, product: str) -> Fill: ...

    @abstractmethod
    def sell(self, symbol: str, qty: int, price: float, product: str) -> Fill: ...


class PaperBroker(Broker):
    """Simulated broker. Fills instantly at the supplied price and tracks P&L."""

    def __init__(self, starting_cash: float = 100_000.0):
        self.cash = starting_cash
        self.starting_cash = starting_cash
        self.positions: dict[str, Position] = {}
        self.fills: list[Fill] = []
        self.realised_pnl = 0.0
        self._oid = 0

    def _next_id(self) -> str:
        self._oid += 1
        return f"PAPER-{self._oid:06d}"

    def buy(self, symbol, qty, price, product="MIS") -> Fill:
        cost = qty * price
        self.cash -= cost
        pos = self.positions.get(symbol)
        if pos:
            new_qty = pos.qty + qty
            pos.avg_price = (pos.avg_price * pos.qty + price * qty) / new_qty
            pos.qty = new_qty
        else:
            self.positions[symbol] = Position(symbol, qty, price)
        fill = Fill(symbol, "BUY", qty, price, self._next_id())
        self.fills.append(fill)
        return fill

    def sell(self, symbol, qty, price, product="MIS") -> Fill:
        pos = self.positions.get(symbol)
        if pos:
            pnl = (price - pos.avg_price) * min(qty, pos.qty)
            self.realised_pnl += pnl
            pos.qty -= qty
            if pos.qty <= 0:
                del self.positions[symbol]
        self.cash += qty * price
        fill = Fill(symbol, "SELL", qty, price, self._next_id())
        self.fills.append(fill)
        return fill

    def equity(self, marks: dict[str, float]) -> float:
        """Cash + mark-to-market value of open positions."""
        mtm = sum(p.qty * marks.get(s, p.avg_price) for s, p in self.positions.items())
        return self.cash + mtm


class KiteBroker(Broker):
    """Live broker wrapping kiteconnect. Places MARKET orders on NSE.

    Every order is stamped with `algo_tag` (max 20 chars). SEBI's retail-algo
    framework expects automated orders to carry a strategy/algo identifier;
    tagging also lets you filter these trades in your Kite order book.
    """

    def __init__(self, kite, exchange: str = "NSE", algo_tag: str = "meanrev_bot"):
        self.kite = kite
        self.exchange = exchange
        self.algo_tag = algo_tag[:20]  # Kite caps tags at 20 chars

    def _order(self, symbol, qty, side, product) -> Fill:
        order_id = self.kite.place_order(
            variety=self.kite.VARIETY_REGULAR,
            exchange=self.exchange,
            tradingsymbol=symbol,
            transaction_type=side,
            quantity=qty,
            product=product,            # MIS or CNC
            order_type=self.kite.ORDER_TYPE_MARKET,
            tag=self.algo_tag,
        )
        # Market orders fill ~immediately; price is read back by the engine via LTP.
        return Fill(symbol, side, qty, 0.0, str(order_id))

    def buy(self, symbol, qty, price, product="MIS") -> Fill:
        return self._order(symbol, qty, self.kite.TRANSACTION_TYPE_BUY, product)

    def sell(self, symbol, qty, price, product="MIS") -> Fill:
        return self._order(symbol, qty, self.kite.TRANSACTION_TYPE_SELL, product)

    def positions(self) -> list[dict]:
        return self.kite.positions().get("net", [])
