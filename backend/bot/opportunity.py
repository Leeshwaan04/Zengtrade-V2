"""The Opportunity Engine — a high-conviction DECISION engine, not another strategy.

Pipeline (per the ZengTrade decision-engine design):

    Candle+Indicators → Regime → Regime-gated WEIGHTED VOTING (specialists) →
    0-100 CONFIDENCE SCORE → Risk/Execution FILTERS → execution BANDS → trade

The job is NOT to predict — it is to REFUSE low-quality trades. Every specialist
strategy gets a regime-dependent weight; their votes plus independent indicator
confirmations produce a transparent 0-100 score, and only the highest-quality,
filter-passing setups are taken. Every decision is fully explainable.

Long-only equity (CNC), so it shares the LongOnly paper-engine state shape and log
format → it plugs into the dashboard P&L / analytics / accuracy / go-live machinery.
"""
from __future__ import annotations

import json
import logging
import os
import time as _tmod
from datetime import datetime, time

import numpy as np
import pandas as pd

from . import indicators
from .governor import GOVERNOR
from .rebalancer import REBALANCER
from .strategies_lib import (EMACrossStrategy, ADXTrendStrategy, BollingerRevStrategy,
                             ZScoreRevStrategy, NR7Strategy, RSI2Strategy,
                             MACrossStrategy, SupertrendStrategy, supertrend_direction)
from .strategy_momentum import MomentumStrategy
from . import paper_engine as _pe

log = logging.getLogger("paper")

# ---- auditable decision log (cross-process: harness writes, bot_api reads) ----
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECISIONS_FILE = os.path.join(_REPO_ROOT, "decisions.jsonl")


def log_decision(rec: dict) -> None:
    """Append one structured decision record (entry/exit + full context) for the audit trail."""
    try:
        rec.setdefault("ts", datetime.now().isoformat())
        with open(DECISIONS_FILE, "a") as f:
            f.write(json.dumps(rec, default=str) + "\n")
    except Exception:
        log.exception("decision-log write failed")


def alloc_for_confidence(conf: float) -> float:
    """Phase-8 dynamic sizing: allocation scales with conviction (not a flat 95%)."""
    if conf >= 90: return 0.95
    if conf >= 85: return 0.85
    if conf >= 80: return 0.70
    if conf >= 75: return 0.50
    if conf >= 70: return 0.35
    return 0.20

# ---- the specialist pool: (key, instance, style) -------------------------------------
SPECIALISTS = [
    ("ema_cross",  EMACrossStrategy(),   "Trend"),
    ("macross",    MACrossStrategy(),    "Trend"),
    ("supertrend", SupertrendStrategy(), "Trend"),
    ("adx_trend",  ADXTrendStrategy(),   "Trend"),
    ("momentum",   MomentumStrategy(),   "Trend"),
    ("nr7",        NR7Strategy(),        "Breakout"),
    ("rsi2",       RSI2Strategy(),       "Reversion"),
    ("bollinger",  BollingerRevStrategy(), "Reversion"),
    ("zscore",     ZScoreRevStrategy(),  "Reversion"),
]

# ---- regime → per-style vote weight (0-10). Not every specialist gets an equal vote. ----
REGIME_WEIGHTS = {
    "Bull":     {"Trend": 10, "Breakout": 8, "Reversion": 2},
    "Bear":     {"Trend": 2,  "Breakout": 3, "Reversion": 6},   # defensive: trust little
    "Choppy":   {"Trend": 2,  "Breakout": 4, "Reversion": 10},
    "High-Vol": {"Trend": 4,  "Breakout": 6, "Reversion": 9},
}

# ---- confidence components (max 100) ----
COMPONENTS = {
    "regime_match": 20, "ema_trend": 15, "rsi_ok": 10, "macd": 10,
    "supertrend": 15, "volume_spike": 15, "atr_healthy": 5, "strong_candle": 10,
}
EXECUTE_MIN = 75        # >= execute (subject to filters); 90+ = highest conviction
WATCH_MIN = 60          # 60-74 watchlist only; below = ignore

# ---- learned weights: score_symbol uses these (learned if the engine has enough evidence,
# else the COMPONENTS priors). Cached ~5min so we don't re-read the file every score. ----
_EFF = {"t": 0.0, "w": None}


def effective_components() -> dict:
    if _EFF["w"] is not None and _tmod.time() - _EFF["t"] < 300:
        return _EFF["w"]
    try:
        from .learning import load_weights
        w = load_weights(COMPONENTS)
    except Exception:
        w = dict(COMPONENTS)
    _EFF.update(t=_tmod.time(), w=w)
    return w


def now_outside_hours() -> bool:
    t = datetime.now().time()
    return not (time(9, 15) <= t <= time(15, 30))


def _indicator_frame(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy(); c = out["close"]
    out["ema20"] = indicators.ema(c, 20)
    out["ema50"] = indicators.ema(c, 50)
    out["rsi14"] = indicators.rsi(c, 14)
    macd_line, sig, hist = indicators.macd(c)
    out["macd"] = macd_line; out["macd_sig"] = sig
    out["atr"] = indicators.atr(out["high"], out["low"], out["close"], 14)
    out["vol_sma"] = indicators.sma(out["volume"], 20)
    out["st_dir"] = supertrend_direction(out["high"], out["low"], out["close"], 10, 3.0)
    return out


def score_symbol(df: pd.DataFrame, regime: str, mtf_df: pd.DataFrame | None = None) -> dict | None:
    """Score ONE symbol's long opportunity right now. Returns a fully-explainable decision."""
    if df is None or df.empty or len(df) < 210:
        return None
    f = _indicator_frame(df)
    row = f.iloc[-1]
    price = float(row["close"])
    if pd.isna(row.get("ema50")) or pd.isna(row.get("atr")):
        return None

    # ---- regime-gated weighted voting across specialists ----
    weights = REGIME_WEIGHTS.get(regime, REGIME_WEIGHTS["Bull"])
    votes, vote_pts, max_pts = [], 0.0, 0.0
    for key, strat, style in SPECIALISTS:
        w = weights.get(style, 1)
        max_pts += w
        try:
            sig = bool(strat._entry_long(strat.compute(df).iloc[-1]))
        except Exception:
            sig = False
        if sig:
            vote_pts += w
        votes.append({"strategy": key, "style": style, "weight": w, "vote": sig})
    agree = sum(1 for v in votes if v["vote"])

    # ---- 0-100 confidence from independent confirmations (weights LEARNED from outcomes) ----
    W = effective_components()
    comp = {}
    fav_styles = [st for st, w in weights.items() if w >= 8]
    comp["regime_match"] = W["regime_match"] if any(
        v["vote"] and v["style"] in fav_styles for v in votes) else 0
    comp["ema_trend"] = W["ema_trend"] if (price >= row["ema50"] and row["ema20"] >= row["ema50"]) else 0
    rsi = row.get("rsi14")
    comp["rsi_ok"] = W["rsi_ok"] if (rsi is not None and not pd.isna(rsi) and 40 <= rsi <= 70) else 0
    comp["macd"] = W["macd"] if (not pd.isna(row["macd"]) and row["macd"] > row["macd_sig"]) else 0
    comp["supertrend"] = W["supertrend"] if row["st_dir"] == 1 else 0
    vs = row.get("vol_sma")
    comp["volume_spike"] = W["volume_spike"] if (vs and not pd.isna(vs) and row["volume"] >= 1.5 * vs) else 0
    atr_pct = row["atr"] / price * 100 if price else 0
    comp["atr_healthy"] = W["atr_healthy"] if 0.5 <= atr_pct <= 6.0 else 0
    rng = row["high"] - row["low"]
    strong = rng > 0 and row["close"] >= row["open"] and (row["close"] - row["low"]) / rng >= 0.6
    comp["strong_candle"] = W["strong_candle"] if strong else 0
    # multi-timeframe: require the higher-TF direction to agree (15m/daily uptrend) if provided
    mtf_ok = True
    if mtf_df is not None and len(mtf_df) > 50:
        mc = mtf_df["close"]
        mtf_ok = bool(mc.iloc[-1] >= indicators.ema(mc, 50).iloc[-1])
    confidence = sum(comp.values())
    if not mtf_ok:
        confidence = int(confidence * 0.6)   # higher-TF disagrees → heavily discount

    # ---- Opportunity Score 2.0: structured sub-scores + expected value + reasons ----
    def _c(x, lo=0, hi=100):
        return int(max(lo, min(hi, x)))
    mom_ret = (price / float(f["close"].iloc[-11]) - 1) if len(f) > 11 else 0.0
    vol_ratio = (row["volume"] / vs) if (vs and not pd.isna(vs) and vs > 0) else 0.0
    adv = (vs * price) if (vs and not pd.isna(vs)) else 0.0           # avg traded value (₹/day proxy)
    trend_q = _c((price >= row["ema50"]) * 40 + (row["ema20"] >= row["ema50"]) * 30 + (row["st_dir"] == 1) * 30)
    momentum = _c(50 * (not pd.isna(row["macd"]) and row["macd"] > row["macd_sig"]) + mom_ret * 800)
    vol_score = _c(vol_ratio * 50)                                   # 2× avg volume → 100
    volat = _c(100 - abs(atr_pct - 2.5) * 22)                        # ~2.5% ATR is the sweet spot
    liquidity = _c(adv / 5e8 * 100)                                  # ₹50cr/day avg traded value → 100
    risk_score = _c(atr_pct * 20)                                    # higher ATR% = more risk (lower = safer)
    exp_return = round(1.5 * atr_pct, 1)                             # ESTIMATE: ~1.5×ATR favourable move
    exp_days = 7 if regime in ("Bull", "Bear") else 3                # heuristic hold, not a promise
    sub = {"trendQuality": trend_q, "momentum": momentum, "volume": vol_score,
           "volatility": volat, "liquidity": liquidity, "risk": risk_score,
           "expReturnPct": exp_return, "expDurationDays": exp_days}
    reasons = []
    if comp["regime_match"]:
        reasons.append(f"Fits the {regime} regime")
    if comp["ema_trend"]:
        reasons.append("EMA 20>50, price above trend")
    if comp["supertrend"]:
        reasons.append("Supertrend up")
    if comp["macd"]:
        reasons.append("MACD above signal")
    if comp["volume_spike"]:
        reasons.append(f"Volume {vol_ratio:.1f}x avg")
    if comp["rsi_ok"] and rsi is not None and not pd.isna(rsi):
        reasons.append(f"RSI healthy ({rsi:.0f})")
    if comp["strong_candle"]:
        reasons.append("Strong close near high")
    if not mtf_ok:
        reasons.append("higher-timeframe disagrees")
    if not reasons:
        reasons.append("No confirmations fired — below conviction")

    band = ("execute" if confidence >= 90 else "execute_if_filters" if confidence >= EXECUTE_MIN
            else "watchlist" if confidence >= WATCH_MIN else "ignore")
    return {
        "confidence": int(confidence), "band": band, "regime": regime, "price": round(price, 2),
        "agree": agree, "votePts": round(vote_pts, 1), "maxVotePts": round(max_pts, 1),
        "votes": votes, "components": comp, "atr": round(float(row["atr"]), 2),
        "rsi": None if pd.isna(rsi) else round(float(rsi), 1), "mtfOk": mtf_ok,
        "sub": sub, "reasons": reasons,
    }


# ---- execution filters: even a high score must clear these ---------------------------
def passes_filters(symbol, decision, engine) -> tuple[bool, str]:
    now = datetime.now().time()
    if not (time(9, 15) <= now <= time(15, 30)):
        return False, "outside trading hours"
    if symbol in engine.positions:
        return False, "already holding"
    if len(engine.positions) >= engine.max_positions:
        return False, "max positions reached"
    if engine.realised <= -engine.capital * engine.max_daily_loss_pct / 100:
        return False, "daily loss limit hit"
    if decision["band"] not in ("execute", "execute_if_filters"):
        return False, f"score {decision['confidence']} below execute band"
    if decision["agree"] < engine.min_agree:
        return False, f"only {decision['agree']} specialists agree (<{engine.min_agree})"
    return True, "ok"


class OpportunityPaperEngine:
    """The decision engine as a deployable paper bot: each cycle it scores the universe,
    and takes ONLY the highest-conviction, filter-passing opportunities. Same state shape
    + log format as LongOnlyPaperEngine, so it flows into the dashboard like any other bot."""

    def __init__(self, name, capital, data, symbols, top_n=3, min_agree=2,
                 history_days=400, max_positions=3, max_daily_loss_pct=3.0,
                 stop_atr=2.0, target_atr=3.5, mtf=True):
        self.name = name
        self.capital = capital
        self.data = data
        self.symbols = symbols
        self.top_n = top_n
        self.min_agree = min_agree
        self.history_days = history_days
        self.interval = "day"
        self.max_positions = max_positions
        self.max_daily_loss_pct = max_daily_loss_pct
        self.stop_atr = stop_atr
        self.target_atr = target_atr
        self.mtf = mtf
        self.positions: dict[str, dict] = {}
        self.realised = 0.0
        self.min_bars = 210
        self.last_scan: list[dict] = []        # cached decisions for the dashboard

    def scan(self) -> list[dict]:
        regime = _pe.CURRENT_REGIME or "Bull"
        out = []
        for sym in self.symbols:
            try:
                df = self.data.historical(self.data.token_for(sym), "day", self.history_days)
                mtf = None
                d = score_symbol(df, regime, mtf)
                if d:
                    d["symbol"] = sym
                    out.append(d)
            except Exception:
                log.exception("[%s] scan failed for %s", self.name, sym)
        out.sort(key=lambda x: x["confidence"], reverse=True)
        self.last_scan = out
        return out

    def run_cycle(self, square_off: bool = False) -> None:
        scan = self.scan()
        price_of = {d["symbol"]: d["price"] for d in scan}
        dec_of = {d["symbol"]: d for d in scan}
        # manage exits: stop / target / score collapse
        for sym in list(self.positions):
            pos = self.positions[sym]; px = price_of.get(sym)
            if px is None:
                continue
            if square_off:
                self._exit(sym, px, "square-off"); continue
            if pos["stop"] and px <= pos["stop"]:
                self._exit(sym, px, "stop"); continue
            if pos["target"] and px >= pos["target"]:
                self._exit(sym, px, "target"); continue
            d = dec_of.get(sym)
            if d and d["confidence"] < WATCH_MIN:
                self._exit(sym, px, "score-collapse")
        if square_off or now_outside_hours():
            return
        from .allocator import Proposal, CapitalAllocator, persist_competition
        if not REBALANCER.allows(self.name):
            persist_competition({"funded": [], "skipped": [], "ranked": 0, "deployed": 0,
                                 "budget": self.capital, "note": "stood down by the regime rebalancer"})
            return
        floor = max(EXECUTE_MIN, REBALANCER.conviction_floor())   # adaptive: harder bar in worse regimes
        # ---- proposal → competition → allocation (Capital Allocation Engine) ----
        # The engine no longer hand-picks top-N. It emits PROPOSALS from the scan; the
        # Allocator ranks them by EV·diversification·regime, funds the best diversified set
        # under the budget, and the Governor still vetoes any that breach portfolio limits.
        props = []
        for d in scan:
            if d["symbol"] in self.positions:
                continue
            sub = d.get("sub") or {}
            props.append(Proposal(bot=self.name, symbol=d["symbol"], price=d["price"],
                                  confidence=d["confidence"], exp_return=sub.get("expReturnPct", 0) or 0,
                                  risk=sub.get("risk", 0) or 0, atr=d["atr"],
                                  reasons=d.get("reasons", []), regime=d["regime"]))
        alloc = CapitalAllocator(self.capital, max_positions=self.max_positions, min_conf=floor)
        result = alloc.allocate(props, open_count=len(self.positions))
        persist_competition(result)            # publish the competition for the Allocation view
        comp_by = {d["symbol"]: d for d in scan}
        for f in result["funded"]:             # the Allocator already cleared each with the Governor
            sym = f["symbol"]; price = f["price"]; qty = f["qty"]; atr = f.get("atr") or 0
            stop = round(price - self.stop_atr * atr, 2)
            target = round(price + self.target_atr * atr, 2) if self.target_atr else 0
            self.positions[sym] = dict(qty=qty, entry=price, stop=stop, target=target,
                                       regime=regime, conf=f["confidence"])
            log.info("[%s] ENTER %s qty=%d @%.2f conf=%.0f alloc=%.1f%% (allocator-funded) regime=%s",
                     self.name, sym, qty, price, f["confidence"], f["allocPct"], regime)
            d = comp_by.get(sym, {})
            log_decision({"bot": self.name, "action": "ENTER", "symbol": sym, "regime": regime,
                          "confidence": f["confidence"], "qty": qty, "entry": price, "stop": stop,
                          "alloc": round(f["allocPct"] / 100, 2),
                          "sub": d.get("sub"), "reasons": d.get("reasons"),
                          "components": d.get("components")})   # for the Learning Engine

    def _exit(self, sym, price, reason):
        pos = self.positions.pop(sym)
        pnl = (price - pos["entry"]) * pos["qty"]
        self.realised += pnl
        log.info("[%s] EXIT  %s qty=%d @%.2f pnl=%+.0f (%s) regime=%s",
                 self.name, sym, pos["qty"], price, pnl, reason, pos.get("regime", "—"))
        log_decision({"bot": self.name, "action": "EXIT", "symbol": sym, "reason": reason,
                      "pnl": round(pnl, 2), "conf": pos.get("conf")})

    def state(self) -> dict:
        return {"realised": round(self.realised, 2), "positions": self.positions}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.positions = s.get("positions", {})


class MoonshotCompounderEngine:
    """The ₹5,000 → moonshot bot. Reinvests EVERY rupee of realised profit (true
    compounding — size grows with the account), concentrates into the single
    highest-conviction Opportunity-Engine setup it can afford, and rides winners with
    a TRAILING stop. Ruin-aware on purpose: one trade can never wipe the account,
    because a zero ends the mission. Honest — it shows real equity, never a fantasy.

    LongOnly-shaped state so it marks to live price + ticks in the dashboard. Holds
    across days (CNC); runs every cycle so it's active in the live session immediately."""

    def __init__(self, name, start_capital, data, symbols, target=5e10,
                 min_conf=65, deploy_frac=0.95, trail_pct=0.05, history_days=400):
        self.name = name
        self.start = float(start_capital)
        self.target = float(target)             # ₹5,000 cr = 5e10
        self.data = data
        self.symbols = symbols
        self.min_conf = min_conf                # only the high-conviction setups
        self.deploy_frac = deploy_frac          # fraction of (growing) equity per trade
        self.trail_pct = trail_pct              # trailing stop distance
        self.history_days = history_days
        self.interval = "day"
        self.min_bars = 210
        self.positions: dict[str, dict] = {}
        self.realised = 0.0
        self.peak = float(start_capital)        # high-water mark for drawdown guardrails
        self.consec_losses = 0                  # consecutive losing trades

    def equity(self) -> float:
        """Closed-trade equity — the capital the next trade compounds on."""
        return self.start + self.realised

    def _guardrail(self):
        """Phase-14 capital preservation. Returns (size_multiplier, pause_reason|None)."""
        dd = 1 - self.equity() / self.peak if self.peak > 0 else 0
        if self.consec_losses >= 5:
            return 0.0, f"paused — {self.consec_losses} consecutive losses"
        if dd >= 0.15:
            return 0.0, f"paused — {dd*100:.0f}% drawdown (capital preservation)"
        mult = 1.0
        if self.consec_losses >= 3:
            mult *= 0.5
        if dd >= 0.10:
            mult *= 0.5
        return mult, None

    def run_cycle(self, square_off: bool = False) -> None:
        try:
            regime = _pe.CURRENT_REGIME or "Bull"
            # ---- manage the one open position: trail the stop, exit on stop / score collapse ----
            for sym in list(self.positions):
                pos = self.positions[sym]
                try:
                    df = self.data.historical(self.data.token_for(sym), "day", self.history_days)
                    px = float(df["close"].iloc[-1])
                except Exception:
                    continue
                pos["stop"] = max(pos.get("stop", 0), round(px * (1 - self.trail_pct), 2))  # ratchet up
                d = score_symbol(df, regime)
                collapsed = d and d["confidence"] < WATCH_MIN
                if square_off or px <= pos["stop"] or collapsed:
                    self._exit(sym, px, "square-off" if square_off else "trail-stop" if px <= pos["stop"] else "score-collapse")
            if square_off or self.positions:
                return
            # capital-preservation guardrails (Phase 14): high-water mark → size cut / pause
            self.peak = max(self.peak, self.equity())
            gmult, pause = self._guardrail()
            if pause:
                return                            # preservation mode — refuse new risk
            if not REBALANCER.allows(self.name):
                return                            # regime rebalancer says stand down → cash
            floor = max(self.min_conf, REBALANCER.conviction_floor())   # demand more in worse regimes
            # ---- flat: scan, pick the single best AFFORDABLE high-conviction setup ----
            best = None
            for sym in self.symbols:
                try:
                    df = self.data.historical(self.data.token_for(sym), "day", self.history_days)
                    d = score_symbol(df, regime)
                except Exception:
                    continue
                if not d or d["confidence"] < floor:
                    continue
                alloc = alloc_for_confidence(d["confidence"]) * gmult   # dynamic, conviction + drawdown aware
                qty = int((self.equity() * alloc) // d["price"])
                if qty < 1:                       # can't afford a whole share at this allocation
                    continue
                if best is None or d["confidence"] > best["d"]["confidence"]:
                    best = {"sym": sym, "d": d, "price": d["price"], "qty": qty, "alloc": alloc}
            if best:
                d = best["d"]; px = best["price"]; qty = best["qty"]; alloc = best["alloc"]
                gd = GOVERNOR.review(self.name, best["sym"], qty * px)   # Governor chokepoint
                if not gd["approved"]:
                    log.info("[%s] VETO %s — %s", self.name, best["sym"], gd["reason"]); return
                qty = int(qty * gd["scale"])
                if qty < 1:
                    return
                stop = round(px * (1 - self.trail_pct), 2)
                self.positions[best["sym"]] = dict(qty=qty, entry=px, stop=stop, target=0,
                                                   regime=regime, conf=d["confidence"])
                log.info("[%s] ENTER %s qty=%d @%.2f conf=%d alloc=%.0f%% equity=%.0f (compounding) regime=%s",
                         self.name, best["sym"], qty, px, d["confidence"], alloc * 100, self.equity(), regime)
                log_decision({"bot": self.name, "action": "ENTER", "symbol": best["sym"], "regime": regime,
                              "confidence": d["confidence"], "alloc": round(alloc, 2), "qty": qty, "entry": px,
                              "stop": stop, "sub": d.get("sub"), "reasons": d.get("reasons"),
                              "components": d.get("components"),     # signal→outcome data for the Learning Engine
                              "expReturnPct": (d.get("sub") or {}).get("expReturnPct"),
                              "expDays": (d.get("sub") or {}).get("expDurationDays"),
                              "equity": round(self.equity(), 2)})
        except Exception:
            log.exception("[%s] cycle error — skipped, harness unaffected", self.name)

    def _exit(self, sym, price, reason):
        pos = self.positions.pop(sym)
        pnl = (price - pos["entry"]) * pos["qty"]
        self.realised += pnl
        self.consec_losses = 0 if pnl > 0 else self.consec_losses + 1   # streak tracking for guardrails
        self.peak = max(self.peak, self.equity())
        log.info("[%s] EXIT  %s qty=%d @%.2f pnl=%+.0f (%s) equity=%.0f regime=%s",
                 self.name, sym, pos["qty"], price, pnl, reason, self.equity(), pos.get("regime", "—"))
        log_decision({"bot": self.name, "action": "EXIT", "symbol": sym, "reason": reason,
                      "pnl": round(pnl, 2), "equity": round(self.equity(), 2),
                      "conf": pos.get("conf"), "consecLosses": self.consec_losses})

    def state(self) -> dict:
        gmult, pause = self._guardrail()
        return {"realised": round(self.realised, 2), "positions": self.positions,
                "start": self.start, "equity": round(self.equity(), 2), "peak": round(self.peak, 2),
                "consecLosses": self.consec_losses, "sizeMult": gmult, "pause": pause}

    def load(self, s: dict) -> None:
        self.realised = s.get("realised", 0.0)
        self.positions = s.get("positions", {})
        self.peak = s.get("peak", self.start)
        self.consec_losses = s.get("consecLosses", 0)
