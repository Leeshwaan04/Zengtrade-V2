#!/usr/bin/env python3
"""Forward paper-trade the FULL strategy library on live Binance spot data — 24/7.

    python3 paper_trade_crypto.py            # continuous 24/7 loop (crypto never closes)
    python3 paper_trade_crypto.py --once     # run one cycle now and exit (for testing)

WHY this is a second harness, not a flag on the first: the NSE harness is wired to Kite,
market-hours, options/futures and daily square-off. Crypto trades 24/7, has no square-off,
and uses a different data feed — but the SAME strategy library and the SAME paper engines
(compute/_entry_long/_exit_long are market-agnostic). So this file reuses every engine class
unchanged and only swaps the feed (CryptoDataFeed) + the session model (24/7, no square-off).

Isolation: every shared state file the engines/governor/rebalancer persist is redirected to a
`crypto_*` path BEFORE the modules are imported-and-bound, so the crypto book can NEVER clobber
the Indian book's state. Prices are REAL Binance spot; fills are simulated (paper only).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import time as _time
from datetime import datetime

# ---- isolate ALL shared persistence to crypto-specific paths (must happen before use) ----
_REPO = os.path.dirname(os.path.abspath(__file__))
import bot.governor as _gov
import bot.rebalancer as _reb
import bot.opportunity as _opp
import bot.learning as _lrn
_gov.STATE_FILE = os.path.join(_REPO, "crypto_governor_state.json")
_reb.STATE_FILE = os.path.join(_REPO, "crypto_rebalance_state.json")
_opp.DECISIONS_FILE = os.path.join(_REPO, "crypto_decisions.jsonl")
_lrn.DECISIONS_FILE = os.path.join(_REPO, "crypto_decisions.jsonl")
_lrn.WEIGHTS_FILE = os.path.join(_REPO, "crypto_learned_weights.json")

from bot import indicators
from bot import paper_engine as _pe
from bot.paper_engine import LongOnlyPaperEngine, PairsPaperEngine
from bot.risk import RiskConfig, RiskManager
from bot.strategy import MeanReversionConfig, MeanReversionStrategy
from bot.strategy_momentum import MomentumConfig, MomentumStrategy
from bot.strategies_lib import (RSI2Strategy, MACrossStrategy, SupertrendStrategy,
                                EMACrossStrategy, ADXTrendStrategy, BollingerRevStrategy,
                                ZScoreRevStrategy, NR7Strategy, ORBStrategy, VWAPRevStrategy,
                                VWAPMomStrategy, EMAScalpStrategy, BBBreakStrategy)
from bot.xs import CrossSectionalPaperEngine
from bot.opportunity import OpportunityPaperEngine, MoonshotCompounderEngine
from bot.crypto_data import CryptoDataFeed
from bot.governor import GOVERNOR
from bot.rebalancer import REBALANCER

POLL_SECONDS = 300
PAPER_CAPITAL = 500_000        # engine sizing (matches the NSE book so P&L is legible & comparable)
GOVERNED_CAPITAL = 1_000_000   # the governed pool the crypto concentration/crowding caps measure against
STATE_FILE = os.path.join(_REPO, "crypto_state.json")

# top-10 liquid majors (USDT spot) — the same universe the Algo Studio shows
UNIVERSE = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
            "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "MATICUSDT"]
# stat-arb legs across correlated majors (2-leg USDT spread)
PAIRS = [("ETHUSDT", "BTCUSDT"), ("SOLUSDT", "ETHUSDT"),
         ("BNBUSDT", "BTCUSDT"), ("AVAXUSDT", "SOLUSDT")]

# crypto sub-sector grouping so the Governor's sector cap applies the SAME anti-correlation
# discipline to crypto (all alts move together = one bet). Each coin also still hits the 18%
# symbol cap + 2-bots-per-name crowding cap for free.
CRYPTO_SECTOR = {
    "BTCUSDT": "Crypto-Major", "ETHUSDT": "Crypto-Major",
    "SOLUSDT": "Crypto-L1", "BNBUSDT": "Crypto-L1", "ADAUSDT": "Crypto-L1", "AVAXUSDT": "Crypto-L1",
    "XRPUSDT": "Crypto-Alt", "DOGEUSDT": "Crypto-Alt", "LINKUSDT": "Crypto-Alt", "MATICUSDT": "Crypto-Alt",
}
_gov.SECTOR.update(CRYPTO_SECTOR)   # teach the (fresh, in-process) Governor how to group crypto

# intraday (5-min) engines run WITHOUT square-off (crypto is 24/7); session VWAP/OR reset each UTC day
INTRADAY = {"mean-rev", "orb", "vwap_rev", "vwap_mom", "ema_scalp", "bb_breakout"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(), logging.FileHandler(os.path.join(_REPO, "crypto_trades.log"))],
)
log = logging.getLogger("crypto.run")


def build_crypto_engines(data):
    """Every market-agnostic strategy in the library, on the crypto universe. Options/futures
    (index-specific) and the NSE pairs sit this one out; crypto gets its own stat-arb pairs."""
    R = lambda **kw: RiskManager(RiskConfig(capital=PAPER_CAPITAL, **kw))
    engines = {
        # ---- daily trend / reversion / breakout (CNC-style, hold across days) ----
        "momentum": LongOnlyPaperEngine("momentum", MomentumStrategy(MomentumConfig()),
            R(product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5), data, UNIVERSE, "day", 400),
        "rsi2": LongOnlyPaperEngine("rsi2", RSI2Strategy(),
            R(product="CNC"), data, UNIVERSE, "day", 400),
        "macross": LongOnlyPaperEngine("macross", MACrossStrategy(),
            R(product="CNC", stop_atr_mult=3.0), data, UNIVERSE, "day", 400),
        "supertrend": LongOnlyPaperEngine("supertrend", SupertrendStrategy(),
            R(product="CNC", stop_atr_mult=3.0), data, UNIVERSE, "day", 400),
        "ema_cross": LongOnlyPaperEngine("ema_cross", EMACrossStrategy(),
            R(product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5), data, UNIVERSE, "day", 400),
        "adx_trend": LongOnlyPaperEngine("adx_trend", ADXTrendStrategy(),
            R(product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5), data, UNIVERSE, "day", 400),
        "bollinger": LongOnlyPaperEngine("bollinger", BollingerRevStrategy(),
            R(product="CNC"), data, UNIVERSE, "day", 400),
        "zscore": LongOnlyPaperEngine("zscore", ZScoreRevStrategy(),
            R(product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5), data, UNIVERSE, "day", 400),
        "nr7": LongOnlyPaperEngine("nr7", NR7Strategy(),
            R(product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5), data, UNIVERSE, "day", 400),
        # ---- cross-sectional rank baskets (daily rebalance, hold top 4) ----
        "xs_momentum": CrossSectionalPaperEngine("xs_momentum", "momentum", PAPER_CAPITAL,
            data, UNIVERSE, top_n=4, mom_lookback=90, market_filter=False),
        "lowvol": CrossSectionalPaperEngine("lowvol", "lowvol", PAPER_CAPITAL,
            data, UNIVERSE, top_n=4, vol_lookback=20, market_filter=False),
        # ---- intraday (5-min) — 24/7, no square-off; session resets each UTC day ----
        "mean-rev": LongOnlyPaperEngine("mean-rev", MeanReversionStrategy(MeanReversionConfig()),
            R(product="MIS"), data, UNIVERSE, "5minute", 12),
        "orb": LongOnlyPaperEngine("orb", ORBStrategy(),
            R(product="MIS", stop_atr_mult=2.0, target_atr_mult=3.0), data, UNIVERSE, "5minute", 12),
        "vwap_rev": LongOnlyPaperEngine("vwap_rev", VWAPRevStrategy(),
            R(product="MIS", stop_atr_mult=1.5, target_atr_mult=0.0), data, UNIVERSE, "5minute", 12),
        "vwap_mom": LongOnlyPaperEngine("vwap_mom", VWAPMomStrategy(),
            R(product="MIS", stop_atr_mult=1.5, target_atr_mult=2.5), data, UNIVERSE, "5minute", 12),
        "ema_scalp": LongOnlyPaperEngine("ema_scalp", EMAScalpStrategy(),
            R(product="MIS", stop_atr_mult=1.2, target_atr_mult=2.0), data, UNIVERSE, "5minute", 12),
        "bb_breakout": LongOnlyPaperEngine("bb_breakout", BBBreakStrategy(),
            R(product="MIS", stop_atr_mult=1.5, target_atr_mult=2.5), data, UNIVERSE, "5minute", 12),
        # ---- high-conviction decision engine + the moonshot compounder ----
        "opportunity": OpportunityPaperEngine("opportunity", PAPER_CAPITAL, data, UNIVERSE,
            top_n=3, min_agree=2, max_positions=3, mtf=False),
        "moonshot": MoonshotCompounderEngine("moonshot", 5_000, data, UNIVERSE,
            min_conf=65, deploy_frac=0.95, trail_pct=0.08),
    }
    pairs = PairsPaperEngine(PAIRS, data, PAPER_CAPITAL)
    return engines, pairs


def crypto_regime(data) -> str:
    """A simple, honest regime read off BTC daily bars (BTC leads the whole complex):
    trend from the 50/200 SMA stack, plus an ATR% high-vol overlay."""
    try:
        df = data.historical("BTCUSDT", "day", 400)
        if df is None or df.empty or len(df) < 205:
            return "Bull"
        c = df["close"]
        sma50 = float(indicators.sma(c, 50).iloc[-1])
        sma200 = float(indicators.sma(c, 200).iloc[-1])
        px = float(c.iloc[-1])
        atr = float(indicators.atr(df["high"], df["low"], df["close"], 14).iloc[-1])
        atr_pct = atr / px * 100 if px else 0.0
        if atr_pct >= 6.0:
            return "High-Vol"
        if px > sma200 and sma50 >= sma200:
            return "Bull"
        if px < sma200 and sma50 < sma200:
            return "Bear"
        return "Choppy"
    except Exception:
        return "Bull"


def update_governor(engines, pairs):
    """Feed the (crypto) Governor the live book + aggregate realised P&L. Crypto is SPOT, so the
    value booked is full notional qty×entry (no margin). Each entry carries its bot for the
    crowding cap."""
    book, realised = [], 0.0
    for k, e in engines.items():
        realised += getattr(e, "realised", 0.0)
        for sym, p in getattr(e, "positions", {}).items():
            book.append({"sym": sym, "value": (p.get("qty", 0) or 0) * (p.get("entry", 0) or 0),
                         "bot": getattr(e, "name", k)})
    realised += getattr(pairs, "realised", 0.0)
    GOVERNOR.set_book(book, realised, GOVERNED_CAPITAL)
    REBALANCER.set(_pe.CURRENT_REGIME, GOVERNOR.health().get("score", 100))


def save(engines, pairs):
    d = {k: e.state() for k, e in engines.items()}
    d["pairs"] = pairs.state()
    d["market"] = "crypto"
    d["regime"] = _pe.CURRENT_REGIME
    d["updated"] = datetime.now().isoformat()
    json.dump(d, open(STATE_FILE, "w"), indent=2, default=str)


def load(engines, pairs):
    if os.path.exists(STATE_FILE):
        try:
            s = json.load(open(STATE_FILE))
            for k, e in engines.items():
                e.load(s.get(k, {}))
            pairs.load(s.get("pairs", {}))
            log.info("Loaded prior crypto paper state from %s", STATE_FILE)
        except Exception:
            log.exception("could not load prior crypto state — starting fresh")


def status(engines, pairs):
    parts = " | ".join(f"{k} {e.realised:+.0f}({len(e.positions)})" for k, e in engines.items())
    log.info("crypto P&L | %s | pairs %+.0f", parts, pairs.realised)


def run_cycle(engines, pairs, data):
    _pe.CURRENT_REGIME = crypto_regime(data)
    update_governor(engines, pairs)     # prime the book (dd/health) + rebalancer BEFORE any entries
    for k, e in engines.items():
        try:
            e.run_cycle(square_off=False)   # crypto never closes → never square off
        except Exception:
            log.exception("[%s] cycle error — skipped, harness unaffected", k)
    try:
        pairs.run_cycle()
    except Exception:
        log.exception("[pairs] cycle error — skipped")
    update_governor(engines, pairs)     # refresh the book after this cycle's entries/exits
    GOVERNOR.persist()
    REBALANCER.persist(list(engines) + ["pairs"])
    save(engines, pairs)
    status(engines, pairs)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()

    data = CryptoDataFeed()
    engines, pairs = build_crypto_engines(data)
    load(engines, pairs)
    _pe.CURRENT_REGIME = crypto_regime(data)
    log.info("CRYPTO PAPER mode — no real orders. %d strategies (%s) + pairs. Universe=%d. Regime=%s.",
             len(engines), ", ".join(engines), len(UNIVERSE), _pe.CURRENT_REGIME)

    run_cycle(engines, pairs, data)
    if args.once:
        log.info("Single crypto cycle done.")
        return
    while True:
        try:
            _time.sleep(POLL_SECONDS)
            run_cycle(engines, pairs, data)
        except KeyboardInterrupt:
            save(engines, pairs)
            log.info("Stopped. Crypto state saved.")
            break
        except Exception:
            log.exception("crypto loop error — continuing")


if __name__ == "__main__":
    main()
