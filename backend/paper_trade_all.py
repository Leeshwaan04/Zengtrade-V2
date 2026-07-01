"""Forward paper-trade ALL THREE strategies on live Kite data. No real orders.

    python paper_trade_all.py            # live loop during market hours
    python paper_trade_all.py --once     # run one cycle now and exit (for testing)

Cadence:
  - Mean-reversion: every cycle (5-min intraday), squared off near close
  - Momentum + Pairs: once per day near 15:20 (they trade daily bars)

State persists to paper_state.json so a multi-day run survives restarts.
Logs to console + paper_trades.log. Generates the fresh out-of-sample evidence
that decides whether anything here earns real capital.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import time as _time
import urllib.request as _url
from datetime import datetime, time

from bot.config import load_env, require
from bot import auth
from bot.data import DataFeed
from bot.paper_engine import LongOnlyPaperEngine, PairsPaperEngine, market_open
from bot import paper_engine as _pe
from bot.risk import RiskConfig, RiskManager
from bot.strategy import MeanReversionConfig, MeanReversionStrategy
from bot.strategy_momentum import MomentumConfig, MomentumStrategy
from bot.strategies_lib import (RSI2Strategy, MACrossStrategy, SupertrendStrategy,
                                EMACrossStrategy, ADXTrendStrategy, BollingerRevStrategy,
                                ZScoreRevStrategy, NR7Strategy, ORBStrategy, VWAPRevStrategy,
                                VWAPMomStrategy, EMAScalpStrategy, BBBreakStrategy)
from bot.xs import CrossSectionalPaperEngine
from bot.opportunity import OpportunityPaperEngine, MoonshotCompounderEngine, COMPONENTS as OPP_PRIORS
from bot.options_paper import OptionsPaperEngine
from bot.futures_paper import FuturesPaperEngine
from bot.learning import compute_learning, save_weights
from bot.governor import GOVERNOR
from bot.rebalancer import REBALANCER


def _engine_capital(e) -> float:
    return (getattr(e, "capital", None) or getattr(e, "start", None)
            or getattr(getattr(e, "risk", None), "cfg", None) and e.risk.cfg.capital or 500_000.0)


GOVERNED_CAPITAL = 1_000_000.0   # the unified governed pool the portfolio limits are measured against
FUT_MARGIN_PCT = 0.15            # futures trade on ~15% SPAN+exposure margin — book the CAPITAL AT RISK,
                                 # not full notional (else one NIFTY lot ≈ 180% of the pool distorts every cap)


def update_governor(engines, pairs, dep):
    """Feed the Risk Governor the live book (all deployed bots) + aggregate realised P&L.
    The book is governed as ONE portfolio against a fixed pool, so concentration limits are
    meaningful (% of capital) regardless of each bot's own sandbox size."""
    book, realised = [], 0.0
    for k, e in engines.items():
        if CATALOG_ID[k] not in dep:
            continue
        realised += getattr(e, "realised", 0.0)
        is_fut = isinstance(e, FuturesPaperEngine)
        for sym, p in getattr(e, "positions", {}).items():
            notional = (p.get("qty", 0) or 0) * (p.get("entry", 0) or 0)
            value = notional * FUT_MARGIN_PCT if is_fut else notional   # margin for futures, cash for equity
            book.append({"sym": sym, "value": value, "bot": getattr(e, "name", k)})
    realised += getattr(pairs, "realised", 0.0)
    GOVERNOR.set_book(book, realised, GOVERNED_CAPITAL)
    # drive the regime rebalancer from the live regime + portfolio health (capital-preservation)
    REBALANCER.set(_pe.CURRENT_REGIME, GOVERNOR.health().get("score", 100))
    REBALANCER.persist([CATALOG_ID.get(k, k) for k in engines] + ["pairs"])
from bot.subscriptions import deployed_ids, all_subs, ensure_seeded

# harness engine key -> catalog strategy id (what the user deploys in the UI)
CATALOG_ID = {"mean-rev": "meanrev", "momentum": "momentum", "rsi2": "rsi2",
              "macross": "macross", "supertrend": "supertrend",
              # Wave-1 price-based bots (engine key == catalog id)
              "ema_cross": "ema_cross", "adx_trend": "adx_trend",
              "bollinger": "bollinger", "zscore": "zscore", "nr7": "nr7",
              # Wave-2 cross-sectional basket bots
              "xs_momentum": "xs_momentum", "lowvol": "lowvol",
              # Wave-4 intraday bots + Opportunity decision engine
              "orb": "orb", "vwap_rev": "vwap_rev", "opportunity": "opportunity",
              "vwap_mom": "vwap_mom", "ema_scalp": "ema_scalp", "bb_breakout": "bb_breakout",
              # Wave-3 options forward-paper bots
              "iron_condor": "iron_condor", "strangle": "strangle",
              # index-futures forward-paper bots (engine key == catalog id)
              "fut_trend": "fut_trend", "basis": "basis",
              # Moonshot compounder (₹5,000 → mission)
              "moonshot": "moonshot"}

STATE_FILE = "paper_state.json"
STOPPED_ARCHIVE = "stopped_positions.json"   # liquidations from STOPPING a strategy — kept OUT of its P&L
POLL_SECONDS = 300
PAPER_CAPITAL = 500_000   # paper sizing — large enough that forward P&L is legible (proves the signal, not the size)
DAILY_RUN_AFTER = time(15, 20)   # LEGACY validated bots (momentum/rsi2/pairs) keep close-entry — untouched
MORNING_RUN_AFTER = time(9, 30)  # NEW daily bots evaluate at the open & HOLD → active intraday
LEGACY_DAILY = {"momentum", "rsi2"}   # the originals stay on close-entry (pairs handled separately)
SQUARE_OFF_AFTER = time(15, 15)  # square off intraday mean-rev after this

UNIVERSE = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "TATASTEEL",
            "HINDALCO", "SBIN", "AXISBANK", "JSWSTEEL", "WIPRO", "LT"]
PAIRS = [("TATASTEEL", "JSWSTEEL"), ("INFY", "WIPRO"),
         ("HDFCBANK", "ICICIBANK"), ("ICICIBANK", "AXISBANK")]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(), logging.FileHandler("paper_trades.log")],
)
log = logging.getLogger("paper.run")


def _fetch_regime() -> str:
    """The live regime the dashboard shows (from bot_api /api/market) so trade tags match the UI."""
    try:
        with _url.urlopen("http://localhost:8756/api/market", timeout=2) as r:
            d = json.load(r)
        return (d.get("engine") or {}).get("regime") or "—"
    except Exception:
        return "—"


def build_engines(data):
    """All cash strategies + pairs in the forward PAPER harness. mean-rev is the only
    intraday (5-min) engine; the rest trade daily bars and run once/day."""
    engines = {
        "mean-rev": LongOnlyPaperEngine("mean-rev", MeanReversionStrategy(MeanReversionConfig()),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="MIS")),
            data, UNIVERSE, interval="5minute", history_days=12),
        "momentum": LongOnlyPaperEngine("momentum", MomentumStrategy(MomentumConfig()),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)),
            data, UNIVERSE, interval="day", history_days=400),
        "rsi2": LongOnlyPaperEngine("rsi2", RSI2Strategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC")),
            data, UNIVERSE, interval="day", history_days=300),
        "macross": LongOnlyPaperEngine("macross", MACrossStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC", stop_atr_mult=3.0)),
            data, UNIVERSE, interval="day", history_days=300),
        "supertrend": LongOnlyPaperEngine("supertrend", SupertrendStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC", stop_atr_mult=3.0)),
            data, UNIVERSE, interval="day", history_days=300),
        # ---- Wave-1 bots: same strategy/risk configs the regime backtest validated ----
        "ema_cross": LongOnlyPaperEngine("ema_cross", EMACrossStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)),
            data, UNIVERSE, interval="day", history_days=300),
        "adx_trend": LongOnlyPaperEngine("adx_trend", ADXTrendStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)),
            data, UNIVERSE, interval="day", history_days=300),
        "bollinger": LongOnlyPaperEngine("bollinger", BollingerRevStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC")),
            data, UNIVERSE, interval="day", history_days=300),
        "zscore": LongOnlyPaperEngine("zscore", ZScoreRevStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)),
            data, UNIVERSE, interval="day", history_days=300),
        "nr7": LongOnlyPaperEngine("nr7", NR7Strategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)),
            data, UNIVERSE, interval="day", history_days=300),
        # ---- Wave-2 cross-sectional rank-basket bots (daily rebalance, hold top 4) ----
        "xs_momentum": CrossSectionalPaperEngine("xs_momentum", "momentum", PAPER_CAPITAL,
            data, UNIVERSE, top_n=4, mom_lookback=126, market_filter=True),
        "lowvol": CrossSectionalPaperEngine("lowvol", "lowvol", PAPER_CAPITAL,
            data, UNIVERSE, top_n=4, vol_lookback=20, market_filter=False),
        # ---- Wave-4 intraday bots (5-min, session-aware, daily square-off) ----
        "orb": LongOnlyPaperEngine("orb", ORBStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="MIS", stop_atr_mult=2.0, target_atr_mult=3.0)),
            data, UNIVERSE, interval="5minute", history_days=12),
        "vwap_rev": LongOnlyPaperEngine("vwap_rev", VWAPRevStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="MIS", stop_atr_mult=1.5, target_atr_mult=0.0)),
            data, UNIVERSE, interval="5minute", history_days=12),
        # ---- intraday momentum / breakout (5-min, tight stop + quick target) ----
        "vwap_mom": LongOnlyPaperEngine("vwap_mom", VWAPMomStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="MIS", stop_atr_mult=1.5, target_atr_mult=2.5)),
            data, UNIVERSE, interval="5minute", history_days=12),
        "ema_scalp": LongOnlyPaperEngine("ema_scalp", EMAScalpStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="MIS", stop_atr_mult=1.2, target_atr_mult=2.0)),
            data, UNIVERSE, interval="5minute", history_days=12),
        "bb_breakout": LongOnlyPaperEngine("bb_breakout", BBBreakStrategy(),
            RiskManager(RiskConfig(capital=PAPER_CAPITAL, product="MIS", stop_atr_mult=1.5, target_atr_mult=2.5)),
            data, UNIVERSE, interval="5minute", history_days=12),
        # ---- the Opportunity Engine: high-conviction decision engine over the whole pool ----
        "opportunity": OpportunityPaperEngine("opportunity", PAPER_CAPITAL, data, UNIVERSE,
            top_n=3, min_agree=2, max_positions=3),
        # ---- Wave-3 options forward-paper bots (weekly Nifty premium selling) ----
        "iron_condor": OptionsPaperEngine("iron_condor", "iron_condor", getattr(data, "kite", None),
            PAPER_CAPITAL, underlying="NIFTY", wing_pts=200, data=data),
        "strangle": OptionsPaperEngine("strangle", "strangle", getattr(data, "kite", None),
            PAPER_CAPITAL, underlying="NIFTY", data=data),
        # ---- index-futures forward-paper bots (near-month NIFTY future) ----
        "fut_trend": FuturesPaperEngine("fut_trend", "trend", getattr(data, "kite", None), data,
            PAPER_CAPITAL, underlying="NIFTY", trend_period=20),
        "basis": FuturesPaperEngine("basis", "basis", getattr(data, "kite", None), data,
            PAPER_CAPITAL, underlying="NIFTY"),
        # ---- the Moonshot Compounder: ₹5,000 start, reinvest everything, ride the best setup ----
        "moonshot": MoonshotCompounderEngine("moonshot", 5_000, data, UNIVERSE,
            target=5e10, min_conf=65, deploy_frac=0.95, trail_pct=0.05),
    }
    pairs = PairsPaperEngine(PAIRS, data, capital=PAPER_CAPITAL)
    return engines, pairs


INTRADAY = ["mean-rev", "orb", "vwap_rev", "vwap_mom", "ema_scalp", "bb_breakout"]   # 5-min engines: every cycle + daily square-off
HOLD_CYCLE = ["moonshot",
              # self-marking options + futures: run EVERY cycle so their live unrealised P&L updates
              # (they self-guard entry — one structure/position at a time — and hold across days, no square-off)
              "iron_condor", "strangle", "fut_trend", "basis"]


def save(engines, pairs):
    d = {k: e.state() for k, e in engines.items()}
    d["pairs"] = pairs.state()
    d["updated"] = datetime.now().isoformat()
    json.dump(d, open(STATE_FILE, "w"), indent=2, default=str)


def load(engines, pairs):
    if os.path.exists(STATE_FILE):
        s = json.load(open(STATE_FILE))
        for k, e in engines.items():
            e.load(s.get(k, {}))
        pairs.load(s.get("pairs", {}))
        log.info("Loaded prior paper state from %s", STATE_FILE)


def status(engines, pairs):
    parts = " | ".join(f"{k} ₹{e.realised:+.0f}({len(e.positions)})" for k, e in engines.items())
    log.info("P&L | %s | pairs ₹%+.0f", parts, pairs.realised)


def _flatten(e, cid, reason, archive: list) -> list:
    """Square off every open position of one engine at the live mark, recording the
    liquidation to `archive` instead of the strategy's realised P&L. A STOPPED strategy
    didn't *choose* to exit — booking the mark-to-market against its track record would
    lie, so admin stop-outs live in a separate ledger (stopped_positions.json)."""
    closed = []
    for sym, pos in list(getattr(e, "positions", {}).items()):
        try:
            df = e.data.historical(e.data.token_for(sym), e.interval, e.history_days)
            if df.empty:
                continue
            mark = float(df.iloc[-1]["close"])
        except Exception:
            log.exception("[%s] flatten: could not mark %s — leaving it for next reconcile", cid, sym)
            continue
        pnl = (mark - pos["entry"]) * pos["qty"]
        closed.append({"sym": sym, "qty": pos["qty"], "entry": pos["entry"],
                       "exit": round(mark, 2), "pnl": round(pnl, 2)})
        del e.positions[sym]
    if closed:
        rec = {"strategy": cid, "stoppedAt": datetime.now().isoformat(), "reason": reason,
               "closed": closed, "flattenPnl": round(sum(c["pnl"] for c in closed), 2)}
        archive.append(rec)
        log.info("STOP %s — flattened %d stranded paper position(s) @ live mark, "
                 "P&L %+.0f → archived (NOT booked to the strategy)",
                 cid, len(closed), rec["flattenPnl"])
    return closed


def _archive_stops(records: list) -> None:
    if not records:
        return
    prior = []
    if os.path.exists(STOPPED_ARCHIVE):
        try:
            prior = json.load(open(STOPPED_ARCHIVE)) or []
        except Exception:
            prior = []
    json.dump(prior + records, open(STOPPED_ARCHIVE, "w"), indent=2, default=str)


def reconcile_subscriptions(engines, pairs) -> None:
    """Square off any engine still holding positions for a strategy no longer subscribed
    (stopped while the harness was down). The in-loop STOP only catches deploy→stop
    transitions seen within ONE running process; without this, a restart strands those
    positions forever and they pollute the monitor book marked-to-market. Paused
    strategies stay in subscriptions, so their open book is intentionally preserved."""
    subs = all_subs()
    recs: list = []
    for k, e in engines.items():
        if CATALOG_ID[k] not in subs:        # not deployed AND not paused → must hold nothing
            _flatten(e, CATALOG_ID[k], "orphan-flatten (unsubscribed across restart)", recs)
    if recs:
        _archive_stops(recs)
        save(engines, pairs)
        log.info("Reconciled %d stopped strateg%s on startup.",
                 len(recs), "y" if len(recs) == 1 else "ies")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()

    load_env()
    kite = auth.make_kite(require("KITE_API_KEY"), require("KITE_ACCESS_TOKEN"))
    data = DataFeed(kite, exchange="NSE")
    data.load_instruments()

    engines, pairs = build_engines(data)
    load(engines, pairs)
    ensure_seeded(["momentum", "rsi2", "pairs"])   # first run: don't silently stop a running forward test
    reconcile_subscriptions(engines, pairs)        # flatten positions stranded by a stop-while-stopped

    def relearn(tag=""):
        """Re-derive the Opportunity-score weights from the decision log (evidence-weighted)."""
        try:
            lr = compute_learning(OPP_PRIORS)
            save_weights(lr["weights"])
            log.info("Learning %s: %s on %d closed trades", tag, lr["status"], lr["nTrades"])
        except Exception:
            log.exception("learning step failed")
    relearn("(startup)")
    try:
        _pe.CURRENT_REGIME = _fetch_regime()                                  # live regime for the rebalancer
        update_governor(engines, pairs, deployed_ids()); GOVERNOR.persist()   # publish risk + rebalance on startup
    except Exception:
        log.exception("governor init failed")
    daily = [k for k in engines if k not in INTRADAY and k not in HOLD_CYCLE]
    morning_daily = [k for k in daily if CATALOG_ID[k] not in LEGACY_DAILY]   # NEW bots → open entry, hold
    legacy_daily = [k for k in daily if CATALOG_ID[k] in LEGACY_DAILY]         # originals → close entry, unchanged
    log.info("PAPER mode — no real orders. %d strategies (%s) + pairs. Universe=%d.",
             len(engines), ", ".join(engines), len(UNIVERSE))

    if args.once:
        dep = deployed_ids()
        log.info("Single test cycle — deployed only: %s", ", ".join(sorted(dep)) or "(none)")
        for k, e in engines.items():
            if CATALOG_ID[k] in dep:
                e.run_cycle()
        if "pairs" in dep:
            pairs.run_cycle()
        status(engines, pairs)
        save(engines, pairs)
        return

    daily_done_on = None     # legacy bots (momentum/rsi2/pairs) — close run
    morning_done_on = None   # new daily bots — open run
    try:
        while True:
            now = datetime.now()
            if market_open(now):
                _pe.CURRENT_REGIME = _fetch_regime()   # stamp the live regime onto entries this cycle
                dep = deployed_ids()          # paper/live only (paused excluded → keeps positions)
                subs = all_subs()
                update_governor(engines, pairs, dep)   # refresh the book + drawdown BEFORE any entries
                # Stop = subscription removed entirely → flatten its open paper book once,
                # archiving the liquidation out of the strategy's P&L. Restart-safe: it fires
                # whenever an unsubscribed engine still holds positions, not on a remembered transition.
                stop_recs: list = []
                for k, e in engines.items():
                    if CATALOG_ID[k] not in subs and getattr(e, "positions", None):
                        _flatten(e, CATALOG_ID[k], "stop (subscription removed)", stop_recs)
                _archive_stops(stop_recs)
                # intraday deployed engines every cycle
                for k in INTRADAY:
                    if CATALOG_ID[k] in dep:
                        engines[k].run_cycle(square_off=now.time() >= SQUARE_OFF_AFTER)
                # hold-cycle engines (e.g. Moonshot) — run every cycle, NO square-off (compound across days)
                for k in HOLD_CYCLE:
                    if CATALOG_ID[k] in dep:
                        engines[k].run_cycle()
                # NEW daily bots — evaluate ONCE at the open, then hold all day (active intraday)
                if now.time() >= MORNING_RUN_AFTER and morning_done_on != now.date():
                    ran = [k for k in morning_daily if CATALOG_ID[k] in dep]
                    if ran:
                        log.info("Morning run (open entry, hold): %s", ", ".join(ran))
                    for k in ran:
                        engines[k].run_cycle()
                    relearn("(daily)")     # update learned weights from the growing decision log
                    morning_done_on = now.date()
                # LEGACY validated bots (momentum/rsi2) + pairs — keep close-entry, once/day after the cutoff
                if now.time() >= DAILY_RUN_AFTER and daily_done_on != now.date():
                    ran = [k for k in legacy_daily if CATALOG_ID[k] in dep]
                    if ran:
                        log.info("Close run (legacy): %s", ", ".join(ran))
                    for k in ran:
                        engines[k].run_cycle()
                    if "pairs" in dep:
                        pairs.run_cycle()
                    daily_done_on = now.date()
                status(engines, pairs)
                save(engines, pairs)
                GOVERNOR.persist()           # publish health + audit for the Risk tab
            else:
                log.info("Market closed — idling.")
            _time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        save(engines, pairs)
        log.info("Stopped. State saved. Final:")
        status(engines, pairs)


if __name__ == "__main__":
    main()
