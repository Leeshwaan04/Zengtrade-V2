# Kite Mean-Reversion Bot

An automated **mean-reversion** trading bot for **NSE equities (cash)** on
Zerodha's [Kite Connect](https://kite.trade) API. It buys stocks that have
stretched too far below their moving mean (oversold) and exits when they revert.

> ⚠️ **Trade at your own risk.** This is educational software. Markets lose
> money. Run it in **PAPER mode** and **backtest** every change before going
> live. Automated order placement on Kite has SEBI/Zerodha compliance
> requirements — read [Kite Connect's algo policy](https://kite.trade) first.

## The strategy in one paragraph

Mean reversion assumes price oscillates around a moving average. We compute
20-period **Bollinger Bands** + 14-period **RSI** on each stock. We go **long**
when price closes **below the lower band AND RSI < 30** (oversold). We **exit**
when price reverts up to the mid band (the mean) OR RSI climbs back above 55 —
or when a volatility-based **stop-loss** (entry − 2×ATR) or **target**
(entry + 3×ATR) is hit. Long-only, because cash/delivery can't short. Every
knob lives in [settings.py](settings.py).

## Layout

| File | What it does |
|------|--------------|
| [bot/indicators.py](bot/indicators.py) | SMA, EMA, RSI, Bollinger, ATR, z-score, VWAP (pure functions) |
| [bot/strategy.py](bot/strategy.py) | Mean-reversion entry/exit logic |
| [bot/risk.py](bot/risk.py) | Position sizing, stops/targets, max positions, daily-loss breaker |
| [bot/broker.py](bot/broker.py) | `PaperBroker` (simulated) + `KiteBroker` (live orders) |
| [bot/data.py](bot/data.py) | Historical candles + live quotes from Kite |
| [bot/engine.py](bot/engine.py) | The live loop: data → signal → risk → order → square-off |
| [bot/backtest.py](bot/backtest.py) | Event-driven backtester + metrics |
| [settings.py](settings.py) | **Your** config: symbols, strategy & risk params, paper/live |

## Quick start

```bash
pip install -r requirements.txt

# 1. See it work immediately — no API keys needed:
python demo_backtest.py
python tests/test_indicators.py
```

Then connect to Kite:

```bash
# 2. Create a Kite Connect app at https://developers.kite.trade (₹2000/mo),
#    copy your key/secret:
cp .env.example .env          # then edit KITE_API_KEY / KITE_API_SECRET

# 3. Mint today's access token (repeat each trading day):
python login.py

# 4. Backtest on REAL historical data:
python run_backtest.py RELIANCE
python run_backtest.py                 # all symbols in settings.py

# 5. Run live in PAPER mode (settings.PAPER = True):
python run_bot.py
```

When you trust it, set `PAPER = False` in [settings.py](settings.py) to place
real orders. Do this with small `capital` first.

## Safety controls (built in)

- **Trend/regime filter** — only fades dips when the long (200-bar) SMA is
  flat-or-rising. Blocks "catching falling knives" in a downtrend, mean
  reversion's #1 way to lose money. For a stronger guard, compute the trend on
  a higher timeframe (e.g. daily) and pass it in. Toggle via `use_trend_filter`.
- **ATR stop-loss + target** — every position gets a volatility-based stop and
  target, sized per stock.
- **Per-trade risk sizing** — quantity is set so the entry→stop loss is only
  `risk_per_trade_pct` of capital, capped at `max_alloc_per_trade_pct` per name.
- **Daily-loss kill-switch** — if realised **+ unrealised** loss for the day
  breaches `max_daily_loss_pct`, the engine flattens everything and stops.
- **Intraday square-off** — MIS positions are closed before 3:15pm.
- **Algo order tagging** — live orders carry an algo tag for SEBI compliance.

## Honest backtesting

```bash
python run_backtest.py RELIANCE --oos
```
Splits history 70/30. Tune parameters on the **in-sample** half if you must,
but judge the strategy ONLY by the **out-of-sample** half — data it never saw.
A strategy that shines in-sample and dies out-of-sample is curve-fit, not real.

## Tuning checklist

1. **Backtest before every change.** If a parameter doesn't improve the
   backtest across several symbols, don't use it live.
2. **Watch the daily-loss breaker** (`max_daily_loss_pct`) — it halts new trades
   after a bad day.
3. **Mean reversion dies in trends.** It works best on range-bound, liquid
   large-caps. Avoid it on stocks in strong directional moves.
4. **Costs matter.** The backtester charges `cost_bps` per side — keep it
   realistic for your brokerage + STT + slippage.

## How to make it yours

- Add/remove stocks in `SYMBOLS`.
- Switch `INTERVAL` (e.g. `"15minute"` for fewer, calmer signals).
- Flip `product` to `"CNC"` for delivery (no auto square-off) or keep `"MIS"`
  for intraday with a 3:15pm square-off.
- Enable `use_zscore` for an additional/alternative entry filter.
```
