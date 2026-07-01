"""Live/paper trading runner.

    python run_bot.py            # uses settings.py (PAPER=True by default)

In PAPER mode it still needs a valid Kite token to fetch real market data,
but routes orders to a simulated broker. In live mode (PAPER=False) it places
REAL orders. Stop with Ctrl-C.
"""
from __future__ import annotations

import logging
import time as _time

import settings
from bot.config import load_env, require
from bot import auth
from bot.broker import KiteBroker, PaperBroker
from bot.data import DataFeed
from bot.engine import TradingEngine
from bot.risk import RiskManager
from bot.safety import live_execution_allowed
from bot.strategy import MeanReversionStrategy
from bot.strategy_momentum import MomentumStrategy, MomentumConfig
from bot.strategies_lib import RSI2Strategy
from bot.pairs_exec import PairsExecEngine

# Validated long-only strategies the live runner can execute. Each → (strategy, interval, history_days).
LIVE_STRATEGIES = {
    "meanrev":  lambda: (MeanReversionStrategy(settings.STRATEGY), "5minute", 30),
    "momentum": lambda: (MomentumStrategy(MomentumConfig()), "day", 400),
    "rsi2":     lambda: (RSI2Strategy(), "day", 300),
}

# Validated market-neutral pairs for the 2-leg executor (STRATEGY_NAME="pairs").
# Cash legs are traded intraday (MIS) so the short leg is legal; for overnight pairs
# swap in the stock-futures tradingsymbols and product="NRML".
PAIRS = [("TATASTEEL", "JSWSTEEL"), ("INFY", "WIPRO"),
         ("HDFCBANK", "ICICIBANK"), ("ICICIBANK", "AXISBANK")]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("run_bot")


def main() -> None:
    load_env()
    api_key = require("KITE_API_KEY")
    access_token = require("KITE_ACCESS_TOKEN")
    kite = auth.make_kite(api_key, access_token)

    data = DataFeed(kite, exchange="NSE")
    data.load_instruments()

    name = getattr(settings, "STRATEGY_NAME", "meanrev")
    is_pairs = (name == "pairs")
    if not is_pairs and name not in LIVE_STRATEGIES:
        raise SystemExit(f"Unknown STRATEGY_NAME={name!r}. Choose: {', '.join(LIVE_STRATEGIES)}, pairs")
    risk = RiskManager(settings.RISK)

    # Two-key gate (shared with the dashboard): real orders require
    # settings.PAPER=False AND ALLOW_LIVE armed AND dashboard mode=live.
    go_live, reason = live_execution_allowed(settings.PAPER)
    if go_live:
        broker = KiteBroker(kite, exchange="NSE")
        log.warning("LIVE mode — REAL orders with REAL money. strategy=%s (%s)", name, reason)
    else:
        broker = PaperBroker(starting_cash=settings.RISK.capital)
        log.info("PAPER mode — no real orders. strategy=%s (%s)", name, reason)

    if is_pairs:
        # 2-leg market-neutral executor — routes BOTH legs through the same gated broker.
        engine = PairsExecEngine(PAIRS, data, broker, capital=settings.RISK.capital, product="MIS")
        log.info("Starting PAIRS loop over %s every %ss",
                 [f"{a}/{b}" for a, b in PAIRS], settings.POLL_SECONDS)
    else:
        strategy, interval, history_days = LIVE_STRATEGIES[name]()
        engine = TradingEngine(
            symbols=settings.SYMBOLS,
            strategy=strategy,
            risk=risk,
            broker=broker,
            data=data,
            interval=interval,
            history_days=history_days,
        )
        log.info("Starting loop over %s every %ss", settings.SYMBOLS, settings.POLL_SECONDS)

    try:
        while True:
            if engine.market_open():
                engine.run_cycle()
            else:
                log.info("Market closed — idling.")
            _time.sleep(settings.POLL_SECONDS)
    except KeyboardInterrupt:
        log.info("Stopped. Open positions: %s", list(engine.positions))


if __name__ == "__main__":
    main()
