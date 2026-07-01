"""Event-driven backtester for the mean-reversion strategy.

Simulates one symbol bar by bar: enters on the strategy's entry signal, and
exits on whichever comes first — strategy exit signal, ATR stop-loss, or ATR
target. Reports the metrics that actually matter for a mean-reversion system.

Costs: a flat per-side cost (bps) approximates brokerage + STT + slippage so
results aren't unrealistically rosy. Tune `cost_bps` to your account.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .risk import RiskConfig, RiskManager
from .strategy import MeanReversionStrategy


@dataclass
class Trade:
    entry_time: pd.Timestamp
    entry: float
    exit_time: pd.Timestamp
    exit: float
    qty: int
    reason: str

    @property
    def pnl(self) -> float:
        return (self.exit - self.entry) * self.qty

    @property
    def return_pct(self) -> float:
        return (self.exit / self.entry - 1) * 100


@dataclass
class BacktestResult:
    trades: list[Trade]
    equity_curve: pd.Series
    starting_capital: float

    @property
    def ending_capital(self) -> float:
        return float(self.equity_curve.iloc[-1]) if len(self.equity_curve) else self.starting_capital

    @property
    def total_return_pct(self) -> float:
        return (self.ending_capital / self.starting_capital - 1) * 100

    @property
    def num_trades(self) -> int:
        return len(self.trades)

    @property
    def win_rate(self) -> float:
        if not self.trades:
            return 0.0
        wins = sum(1 for t in self.trades if t.pnl > 0)
        return wins / len(self.trades) * 100

    @property
    def avg_return_pct(self) -> float:
        if not self.trades:
            return 0.0
        return float(np.mean([t.return_pct for t in self.trades]))

    @property
    def profit_factor(self) -> float:
        gains = sum(t.pnl for t in self.trades if t.pnl > 0)
        losses = -sum(t.pnl for t in self.trades if t.pnl < 0)
        return gains / losses if losses else float("inf")

    @property
    def max_drawdown_pct(self) -> float:
        if self.equity_curve.empty:
            return 0.0
        running_max = self.equity_curve.cummax()
        drawdown = (self.equity_curve - running_max) / running_max
        return float(drawdown.min() * 100)

    def summary(self) -> str:
        return (
            f"Trades:        {self.num_trades}\n"
            f"Win rate:      {self.win_rate:.1f}%\n"
            f"Avg trade:     {self.avg_return_pct:+.2f}%\n"
            f"Total return:  {self.total_return_pct:+.2f}%\n"
            f"Profit factor: {self.profit_factor:.2f}\n"
            f"Max drawdown:  {self.max_drawdown_pct:.2f}%\n"
            f"Capital:       {self.starting_capital:,.0f} -> {self.ending_capital:,.0f}"
        )


class Backtester:
    def __init__(
        self,
        strategy: MeanReversionStrategy,
        risk: RiskManager | None = None,
        cost_bps: float = 5.0,
    ):
        self.strategy = strategy
        self.risk = risk or RiskManager(RiskConfig())
        self.cost_bps = cost_bps  # per side, in basis points

    def run(self, df: pd.DataFrame) -> BacktestResult:
        data = self.strategy.compute(df)
        cap = self.risk.cfg.capital
        equity = cap
        cash = cap
        trades: list[Trade] = []
        curve = []

        position = None  # dict: qty, entry, stop, target, entry_time

        for ts, row in data.iterrows():
            price = row["close"]
            # mark-to-market equity for the curve
            mtm = position["qty"] * price if position else 0
            curve.append((ts, cash + mtm))

            warming = pd.isna(row.get("bb_lower")) or pd.isna(row.get("atr"))
            if warming:
                continue

            if position is None:
                if self.strategy._entry_long(row):
                    stop, target = self.risk.stop_and_target(price, row["atr"])
                    qty = self.risk.position_size(equity, price, stop)
                    if qty <= 0:
                        continue
                    cost = price * qty * (1 + self.cost_bps / 10_000)
                    cash -= cost
                    position = dict(
                        qty=qty, entry=price, stop=stop, target=target, entry_time=ts
                    )
            else:
                exit_reason = None
                if row["low"] <= position["stop"]:
                    exit_price, exit_reason = position["stop"], "stop"
                elif position["target"] and row["high"] >= position["target"]:
                    exit_price, exit_reason = position["target"], "target"
                elif self.strategy._exit_long(row):
                    exit_price, exit_reason = price, "signal"

                if exit_reason:
                    proceeds = exit_price * position["qty"] * (1 - self.cost_bps / 10_000)
                    cash += proceeds
                    equity = cash
                    trades.append(
                        Trade(
                            entry_time=position["entry_time"],
                            entry=position["entry"],
                            exit_time=ts,
                            exit=exit_price,
                            qty=position["qty"],
                            reason=exit_reason,
                        )
                    )
                    position = None

        equity_curve = pd.Series(
            [v for _, v in curve], index=[t for t, _ in curve], name="equity"
        )
        return BacktestResult(trades, equity_curve, cap)

    def out_of_sample(
        self, df: pd.DataFrame, split: float = 0.7
    ) -> tuple[BacktestResult, BacktestResult]:
        """Split history at `split` and backtest each half separately.

        The honest test: if you tune parameters, do it on the IN-SAMPLE half,
        then judge the strategy ONLY by the OUT-OF-SAMPLE half — data it never
        saw. A strategy that looks great in-sample but falls apart
        out-of-sample is curve-fit, not a real edge. Treat OOS as the truth.
        """
        cut = int(len(df) * split)
        in_sample = df.iloc[:cut]
        out_sample = df.iloc[cut:]
        return self.run(in_sample), self.run(out_sample)
