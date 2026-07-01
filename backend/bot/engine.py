"""Live/paper trading engine: the main loop that ties everything together.

Each cycle (e.g. every 5 min, matched to your candle interval):
  1. pull recent candles for each symbol
  2. ask the strategy for a Decision on the latest completed bar
  3. apply risk gates (max positions, daily-loss breaker, sizing)
  4. place orders through the broker (paper or live)
  5. enforce stop-loss / target on open positions
  6. for MIS, square off everything before the cutoff time

Run this on a scheduler (cron / a `while True` with sleep) during market hours.
A single `run_cycle()` call is one decision pass — easy to test and to schedule.
"""
from __future__ import annotations

import logging
from datetime import datetime, time

from .broker import Broker, Position
from .data import DataFeed
from .risk import RiskManager
from .strategy import Action, MeanReversionStrategy

log = logging.getLogger("bot.engine")

MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)


class TradingEngine:
    def __init__(
        self,
        symbols: list[str],
        strategy: MeanReversionStrategy,
        risk: RiskManager,
        broker: Broker,
        data: DataFeed,
        interval: str = "5minute",
        history_days: int = 30,
        square_off_time: time = time(15, 15),
    ):
        self.symbols = symbols
        self.strategy = strategy
        self.risk = risk
        self.broker = broker
        self.data = data
        self.interval = interval
        self.history_days = history_days
        self.square_off_time = square_off_time
        self.positions: dict[str, Position] = {}

    # ----- helpers ---------------------------------------------------------------
    @staticmethod
    def market_open(now: datetime | None = None) -> bool:
        now = now or datetime.now()
        if now.weekday() >= 5:  # Sat/Sun
            return False
        return MARKET_OPEN <= now.time() <= MARKET_CLOSE

    def _enter(self, symbol: str, price: float, atr: float) -> None:
        stop, target = self.risk.stop_and_target(price, atr)
        qty = self.risk.position_size(self.risk.cfg.capital, price, stop)
        if qty <= 0:
            log.info("%s: sized to 0 qty, skipping", symbol)
            return
        fill = self.broker.buy(symbol, qty, price, self.risk.cfg.product)
        self.positions[symbol] = Position(symbol, qty, price, stop, target)
        log.info("ENTER %s qty=%d @ ~%.2f stop=%.2f target=%.2f (order %s)",
                 symbol, qty, price, stop, target, fill.order_id)

    def _exit(self, symbol: str, price: float, reason: str) -> None:
        pos = self.positions.get(symbol)
        if not pos:
            return
        fill = self.broker.sell(symbol, pos.qty, price, self.risk.cfg.product)
        pnl = (price - pos.avg_price) * pos.qty
        self.risk.register_realised_pnl(pnl)
        log.info("EXIT  %s qty=%d @ ~%.2f pnl=%.0f (%s) (order %s)",
                 symbol, pos.qty, price, pnl, reason, fill.order_id)
        del self.positions[symbol]

    def _flatten_all(self, reason: str) -> None:
        """Kill-switch: sell every open position immediately at market."""
        if not self.positions:
            return
        marks = self.data.ltp(list(self.positions))
        for sym in list(self.positions):
            self._exit(sym, marks.get(sym, self.positions[sym].avg_price), reason)

    def _open_pnl(self) -> float:
        """Mark-to-market P&L of currently open positions."""
        if not self.positions:
            return 0.0
        marks = self.data.ltp(list(self.positions))
        return sum(
            (marks.get(s, p.avg_price) - p.avg_price) * p.qty
            for s, p in self.positions.items()
        )

    def _kill_switch_tripped(self) -> bool:
        """True if realised + unrealised loss today breaches the daily limit."""
        total = self.risk.realised_pnl_today + self._open_pnl()
        max_loss = -self.risk.cfg.capital * self.risk.cfg.max_daily_loss_pct / 100.0
        return total <= max_loss

    # ----- one decision pass -----------------------------------------------------
    def run_cycle(self, now: datetime | None = None) -> None:
        now = now or datetime.now()

        # Kill-switch: if total loss (realised + open) breaches the daily limit,
        # flatten everything and stop trading for the day.
        if not self.risk.halted and self.positions and self._kill_switch_tripped():
            log.error("KILL-SWITCH: daily loss limit breached — flattening all positions.")
            self._flatten_all("kill-switch")
            self.risk._halted = True
            return

        # Square off intraday before the cutoff.
        if self.risk.cfg.product == "MIS" and now.time() >= self.square_off_time:
            if self.positions:
                marks = self.data.ltp(list(self.positions))
                for sym in list(self.positions):
                    self._exit(sym, marks.get(sym, self.positions[sym].avg_price), "square-off")
            return

        if self.risk.halted:
            log.warning("Risk halt active (daily loss limit). No new trades.")

        for symbol in self.symbols:
            try:
                token = self.data.token_for(symbol)
                df = self.data.historical(token, self.interval, self.history_days)
                if df.empty or len(df) < self.strategy.cfg.bb_period + 2:
                    continue

                in_pos = symbol in self.positions
                decision = self.strategy.signal(df, in_pos)
                price = decision.price

                # Hard stop / target check first (intra-bar protection).
                if in_pos:
                    pos = self.positions[symbol]
                    if pos.stop and price <= pos.stop:
                        self._exit(symbol, price, "stop")
                        continue
                    if pos.target and price >= pos.target:
                        self._exit(symbol, price, "target")
                        continue

                if decision.action is Action.EXIT:
                    self._exit(symbol, price, decision.reason)
                elif decision.action is Action.ENTER_LONG:
                    if not self.risk.can_open(len(self.positions)):
                        continue
                    atr = self.strategy.compute(df).iloc[-1]["atr"]
                    self._enter(symbol, price, atr)
                else:
                    log.debug("%s: HOLD (%s)", symbol, decision.reason)
            except Exception:  # never let one symbol kill the loop
                log.exception("Error processing %s", symbol)
