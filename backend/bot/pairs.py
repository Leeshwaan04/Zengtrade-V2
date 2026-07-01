"""Pairs trading (statistical arbitrage): mean-revert the SPREAD between two
correlated stocks instead of a single stock's price.

Logic: spread = log(A) - log(B). When the spread stretches `entry_z` std devs
from its rolling mean, bet on convergence — long the cheap leg, short the rich
leg — and exit when it reverts (|z| <= exit_z). Market-neutral, so it's far
less exposed to overall market direction than single-stock reversion.

IMPORTANT (India cash constraint): the short leg can't be held overnight in the
cash segment — daily pairs trading needs F&O (futures) or must be intraday. We
backtest the EDGE first; if it's real, we implement the short via futures.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def run_pair(
    a: pd.Series, b: pd.Series, window: int = 30,
    entry_z: float = 2.0, exit_z: float = 0.5, stop_z: float = 4.0,
    cost_bps: float = 5.0,
) -> pd.DataFrame | None:
    """Return a DataFrame with z, position (+1 long-spread / -1 short-spread),
    and the strategy's daily return (dollar-neutral, costs included)."""
    df = pd.concat([a, b], axis=1, keys=["a", "b"]).dropna()
    if len(df) < window + 40:
        return None
    spread = np.log(df["a"]) - np.log(df["b"])
    z = (spread - spread.rolling(window).mean()) / spread.rolling(window).std(ddof=0)

    pos_list: list[int] = []
    for zi in z:
        prev = pos_list[-1] if pos_list else 0
        if pd.isna(zi):
            pos_list.append(0)
            continue
        if prev == 0:
            if zi <= -entry_z:
                prev = 1          # long A, short B
            elif zi >= entry_z:
                prev = -1         # short A, long B
        elif abs(zi) <= exit_z or abs(zi) >= stop_z:
            prev = 0
        pos_list.append(prev)

    pos = pd.Series(pos_list, index=df.index)
    spread_ret = (df["a"].pct_change().fillna(0) - df["b"].pct_change().fillna(0)) / 2.0
    strat_ret = pos.shift(1).fillna(0) * spread_ret
    turnover = pos.diff().abs().fillna(0)
    strat_ret = strat_ret - turnover * (cost_bps / 10_000) * 2  # 2 legs per change
    return pd.DataFrame({"z": z, "pos": pos, "ret": strat_ret})


def metrics(bt: pd.DataFrame) -> dict:
    ret = bt["ret"]
    equity = (1 + ret).cumprod()
    total = (equity.iloc[-1] - 1) * 100 if len(equity) else 0.0
    sharpe = (ret.mean() / ret.std() * np.sqrt(252)) if ret.std() > 0 else 0.0
    dd = ((equity - equity.cummax()) / equity.cummax()).min() * 100

    # per-trade win rate
    pos = bt["pos"]
    trades, start = [], None
    for i in range(len(pos)):
        p = pos.iloc[i]
        prev = pos.iloc[i - 1] if i else 0
        if prev == 0 and p != 0:
            start = i
        elif prev != 0 and p == 0 and start is not None:
            trades.append(ret.iloc[start:i + 1].sum())
            start = None
    wins = sum(1 for t in trades if t > 0)
    win_rate = wins / len(trades) * 100 if trades else 0.0
    return dict(total=total, sharpe=sharpe, maxdd=dd,
                n_trades=len(trades), win_rate=win_rate)


def out_of_sample(bt: pd.DataFrame, split: float = 0.7) -> tuple[dict, dict]:
    cut = int(len(bt) * split)
    return metrics(bt.iloc[:cut]), metrics(bt.iloc[cut:])
