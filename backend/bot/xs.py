"""Cross-sectional (portfolio) strategies — they RANK the whole universe and hold a
basket, rather than trading each symbol independently. Two return-drivers your book
was missing:

  RS-Momentum (xs_momentum) : hold the strongest names by 6-month return, behind a
                              market-trend filter (go to cash below the index 200-DMA).
  Low-Vol     (lowvol)      : hold the CALMEST names — a defensive sleeve that holds up
                              in bear / high-vol where the trend bots bleed.

The engine mirrors LongOnlyPaperEngine's state shape ({realised, positions}) and its
[name] ENTER/EXIT log format, so it plugs straight into the dashboard's P&L, analytics,
accuracy and go-live machinery with no special-casing. Long-only, delivery (CNC).
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

log = logging.getLogger("paper")          # same logger the harness reads for forward trades
from bot import paper_engine as _pe        # for CURRENT_REGIME stamping
from bot.governor import GOVERNOR
from bot.rebalancer import REBALANCER


def momentum_metric(df: pd.DataFrame, lookback: int = 126) -> float:
    """Trailing total return over `lookback` bars (~6 months of trading days)."""
    if len(df) <= lookback:
        return float("nan")
    c0, c1 = float(df["close"].iloc[-lookback]), float(df["close"].iloc[-1])
    return (c1 / c0 - 1.0) if c0 > 0 else float("nan")


def lowvol_metric(df: pd.DataFrame, lookback: int = 20) -> float:
    """NEGATIVE realised volatility (so 'higher metric = calmer = preferred')."""
    r = df["close"].pct_change().tail(lookback)
    sd = float(r.std())
    return -sd if sd == sd else float("nan")   # nan-guard


class CrossSectionalPaperEngine:
    """Ranks `symbols` each cycle and holds the top `top_n` equally weighted. Rebalances
    by reconciling holdings to the target set (exit dropouts, enter newcomers)."""

    def __init__(self, name, kind, capital, data, symbols, top_n=4,
                 mom_lookback=126, vol_lookback=20, history_days=420,
                 market_filter=True, trend_period=200):
        self.name = name
        self.kind = kind                       # 'momentum' | 'lowvol'
        self.capital = capital
        self.data = data
        self.symbols = symbols
        self.top_n = top_n
        self.mom_lookback = mom_lookback
        self.vol_lookback = vol_lookback
        self.history_days = history_days
        self.market_filter = market_filter      # momentum: only hold when the index is in an uptrend
        self.trend_period = trend_period
        self.interval = "day"                    # used by the harness flatten path
        self.positions: dict[str, dict] = {}
        self.realised = 0.0
        self.min_bars = trend_period + 5         # harness gate parity

    # ----- ranking -----------------------------------------------------------------
    def _frames(self) -> dict[str, pd.DataFrame]:
        out = {}
        for sym in self.symbols:
            try:
                df = self.data.historical(self.data.token_for(sym), "day", self.history_days)
                if not df.empty and len(df) >= max(self.mom_lookback, self.trend_period) + 2:
                    out[sym] = df
            except Exception:
                log.exception("[%s] history fetch failed for %s", self.name, sym)
        return out

    def _market_ok(self, frames: dict[str, pd.DataFrame]) -> bool:
        """Equal-weight index of the universe above its `trend_period`-SMA = risk-on.
        Defensive (lowvol) ignores this — it's meant to hold through downturns."""
        if not self.market_filter:
            return True
        closes = pd.DataFrame({s: d["close"] for s, d in frames.items()}).dropna()
        if len(closes) < self.trend_period + 1:
            return True
        idx = (closes / closes.iloc[0] * 100).mean(axis=1)
        sma = idx.rolling(self.trend_period).mean()
        return bool(idx.iloc[-1] >= sma.iloc[-1])

    def _target(self, frames: dict[str, pd.DataFrame]) -> list[str]:
        if not self._market_ok(frames):
            return []                                  # risk-off → hold nothing (go to cash)
        metric = momentum_metric if self.kind == "momentum" else lowvol_metric
        lb = self.mom_lookback if self.kind == "momentum" else self.vol_lookback
        scored = [(s, metric(d, lb)) for s, d in frames.items()]
        scored = [(s, v) for s, v in scored if v == v]   # drop nan
        if self.kind == "momentum":
            scored = [(s, v) for s, v in scored if v > 0]  # only positive momentum
        scored.sort(key=lambda kv: kv[1], reverse=True)
        return [s for s, _ in scored[: self.top_n]]

    # ----- cycle -------------------------------------------------------------------
    def run_cycle(self, square_off: bool = False) -> None:
        frames = self._frames()
        if not frames:
            return
        last = {s: float(d["close"].iloc[-1]) for s, d in frames.items()}
        # regime rebalancer can stand this basket DOWN TO CASH (e.g. RS-momentum in chop)
        target = set() if (square_off or not REBALANCER.allows(self.name)) else set(self._target(frames))
        # EXIT holdings no longer in the target basket (rebalance out)
        for sym in list(self.positions):
            if sym not in target and sym in last:
                self._exit(sym, last[sym], "rebalance" if not square_off else "square-off")
        # ENTER newcomers, equal-weight
        budget = self.capital / max(self.top_n, 1)
        for sym in target:
            if sym in self.positions or sym not in last:
                continue
            price = last[sym]
            qty = int(budget // price)
            if qty > 0:
                gd = GOVERNOR.review(self.name, sym, qty * price)        # Governor chokepoint
                if not gd["approved"]:
                    log.info("[%s] VETO %s — %s", self.name, sym, gd["reason"]); continue
                qty = int(qty * gd["scale"])
                if qty < 1:
                    continue
                self.positions[sym] = dict(qty=qty, entry=price, stop=0, target=0,
                                           regime=_pe.CURRENT_REGIME)
                log.info("[%s] ENTER %s qty=%d @%.2f (rank-basket) regime=%s",
                         self.name, sym, qty, price, _pe.CURRENT_REGIME)

    def _exit(self, sym, price, reason):
        pos = self.positions.pop(sym)
        pnl = (price - pos["entry"]) * pos["qty"]
        self.realised += pnl
        log.info("[%s] EXIT  %s qty=%d @%.2f pnl=%+.0f (%s) regime=%s",
                 self.name, sym, pos["qty"], price, pnl, reason, pos.get("regime", "—"))

    # ----- persistence (identical shape to LongOnlyPaperEngine) --------------------
    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "positions": self.positions}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.positions = s.get("positions", {})


def xs_backtest(get_df, kind, symbols, top_n=4, mom_lookback=126, vol_lookback=20,
                trend_period=200, rebalance=21, cost_bps=15.0):
    """Compact monthly-rebalance cross-sectional backtest over aligned daily history.
    Returns regime-agnostic portfolio metrics + a base-100 equity curve. Honest evidence
    for the rank-basket bots (the per-symbol Backtester can't express cross-sectional)."""
    frames = {}
    for s in symbols:
        df = get_df(s)
        if df is not None and not getattr(df, "empty", True) and len(df) > trend_period + mom_lookback:
            frames[s] = df
    if len(frames) < top_n + 1:
        return None
    closes = pd.DataFrame({s: d["close"] for s, d in frames.items()}).dropna()
    if len(closes) < trend_period + mom_lookback + rebalance:
        return None
    idx = (closes / closes.iloc[0] * 100).mean(axis=1)
    idx_sma = idx.rolling(trend_period).mean()
    rets = closes.pct_change().fillna(0.0)
    dates = closes.index
    start = max(trend_period, mom_lookback) + 1
    equity = [100.0]
    eq_dates = [dates[start]]
    holdings: list[str] = []
    per_rebal = []           # return of each rebalance period (for win-rate)
    last_rebal_eq = 100.0
    for i in range(start, len(dates)):
        # daily mark: equal-weight return of current holdings
        if holdings:
            day_ret = float(rets.iloc[i][holdings].mean())
        else:
            day_ret = 0.0
        equity.append(equity[-1] * (1 + day_ret))
        eq_dates.append(dates[i])
        # rebalance on cadence
        if (i - start) % rebalance == 0:
            if holdings:                                   # book the period + a round-turn cost
                per = equity[-1] / last_rebal_eq - 1
                per_rebal.append(per)
                equity[-1] *= (1 - cost_bps / 10_000)
                last_rebal_eq = equity[-1]
            # choose new basket
            if kind == "momentum" and idx.iloc[i] < idx_sma.iloc[i]:
                holdings = []                              # risk-off
            else:
                if kind == "momentum":
                    score = {s: closes[s].iloc[i] / closes[s].iloc[i - mom_lookback] - 1 for s in closes}
                    score = {s: v for s, v in score.items() if v > 0}
                    holdings = sorted(score, key=score.get, reverse=True)[:top_n]
                else:
                    vol = {s: rets[s].iloc[i - vol_lookback:i].std() for s in closes}
                    vol = {s: v for s, v in vol.items() if v == v}
                    holdings = sorted(vol, key=vol.get)[:top_n]
    port = pd.Series(equity, index=pd.DatetimeIndex(eq_dates))
    daily = port.pct_change().dropna()
    sharpe = float(daily.mean() / daily.std() * np.sqrt(252)) if daily.std() > 0 else 0.0
    run_max = port.cummax(); maxdd = float(((port - run_max) / run_max).min() * 100)
    total = float(port.iloc[-1] / port.iloc[0] - 1) * 100
    yrs = max(len(port) / 252.0, 0.1); cagr = float(((port.iloc[-1] / port.iloc[0]) ** (1 / yrs) - 1) * 100)
    win = (sum(1 for r in per_rebal if r > 0) / len(per_rebal) * 100) if per_rebal else 0.0
    cut = int(len(port) * 0.7)
    seg = lambda c: (float(c.iloc[-1] / c.iloc[0] - 1) * 100) if len(c) > 1 else 0.0
    pts = [round(float(v), 2) for v in port.iloc[:: max(1, len(port) // 120)]]
    return {
        "real": True, "pts": pts, "trades": len(per_rebal), "win": round(win, 1),
        "sharpe": round(sharpe, 2), "maxdd": round(maxdd, 2), "totalRet": round(total, 2),
        "cagr": round(cagr, 2), "avgTrade": round(float(np.mean(per_rebal)) * 100, 2) if per_rebal else 0.0,
        "oos": {"is_ret": round(seg(port.iloc[:cut]), 2), "oos_ret": round(seg(port.iloc[cut:]), 2),
                "is_trades": cut // rebalance, "oos_trades": (len(port) - cut) // rebalance},
        "kind": "cross-sectional", "universe": len(frames),
    }
