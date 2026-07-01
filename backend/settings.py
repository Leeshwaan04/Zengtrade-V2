"""Your trading configuration. Edit this file — no code changes needed.

These are deliberately conservative defaults. Backtest any change before
running it live.
"""
from bot.strategy import MeanReversionConfig
from bot.risk import RiskConfig

# --- Universe: which NSE equities to trade (liquid large-caps recommended) ---
SYMBOLS = [
    "RELIANCE",
    "TCS",
    "HDFCBANK",
    "INFY",
    "ICICIBANK",
]

# --- Candle interval & how much history to pull for indicators ---
INTERVAL = "5minute"      # minute, 5minute, 15minute, 30minute, day
HISTORY_DAYS = 30

# --- Strategy parameters (mean reversion) ---
STRATEGY = MeanReversionConfig(
    use_bbands=True,
    bb_period=20,
    bb_std=2.0,
    use_rsi=True,
    rsi_period=14,
    rsi_oversold=30.0,    # enter long when RSI below this AND price below lower band
    rsi_exit=55.0,        # exit when RSI climbs back above this
    use_zscore=False,
    exit_at_mean=True,    # also exit when price reverts up to the 20-SMA mid band
    use_trend_filter=True,  # only buy dips when price is ABOVE its long SMA (anti falling-knife)
    trend_period=200,       # 200-bar trend baseline
    atr_period=14,
    allow_short=False,    # keep False for cash/delivery
)

# --- Risk parameters ---
RISK = RiskConfig(
    capital=25_000.0,
    risk_per_trade_pct=1.0,        # risk 1% of capital between entry and stop
    max_alloc_per_trade_pct=20.0,  # never put >20% of capital in one name
    max_positions=5,
    max_daily_loss_pct=3.0,        # stop trading for the day after a 3% loss
    stop_atr_mult=2.0,             # stop-loss = entry - 2*ATR
    target_atr_mult=3.0,           # target  = entry + 3*ATR (0 = ride to mean only)
    product="MIS",                 # "MIS" = intraday (auto square-off), "CNC" = delivery
)

# --- Mode ---
PAPER = True   # True = simulate (no real orders). Set False ONLY when you trust it.
STRATEGY_NAME = "momentum"   # which validated strategy the live runner trades: meanrev | momentum | rsi2 | pairs
POLL_SECONDS = 300  # how often the live loop runs a cycle (match your interval)
