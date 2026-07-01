"""Risk management: position sizing, stops/targets, and circuit breakers.

This is the part that keeps an automated bot from blowing up. The strategy
says *what* to trade; the risk manager says *how much* and *when to stop*.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RiskConfig:
    capital: float = 100_000.0          # trading capital in INR
    risk_per_trade_pct: float = 1.0     # % of capital risked (entry->stop) per trade
    max_alloc_per_trade_pct: float = 20.0  # hard cap: one position <= 20% of capital
    max_positions: int = 5              # max simultaneous open positions
    max_daily_loss_pct: float = 3.0     # halt trading if day's loss exceeds this
    stop_atr_mult: float = 2.0          # stop = entry - N*ATR
    target_atr_mult: float = 3.0        # target = entry + N*ATR (0 disables)
    product: str = "MIS"                # "MIS" intraday | "CNC" delivery


class RiskManager:
    def __init__(self, config: RiskConfig | None = None):
        self.cfg = config or RiskConfig()
        self._realised_pnl_today = 0.0
        self._halted = False

    # ----- sizing ----------------------------------------------------------------
    def stop_and_target(self, entry: float, atr: float) -> tuple[float, float]:
        stop = entry - self.cfg.stop_atr_mult * atr
        target = (
            entry + self.cfg.target_atr_mult * atr
            if self.cfg.target_atr_mult > 0
            else 0.0
        )
        return round(stop, 2), round(target, 2)

    def position_size(self, capital: float, entry: float, stop: float) -> int:
        """Quantity sized so that (entry - stop) loss == risk_per_trade_pct of capital,
        capped by max allocation per trade. Returns whole shares.
        """
        per_share_risk = max(entry - stop, 0.01)
        risk_amount = capital * self.cfg.risk_per_trade_pct / 100.0
        qty_by_risk = int(risk_amount // per_share_risk)

        max_value = capital * self.cfg.max_alloc_per_trade_pct / 100.0
        qty_by_alloc = int(max_value // entry)

        return max(0, min(qty_by_risk, qty_by_alloc))

    # ----- gating ----------------------------------------------------------------
    def can_open(self, open_positions: int) -> bool:
        if self._halted:
            return False
        return open_positions < self.cfg.max_positions

    def register_realised_pnl(self, pnl: float) -> None:
        """Call after each closed trade so the daily loss breaker can trip."""
        self._realised_pnl_today += pnl
        max_loss = -self.cfg.capital * self.cfg.max_daily_loss_pct / 100.0
        if self._realised_pnl_today <= max_loss:
            self._halted = True

    @property
    def halted(self) -> bool:
        return self._halted

    @property
    def realised_pnl_today(self) -> float:
        return self._realised_pnl_today

    def reset_day(self) -> None:
        self._realised_pnl_today = 0.0
        self._halted = False
