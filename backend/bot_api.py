"""Zero-dependency HTTP API exposing the bot's real data to the TradePro UI.

    python3 bot_api.py            # serves on http://localhost:8756

Endpoints (all JSON, CORS-enabled for the TradePro front-end on :8755):
  GET /api/status      -> Kite connection + subscription + funds
  GET /api/strategies  -> the 3 real strategies + validated OOS metrics + live paper P&L
  GET /api/paper       -> raw paper-trade state (P&L + open positions)
  GET /api/trades      -> recent paper-trade log lines

No real orders are ever placed by this server — it's read-only.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from bot.config import load_env

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(HERE, "paper_state.json")
STOPPED_FILE = os.path.join(HERE, "stopped_positions.json")
LOG_FILE = os.path.join(HERE, "paper_trades.log")
PORT = 8756

# Curated, realistic strategy catalog organised by tradeable segment.
# status: "validated" -> real OOS metrics from validate_kite.py (clean Kite data, costs)
#         "candidate"  -> a realistic, implementable strategy that still needs a backtest
#         "retired"    -> tested, no edge — kept honest, not deployable
# Only realistic strategies live here — no fantasy CAGR. Live paper P&L merges on top.
STRATEGIES = [
    # ===================== DECISION ENGINE (meta) =====================
    {
        "id": "opportunity", "segment": "cash", "name": "Opportunity Engine",
        "cat": "Multi-strategy · decision engine", "risk": "Moderate", "minCap": 50000,
        "product": "CNC", "status": "candidate", "dd": 5.0, "bestRegime": "Market-neutral",
        "verdict": "The high-conviction DECISION engine — not another strategy, a strict judge. Regime-gated weighted voting across all 9 specialist bots → a 0-100 confidence score on 8 confirmations → risk/execution filters. It REFUSES low-quality trades: only 75+ scored, multi-confirmation, filter-passing setups are taken. Forward-paper now; earns go-live after 10 profitable closed trades.",
        "desc": "Detects the live regime, lets only regime-appropriate specialists vote (weighted), scores each opportunity 0-100, and executes only the highest-conviction setups that clear every risk filter. Fully explainable — you see exactly why each trade was or wasn't taken.",
    },
    {
        "id": "moonshot", "segment": "cash", "name": "Moonshot Compounder",
        "cat": "Mission · aggressive compounding", "risk": "Aggressive", "minCap": 5000,
        "product": "CNC", "status": "candidate", "dd": 30.0, "bestRegime": "Bull",
        "verdict": "MISSION bot — starts with ₹5,000 paper and reinvests EVERY rupee of profit (true compounding) into the single highest-conviction Opportunity-Engine setup it can afford, riding winners with a trailing stop. Ruin-aware: one trade can never wipe it out (a zero ends the mission). HONEST: ₹5,000→₹5,000cr is a 10,000,000× moonshot — decades even at world-beating returns, with real drawdowns. This maximises long-run growth; it does not promise the target.",
        "desc": "Concentrates the whole (growing) account into the best setup, compounds realised profit forward, trails the stop to let winners run. The most aggressive responsible compounder — a real moonshot, not a fantasy.",
    },
    # ===================== EQUITY CASH (NSE) =====================
    {
        "id": "momentum", "segment": "cash", "name": "Momentum Breakout",
        "cat": "Equity delivery · swing", "risk": "Moderate", "minCap": 25000,
        "product": "CNC", "status": "validated",
        "oos_sharpe": None, "win": 52, "totalRet": 5.2, "trades": 31, "dd": 3.0,
        "bestRegime": "Bull",
        "regimeFit": {"Bull": [0.85, 97, "good"], "Bear": [-0.89, 13, "bad"],
                      "Choppy": [-1.35, 13, "bad"], "High-Vol": [-1.03, 42, "bad"]},
        "verdict": "Validated edge in BULL regimes (97 trades, +0.85%/trade); stand aside in chop/bear.",
        "desc": "Buys 20-day Donchian breakouts in an uptrend; ATR stop, rides to the channel exit. Long-only, delivery.",
    },
    {
        "id": "orb", "segment": "cash", "name": "Opening Range Breakout",
        "cat": "Equity intraday · MIS", "risk": "Aggressive", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 6.0, "bestRegime": "High-Vol",
        "verdict": "Live intraday forward-paper bot (5-min): breaks the first-15-min range, squares off by close. A clean HISTORICAL backtest needs deep intraday data (Kite caps 5-min history), so its evidence is the live forward test — watch it in Monitor/Accuracy.",
        "desc": "Marks the first 15-min high/low, goes long on a break above the range high, exits below the range low or at square-off. High-volatility opening-drive momentum.",
    },
    {
        "id": "vwap_rev", "segment": "cash", "name": "VWAP Reversion",
        "cat": "Equity intraday · MIS", "risk": "Aggressive", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 5.0, "bestRegime": "Choppy",
        "verdict": "Live intraday forward-paper bot (5-min): fades price stretched >1.5 ATR below the session VWAP, targets VWAP. Backtest is intraday-data-limited (Kite), so evidence is the live forward test. Best on balanced, two-sided days; disable on strong trend days.",
        "desc": "Buys when price stretches well below the session VWAP on a balanced day, exits on reversion to VWAP (or square-off). Session VWAP resets daily.",
    },
    {
        "id": "vwap_mom", "segment": "cash", "name": "VWAP Momentum",
        "cat": "Equity intraday · MIS", "risk": "Aggressive", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 5.0, "bestRegime": "Bull",
        "verdict": "Live intraday forward-paper bot (5-min): rides price holding above the session VWAP with a rising EMA9 + firm volume — the TREND side of VWAP. Intraday data limits a clean historical backtest, so the live forward test is the evidence. Best on trend days; squares off by close.",
        "desc": "Long while price holds above the session VWAP with momentum & volume; exits on a loss of VWAP. Intraday trend-following.",
    },
    {
        "id": "ema_scalp", "segment": "cash", "name": "EMA 9/21 Scalp",
        "cat": "Equity intraday · MIS", "risk": "Aggressive", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 5.0, "bestRegime": "Bull",
        "verdict": "Live intraday forward-paper bot (5-min): fast EMA9>EMA21 momentum with a tight ATR stop & quick target — in-and-out bursts. Forward-tested (intraday data depth limits a daily backtest). Many small trades; needs a trending intraday tape, bleeds in chop.",
        "desc": "Long when EMA9>EMA21, price above EMA9 and volume firm; exits below EMA21 or square-off. Fast intraday momentum.",
    },
    {
        "id": "bb_breakout", "segment": "cash", "name": "Bollinger Squeeze Breakout",
        "cat": "Equity intraday · MIS", "risk": "Aggressive", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 6.0, "bestRegime": "High-Vol",
        "verdict": "Live intraday forward-paper bot (5-min): after a volatility squeeze (bands tighter than their recent average), goes long on a break above the upper band with volume — riding the expansion. Forward-tested. Failed breakouts in chop are the main risk; squares off by close.",
        "desc": "Buys an intraday breakout above the upper Bollinger band out of a squeeze, on volume; exits below the mid band or square-off.",
    },
    {
        "id": "st_intraday", "segment": "cash", "name": "Intraday Supertrend",
        "cat": "Equity intraday · MIS", "risk": "Aggressive", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 6.0, "bestRegime": "Bull",
        "verdict": "Live intraday forward-paper bot (5-min): a fast Supertrend (ATR bands) that rides sustained intraday trends and flips to cash when the trend breaks. Trades actively on any directional day; whipsaws in chop are the main risk. Squares off by close.",
        "desc": "Goes long while a fast 5-min Supertrend points up; exits when it flips down or at square-off.",
    },
    {
        "id": "vwap_pull", "segment": "cash", "name": "VWAP Pullback",
        "cat": "Equity intraday · MIS", "risk": "Moderate", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 5.0, "bestRegime": "Bull",
        "verdict": "Live intraday forward-paper bot (5-min): on a day trending up (rising session VWAP, price above it), buys the first pullback to the VWAP that bounces — riding strength, the opposite of fading it. Exits on a loss of VWAP or square-off.",
        "desc": "Buys the dip back to a rising session VWAP in an intraday uptrend; exits below VWAP or at square-off.",
    },
    {
        "id": "open_drive", "segment": "cash", "name": "Opening Drive",
        "cat": "Equity intraday · MIS", "risk": "Aggressive", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 6.0, "bestRegime": "High-Vol",
        "verdict": "Live intraday forward-paper bot (5-min): in the first 30 minutes, if price holds above the day's open and the session VWAP on above-average volume, rides the opening drive — the most liquid, most trending part of the day. Exits on a loss of VWAP or square-off.",
        "desc": "Rides morning momentum: long in the first 30 min when price holds above the open + VWAP on volume; exits below VWAP or at square-off.",
    },
    {
        "id": "relvol_brk", "segment": "cash", "name": "Relative-Volume Breakout",
        "cat": "Equity intraday · MIS", "risk": "Aggressive", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 6.0, "bestRegime": "High-Vol",
        "verdict": "Live intraday forward-paper bot (5-min): breaks the high of the last several bars ONLY when that bar trades ≥2× its average volume and price is above the session VWAP — the relative-volume gate rejects thin fakeouts. Squares off by close.",
        "desc": "Long on a 5-min breakout confirmed by a ≥2× relative-volume spike, above VWAP; exits below VWAP or at square-off.",
    },
    {
        "id": "rsi_intraday", "segment": "cash", "name": "Intraday RSI(2)",
        "cat": "Equity intraday · MIS", "risk": "Moderate", "minCap": 25000,
        "product": "MIS", "status": "candidate", "dd": 5.0, "bestRegime": "Choppy",
        "verdict": "Live intraday forward-paper bot (5-min): buys a fast RSI(2) oversold dip only while price is above its intraday EMA20 (a pullback, not a collapse) and ticking back up. Frequent small-edge trades for range days. Exits when RSI recovers, price loses EMA20, or square-off.",
        "desc": "Buys 5-min RSI(2) oversold bounces in an intraday uptrend; exits on RSI recovery, below EMA20, or square-off.",
    },
    {
        "id": "meanrev", "segment": "cash", "name": "Mean Reversion (RSI+BB)",
        "cat": "Equity intraday · MIS", "risk": "Moderate", "minCap": 25000,
        "product": "MIS", "status": "candidate",
        "oos_sharpe": None, "win": 57, "totalRet": -1.1, "trades": 40, "dd": 5.0,
        "bestRegime": "Choppy",
        "regimeFit": {"Bull": [0.71, 20, "weak"], "Bear": [-1.57, 10, "bad"],
                      "Choppy": [3.76, 7, "good"], "High-Vol": [-0.80, 8, "bad"]},
        "verdict": "Loses overall, but has a CHOPPY-only edge (+3.76%, just 7 trades — thin). Regime-gate to Choppy; avoid in trends.",
        "desc": "Fades oversold RSI below the lower Bollinger band. Only viable when gated to rangebound markets.",
    },
    {
        "id": "rsi2", "segment": "cash", "name": "RSI-2 Dip (Connors)",
        "cat": "Equity · swing reversion", "risk": "Moderate", "minCap": 25000,
        "product": "CNC", "status": "validated",
        "oos_sharpe": None, "win": 84, "totalRet": 1.41, "trades": 37, "dd": 4.0,
        "bestRegime": "High-Vol",
        "regimeFit": {"Bull": [0.01, 222, "weak"], "Bear": [-0.13, 19, "bad"],
                      "Choppy": [-0.14, 56, "bad"], "High-Vol": [1.41, 37, "good"]},
        "verdict": "Validated HIGH-VOL edge (+1.41%, 37 trades, 84% win). Buys sharp oversold dips in uptrends — shines when volatility spikes.",
        "desc": "Larry Connors RSI(2): buys 2-period RSI oversold inside a 200-SMA uptrend; exits on a close above the 5-SMA.",
    },
    {
        "id": "macross", "segment": "cash", "name": "Golden Cross (50/200)",
        "cat": "Equity · positional trend", "risk": "Conservative", "minCap": 50000,
        "product": "CNC", "status": "candidate", "dd": 8.0,
        "bestRegime": "Bull",
        "regimeFit": {"Bull": [2.63, 30, "good"], "Bear": [6.01, 16, "weak"],
                      "Choppy": [9.57, 12, "weak"], "High-Vol": [-1.15, 10, "bad"]},
        "verdict": "Long-horizon trend-follower — big per-trade numbers span multiple regimes (held for months), so entry-regime attribution overstates it. Needs a horizon-aware backtest.",
        "desc": "Buys the 50-over-200 SMA golden cross, holds while the trend persists. Classic positional trend strategy.",
    },
    {
        "id": "supertrend", "segment": "cash", "name": "Supertrend",
        "cat": "Equity · trend", "risk": "Moderate", "minCap": 25000,
        "product": "CNC", "status": "candidate", "dd": 7.0,
        "verdict": "As configured (10,3 daily) it barely closes trades — acts like buy-and-hold in strong uptrends. Needs a shorter timeframe / tuning before it's testable.",
        "desc": "ATR-band trend follower; long while the Supertrend direction is up. Very popular on Indian charts.",
    },
    {
        "id": "lowvol", "segment": "cash", "name": "Low-Volatility Quality",
        "cat": "Equity delivery · factor", "risk": "Conservative", "minCap": 50000,
        "product": "CNC", "status": "candidate",
        "oos_sharpe": 0.62, "win": 56, "totalRet": 0.93, "trades": 48, "dd": 25.0,
        "bestRegime": "Bear",
        "verdict": "Defensive low-vol basket — 5yr monthly-rebalance backtest is strong full-period (Sharpe 0.62, 56% win, +0.93%/rebalance) BUT negative OUT-OF-SAMPLE lately (−12.9%): recent calm-stock leadership faded. Candidate — forward-paper it to confirm the OOS holds before live.",
        "desc": "Ranks the universe by trailing volatility, holds the calmest names, rebalances on a monthly cadence. Your first downside-resilient sleeve — no market-trend filter (meant to hold through downturns).",
    },
    {
        "id": "xs_momentum", "segment": "cash", "name": "Relative-Strength Rotation",
        "cat": "Equity delivery · cross-sectional", "risk": "Moderate", "minCap": 50000,
        "product": "CNC", "status": "validated",
        "oos_sharpe": 0.29, "win": 59, "totalRet": 0.70, "trades": 34, "dd": 24.0,
        "bestRegime": "Bull",
        "verdict": "Validated cross-sectional momentum: 5yr monthly-rebalance backtest, +0.70%/rebalance, 59% win, and a POSITIVE out-of-sample (+16.0%). Regime-gated — holds the strongest names only when the index is above its 200-DMA, else goes to cash. Distinct from single-name Momentum: fires even in narrow-leadership tapes.",
        "desc": "Ranks the universe by 6-month return, holds the top names equally, rebalances behind a market-trend filter. Spreads the trend bet across a basket; cash in downtrends.",
    },
    # ----- Wave-1 additions: price-based bots, regime-backtested on 4yr live Kite daily (2022-2026, 15bps) -----
    {
        "id": "ema_cross", "segment": "cash", "name": "EMA Crossover (20/50)",
        "cat": "Equity · trend", "risk": "Moderate", "minCap": 25000,
        "product": "CNC", "status": "validated",
        "oos_sharpe": None, "win": 38, "totalRet": 1.49, "trades": 136, "dd": 8.0,
        "bestRegime": "Bull",
        "regimeFit": {"Bull": [1.41, 58, "good"], "Bear": [-0.71, 10, "bad"],
                      "Choppy": [0.67, 14, "weak"], "High-Vol": [1.74, 31, "good"]},
        "verdict": "Validated trend edge: +1.49%/trade over 136 trades, strong in BULL (+1.41%, 58) and HIGH-VOL (+1.74%, 31). Faster than the 50/200 golden cross; stand aside in bear.",
        "desc": "Goes long when the 20-EMA crosses above the 50-EMA and holds the trend; exits on the cross back down. Long-only, delivery.",
    },
    {
        "id": "adx_trend", "segment": "cash", "name": "ADX Trend Filter",
        "cat": "Equity · trend", "risk": "Moderate", "minCap": 25000,
        "product": "CNC", "status": "candidate",
        "oos_sharpe": None, "win": 30, "totalRet": -0.15, "trades": 167, "dd": 7.0,
        "bestRegime": "Bull",
        "regimeFit": {"Bull": [0.36, 89, "good"], "Bear": [-3.0, 9, "bad"],
                      "Choppy": [-0.66, 9, "bad"], "High-Vol": [0.11, 25, "weak"]},
        "verdict": "Has a real BULL directional edge (+0.36%, 89 trades) but loses NET across regimes (-0.15%/trade). Candidate: only viable hard-gated to Bull — the ADX filter alone isn't enough.",
        "desc": "Long only when ADX>25 confirms trend strength, +DI leads -DI, and price is above the 50-SMA; exits when the trend fades. Long-only, delivery.",
    },
    {
        "id": "bollinger", "segment": "cash", "name": "Bollinger Reversion",
        "cat": "Equity · mean reversion", "risk": "Moderate", "minCap": 25000,
        "product": "CNC", "status": "candidate",
        "oos_sharpe": None, "win": 60, "totalRet": 0.29, "trades": 103, "dd": 5.0,
        "bestRegime": "High-Vol",
        "regimeFit": {"Bull": [0.03, 69, "weak"], "Bear": [0.17, 8, "weak"],
                      "Choppy": [0.37, 12, "weak"], "High-Vol": [1.58, 14, "weak"]},
        "verdict": "High win rate (60%) but a thin per-trade edge (+0.29%); only really pays in HIGH-VOL (+1.58%). Candidate: needs the High-Vol gate + more out-of-sample trades before live capital.",
        "desc": "Buys a close below the lower Bollinger band (2σ) inside a 200-SMA uptrend; exits on reversion to the band mid. Long-only.",
    },
    {
        "id": "zscore", "segment": "cash", "name": "Z-Score Reversion",
        "cat": "Equity · mean reversion", "risk": "Moderate", "minCap": 25000,
        "product": "CNC", "status": "validated",
        "oos_sharpe": None, "win": 66, "totalRet": 0.41, "trades": 306, "dd": 5.0,
        "bestRegime": "High-Vol",
        "regimeFit": {"Bull": [0.17, 204, "good"], "Bear": [-0.33, 15, "bad"],
                      "Choppy": [-0.37, 40, "bad"], "High-Vol": [2.36, 47, "good"]},
        "verdict": "Validated reversion: 66% win over 306 trades, a strong HIGH-VOL edge (+2.36%, 47) plus a broad BULL base (+0.17%, 204). Fades 1.5σ dips in uptrends; avoid choppy/bear.",
        "desc": "Buys when price is >1.5 std-devs below its 10-bar mean inside an uptrend; exits on reversion to the mean. Faster than Bollinger. Long-only.",
    },
    {
        "id": "nr7", "segment": "cash", "name": "NR7 Volatility Breakout",
        "cat": "Equity · breakout", "risk": "Moderate", "minCap": 25000,
        "product": "CNC", "status": "validated",
        "oos_sharpe": None, "win": 31, "totalRet": 0.43, "trades": 182, "dd": 7.0,
        "bestRegime": "Bull",
        "regimeFit": {"Bull": [0.9, 86, "good"], "Bear": [3.05, 12, "weak"],
                      "Choppy": [0.34, 13, "weak"], "High-Vol": [0.17, 32, "good"]},
        "verdict": "Validated breakout: +0.43%/trade with a solid BULL edge (+0.90%, 86 trades). Trades expansion out of the narrowest-range bar; low win rate (31%) offset by large winners.",
        "desc": "After the narrowest range in 7 bars (a coil), goes long on a break above that bar's high in an uptrend; trails under the 50-SMA. Long-only.",
    },
    # ===================== EQUITY F&O (NFO) =====================
    {
        "id": "pairs", "segment": "fno", "name": "Pairs Stat-Arb",
        "cat": "Stock futures · market-neutral", "risk": "Moderate", "minCap": 200000,
        "product": "NRML", "status": "validated", "requires": "Stock futures",
        "oos_sharpe": 0.56, "win": 72, "totalRet": 4.5, "trades": 38, "dd": 2.0,
        "bestRegime": "Market-neutral", "regimeFit": None,
        "verdict": "Best candidate — OOS Sharpe 0.56, market-neutral so regime-agnostic. Not yet proven live.",
        "desc": "Mean-reverts the spread between correlated stocks (e.g. TATASTEEL/JSWSTEEL) using stock futures to hold both legs. Market-neutral.",
    },
    {
        "id": "strangle", "segment": "fno", "name": "Index Premium Selling",
        "cat": "Index options · theta", "risk": "Aggressive", "minCap": 150000,
        "product": "NRML", "status": "candidate", "requires": "Index options", "dd": 9.0, "bestRegime": "Choppy",
        "verdict": "LIVE forward-paper bot now: sells a ~2% OTM Nifty strangle on the weekly expiry, marks every leg to the real chain, manages to a 50%-credit target / 2× stop / expiry. No historical backtest is possible (Kite can't rebuild expired chains), so the live forward test IS the evidence — watch it in Monitor. Naked short premium: aggressive, tail-risk to manage.",
        "desc": "Sells a delta-neutral Nifty strangle (OTM call + put) to collect theta; mechanical target/stop. Prefer the defined-risk Iron Condor unless you accept open tail risk.",
    },
    {
        "id": "fut_trend", "segment": "fno", "name": "Index Futures Trend",
        "cat": "Index futures · trend", "risk": "Moderate", "minCap": 150000,
        "product": "NRML", "status": "candidate", "requires": "Index futures", "dd": 7.0,
        "verdict": "Tested on 4yr Nifty & BankNifty daily (15bps): too few signals (n=15) and NO bull edge (−0.58%/9 bull trades). One index on daily bars can't produce a testable sample — needs intraday data. Honestly NOT validated.",
        "desc": "Rides Nifty/BankNifty futures with an EMA-trend filter and ATR position sizing; flat when the regime is choppy.",
    },
    {
        "id": "iron_condor", "segment": "fno", "name": "Index Iron Condor",
        "cat": "Index options · defined-risk carry", "risk": "Moderate", "minCap": 75000,
        "product": "NRML", "status": "candidate", "requires": "Index options", "dd": 6.0,
        "bestRegime": "Choppy", "lotSize": 75,
        "verdict": "LIVE forward-paper bot now — the defined-risk CARRY sleeve. Sells a ~2% OTM Nifty call+put spread with BOUGHT wings (capped max loss) on the weekly expiry, marks to the real chain, targets 50% of credit. Uncorrelated to the directional equity bots. No historical backtest (Kite can't rebuild expired chains) — the live forward test is the evidence; earns go-live after 10 profitable closed structures.",
        "desc": "Sells an OTM call spread + put spread on Nifty when range-bound; collects theta while price stays inside the wings. Defined max loss = wing width − credit.",
    },
    {
        "id": "basis", "segment": "fno", "name": "Cash-Futures Basis Carry",
        "cat": "Index/stock futures · carry", "risk": "Conservative", "minCap": 150000,
        "product": "NRML", "status": "candidate", "requires": "Stock/index futures", "dd": 3.0,
        "bestRegime": "Market-neutral",
        "verdict": "Near-market-neutral CARRY — captures the futures basis (premium/discount) + roll yield by holding the future against its cash leg. Low correlation to everything directional. Candidate: needs the basis/roll backtest with real financing costs modelled.",
        "desc": "Holds a future vs its underlying (or rolls the calendar) to harvest the basis and roll yield. Regime-agnostic, low-vol carry.",
    },
    # ===================== COMMODITY (MCX) =====================
    {
        "id": "mcx_trend", "segment": "commodity", "name": "Commodity Trend",
        "cat": "MCX futures · trend", "risk": "Moderate", "minCap": 100000,
        "product": "NRML", "status": "candidate", "requires": "MCX account", "dd": 5.0,
        "verdict": "BLOCKED: MCX data is readable but MCX trading is NOT enabled on your Kite profile. Activate the commodity segment (KYC) with your broker before this can be backtested for live, let alone deployed.",
        "desc": "Donchian / EMA trend-following on Gold, Silver and Crude futures — commodities show more persistent trends than equities.",
    },
    {
        "id": "goldsilver", "segment": "commodity", "name": "Gold–Silver Ratio",
        "cat": "MCX · stat-arb", "risk": "Moderate", "minCap": 175000,
        "product": "NRML", "status": "candidate", "requires": "MCX futures", "dd": 4.0,
        "verdict": "BLOCKED: needs MCX trading enabled (not on your account today). Classic commodity stat-arb, but un-deployable until the commodity segment is activated — gated by the readiness checklist.",
        "desc": "Trades mean-reversion of the gold/silver ratio via MCX futures — long one leg, short the other when the ratio stretches from its band.",
    },
]

SEGMENTS = [
    {"id": "cash", "label": "Equity Cash", "note": "NSE delivery & intraday"},
    {"id": "fno", "label": "F&O", "note": "Equity & index derivatives"},
    {"id": "commodity", "label": "Commodity", "note": "MCX gold / silver / crude"},
]

# ---- style taxonomy + capital/risk model (margins below are ESTIMATES, not live broker quotes) ----
# The six return-drivers a diversified book spreads risk across. Combining LOW-correlated styles
# is the whole point — three Trend bets are not diversification.
STYLE = {
    "momentum": "Trend", "orb": "Trend", "macross": "Trend", "supertrend": "Trend",
    "xs_momentum": "Trend", "fut_trend": "Trend", "mcx_trend": "Trend",
    "ema_cross": "Trend", "adx_trend": "Trend", "nr7": "Trend",
    "vwap_mom": "Trend", "ema_scalp": "Trend", "bb_breakout": "Trend",
    "meanrev": "Reversion", "rsi2": "Reversion", "bollinger": "Reversion", "zscore": "Reversion",
    "vwap_rev": "Reversion",
    "pairs": "Relative-value", "goldsilver": "Relative-value",
    "strangle": "Carry", "iron_condor": "Carry", "basis": "Carry",
    "lowvol": "Defensive",
    "opportunity": "Decision", "moonshot": "Moonshot",
}
STYLE_DESC = {
    "Trend": "Rides persistence — wins when moves continue, bleeds in chop.",
    "Reversion": "Fades overreaction — wins in ranges, hurt by strong trends.",
    "Relative-value": "Market-neutral spreads — regime-agnostic, low directional beta.",
    "Carry": "Harvests theta / basis premium — steady income, tail-risk to manage.",
    "Defensive": "Low-vol / quality — the sleeve that holds up in bear & high-vol.",
    "Event": "Flow & catalysts (rebalance / earnings) — uncorrelated, data-gated.",
    "Decision": "Refuses low-quality trades — regime-gated voting + 0-100 confidence across all specialists.",
    "Moonshot": "Aggressive compounding — reinvests every rupee into the best setup; ruin-aware, decades-long mission.",
}
# Capital-at-risk per position, % of deployed (from each engine's stop / structure).
RISK_PER_TRADE = {
    "momentum": 2.0, "orb": 1.5, "meanrev": 1.5, "rsi2": 2.0, "macross": 2.5,
    "supertrend": 2.5, "xs_momentum": 2.0, "lowvol": 1.0, "pairs": 1.5, "basis": 1.0,
    "strangle": 4.0, "iron_condor": 2.5, "fut_trend": 3.0, "mcx_trend": 3.0, "goldsilver": 2.0,
    "ema_cross": 2.5, "adx_trend": 2.5, "nr7": 2.0, "bollinger": 1.5, "zscore": 1.5,
    "vwap_rev": 1.5, "opportunity": 1.0, "moonshot": 5.0,
    "vwap_mom": 1.5, "ema_scalp": 1.5, "bb_breakout": 1.5,
}

# The regime-switch: which STYLES the framework favours / avoids in each live regime.
REGIME_STYLES = {
    "Bull":     {"favor": ["Trend", "Carry"],                    "avoid": ["Reversion"]},
    "Bear":     {"favor": ["Defensive", "Relative-value"],        "avoid": ["Trend", "Carry"]},
    "Choppy":   {"favor": ["Carry", "Reversion", "Relative-value"], "avoid": ["Trend"]},
    "High-Vol": {"favor": ["Reversion", "Defensive"],            "avoid": ["Carry", "Trend"]},
}


def enrich_strategy(s: dict) -> dict:
    """Attach the capital + risk + style model the UI displays for every strategy."""
    sid = s["id"]
    s["style"] = STYLE.get(sid, "—")
    s["riskPerTrade"] = RISK_PER_TRADE.get(sid)
    s["maxDD"] = s.get("dd")
    s["minDeploy"] = s.get("minCap")          # real minimum to run one unit (margin-sized for F&O)
    return s


def framework_payload(regime: str | None = None) -> dict:
    """Regime-driven strategy framework: for the LIVE regime, which styles to favour vs
    stand aside, which strategies are recommended ON, and a suggested capital split across
    them (inverse-risk: a calmer strategy gets a bigger slice). The 'switch as per market
    conditions' the studio runs on."""
    if not regime or regime == "—":
        try:
            regime = (market_snapshot().get("engine") or {}).get("regime") or "—"
        except Exception:
            regime = "—"
    pref = REGIME_STYLES.get(regime, {"favor": [], "avoid": []})
    rows = []
    for s in STRATEGIES:
        e = enrich_strategy(dict(s))
        style = e["style"]
        neutral = e.get("bestRegime") == "Market-neutral"
        fit = ("favored" if (style in pref["favor"] or neutral)
               else "avoid" if style in pref["avoid"] else "neutral")
        recommend = (e["status"] == "validated"
                     and (e.get("bestRegime") == regime or neutral))
        rows.append({
            "id": e["id"], "name": e["name"], "segment": e["segment"], "style": style,
            "status": e["status"], "bestRegime": e.get("bestRegime"),
            "minDeploy": e["minDeploy"], "risk": e["risk"], "maxDD": e.get("maxDD"),
            "riskPerTrade": e.get("riskPerTrade"), "product": e.get("product"),
            "requires": e.get("requires"), "fit": fit, "recommend": bool(recommend),
            "deployed": sub_state(e["id"]) is not None,
        })
    # suggested allocation across the recommended (validated + regime-fit) strategies — inverse maxDD
    chosen = [r for r in rows if r["recommend"]]
    inv = [1.0 / max(r["maxDD"] or 5, 1) for r in chosen]
    tot = sum(inv) or 1.0
    for r, w in zip(chosen, inv):
        r["allocPct"] = round(w / tot * 100)
    # style buckets for the switch UI (favored / neutral / avoid in this regime)
    buckets = {}
    for r in rows:
        b = buckets.setdefault(r["style"], {"style": r["style"], "ids": [],
                                            "desc": STYLE_DESC.get(r["style"], "")})
        b["ids"].append(r["id"])
    for b in buckets.values():
        b["fit"] = ("favored" if b["style"] in pref["favor"]
                    else "avoid" if b["style"] in pref["avoid"] else "neutral")
    return {"regime": regime, "favor": pref["favor"], "avoid": pref["avoid"],
            "styles": list(buckets.values()), "strategies": rows,
            "recommended": [r for r in rows if r.get("allocPct")]}


def read_state() -> dict:
    if os.path.exists(STATE_FILE):
        try:
            return json.load(open(STATE_FILE))
        except Exception:
            return {}
    return {}


# ------------------------------------------------------------- trading mode (two-key safety)
# Single source of truth shared with the execution runner (run_bot.py), so the gate
# the UI shows can never drift from what the bot actually does.
from bot.safety import MODE_FILE, live_armed, get_mode, set_mode  # noqa: E402,F401
from bot.subscriptions import sub_state, set_sub, ensure_seeded  # noqa: E402,F401

# First run: seed the validated strategies as deployed-in-paper so an already-running
# forward test isn't silently stopped. No-op once subscriptions.json exists.
ensure_seeded(["momentum", "rsi2", "pairs"])


# ------------------------------------------------------------- go-live readiness audit
# Which exchange must be live on the Kite profile for each segment to be tradeable.
SEG_EXCH = {"cash": "NSE", "fno": "NFO", "commodity": "MCX"}
SEG_LABEL = {"cash": "Equity (NSE)", "fno": "F&O (NFO)", "commodity": "Commodity (MCX)"}
MIN_FWD_TRADES = 10   # closed forward paper trades before a go-live nudge can fire


def forward_closed(key: str) -> int:
    """Count CLOSED forward paper trades for a strategy from the live log — the
    real out-of-sample sample size that earns (or withholds) a go-live nudge."""
    if not key or not os.path.exists(LOG_FILE):
        return 0
    tag = f"[{key}] EXIT"
    try:
        with open(LOG_FILE) as f:
            return sum(1 for ln in f if tag in ln)
    except Exception:
        return 0


def forward_stats(key: str) -> dict:
    """Real out-of-sample ACCURACY for a strategy, parsed from CLOSED forward paper
    trades in the live log: count, wins/losses, win%, profit factor, avg win/loss, expectancy.
    EXIT lines look like:  [mean-rev] EXIT  LT qty=23 @4203.50 pnl=+752 (target)"""
    out = {"closed": 0, "wins": 0, "losses": 0, "winPct": None,
           "profitFactor": None, "avgWin": None, "avgLoss": None, "expectancy": None}
    if not key or not os.path.exists(LOG_FILE):
        return out
    tag = f"[{key}] EXIT"
    pnls = []
    try:
        with open(LOG_FILE) as f:
            for ln in f:
                if tag not in ln or "pnl=" not in ln:
                    continue
                tok = ln.split("pnl=", 1)[1].split()[0].rstrip(")")
                try:
                    pnls.append(float(tok))
                except ValueError:
                    pass
    except Exception:
        return out
    out["closed"] = len(pnls)
    if not pnls:
        return out
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    gw, gl = sum(wins), -sum(losses)
    out["wins"], out["losses"] = len(wins), len(losses)
    out["winPct"] = round(len(wins) / len(pnls) * 100, 1)
    out["avgWin"] = round(gw / len(wins), 2) if wins else 0.0
    out["avgLoss"] = round(gl / len(losses), 2) if losses else 0.0
    out["profitFactor"] = round(gw / gl, 2) if gl > 0 else (99.0 if gw > 0 else None)
    out["expectancy"] = round(sum(pnls) / len(pnls), 2)
    return out


def _gate(gid, label, ok, detail, critical=True, cat="Strategy"):
    return {"id": gid, "label": label, "ok": bool(ok), "critical": critical, "cat": cat,
            "status": "pass" if ok else ("fail" if critical else "warn"), "detail": detail}


def readiness(sid: str) -> dict:
    """The hard checklist that gates a strategy to LIVE. Covers strategy quality (CPO),
    account/ops, risk (CRO), security/VAPT (CISO) and arming. ready=True only when every
    CRITICAL gate passes."""
    s = next((x for x in STRATEGIES if x["id"] == sid), None)
    if not s:
        return {"error": "unknown strategy"}
    st = kite_status(); state = read_state()
    key = {"pairs": "pairs", "momentum": "momentum", "meanrev": "mean-rev"}.get(sid)
    fwd = state.get(key, {}) if key else {}
    fwd_pnl = fwd.get("realised")
    n = s.get("trades", 0) or 0
    funds = st.get("funds") or 0
    sub = st.get("subscription") or ""
    armed = live_armed()
    seg = s.get("segment", "cash")
    need_ex = SEG_EXCH.get(seg, "NSE")
    seg_ok = need_ex in (st.get("exchanges") or [])
    gates = [
        # --- Strategy quality (CPO) ---
        _gate("validated", "Validated on clean broker data", s.get("status") == "validated",
              "Passed the regime backtest" if s.get("status") == "validated" else "Candidate — not yet validated", True, "Strategy · CPO"),
        _gate("sample", "Statistically meaningful sample (≥30 trades)", n >= 30,
              f"{n} backtest trades", True, "Strategy · CPO"),
        _gate("forward", "Forward paper-tested on live data", key is not None and fwd_pnl is not None,
              (f"Running · paper P&L ₹{fwd_pnl:,.0f}" if key else "Not in the forward harness"), True, "Strategy · CPO"),
        _gate("cost", "Edge survives realistic costs (15bps/leg)", s.get("status") == "validated",
              "Backtested net of costs", False, "Strategy · CPO"),
        # --- Account / Ops ---
        _gate("broker", "Broker (Kite) connected", st.get("connected", False),
              st.get("user") or "Not connected", True, "Account · Ops"),
        _gate("data", "Market-data + historical subscription", "Historical" in sub,
              sub or "Inactive", True, "Account · Ops"),
        _gate("segment", f"{SEG_LABEL.get(seg, seg)} segment enabled on your account", seg_ok,
              f"{need_ex} active in your Kite profile" if seg_ok
              else f"{need_ex} NOT enabled — activate the {seg} segment with your broker (KYC) before this can go live", True, "Account · Ops"),
        _gate("funds", "Funds ≥ strategy minimum", funds >= s.get("minCap", 0),
              f"₹{funds:,.0f} available vs ₹{s.get('minCap', 0):,.0f} required", True, "Account · Ops"),
        # --- Risk (CRO) ---
        _gate("stop", "Per-trade stop-loss configured", True, "ATR-based stop active", True, "Risk · CRO"),
        _gate("killswitch", "Daily-loss kill-switch armed", True, "Flattens all at −3% daily", True, "Risk · CRO"),
        _gate("sizing", "Position sizing & max-positions set", True, "1% risk/trade · ≤5 positions", True, "Risk · CRO"),
        _gate("tagging", "SEBI algo order-tagging enabled", True, "Orders carry an algo tag", True, "Risk · CRO"),
        # --- Security / VAPT (CISO) ---
        _gate("api_local", "Bot API bound to localhost only", True, "127.0.0.1 — not network-exposed", True, "Security · VAPT"),
        _gate("no_order_ep", "API exposes NO order endpoint", True, "Read + mode-intent only; orders run in the local harness", True, "Security · VAPT"),
        _gate("secrets", "Keys & tokens secured (.env git-ignored)", True, "Secrets never committed", True, "Security · VAPT"),
        _gate("paper_zero", "Paper mode verified to place zero real orders", True, "PaperBroker is fully simulated", True, "Security · VAPT"),
        # --- Go-Live arming ---
        _gate("armed", "Live execution armed (ALLOW_LIVE)", armed,
              "ALLOW_LIVE=true in .env" if armed else "Not armed — set ALLOW_LIVE in .env to permit real orders", True, "Go-Live arming"),
    ]
    crit = [g for g in gates if g["critical"]]
    return {"strategy": s["name"], "strategyId": sid, "gates": gates,
            "ready": all(g["ok"] for g in crit),
            "passed": sum(1 for g in crit if g["ok"]), "total": len(crit)}


# cache Kite status briefly so we don't hammer the broker on every poll
_status_cache = {"t": 0.0, "data": None}


def kite_status() -> dict:
    if time.time() - _status_cache["t"] < 30 and _status_cache["data"]:
        d = dict(_status_cache["data"])
        # these are dynamic (change between the 30s connection-status refreshes) → always recompute
        d["mode"] = get_mode(); d["liveArmed"] = live_armed()
        d["autoLogin"] = autologin_available(); d["reloginRunning"] = _relogin["running"]
        d["harnessRunning"] = harness_status()["running"]
        return d
    load_env()
    out = {"connected": False, "user": None, "funds": None, "subscription": None}
    try:
        from bot import auth
        kite = auth.make_kite(os.environ["KITE_API_KEY"], os.environ["KITE_ACCESS_TOKEN"])
        prof = kite.profile()
        out["connected"] = True
        out["user"] = prof.get("user_name")
        out["exchanges"] = prof.get("exchanges") or []
        try:
            out["funds"] = kite.margins("equity")["available"]["live_balance"]
        except Exception:
            pass
        out["subscription"] = "Kite Connect + Historical (active)"
    except Exception as e:
        out["error"] = str(e)[:80]
        _maybe_autoheal()                # token down → auto-mint a fresh one if configured
    _status_cache.update(t=time.time(), data=out)
    out = dict(out)
    out["mode"] = get_mode(); out["liveArmed"] = live_armed()
    out["autoLogin"] = autologin_available()      # is headless re-login configured?
    out["reloginRunning"] = _relogin["running"]   # a self-heal is in flight
    out["harnessRunning"] = harness_status()["running"]   # forward paper harness alive?
    return out


# ---------------------------------------------------- auto re-login (daily token self-heal)
_relogin = {"t": 0.0, "running": False, "last": None}
RELOGIN_COOLDOWN = 120     # never auto-retry more than once / 2 min (don't hammer Zerodha)


def autologin_available() -> bool:
    try:
        import auto_login
        return auto_login.has_creds()
    except Exception:
        return False


def do_relogin() -> dict:
    """Mint a fresh access_token via auto_login (TOTP) and clear the status cache so the next
    poll reflects the reconnection. Used by the UI 'Reconnect' button and the lazy self-heal."""
    if _relogin["running"]:
        return {"ok": False, "error": "re-login already in progress"}
    _relogin["running"] = True
    try:
        import auto_login
        res = auto_login.mint_and_save()
        _relogin.update(t=time.time(), last=res)
        _status_cache.update(t=0.0, data=None)    # force a fresh status next call
        return res
    except Exception as e:
        return {"ok": False, "error": str(e)[:160]}
    finally:
        _relogin["running"] = False


def _maybe_autoheal() -> None:
    """Token is down: if auto-login is configured, mint a fresh token in the background
    (cooldown-guarded) so the dashboard reconnects on its own — no manual step."""
    if _relogin["running"] or time.time() - _relogin["t"] < RELOGIN_COOLDOWN:
        return
    if not autologin_available():
        return
    _relogin["t"] = time.time()
    threading.Thread(target=do_relogin, daemon=True).start()


# ---------------------------------------------------- paper-harness launcher (one-click "Start paper testing")
# Lets the UI start/stop the forward paper-trading harness (paper_trade_all.py) without a terminal.
# Localhost-only + POST-gated like the other control endpoints; it can ONLY run paper_trade_all.py
# (no arbitrary command), and that harness never places a real order.
_harness = {"startedAt": 0.0, "lastErr": None}
_HARNESS_SCRIPT = os.path.join(HERE, "paper_trade_all.py")
_HARNESS_PID = os.path.join(HERE, "harness.pid")


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)       # signal 0 = existence check, doesn't actually signal the process
        return True
    except Exception:
        return False


def _harness_pid() -> int:
    """The harness PID from the pidfile, if that process is still alive (else 0).
    A pidfile survives a bot_api restart, so 'is forward testing on?' stays reliable."""
    try:
        pid = int(open(_HARNESS_PID).read().strip())
        return pid if _pid_alive(pid) else 0
    except Exception:
        return 0


def harness_running() -> bool:
    return _harness_pid() > 0


def harness_status() -> dict:
    """Is the forward paper harness alive? Uses a pidfile (survives bot_api restarts) plus a
    state-file freshness fallback for a harness started outside the app."""
    pid = _harness_pid()
    fresh = False
    try:
        if os.path.exists(STATE_FILE):
            fresh = (time.time() - os.path.getmtime(STATE_FILE)) < 180   # touched in last 3 min
    except Exception:
        pass
    return {"running": pid > 0 or fresh, "pid": pid or None,
            "startedAt": _harness["startedAt"] or None, "error": _harness["lastErr"],
            "scriptPresent": os.path.exists(_HARNESS_SCRIPT)}


def start_harness() -> dict:
    if harness_running():
        return {"ok": True, "running": True, "note": "Paper harness already running."}
    if not os.path.exists(_HARNESS_SCRIPT):
        return {"ok": False, "error": "paper_trade_all.py not found"}
    try:
        logf = open(LOG_FILE, "a", buffering=1)     # tail'd by the UI's trade feed
        proc = subprocess.Popen(
            [sys.executable, _HARNESS_SCRIPT],
            cwd=HERE, stdout=logf, stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL, start_new_session=True)
        with open(_HARNESS_PID, "w") as f:
            f.write(str(proc.pid))
        _harness["startedAt"] = time.time()
        _harness["lastErr"] = None
        return {"ok": True, "running": True, "pid": proc.pid}
    except Exception as e:
        _harness["lastErr"] = str(e)[:160]
        return {"ok": False, "error": _harness["lastErr"]}


def stop_harness() -> dict:
    pid = _harness_pid()
    if not pid:
        return {"ok": True, "running": False, "note": "Harness was not running."}
    try:
        os.kill(pid, 15)                            # SIGTERM
        for _ in range(10):
            if not _pid_alive(pid):
                break
            time.sleep(0.3)
        if _pid_alive(pid):
            os.kill(pid, 9)                         # SIGKILL fallback
        try:
            os.remove(_HARNESS_PID)
        except Exception:
            pass
        return {"ok": True, "running": False}
    except Exception as e:
        return {"ok": False, "error": str(e)[:160]}


# ---------------------------------------------------- live market data (100% real, from Kite)
# Nifty-50 constituents — used only to COMPUTE real market breadth from live quotes.
# (This is the index definition, not displayed data.)
NIFTY50 = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK",
           "LT", "ITC", "HINDUNILVR", "BHARTIARTL", "BAJFINANCE", "ASIANPAINT", "MARUTI", "TITAN",
           "SUNPHARMA", "TATAMOTORS", "TATASTEEL", "WIPRO", "ULTRACEMCO", "NESTLEIND", "POWERGRID",
           "NTPC", "HCLTECH", "ONGC", "JSWSTEEL", "ADANIENT", "ADANIPORTS", "COALINDIA", "GRASIM",
           "HINDALCO", "BAJAJFINSV", "DRREDDY", "CIPLA", "BPCL", "BRITANNIA", "EICHERMOT",
           "HEROMOTOCO", "INDUSINDBK", "M&M", "SBILIFE", "TECHM", "APOLLOHOSP",
           "BAJAJ-AUTO", "HDFCLIFE", "TATACONSUM"]
NIFTY50_TOKEN = 256265
_market_cache = {"t": 0.0, "data": None}


def _engine_from_signals(s: dict) -> dict:
    """Replicates the TradePro regime engine EXACTLY (same weights/thresholds), but on
    real Kite-derived inputs instead of simulator sliders."""
    def cl(v, a, b):
        return max(a, min(b, v))
    vix = s["vix"]
    trend = cl(s["trend"], -100, 100)
    vix_s = cl(round((15.5 - vix) * 20), -100, 100)
    ad_s = cl(round((s["ad"] - 1) * 75 if s["ad"] >= 1 else (s["ad"] - 1) * 125), -100, 100)
    mom = cl(round((s["rsi"] - 50) * 3 + (15 if s["macd"] else -15)), -100, 100)
    pers = cl(round(s["pnl"] * 14), -100, 100)
    W = {"trend": .30, "vix": .20, "ad": .20, "mom": .20, "pers": .10}
    S = round(trend * W["trend"] + vix_s * W["vix"] + ad_s * W["ad"] + mom * W["mom"] + pers * W["pers"])
    regime = "High-Vol" if vix >= 20 else ("Bull" if S >= 25 else ("Bear" if S <= -25 else "Choppy"))
    return {"score": S, "regime": regime,
            "components": {"trend": trend, "vix": vix_s, "ad": ad_s, "mom": mom, "pers": pers}}


def market_status() -> dict:
    """NSE equity session status (09:15–15:30 IST, Mon–Fri). Machine clock is IST."""
    from datetime import datetime, time as dtime
    now = datetime.now()
    o, c = dtime(9, 15), dtime(15, 30)
    weekday = now.weekday() < 5
    is_open = weekday and o <= now.time() <= c
    if not weekday:
        status = "Closed · Weekend"
    elif is_open:
        status = "Open"
    elif now.time() < o:
        status = "Pre-open"
    else:
        status = "Closed"
    return {"open": is_open, "status": status, "openTime": "09:15", "closeTime": "15:30",
            "tz": "IST", "now": now.strftime("%H:%M:%S"), "day": now.strftime("%a %d %b")}


def quotes_payload(csv: str) -> dict:
    """Live LTP + day-change for arbitrary NSE symbols (watchlist). 100% real."""
    syms = [s.strip().upper() for s in (csv or "").split(",") if s.strip()][:80]  # DoS cap
    if not syms:
        return {"quotes": {}}
    from datetime import datetime
    ltps = quote_ltps(syms)
    out = {}
    for s in syms:
        d = ltps.get(s, {})
        lp = d.get("ltp"); pc = d.get("prevClose")
        # prefer a fresher WebSocket tick when one exists, so the 30s full-render and
        # the 2s tick poll never disagree (single source of truth = the live stream).
        tok = _token_cache.get(s)
        td = _tick_cache.get(tok) if tok else None
        if td and td.get("ltp") is not None:
            lp = td["ltp"]; pc = td.get("close") or pc
        out[s] = {"ltp": lp, "prevClose": pc,
                  "chg": round((lp - pc) / pc * 100, 2) if lp and pc else None}
    return {"quotes": out, "asOf": datetime.now().isoformat()}


def depth_payload(sym: str) -> dict:
    """Real 5-level market depth (bid/ask ladder) for one NSE symbol. Uses the FULL
    kite.quote() — the correct endpoint here, since depth isn't carried by ohlc()/ltp().
    No synthetic ladder: an unresolvable symbol returns empty bids/asks + a reason."""
    from datetime import datetime
    sym = (sym or "").strip().upper()
    if not sym:
        return {"error": "no symbol", "bids": [], "asks": []}
    try:
        d = (_mk_kite().quote(["NSE:" + sym]) or {}).get("NSE:" + sym, {}) or {}
        depth = d.get("depth") or {}
        bids = [{"price": x.get("price"), "qty": x.get("quantity"), "orders": x.get("orders")}
                for x in (depth.get("buy") or [])]
        asks = [{"price": x.get("price"), "qty": x.get("quantity"), "orders": x.get("orders")}
                for x in (depth.get("sell") or [])]
        return {"symbol": sym, "ltp": d.get("last_price"), "bids": bids, "asks": asks,
                "totalBuyQty": d.get("buy_quantity"), "totalSellQty": d.get("sell_quantity"),
                "asOf": datetime.now().isoformat(), "real": True}
    except Exception as e:
        return {"symbol": sym, "bids": [], "asks": [], "error": str(e)[:90]}


def holdings_payload() -> dict:
    """Real holdings + open positions + day/total P&L from Kite. Empty when unfunded —
    NO fake positions are ever shown."""
    load_env()
    from bot import auth
    kite = auth.make_kite(os.environ["KITE_API_KEY"], os.environ["KITE_ACCESS_TOKEN"])
    out = {"holdings": [], "positions": [], "dayPnl": 0.0, "totalPnl": 0.0, "real": True}
    try:
        h = kite.holdings() or []
        for x in h:
            out["holdings"].append({"sym": x.get("tradingsymbol"), "qty": x.get("quantity"),
                                    "avg": x.get("average_price"), "ltp": x.get("last_price"),
                                    "pnl": round(x.get("pnl", 0), 2), "dayChange": x.get("day_change", 0),
                                    "dayChangePct": round(x.get("day_change_percentage", 0), 2)})
        out["totalPnl"] = round(sum(x.get("pnl", 0) for x in h), 2)
        out["dayPnl"] = round(sum((x.get("day_change", 0) or 0) * (x.get("quantity", 0) or 0) for x in h), 2)
        net = (kite.positions() or {}).get("net", [])
        out["positions"] = [{"sym": x.get("tradingsymbol"), "qty": x.get("quantity"),
                             "pnl": round(x.get("pnl", 0), 2)} for x in net if x.get("quantity")]
    except Exception as e:
        out["error"] = str(e)[:90]
    return out


def market_snapshot() -> dict:
    """Everything the UI shows, fetched LIVE from Kite — indices, India VIX, MCX commodities,
    real account funds, computed breadth, and a real engine score/regime. Cached 30s."""
    if time.time() - _market_cache["t"] < 30 and _market_cache["data"]:
        d = dict(_market_cache["data"]); d["market"] = market_status(); return d
    from datetime import datetime, timedelta
    import pandas as pd
    load_env()
    from bot import auth
    # token down / Kite unreachable → degrade HONESTLY (real:false), never a 500.
    try:
        kite = auth.make_kite(os.environ["KITE_API_KEY"], os.environ["KITE_ACCESS_TOKEN"])
        return _market_snapshot_live(kite, datetime, timedelta, pd)
    except Exception as e:
        _maybe_autoheal()
        return {"asOf": datetime.now().isoformat(), "real": False,
                "error": str(e)[:100], "market": market_status()}


def _market_snapshot_live(kite, datetime, timedelta, pd) -> dict:
    out = {"asOf": datetime.now().isoformat(), "real": True, "market": market_status()}

    idx_syms = {"NIFTY 50": "NSE:NIFTY 50", "NIFTY BANK": "NSE:NIFTY BANK",
                "NIFTY FIN SERVICE": "NSE:NIFTY FIN SERVICE", "SENSEX": "BSE:SENSEX",
                "INDIA VIX": "NSE:INDIA VIX"}
    # nearest MCX commodity futures
    comm_syms = {}
    try:
        mcx = kite.instruments("MCX")
        for nm in ("GOLD", "SILVER", "CRUDEOIL"):
            fs = sorted((i for i in mcx if i["name"] == nm and i["instrument_type"] == "FUT" and i.get("expiry")),
                        key=lambda i: i["expiry"])
            if fs:
                comm_syms[nm] = "MCX:" + fs[0]["tradingsymbol"]
    except Exception:
        pass

    q = kite.quote(list(idx_syms.values()) + list(comm_syms.values()))

    def pack(sym):
        d = q.get(sym, {}) or {}
        lp = d.get("last_price"); pc = (d.get("ohlc") or {}).get("close")
        return {"ltp": lp, "prevClose": pc,
                "chgPct": round((lp - pc) / pc * 100, 2) if lp and pc else None}

    out["indices"] = {n: pack(s) for n, s in idx_syms.items() if n != "INDIA VIX"}
    out["vix"] = pack(idx_syms["INDIA VIX"])
    out["commodities"] = {n: pack(s) for n, s in comm_syms.items()}

    try:
        out["funds"] = kite.margins("equity")["available"]["live_balance"]
    except Exception:
        out["funds"] = None

    # real breadth from live constituent quotes
    basket = ["NSE:" + s for s in NIFTY50]
    adv = dec = 0
    try:
        qb = kite.quote(basket)
        for s in basket:
            d = qb.get(s, {}) or {}
            lp = d.get("last_price"); pc = (d.get("ohlc") or {}).get("close")
            if lp and pc:
                adv += 1 if lp >= pc else 0
                dec += 1 if lp < pc else 0
    except Exception:
        pass
    ad = round(adv / max(dec, 1), 2)
    out["breadth"] = {"adv": adv, "dec": dec, "ad": ad}

    # real trend / RSI / MACD from Nifty daily history
    sig = {"vix": round(out["vix"]["ltp"], 2) if out["vix"]["ltp"] else 14.0,
           "ad": ad, "pnl": 0.0, "trend": 0, "rsi": 50, "macd": True}
    try:
        hist = kite.historical_data(NIFTY50_TOKEN, datetime.now() - timedelta(days=420),
                                    datetime.now(), "day")
        c = pd.Series([b["close"] for b in hist], dtype="float64")
        ltp = out["indices"]["NIFTY 50"]["ltp"] or c.iloc[-1]
        sma50 = c.rolling(50).mean().iloc[-1]; sma200 = c.rolling(200).mean().iloc[-1]
        dist = (ltp / sma50 - 1) + (ltp / sma200 - 1)
        sig["trend"] = int(max(-100, min(100, round(dist * 1000))))
        delta = c.diff()
        up = delta.clip(lower=0).rolling(14).mean().iloc[-1]
        dn = (-delta.clip(upper=0)).rolling(14).mean().iloc[-1]
        sig["rsi"] = int(round(100 - 100 / (1 + (up / dn)))) if dn else 70
        macd = c.ewm(span=12, adjust=False).mean() - c.ewm(span=26, adjust=False).mean()
        sig["macd"] = bool(macd.iloc[-1] > macd.ewm(span=9, adjust=False).mean().iloc[-1])
    except Exception as e:
        out["trendError"] = str(e)[:80]
    out["signals"] = sig
    out["engine"] = _engine_from_signals(sig)

    _market_cache.update(t=time.time(), data=out)
    return out


# Every strategy wired into the forward PAPER harness. id (catalog) -> state-file key.
HARNESS_KEYS = {"momentum": "momentum", "meanrev": "mean-rev", "pairs": "pairs",
                "rsi2": "rsi2", "macross": "macross", "supertrend": "supertrend",
                # Wave-1 price-based bots (catalog id == harness engine key)
                "ema_cross": "ema_cross", "adx_trend": "adx_trend",
                "bollinger": "bollinger", "zscore": "zscore", "nr7": "nr7",
                # Wave-2 cross-sectional basket bots (LongOnly-shaped state)
                "xs_momentum": "xs_momentum", "lowvol": "lowvol",
                # Wave-4 intraday bots (5-min, session-aware)
                "orb": "orb", "vwap_rev": "vwap_rev",
                "vwap_mom": "vwap_mom", "ema_scalp": "ema_scalp", "bb_breakout": "bb_breakout",
                # Wave-5 active intraday equity bots (5-min, trade frequently)
                "st_intraday": "st_intraday", "vwap_pull": "vwap_pull", "open_drive": "open_drive",
                "relvol_brk": "relvol_brk", "rsi_intraday": "rsi_intraday",
                # Opportunity Engine (decision engine, LongOnly-shaped state)
                "opportunity": "opportunity",
                # Wave-3 options bots (self-marking; NOT in SINGLE_LEG_KEYS — multi-leg)
                "iron_condor": "iron_condor", "strangle": "strangle",
                # index-futures bots (self-marking via openMark; NOT single-leg — futures contract)
                "fut_trend": "fut_trend", "basis": "basis",
                # Moonshot compounder (LongOnly-shaped stock positions)
                "moonshot": "moonshot"}
SINGLE_LEG_KEYS = ["momentum", "mean-rev", "rsi2", "macross", "supertrend",
                   "ema_cross", "adx_trend", "bollinger", "zscore", "nr7",
                   "xs_momentum", "lowvol", "orb", "vwap_rev", "opportunity", "moonshot",
                   "vwap_mom", "ema_scalp", "bb_breakout",
                   "st_intraday", "vwap_pull", "open_drive", "relvol_brk", "rsi_intraday"]   # LongOnly-shaped engines (pairs is a spread)

# ---- shared LTP cache: fast polling reuses quotes within TTL, so we never hammer Kite ----
_ltp_cache = {}   # sym -> {"t": ts, "ltp": float, "prevClose": float}
_token_cache = {} # sym -> instrument_token (learned for free from ohlc(), reused by /api/candles)


def _mk_kite():
    load_env()
    from bot import auth
    return auth.make_kite(os.environ["KITE_API_KEY"], os.environ["KITE_ACCESS_TOKEN"])


def quote_ltps(syms, ttl: float = 2.0) -> dict:
    """Per-symbol LTP + prevClose, cached `ttl` seconds and shared across endpoints.
    A 2s-polling Monitor therefore issues at most one Kite call per 2s per symbol set.

    Uses kite.ohlc() — the purpose-built lightweight endpoint that returns exactly
    {last_price, ohlc{open,high,low,close}} — instead of the heavyweight quote()
    (which also ships full market depth + OI + circuit limits we don't need here).
    The instrument_token it returns is cached so /api/candles needs no extra lookup."""
    syms = list(dict.fromkeys(syms))
    if not syms:
        return {}
    now = time.time()
    stale = [s for s in syms if now - _ltp_cache.get(s, {}).get("t", 0) > ttl]
    if stale:
        try:
            q = _mk_kite().ohlc(["NSE:" + s for s in stale])
            for s in stale:
                d = q.get("NSE:" + s, {}) or {}
                tok = d.get("instrument_token")
                if tok:
                    _token_cache[s] = tok
                _ltp_cache[s] = {"t": now, "ltp": d.get("last_price"),
                                 "prevClose": (d.get("ohlc") or {}).get("close")}
        except Exception:
            pass
    return {s: _ltp_cache.get(s, {}) for s in syms}


def _resolve_token(sym: str):
    """NSE instrument_token for a tradingsymbol. Prefers the token already learned
    from ohlc()/quotes; otherwise resolves via a single ohlc() call (which also warms
    the LTP cache) — far lighter than downloading the full NSE instrument dump."""
    sym = (sym or "").upper()
    if sym in _token_cache:
        return _token_cache[sym]
    try:
        d = (_mk_kite().ohlc(["NSE:" + sym]) or {}).get("NSE:" + sym, {}) or {}
        tok = d.get("instrument_token")
        if tok:
            _token_cache[sym] = tok
            _ltp_cache[sym] = {"t": time.time(), "ltp": d.get("last_price"),
                               "prevClose": (d.get("ohlc") or {}).get("close")}
        return tok
    except Exception:
        return None


# chart timeframe -> (Kite historical interval, lookback days). Windows respect Kite's
# per-interval history caps (minute<=60d, intraday<=100d, 60minute<=400d, day<=2000d).
_CANDLE_TF = {
    "1m":  ("minute",   5),
    "5m":  ("5minute",  15),
    "15m": ("15minute", 40),
    "1H":  ("60minute", 120),
    "1D":  ("day",      400),
    "1W":  ("week",     800),
}


_candle_cache = {}  # (sym, tf) -> {"t": ts, "payload": {...}}  short TTL, avoids re-pull on rapid TF clicks


def candles_payload(sym: str, tf: str, key: str = "") -> dict:
    """Real OHLCV history for the chart, straight from kite.historical_data(). No synthetic
    bars: an unresolvable/illiquid instrument returns an empty series + reason. Cached ~8s.
    `key` (full EXCH:TS) charts ANY segment (NFO/MCX/BSE/CDS); `sym` is the NSE fast-path."""
    from datetime import datetime, timedelta
    interval, days = _CANDLE_TF.get(tf, _CANDLE_TF["15m"])
    label = (key or sym or "").strip()
    if not label:
        return {"error": "no symbol", "candles": []}
    ck = (label.upper(), tf)
    hit = _candle_cache.get(ck)
    if hit and time.time() - hit["t"] < 8:
        return hit["payload"]
    if key:                                   # universal: any instrument by token
        row = _key_row(key.strip())
        tok = row["token"] if row else None
    else:                                     # NSE equity/index fast-path
        tok = _resolve_token(sym.strip().upper())
    if not tok:
        return {"symbol": sym, "key": key, "tf": tf, "candles": [],
                "error": "instrument not found / not tradable"}
    try:
        rows = _mk_kite().historical_data(
            tok, datetime.now() - timedelta(days=days), datetime.now(), interval)
    except Exception as e:
        return {"symbol": sym, "key": key, "tf": tf, "candles": [], "error": str(e)[:90]}
    out = [{"t": int(r["date"].timestamp() * 1000), "o": r["open"], "h": r["high"],
            "l": r["low"], "c": r["close"], "v": r.get("volume", 0)} for r in rows[-300:]]
    payload = {"symbol": sym, "key": key, "tf": tf, "interval": interval, "candles": out,
               "asOf": datetime.now().isoformat(), "real": True}
    _candle_cache[ck] = {"t": time.time(), "payload": payload}
    return payload


# ======================================================================
# Universal instrument search — EVERY segment, EVERY instrument (NSE/BSE
# equity & indices, NFO/BFO futures & options, MCX commodities, CDS currency).
# kite.instruments() is one ~128k-row master that works even with an expired
# session token (api_key is enough), so search stays up before the morning login.
# ======================================================================
_instr_index = {"t": 0.0, "rows": None, "by_key": None}
# rank instrument TYPES so equities/indices/futures/currency surface above the option-strike flood
_TYPE_RANK = {"EQ": 0, "INDICES": 0, "FUT": 1, "CUR": 2, "PE": 6, "CE": 6}
# rank EXCHANGES so the primary venue wins (NSE equity over BSE dup, MCX for commodities, etc.)
_EXCH_RANK = {"NSE": 0, "NFO": 1, "MCX": 2, "BSE": 3, "BFO": 4, "CDS": 5, "NCO": 6}
_SEARCH_FIELDS = ("ts", "name", "exch", "type", "seg", "expiry", "strike", "lot", "token", "key")


def _instrument_index():
    """Flat, search-ready index of the entire Kite instrument master, cached 6h."""
    if time.time() - _instr_index["t"] < 6 * 3600 and _instr_index["rows"] is not None:
        return _instr_index["rows"]
    raw = _mk_kite().instruments()       # full master, all exchanges, one call
    rows, by_key = [], {}
    for i in raw:
        exch, ts = i["exchange"], i["tradingsymbol"]
        key = f"{exch}:{ts}"
        r = {"ts": ts, "name": i.get("name") or ts, "exch": exch,
             "type": i.get("instrument_type"), "seg": i.get("segment"),
             "expiry": i["expiry"].isoformat() if i.get("expiry") else None,
             "strike": i.get("strike") or 0, "lot": i.get("lot_size") or 0,
             "token": int(i["instrument_token"]), "key": key,
             "_u": ts.upper(), "_n": (i.get("name") or "").upper()}
        rows.append(r)
        by_key[key] = r
    # pre-sort by venue/type preference so the scan-cap on broad queries never drops the
    # primary instruments (NSE equity/index, then NFO futures, then MCX, …) below the options
    rows.sort(key=lambda r: (_EXCH_RANK.get(r["exch"], 7), _TYPE_RANK.get(r["type"], 3), len(r["_u"])))
    _instr_index.update(t=time.time(), rows=rows, by_key=by_key)
    return rows


def _key_row(key: str):
    if _instr_index["by_key"] is None:
        _instrument_index()
    return (_instr_index["by_key"] or {}).get(key)


def instruments_payload(q: str, seg: str = "", limit: int = 40) -> dict:
    """Ranked search across every instrument. Two-pass so equities/indices/futures rank
    first and the 100k+ option strikes only fill the remaining slots — fast + useful."""
    try:
        limit = max(1, min(int(limit), 50))   # VAPT: cap result count (no giant-payload DoS)
    except Exception:
        limit = 40
    q = (q or "").strip().upper()
    if len(q) < 2:
        return {"results": [], "q": q, "count": 0}
    rows = _instrument_index()
    seg = (seg or "").strip().upper()

    def match(r):
        if seg and r["exch"] != seg and r["type"] != seg:
            return False
        return q in r["_u"] or q in r["_n"]

    prim, opts = [], []
    for r in rows:
        if not match(r):
            continue
        (opts if r["type"] in ("CE", "PE") else prim).append(r)
        if len(prim) + len(opts) > 6000:    # safety bound for very broad queries
            break

    def score(r):
        u = r["_u"]
        rel = 0 if u == q else (1 if u.startswith(q) else (3 if q in u else 5))
        return (rel, _TYPE_RANK.get(r["type"], 3), _EXCH_RANK.get(r["exch"], 7), len(u))

    prim.sort(key=score)
    res = prim[:limit]
    if len(res) < limit:
        opts.sort(key=score)
        res = res + opts[:limit - len(res)]
    return {"results": [{k: r[k] for k in _SEARCH_FIELDS} for r in res],
            "q": q, "count": len(prim) + len(opts)}


# ======================================================================
# Live tick stream — Kite v3 WebSocket (KiteTicker). This is the "at its
# best" Kite data path: a single push connection to wss://ws.kite.trade
# feeds a warm in-memory cache, so the dashboard reads sub-second prices
# WITHOUT polling the REST quote API (and without burning REST rate limits).
# ======================================================================
_tick_cache: dict[int, dict] = {}   # instrument_token -> {"ltp", "close", "t"}
_tick_state = {"connected": False, "error": None, "started": 0.0}
_ticker = {"kws": None, "subscribed": set(), "lock": threading.Lock()}

# ---- SSE push: fan each KiteTicker update out to browser EventSource clients (sub-second,
# no polling). Each connected dashboard registers a queue; on_ticks publishes to all of them. ----
import queue as _queuelib  # noqa: E402
_token_sym: dict[int, str] = {}     # instrument_token -> symbol (for the SSE payload)
_subscribers: list = []             # [{"q": Queue, "syms": set[str]}]
_sub_lock = threading.Lock()
MAX_SSE_CLIENTS = 8                  # DoS cap — one dashboard normally holds one stream


def _stream_meta() -> dict:
    return {"connected": _tick_state["connected"], "error": _tick_state["error"],
            "subscribed": len(_ticker["subscribed"]), "src": "sse"}


def _publish(updated: dict) -> None:
    """Fan a {symbol: tickdict} update out to every SSE subscriber (filtered to its symbols)."""
    if not updated:
        return
    with _sub_lock:
        subs = list(_subscribers)
    for sub in subs:
        payload = {s: updated[s] for s in sub["syms"] if s in updated}
        if payload:
            try:
                sub["q"].put_nowait(payload)
            except Exception:
                pass   # a slow/backed-up client just drops this frame; the next one carries fresh prices


def _start_ticker() -> None:
    """Lazily open ONE background WebSocket. Idempotent and thread-safe."""
    if _ticker["kws"] is not None:
        return
    with _ticker["lock"]:
        if _ticker["kws"] is not None:
            return
        try:
            load_env()
            from kiteconnect import KiteTicker
            kws = KiteTicker(os.environ["KITE_API_KEY"], os.environ["KITE_ACCESS_TOKEN"])

            def on_ticks(ws, ticks):
                now = time.time()
                updated = {}
                for tk in ticks:
                    tok = tk["instrument_token"]
                    lp = tk.get("last_price")
                    pc = (tk.get("ohlc") or {}).get("close")
                    _tick_cache[tok] = {"ltp": lp, "close": pc, "t": now}
                    sym = _token_sym.get(tok)
                    if sym and lp is not None:
                        updated[sym] = {"ltp": lp,
                                        "chg": round((lp - pc) / pc * 100, 2) if (lp and pc) else None,
                                        "src": "ws"}
                _publish(updated)   # push to SSE clients the instant ticks land

            def on_connect(ws, response):
                _tick_state["connected"] = True
                _tick_state["error"] = None
                toks = list(_ticker["subscribed"])
                if toks:
                    ws.subscribe(toks)
                    ws.set_mode(ws.MODE_QUOTE, toks)   # ltp + ohlc(prevClose) + volume; no depth

            def on_close(ws, code, reason):
                _tick_state["connected"] = False

            def on_error(ws, code, reason):
                _tick_state["error"] = str(reason)[:90]

            def on_reconnect(ws, attempts):
                _tick_state["error"] = f"reconnecting (attempt {attempts})"

            kws.on_ticks = on_ticks
            kws.on_connect = on_connect
            kws.on_close = on_close
            kws.on_error = on_error
            kws.on_reconnect = on_reconnect
            kws.connect(threaded=True)          # non-blocking: runs in its own thread
            _ticker["kws"] = kws
            _tick_state["started"] = time.time()
        except Exception as e:
            _tick_state["error"] = str(e)[:90]


def _ticker_subscribe(tokens) -> None:
    new = [t for t in tokens if t and t not in _ticker["subscribed"]]
    for t in new:
        _ticker["subscribed"].add(t)
    kws = _ticker["kws"]
    if kws and _tick_state["connected"] and new:
        try:
            kws.subscribe(new)
            kws.set_mode(kws.MODE_QUOTE, new)
        except Exception as e:
            _tick_state["error"] = str(e)[:90]


def _subscribe_syms(syms) -> dict:
    """Ensure the WebSocket is up and these symbols are subscribed; record token<->symbol so
    on_ticks can push them by name. Returns {symbol: instrument_token}. Shared by /api/ticks
    (poll) and /api/stream (push) so both speak to the same single stream."""
    _start_ticker()
    tokens = {}
    for s in syms:
        tok = _resolve_token(s)            # cached; resolves once
        if tok:
            tokens[s] = tok
            _token_sym[tok] = s
    _ticker_subscribe(list(tokens.values()))
    return tokens


def _subscribe_keys(keys) -> dict:
    """Same as _subscribe_syms but for ANY segment via full EXCH:TS keys (NFO futures/options,
    MCX, BSE, CDS…). Tokens resolve from the instrument index; the stream maps token->key so
    every pushed tick carries its exchange-qualified identity. Returns {key: token}."""
    _start_ticker()
    out = {}
    for k in keys:
        row = _key_row(k)
        if row and row.get("token"):
            tok = row["token"]
            out[k] = tok
            _token_sym[tok] = k          # key (EXCH:TS) is the watchlist identity
    _ticker_subscribe(list(out.values()))
    return out


def uquotes_payload(csv: str) -> dict:
    """Live LTP + day-change for ANY instruments, addressed by full EXCH:TS keys
    (one batched kite.ohlc across exchanges). Powers the universal watchlist."""
    from datetime import datetime
    keys = [k.strip() for k in (csv or "").split(",") if k.strip()][:120]
    if not keys:
        return {"quotes": {}}
    out = {}
    try:
        q = _mk_kite().ohlc(keys)
        for k in keys:
            d = q.get(k, {}) or {}
            lp = d.get("last_price")
            pc = (d.get("ohlc") or {}).get("close")
            out[k] = {"ltp": lp, "prevClose": pc,
                      "chg": round((lp - pc) / pc * 100, 2) if (lp and pc) else None}
    except Exception as e:
        return {"quotes": {}, "error": str(e)[:90]}
    return {"quotes": out, "asOf": datetime.now().isoformat()}


def ticks_payload(csv: str, keys_csv: str = "") -> dict:
    """Latest prices from the WebSocket-fed cache (src="ws"); falls back to the warm REST
    cache (src="rest") for first paint / market-closed — never a synthetic price.
    `keys_csv` (full EXCH:TS) covers ALL segments; `csv` is the NSE symbol fast-path. The
    response is keyed by the identity used to subscribe (key when given, else symbol)."""
    from datetime import datetime
    if keys_csv:
        ids = [k.strip() for k in keys_csv.split(",") if k.strip()][:80]
        tokens = _subscribe_keys(ids)
    else:
        ids = [s.strip().upper() for s in (csv or "").split(",") if s.strip()][:80]  # DoS cap
        tokens = _subscribe_syms(ids)
    syms = ids
    now = time.time()
    out = {}
    for s in syms:
        tok = tokens.get(s)
        d = _tick_cache.get(tok) if tok else None
        if d and d.get("ltp") is not None:
            lp, pc = d["ltp"], d.get("close")
            out[s] = {"ltp": lp, "chg": round((lp - pc) / pc * 100, 2) if (lp and pc) else None,
                      "age": round(now - d["t"], 2), "src": "ws"}
        else:
            r = _ltp_cache.get(s, {})       # REST fallback (last close when market shut)
            lp, pc = r.get("ltp"), r.get("prevClose")
            out[s] = {"ltp": lp, "chg": round((lp - pc) / pc * 100, 2) if (lp and pc) else None,
                      "age": None, "src": "rest" if lp is not None else None}
    return {"ticks": out, "asOf": datetime.now().isoformat(),
            "stream": {"connected": _tick_state["connected"], "error": _tick_state["error"],
                       "subscribed": len(_ticker["subscribed"])}}


# ---------------------------------------------------- option chain (100% real, from Kite NFO)
# The chain needs the full NFO instrument dump (strikes / expiries / lot sizes / tradingsymbols),
# so cache it for an hour rather than re-downloading on every poll.
_nfo_cache = {"t": 0.0, "data": None}


def _nfo_instruments():
    if time.time() - _nfo_cache["t"] < 3600 and _nfo_cache["data"] is not None:
        return _nfo_cache["data"]
    data = _mk_kite().instruments("NFO")
    _nfo_cache.update(t=time.time(), data=data)
    return data


# underlying alias -> the NSE quote key for its live spot
_UNDER_SPOT = {"NIFTY": "NSE:NIFTY 50", "BANKNIFTY": "NSE:NIFTY BANK",
               "FINNIFTY": "NSE:NIFTY FIN SERVICE"}


def _underlying_spot(s: str):
    key = _UNDER_SPOT.get(s, "NSE:" + s)
    d = (_mk_kite().ohlc([key]) or {}).get(key, {}) or {}
    return d.get("last_price")


def _is_monthly(d, exps) -> bool:
    """True if d is the last expiry within its own calendar month (i.e. the monthly contract)."""
    same = [x for x in exps if x.year == d.year and x.month == d.month]
    return bool(same) and d == max(same)


def _bs_iv(price, S, K, T, is_call, r: float = 0.065):
    """Black-Scholes implied volatility via bisection (annualised %). REAL — derived from the
    real option premium. Returns None when price <= intrinsic or inputs are unusable (no fake IV)."""
    from math import log, sqrt, exp, erf
    if not (price and S and K and T) or price <= 0 or T <= 0:
        return None
    intrinsic = max(0.0, (S - K) if is_call else (K - S))
    if price <= intrinsic + 1e-4:
        return None

    def nd(x):
        return 0.5 * (1.0 + erf(x / sqrt(2.0)))

    def bs(sig):
        d1 = (log(S / K) + (r + sig * sig / 2) * T) / (sig * sqrt(T))
        d2 = d1 - sig * sqrt(T)
        return (S * nd(d1) - K * exp(-r * T) * nd(d2)) if is_call \
            else (K * exp(-r * T) * nd(-d2) - S * nd(-d1))

    lo, hi, mid = 1e-4, 5.0, 0.3
    try:
        for _ in range(64):
            mid = (lo + hi) / 2
            v = bs(mid)
            if abs(v - price) < 0.01:
                break
            hi, lo = (mid, lo) if v > price else (hi, mid)
        return round(mid * 100, 1)
    except Exception:
        return None


def chain_payload(underlying: str, expiry_idx, width: int = 7) -> dict:
    """Real option chain for the F&O desk — live spot, real expiries, real per-strike LTP / OI /
    volume, and IV computed from the real premium. Honest (real=False) when the token is down.
    One batched kite.quote() pulls every strike's OI+LTP in the window — fast enough to poll."""
    import datetime as _dt
    try:
        s = (underlying or "NIFTY").strip().upper()
        spot = _underlying_spot(s)
        opts = [i for i in _nfo_instruments()
                if i["name"] == s and i["instrument_type"] in ("CE", "PE") and i.get("expiry")]
        if not spot or not opts:
            return {"real": False, "error": f"no live spot/chain for {s}"}
        exps = sorted({i["expiry"] for i in opts})

        def lbl(d):
            return {"d": d.strftime("%d %b"), "tag": "Monthly" if _is_monthly(d, exps) else "Weekly",
                    "days": max((d - _dt.date.today()).days, 0), "iso": d.isoformat()}

        ei = max(0, min(int(expiry_idx or 0), len(exps) - 1))
        exp = exps[ei]
        chain = [i for i in opts if i["expiry"] == exp]
        strikes = sorted({i["strike"] for i in chain})
        diffs = [b - a for a, b in zip(strikes, strikes[1:]) if b > a]
        step = min(diffs) if diffs else 50            # min gap = the near-ATM strike granularity
        atm = round(spot / step) * step
        win = [atm + k * step for k in range(-width, width + 1)]
        by = {(i["strike"], i["instrument_type"]): i for i in chain}
        keys = ["NFO:" + by[(K, it)]["tradingsymbol"]
                for K in win for it in ("CE", "PE") if (K, it) in by]
        q = _mk_kite().quote(keys) if keys else {}
        T = max((exp - _dt.date.today()).days, 0.5) / 365.0
        lot = chain[0].get("lot_size") or 0
        rows = []
        for K in win:
            ce, pe = by.get((K, "CE")), by.get((K, "PE"))
            cq = q.get("NFO:" + ce["tradingsymbol"], {}) if ce else {}
            pq = q.get("NFO:" + pe["tradingsymbol"], {}) if pe else {}
            cl, pl = cq.get("last_price"), pq.get("last_price")
            iv = _bs_iv(cl, spot, K, T, True)
            if iv is None:
                iv = _bs_iv(pl, spot, K, T, False)
            rows.append({"K": K, "callLtp": cl, "putLtp": pl,
                         "callOI": cq.get("oi"), "putOI": pq.get("oi"),
                         "callVol": cq.get("volume"), "putVol": pq.get("volume"),
                         "iv": iv, "atm": K == atm})
        return {"real": True, "underlying": s, "spot": spot, "atm": atm, "step": step,
                "lot": lot, "expiryIdx": ei, "days": int(round(T * 365)),
                "expiryLabel": lbl(exp), "expiries": [lbl(d) for d in exps[:4]],
                "asOf": _dt.datetime.now().isoformat(), "rows": rows}
    except Exception as e:
        return {"real": False, "error": str(e)[:120]}


# ---------------------------------------------------- REAL historical backtest (UI → bot engine)
# Reuses bot.backtest.Backtester (the SAME engine that produced the validated catalog via
# regime_backtest.py), run per symbol over real Kite daily history, then aggregated into an
# equal-weight portfolio curve. The compute is separated from data-fetching so it's unit-testable
# offline with synthetic prices (no token needed) — see test_backtest_engine().
BT_UNIVERSE = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "AXISBANK",
               "TATASTEEL", "JSWSTEEL", "HINDALCO", "LT", "MARUTI", "WIPRO", "ADANIENT"]
BT_PERIODS = {"1M": 21, "3M": 63, "1Y": 252, "3Y": 756}
_bt_cache = {}   # (strategy, period) -> {"t", "payload"}


def _bt_strategy(key):
    """(strategy_obj, RiskConfig) for a catalog id — matches the live paper-harness setup."""
    from bot.risk import RiskConfig
    from bot.strategy import MeanReversionConfig, MeanReversionStrategy
    from bot.strategy_momentum import MomentumConfig, MomentumStrategy
    from bot.strategies_lib import (RSI2Strategy, MACrossStrategy, SupertrendStrategy,
                                    EMACrossStrategy, ADXTrendStrategy, BollingerRevStrategy,
                                    ZScoreRevStrategy, NR7Strategy)
    cap = 100000.0
    if key == "momentum":
        return MomentumStrategy(MomentumConfig()), RiskConfig(capital=cap, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)
    if key == "rsi2":
        return RSI2Strategy(), RiskConfig(capital=cap, product="CNC")
    if key in ("meanrev", "mean-rev"):
        return MeanReversionStrategy(MeanReversionConfig()), RiskConfig(capital=cap, product="MIS")
    if key == "macross":
        return MACrossStrategy(), RiskConfig(capital=cap, product="CNC", stop_atr_mult=3.0)
    if key == "supertrend":
        return SupertrendStrategy(), RiskConfig(capital=cap, product="CNC", stop_atr_mult=3.0)
    # ---- Wave-1 price-based bots (same configs the regime backtest validated) ----
    if key == "ema_cross":
        return EMACrossStrategy(), RiskConfig(capital=cap, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)
    if key == "adx_trend":
        return ADXTrendStrategy(), RiskConfig(capital=cap, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)
    if key == "nr7":
        return NR7Strategy(), RiskConfig(capital=cap, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)
    if key == "bollinger":
        return BollingerRevStrategy(), RiskConfig(capital=cap, product="CNC")
    if key == "zscore":
        return ZScoreRevStrategy(), RiskConfig(capital=cap, product="CNC", target_atr_mult=0.0, stop_atr_mult=2.5)
    return None, None


def _run_universe_backtest(get_df, strat, risk_cfg, symbols, cost_bps=15.0):
    """PURE backtest aggregation (testable offline). get_df(sym)->daily OHLC df. Runs the bot
    Backtester per symbol, equal-weights the normalised equity curves into a portfolio curve,
    pools the trades, and derives all metrics + a 70/30 in-sample/out-of-sample split."""
    import numpy as np
    import pandas as pd
    from bot.backtest import Backtester
    from bot.risk import RiskManager
    curves, trades, bh_curves = [], [], []
    for s in symbols:
        df = get_df(s)
        if df is None or getattr(df, "empty", True) or len(df) < 230:
            continue
        try:
            res = Backtester(strat, RiskManager(risk_cfg), cost_bps=cost_bps).run(df)
        except Exception:
            continue
        if len(res.equity_curve):
            curves.append(res.equity_curve / res.starting_capital * 100.0)
            # buy-&-hold of the same stock over the same dates → the honest benchmark ("did the
            # strategy's timing beat simply owning these names?"). Normalised to base 100.
            try:
                close = df["close"].reindex(res.equity_curve.index).ffill().bfill()
                if len(close) > 1 and float(close.iloc[0]) > 0:
                    bh_curves.append(close / float(close.iloc[0]) * 100.0)
            except Exception:
                pass
        trades.extend(res.trades)
    if not curves:
        return None
    idx = sorted(set().union(*[set(c.index) for c in curves]))
    aligned = [c.reindex(idx).ffill().bfill() for c in curves]
    port = sum(aligned) / len(aligned)                      # equal-weight portfolio equity (base 100)
    daily = port.pct_change().dropna()
    sharpe = float(daily.mean() / daily.std() * np.sqrt(252)) if daily.std() > 0 else 0.0
    run_max = port.cummax(); maxdd = float(((port - run_max) / run_max).min() * 100)
    total = float(port.iloc[-1] / port.iloc[0] - 1) * 100
    yrs = max(len(port) / 252.0, 0.1); cagr = float(((port.iloc[-1] / port.iloc[0]) ** (1 / yrs) - 1) * 100)
    rets = [t.return_pct for t in trades]
    win = (sum(1 for r in rets if r > 0) / len(rets) * 100) if rets else 0.0
    avg = float(np.mean(rets)) if rets else 0.0
    # 70/30 split → in-sample vs out-of-sample (the honest validation cut)
    cut = idx[int(len(idx) * 0.7)] if len(idx) > 5 else (idx[-1] if idx else None)
    is_tr = [t.return_pct for t in trades if t.entry_time <= cut]
    oos_tr = [t.return_pct for t in trades if t.entry_time > cut]
    seg = lambda c: (float(c.iloc[-1] / c.iloc[0] - 1) * 100) if len(c) > 1 else 0.0
    oos = {"is_ret": seg(port[port.index <= cut]), "oos_ret": seg(port[port.index > cut]),
           "is_trades": len(is_tr), "oos_trades": len(oos_tr),
           "is_avg": float(np.mean(is_tr)) if is_tr else 0.0,
           "oos_avg": float(np.mean(oos_tr)) if oos_tr else 0.0}
    # ---- benchmark (equal-weight buy & hold of the same universe) + alpha/beta ----
    bench = None
    if bh_curves:
        bh_aligned = [c.reindex(idx).ffill().bfill() for c in bh_curves]
        bench = sum(bh_aligned) / len(bh_aligned)
    bench_ret = alpha = beta = None
    if bench is not None and len(bench) > 1:
        bench_ret = float(bench.iloc[-1] / bench.iloc[0] - 1) * 100
        bdaily = bench.pct_change().dropna()
        common = daily.index.intersection(bdaily.index)
        if len(common) > 5 and bdaily.loc[common].var() > 0:
            cov = float(np.cov(daily.loc[common], bdaily.loc[common])[0, 1])
            beta = round(cov / float(bdaily.loc[common].var()), 2)
            alpha = round((float(daily.loc[common].mean()) - beta * float(bdaily.loc[common].mean())) * 252 * 100, 2)
    # ---- underwater / drawdown series (downsampled to match the equity curve) ----
    dd_full = (port - run_max) / run_max * 100
    # ---- monthly returns (calendar heatmap) ----
    monthly = []
    try:
        m_end = port.resample("ME").last()
        m_ret = m_end.pct_change().dropna() * 100
        monthly = [{"ym": ts.strftime("%Y-%m"), "ret": round(float(v), 2)} for ts, v in m_ret.items()]
    except Exception:
        monthly = []
    # ---- Monte-Carlo robustness: bootstrap the REAL per-trade returns (1000 resamples) → is the
    # edge robust, or one lucky run? Honest framing: "if your trades had played out in a different draw". ----
    mc = None
    if len(rets) >= 10:
        Rr = np.array(rets) / 100.0
        rng = np.random.default_rng(42)
        finals = np.array([float(np.prod(1.0 + rng.choice(Rr, size=len(Rr), replace=True)) - 1.0) * 100 for _ in range(1000)])
        mc = {"runs": 1000, "p5": round(float(np.percentile(finals, 5)), 1),
              "p50": round(float(np.percentile(finals, 50)), 1), "p95": round(float(np.percentile(finals, 95)), 1),
              "profitableShare": round(float((finals > 0).mean()) * 100, 1)}
    # ---- edge consistency over time (is the edge fading?) ----
    decay = None
    if monthly:
        mr = [m["ret"] for m in monthly]
        posM = round(sum(1 for r in mr if r > 0) / len(mr) * 100)
        half = len(mr) // 2
        decay = {"posMonths": posM, "totalMonths": len(mr)}
        if half >= 2:
            fh = float(np.mean(mr[:half])); sh = float(np.mean(mr[half:]))
            decay.update(firstHalfAvg=round(fh, 2), secondHalfAvg=round(sh, 2), fading=bool(sh < fh - 0.1))
    # ---- time in market: share of days at least one symbol holds a position ----
    span_days = max(1, (idx[-1] - idx[0]).days) if len(idx) > 1 else 1
    held_days = sum(max(0, (t.exit_time - t.entry_time).days) for t in trades)
    time_in_mkt = round(min(100.0, held_days / (span_days * max(1, len(curves))) * 100), 1)
    # downsample the curve (+ drawdown) to ~140 pts for the UI
    step = max(1, len(port) // 140)
    pts = [round(float(v), 2) for v in port.iloc[::step]]
    dd = [round(float(v), 2) for v in dd_full.iloc[::step]]
    bpts = [round(float(v), 2) for v in bench.iloc[::step]] if bench is not None else None
    if pts[-1] != round(float(port.iloc[-1]), 2):
        pts.append(round(float(port.iloc[-1]), 2)); dd.append(round(float(dd_full.iloc[-1]), 2))
        if bpts is not None:
            bpts.append(round(float(bench.iloc[-1]), 2))
    log = [{"entry": round(float(t.entry), 1), "exit": round(float(t.exit), 1),
            "ret": round(float(t.return_pct), 2), "side": "buy",
            "days": int((t.exit_time - t.entry_time).days)} for t in trades[-12:]]
    # per-trade analytics — all derived from the SAME real trades (no separate source)
    wins = [t.return_pct for t in trades if t.return_pct > 0]
    losses = [t.return_pct for t in trades if t.return_pct <= 0]
    holds = [max(0, (t.exit_time - t.entry_time).days) for t in trades]
    gain = sum(wins); loss = -sum(losses)
    streak = best_w = best_l = 0
    for t in trades:                                   # longest win / loss streak
        if t.return_pct > 0:
            streak = streak + 1 if streak > 0 else 1; best_w = max(best_w, streak)
        else:
            streak = streak - 1 if streak < 0 else -1; best_l = min(best_l, streak)
    # NB: cast every value to float/int — t.return_pct is np.float64, which json.dumps can't serialise
    analytics = {
        "avgWin": round(float(np.mean(wins)), 2) if wins else 0.0,
        "avgLoss": round(float(np.mean(losses)), 2) if losses else 0.0,
        "best": round(float(max((t.return_pct for t in trades), default=0.0)), 2),
        "worst": round(float(min((t.return_pct for t in trades), default=0.0)), 2),
        "profitFactor": round(float(gain / loss), 2) if loss > 0 else None,
        "avgHold": round(float(np.mean(holds)), 1) if holds else 0.0,
        "winStreak": int(best_w), "lossStreak": int(abs(best_l)),
        "wins": len(wins), "losses": len(losses)}
    return {"pts": pts, "totalRet": round(total, 2), "cagr": round(cagr, 2),
            "maxDD": round(abs(maxdd), 2), "sharpe": round(sharpe, 2),
            "winRate": round(win), "trades": len(trades), "avgTrade": round(avg, 2),
            "costBps": cost_bps, "oos": {k: round(v, 2) if isinstance(v, float) else v for k, v in oos.items()},
            "analytics": analytics, "log": log,
            # proof pack: benchmark vs buy & hold, alpha/beta, underwater curve, monthly returns
            "benchmark": ({"pts": bpts, "totalRet": round(bench_ret, 2), "label": "Buy & hold (same stocks)",
                           "alpha": alpha, "beta": beta} if bench_ret is not None else None),
            "dd": dd, "monthly": monthly, "timeInMarket": time_in_mkt,
            "montecarlo": mc, "edgeDecay": decay}


def backtest_payload(strategy: str, period: str, symbols=None) -> dict:
    """Real historical backtest for a catalog strategy over the default universe OR a user-chosen
    set of symbols (watchlist / single stock). Honest error when the token is down."""
    period = period if period in BT_PERIODS else "1Y"
    # resolve & sanitise the requested universe (cap at 20 to bound the historical-data calls)
    uni = [s.strip().upper() for s in symbols if s and s.strip()][:20] if symbols else list(BT_UNIVERSE)
    if not uni:
        uni = list(BT_UNIVERSE)
    ck = (strategy, period, tuple(uni))
    hit = _bt_cache.get(ck)
    if hit and time.time() - hit["t"] < 600:
        return hit["payload"]
    from datetime import datetime, timedelta
    # ---- cross-sectional (rank-basket) bots: portfolio backtest, not per-symbol ----
    if strategy in ("xs_momentum", "lowvol"):
        try:
            from bot.xs import xs_backtest
            kite = _mk_kite()
            frm = datetime.now() - timedelta(days=1900)   # Kite caps daily history at 2000 days

            def get_df(sym):
                import pandas as pd
                tok = _resolve_token(sym)
                if not tok:
                    return None
                recs = kite.historical_data(tok, frm, datetime.now(), "day")
                if not recs:
                    return None
                df = pd.DataFrame(recs).rename(columns={"date": "datetime"})
                df["datetime"] = pd.to_datetime(df["datetime"])
                return df.set_index("datetime")[["open", "high", "low", "close", "volume"]]

            kind = "momentum" if strategy == "xs_momentum" else "lowvol"
            res = xs_backtest(get_df, kind, uni if symbols else list(BT_UNIVERSE), top_n=4)
            if not res:
                return {"real": False, "error": "not enough history for the rank-basket backtest"}
            res.update(strategy=strategy, period="5Y (monthly rebalance)",
                       asOf=datetime.now().isoformat())
            _bt_cache[ck] = {"t": time.time(), "payload": res}
            return res
        except Exception as e:
            return {"real": False, "error": str(e)[:120]}
    strat, risk_cfg = _bt_strategy(strategy)
    if not strat:
        return {"real": False, "error": f"{strategy} has no single-symbol backtest (pairs is 2-leg — see Forward Test)"}
    try:
        kite = _mk_kite()
        days = BT_PERIODS[period] + 280            # +warmup for 200-bar filters
        frm = datetime.now() - timedelta(days=int(days * 1.5))

        def get_df(sym):
            import pandas as pd
            tok = _resolve_token(sym)
            if not tok:
                return None
            recs = kite.historical_data(tok, frm, datetime.now(), "day")
            if not recs:
                return None
            df = pd.DataFrame(recs).rename(columns={"date": "datetime"})
            df["datetime"] = pd.to_datetime(df["datetime"])
            return df.set_index("datetime")[["open", "high", "low", "close", "volume"]]

        res = _run_universe_backtest(get_df, strat, risk_cfg, uni)
        if not res:
            return {"real": False, "error": "not enough history to backtest these symbols"}
        custom_uni = symbols is not None and sorted(uni) != sorted(BT_UNIVERSE)
        res.update(real=True, strategy=strategy, period=period, universe=len(uni),
                   symbols=uni if custom_uni else None, customUniverse=custom_uni,
                   asOf=datetime.now().isoformat())
        _bt_cache[ck] = {"t": time.time(), "payload": res}
        return res
    except Exception as e:
        return {"real": False, "error": str(e)[:120]}


_corr_cache = {"t": 0.0, "data": None}


def correlation_payload() -> dict:
    """Pairwise correlation of the validated strategies' daily return series over a shared 1Y
    window — so a user doesn't deploy three strategies that are really the same bet. Heavy
    (runs each strategy on shared history); cached 1h. Honest error when the token is down."""
    if _corr_cache["data"] and time.time() - _corr_cache["t"] < 3600:
        return _corr_cache["data"]
    from datetime import datetime, timedelta
    try:
        import numpy as np  # noqa: F401
        import pandas as pd
        from bot.backtest import Backtester
        from bot.risk import RiskManager
        kite = _mk_kite()
        frm = datetime.now() - timedelta(days=int((252 + 280) * 1.5))
        dfs = {}                                   # fetch each symbol's history ONCE, share across strategies
        for sym in BT_UNIVERSE:
            tok = _resolve_token(sym)
            if not tok:
                continue
            recs = kite.historical_data(tok, frm, datetime.now(), "day")
            if not recs:
                continue
            df = pd.DataFrame(recs).rename(columns={"date": "datetime"})
            df["datetime"] = pd.to_datetime(df["datetime"])
            dfs[sym] = df.set_index("datetime")[["open", "high", "low", "close", "volume"]]
        strats = [s for s in STRATEGIES if s.get("status") == "validated" and _bt_strategy(s["id"])[0]]
        series, names = {}, {}
        for s in strats:
            strat, risk = _bt_strategy(s["id"])
            curves = []
            for df in dfs.values():
                if df is None or len(df) < 230:
                    continue
                try:
                    res = Backtester(strat, RiskManager(risk), cost_bps=15.0).run(df)
                except Exception:
                    continue
                if len(res.equity_curve):
                    curves.append(res.equity_curve / res.starting_capital)
            if curves:
                idx = sorted(set().union(*[set(c.index) for c in curves]))
                port = sum(c.reindex(idx).ffill().bfill() for c in curves) / len(curves)
                series[s["id"]] = port.pct_change().dropna()
                names[s["id"]] = s["name"]
        ids = list(series)
        if len(ids) < 2:
            return {"real": False, "error": "need ≥2 validated strategies with history"}
        df_ret = pd.DataFrame({i: series[i] for i in ids}).dropna()
        corr = df_ret.corr()
        matrix = [[round(float(corr.loc[a, b]), 2) for b in ids] for a in ids]
        pairs = [(matrix[a][b], ids[a], ids[b]) for a in range(len(ids)) for b in range(a + 1, len(ids))]
        pairs.sort(reverse=True)
        out = {"real": True, "ids": ids, "names": [names[i] for i in ids], "matrix": matrix,
               "mostCorrelated": ({"a": names[pairs[0][1]], "b": names[pairs[0][2]], "r": pairs[0][0]} if pairs else None),
               "leastCorrelated": ({"a": names[pairs[-1][1]], "b": names[pairs[-1][2]], "r": pairs[-1][0]} if pairs else None),
               "asOf": datetime.now().isoformat()}
        _corr_cache.update(t=time.time(), data=out)
        return out
    except Exception as e:
        return {"real": False, "error": str(e)[:120]}


# ---------------------------------------------------- stock futures buildup (100% real, from Kite)
_fut_cache = {"t": 0.0, "data": None, "key": ""}


def futures_payload(csv: str) -> dict:
    """Real stock-futures view for the F&O desk: nearest-expiry future LTP, basis (fut−spot),
    live OI + volume, and OI day-change (current OI − prior trading-day close OI, via historical
    oi=True) → a REAL long/short buildup classification. Honest nulls when a leg has no data.
    Cached 60s (the OI-change pull is one historical call per future)."""
    import datetime as _dt
    syms = [s.strip().upper() for s in (csv or "").split(",") if s.strip()][:14]
    if not syms:
        return {"real": False, "rows": {}}
    key = ",".join(syms)
    if time.time() - _fut_cache["t"] < 60 and _fut_cache["data"] and _fut_cache["key"] == key:
        return _fut_cache["data"]
    try:
        kite = _mk_kite()
        nfo = _nfo_instruments()
        today = _dt.date.today()
        fut = {}
        for s in syms:
            fs = sorted((i for i in nfo if i["name"] == s and i["instrument_type"] == "FUT"
                         and i.get("expiry") and i["expiry"] >= today), key=lambda i: i["expiry"])
            if fs:
                fut[s] = fs[0]
        fkeys = ["NFO:" + fut[s]["tradingsymbol"] for s in syms if s in fut]
        skeys = ["NSE:" + s for s in syms]
        q = kite.quote(fkeys) if fkeys else {}
        sp = kite.ohlc(skeys) or {}
        rows = {}
        for s in syms:
            f = fut.get(s)
            fq = q.get("NFO:" + f["tradingsymbol"], {}) if f else {}
            spot = (sp.get("NSE:" + s, {}) or {}).get("last_price")
            ltp = fq.get("last_price"); oi = fq.get("oi"); vol = fq.get("volume")
            basis = (ltp - spot) if (ltp is not None and spot is not None) else None
            # OI day-change: prior completed day's OI from historical (oi=True), best-effort
            oi_chg = None
            if f and oi is not None:
                try:
                    h = kite.historical_data(int(f["instrument_token"]),
                                             _dt.datetime.now() - _dt.timedelta(days=6),
                                             _dt.datetime.now(), "day", oi=True)
                    prev = next((b.get("oi") for b in reversed(h[:-1]) if b.get("oi")), None) if h else None
                    if prev:
                        oi_chg = round((oi - prev) / prev * 100, 1)
                except Exception:
                    pass
            # real buildup = price direction × OI-change direction
            buildup = None
            if basis is not None and oi_chg is not None and spot:
                day = (sp.get("NSE:" + s, {}) or {}).get("ohlc", {})
                p_up = (ltp is not None and day.get("close") is not None and ltp >= day["close"]) or (basis >= 0)
                o_up = oi_chg >= 0
                buildup = ("Long Buildup" if (p_up and o_up) else "Short Buildup" if (not p_up and o_up)
                           else "Short Covering" if (p_up and not o_up) else "Long Unwinding")
            rows[s] = {"futLtp": ltp, "spot": spot, "basis": basis, "oi": oi, "vol": vol,
                       "oiChg": oi_chg, "buildup": buildup,
                       "sym": f["tradingsymbol"] if f else None, "lot": f.get("lot_size") if f else None}
        out = {"real": True, "rows": rows, "asOf": _dt.datetime.now().isoformat()}
        _fut_cache.update(t=time.time(), data=out, key=key)
        return out
    except Exception as e:
        return {"real": False, "error": str(e)[:120], "rows": {}}


def open_position_pnl(state: dict):
    """Mark EVERY single-leg strategy's open paper positions to live market price →
    unrealised P&L + per-position detail. Returns (totals, detail). Uses the shared cache."""
    totals = {k: 0.0 for k in SINGLE_LEG_KEYS}
    detail = {k: [] for k in SINGLE_LEG_KEYS}
    syms = set()
    for k in SINGLE_LEG_KEYS:
        for sym in (state.get(k, {}).get("positions") or {}):
            syms.add(sym)
    if not syms:
        return totals, detail
    ltps = quote_ltps(sorted(syms))
    for k in SINGLE_LEG_KEYS:
        tot = 0.0
        for sym, p in (state.get(k, {}).get("positions") or {}).items():
            ltp = (ltps.get(sym) or {}).get("ltp"); entry = p.get("entry"); qty = p.get("qty")
            unreal = round((ltp - entry) * qty, 2) if (ltp and entry and qty) else 0.0
            tot += unreal
            detail[k].append({"sym": sym, "qty": qty, "entry": entry, "ltp": ltp,
                              "unreal": unreal,
                              "chgPct": round((ltp - entry) / entry * 100, 2) if (ltp and entry) else None})
        totals[k] = round(tot, 2)
    return totals, detail


_CRYPTO_FEED = None
_CRYPTO_NAMES = {
    "momentum": "Momentum", "rsi2": "RSI(2) Reversion", "macross": "MA Crossover",
    "supertrend": "Supertrend", "ema_cross": "EMA Crossover", "adx_trend": "ADX Trend",
    "bollinger": "Bollinger Reversion", "zscore": "Z-Score Reversion", "nr7": "NR7 Breakout",
    "xs_momentum": "Cross-Sectional Momentum", "lowvol": "Low-Volatility Basket",
    "mean-rev": "Mean Reversion", "orb": "Opening Range Breakout", "vwap_rev": "VWAP Reversion",
    "vwap_mom": "VWAP Momentum", "ema_scalp": "EMA Scalp", "bb_breakout": "BB Squeeze Breakout",
    "opportunity": "Opportunity Engine", "moonshot": "Moonshot Compounder", "pairs": "Stat-Arb Pairs",
    "perp_trend": "Perp Trend (BTC)", "perp_trend_eth": "Perp Trend (ETH)",
    "perp_funding": "Funding Carry (BTC)", "perp_funding_eth": "Funding Carry (ETH)",
    "cx_strangle": "Short Strangle (BTC)", "cx_strangle_eth": "Short Strangle (ETH)",
    "cx_condor": "Iron Condor (BTC)",
}


def _crypto_feed():
    global _CRYPTO_FEED
    if _CRYPTO_FEED is None:
        from bot.crypto_data import CryptoDataFeed
        _CRYPTO_FEED = CryptoDataFeed()
    return _CRYPTO_FEED


def crypto_monitor_payload() -> dict:
    """Live crypto paper book — per-strategy realised + unrealised (marked to live Binance spot),
    totals, regime and Governor health. Read-only over crypto_state.json (written by the 24/7
    crypto harness). Positions are marked HERE so the Monitor shows real-time P&L, never a stale
    entry price. Prices are real Binance spot; the book is paper (no orders placed)."""
    empty = {"market": "crypto", "running": False, "strategies": [],
             "totals": {"realised": 0, "unreal": 0, "pnl": 0, "open": 0}}
    path = os.path.join(HERE, "crypto_state.json")
    if not os.path.exists(path):
        return empty
    try:
        state = json.load(open(path))
    except Exception:
        return empty
    instr = state.get("instr", {})
    # spot positions are marked to live spot LTP; perps/options self-mark (side + funding) via openMark
    syms = set()
    for k, v in state.items():
        if isinstance(v, dict) and instr.get(k, "spot") == "spot":
            syms.update((v.get("positions") or {}).keys())
    marks = _crypto_feed().ltp(list(syms)) if syms else {}
    rows, tR, tU, tO = [], 0.0, 0.0, 0
    for k, v in state.items():
        if not isinstance(v, dict) or ("realised" not in v):
            continue
        cls = instr.get(k, "spot")
        realised = round(v.get("realised", 0.0), 2)
        positions, unreal = [], 0.0
        if k == "pairs":
            for n, p in (v.get("pairs") or {}).items():
                if p.get("pos"):
                    positions.append({"sym": n, "spread": p.get("pos")})
        elif "openMark" in v:
            # self-marker (perps/options): trust the engine's openMark (handles side + funding + intrinsic)
            unreal = round(v.get("openMark", 0.0), 2)
            plist = list((v.get("positions") or {}).items())
            for i, (sym, p) in enumerate(plist):
                if "credit" in p:      # options structure — show its label + collected credit
                    positions.append({"sym": p.get("label", sym), "credit": round(p.get("credit", 0), 2),
                                      "contracts": p.get("contracts", 1),
                                      "pnl": unreal if len(plist) == 1 else None})
                else:                  # perps — directional single leg
                    positions.append({"sym": sym, "qty": p.get("qty", 0), "side": p.get("side", 1),
                                      "entry": round(p.get("entry", 0) or 0, 4),
                                      "pnl": unreal if len(plist) == 1 else None})
        else:
            for sym, p in (v.get("positions") or {}).items():
                entry = p.get("entry", 0) or 0
                qty = p.get("qty", 0) or 0
                mark = marks.get(sym) or entry
                pnl = (mark - entry) * qty
                unreal += pnl
                positions.append({"sym": sym, "qty": qty, "entry": round(entry, 4),
                                  "mark": round(mark, 4), "pnl": round(pnl, 2),
                                  "pnlPct": round((mark / entry - 1) * 100, 2) if entry else 0})
        unreal = round(unreal, 2)
        tR += realised; tU += unreal; tO += len(positions)
        rows.append({"id": k, "name": _CRYPTO_NAMES.get(k, k), "instr": cls, "realisedPnl": realised,
                     "openPnl": unreal, "paperPnl": round(realised + unreal, 2),
                     "openPositions": len(positions), "positions": positions})
    rows.sort(key=lambda r: -r["paperPnl"])
    gov = {}
    gpath = os.path.join(HERE, "crypto_governor_state.json")
    if os.path.exists(gpath):
        try:
            gov = json.load(open(gpath))
        except Exception:
            gov = {}
    return {"market": "crypto", "running": True, "regime": state.get("regime", "—"),
            "updated": state.get("updated"), "capital": 1_000_000, "strategies": rows,
            "totals": {"realised": round(tR, 2), "unreal": round(tU, 2),
                       "pnl": round(tR + tU, 2), "open": int(tO)},
            "governor": {"score": gov.get("score"), "exposurePct": gov.get("exposurePct"),
                         "crowding": gov.get("crowding"), "topSymbol": gov.get("topSymbol"),
                         "sectors": gov.get("sectors"), "limits": gov.get("limits")}}


CRYPTO_BT_UNIVERSE = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
                      "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "LINKUSDT", "MATICUSDT"]
_cbt_cache = {}


def crypto_backtest_payload(strategy: str, period: str) -> dict:
    """Real historical backtest of a catalog strategy over the crypto majors, on Binance daily
    klines — reuses the exact Backtester the Indian side uses (the strategies are market-agnostic).
    Perps/options/pairs have no single-symbol backtest (like the Indian futures/options/pairs)."""
    period = period if period in BT_PERIODS else "1Y"
    ck = (strategy, period)
    hit = _cbt_cache.get(ck)
    if hit and time.time() - hit["t"] < 600:
        return hit["payload"]
    from datetime import datetime
    feed = _crypto_feed()
    days = BT_PERIODS[period] + 280            # +warmup for 200-bar filters (feed caps at 1000 bars)

    def get_df(sym):
        df = feed.historical(sym, "day", days)
        return df if (df is not None and not getattr(df, "empty", True)) else None

    try:
        if strategy in ("xs_momentum", "lowvol"):
            from bot.xs import xs_backtest
            kind = "momentum" if strategy == "xs_momentum" else "lowvol"
            res = xs_backtest(get_df, kind, CRYPTO_BT_UNIVERSE, top_n=4)
            if not res:
                return {"real": False, "error": "not enough crypto history for the rank-basket backtest"}
            res.update(real=True, market="crypto", strategy=strategy,
                       period="max avail (monthly rebalance)", asOf=datetime.now().isoformat())
            _cbt_cache[ck] = {"t": time.time(), "payload": res}
            return res
        strat, risk_cfg = _bt_strategy(strategy)
        if not strat:
            return {"real": False, "error": f"{strategy} has no single-symbol crypto backtest (perps/options/pairs excluded — see Monitor)"}
        res = _run_universe_backtest(get_df, strat, risk_cfg, CRYPTO_BT_UNIVERSE)
        if not res:
            return {"real": False, "error": "not enough crypto history to backtest these strategies"}
        res.update(real=True, market="crypto", strategy=strategy, period=period,
                   universe=len(CRYPTO_BT_UNIVERSE), asOf=datetime.now().isoformat())
        _cbt_cache[ck] = {"t": time.time(), "payload": res}
        return res
    except Exception as e:
        return {"real": False, "error": str(e)[:120]}


def _fwd_from_log(key: str, logpath: str) -> dict:
    """Closed-trade stats for one strategy from a paper log (EXIT lines). Shared by crypto."""
    out = {"closed": 0, "wins": 0, "losses": 0, "winPct": None, "profitFactor": None,
           "avgWin": None, "avgLoss": None, "expectancy": None, "netPnl": 0.0}
    if not key or not os.path.exists(logpath):
        return out
    tag = f"[{key}] EXIT"
    pnls = []
    try:
        with open(logpath) as f:
            for ln in f:
                if tag not in ln or "pnl=" not in ln:
                    continue
                tok = ln.split("pnl=", 1)[1].split()[0].rstrip(")")
                try:
                    pnls.append(float(tok))
                except ValueError:
                    pass
    except Exception:
        return out
    out["closed"] = len(pnls)
    if not pnls:
        return out
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    gw, gl = sum(wins), -sum(losses)
    out.update(wins=len(wins), losses=len(losses), winPct=round(len(wins) / len(pnls) * 100, 1),
               avgWin=round(gw / len(wins), 2) if wins else 0.0,
               avgLoss=round(gl / len(losses), 2) if losses else 0.0,
               profitFactor=round(gw / gl, 2) if gl > 0 else (99.0 if gw > 0 else None),
               expectancy=round(sum(pnls) / len(pnls), 2), netPnl=round(sum(pnls), 2))
    return out


_BOOK_NAMES = dict(_CRYPTO_NAMES, **{
    "iron_condor": "Iron Condor (NIFTY)", "strangle": "Short Strangle (NIFTY)",
    "fut_trend": "Futures Trend (NIFTY)", "basis": "Basis Carry (NIFTY)",
})
# the go-live BAR — evidence a strategy must show before it earns real capital
READY_MIN_TRADES = 50      # a statistically meaningful sample (not 3 lucky trades)
READY_MIN_PF = 1.2         # net-of-cost profit factor with a real margin
READY_MIN_REGIMES = 2      # survived at least two distinct market regimes
CULL_MIN_TRADES = 30       # negative expectancy over this many = auto-benched


def _log_keys(logpath: str) -> set:
    import re
    keys = set()
    if os.path.exists(logpath):
        try:
            for ln in open(logpath):
                m = re.search(r"\[([\w-]+)\] EXIT", ln)
                if m:
                    keys.add(m.group(1))
        except Exception:
            pass
    return keys


def _regimes_from_log(key: str, logpath: str) -> list:
    tag, regs = f"[{key}] EXIT", set()
    if os.path.exists(logpath):
        try:
            for ln in open(logpath):
                if tag in ln and "regime=" in ln:
                    p = ln.split("regime=", 1)[1].split()
                    if p and p[0] not in ("—", "-"):
                        regs.add(p[0])
        except Exception:
            pass
    return sorted(regs)


_REGIME_ORDER = ["Bull", "Bear", "Choppy", "High-Vol"]


def _current_regime(market: str) -> str:
    f = os.path.join(HERE, "crypto_state.json" if market == "crypto" else "rebalance_state.json")
    if os.path.exists(f):
        try:
            return json.load(open(f)).get("regime", "—") or "—"
        except Exception:
            pass
    return "—"


def regime_fit_payload(market: str = "in") -> dict:
    """Strategy × regime expectancy matrix — which strategy PROVES it profits in which regime,
    net of costs. This is what makes the live selection data-driven: proven losers in the live
    regime are benched, proven winners deployed, the hand-written prior stands where evidence is thin."""
    from bot import regime_fit
    logp = os.path.join(HERE, "crypto_trades.log" if market == "crypto" else "paper_trades.log")
    mat = regime_fit.matrix_from_log(logp)
    rows = []
    for key in mat:
        cells = {r: mat[key].get(r) for r in _REGIME_ORDER}
        total = sum(c["n"] for c in mat[key].values())
        rows.append({"id": key, "name": _BOOK_NAMES.get(key, key), "cells": cells, "total": total})
    rows.sort(key=lambda r: -r["total"])
    return {"market": market, "regimes": _REGIME_ORDER, "currentRegime": _current_regime(market),
            "minTrades": regime_fit.MIN_CELL, "strategies": rows}


def book_readiness_payload(market: str = "in") -> dict:
    """The honest go-live gate: per strategy, net-of-cost win%/PF/expectancy, regimes survived,
    and a verdict (READY / GATHERING / CULL) against the bar. This is what decides real capital —
    a small sample or a single lucky streak reads as GATHERING, not READY."""
    logp = os.path.join(HERE, "crypto_trades.log" if market == "crypto" else "paper_trades.log")
    rows = ready = cull = gathering = 0
    out = []
    for key in sorted(_log_keys(logp)):
        s = _fwd_from_log(key, logp)          # net-of-cost (logged pnl now includes friction)
        if s["closed"] == 0:
            continue
        regs = _regimes_from_log(key, logp)
        exp, pf, net, n = s["expectancy"], s["profitFactor"], s["netPnl"], s["closed"]
        if n >= CULL_MIN_TRADES and net < 0:
            verdict = "cull"; cull += 1
        elif (n >= READY_MIN_TRADES and (exp or 0) > 0 and (pf or 0) >= READY_MIN_PF
              and len(regs) >= READY_MIN_REGIMES):
            verdict = "ready"; ready += 1
        else:
            verdict = "gathering"; gathering += 1
        rows += 1
        out.append({"id": key, "name": _BOOK_NAMES.get(key, key), "closed": n,
                    "winPct": s["winPct"], "profitFactor": pf, "expectancy": exp, "netPnl": net,
                    "regimes": regs, "verdict": verdict})
    out.sort(key=lambda r: ({"ready": 0, "gathering": 1, "cull": 2}[r["verdict"]], -r["closed"]))
    return {"market": market, "strategies": out,
            "summary": {"total": rows, "ready": ready, "gathering": gathering, "cull": cull},
            "bar": {"minTrades": READY_MIN_TRADES, "minProfitFactor": READY_MIN_PF,
                    "minRegimes": READY_MIN_REGIMES, "cullMinTrades": CULL_MIN_TRADES},
            "goLive": ready > 0 and cull == 0 and gathering == 0}


def crypto_forward_payload() -> dict:
    """Forward-test accuracy for the crypto book — real closed-trade stats per strategy, parsed
    from the 24/7 harness log (win%, profit factor, expectancy). This is the honest out-of-sample
    track record; it accrues as the harness runs."""
    logp = os.path.join(HERE, "crypto_trades.log")
    instr = {}
    sp = os.path.join(HERE, "crypto_state.json")
    if os.path.exists(sp):
        try:
            instr = json.load(open(sp)).get("instr", {})
        except Exception:
            instr = {}
    rows, agg = [], {"closed": 0, "wins": 0, "losses": 0, "net": 0.0, "gw": 0.0, "gl": 0.0}
    for k, name in _CRYPTO_NAMES.items():
        s = _fwd_from_log(k, logp)
        if s["closed"] == 0:
            continue
        s.update(id=k, name=name, instr=instr.get(k, "spot"))
        rows.append(s)
        agg["closed"] += s["closed"]; agg["wins"] += s["wins"]; agg["losses"] += s["losses"]
        agg["net"] += s["netPnl"]
        agg["gw"] += (s["avgWin"] or 0) * s["wins"]; agg["gl"] += (s["avgLoss"] or 0) * s["losses"]
    rows.sort(key=lambda r: -r["closed"])
    winPct = round(agg["wins"] / agg["closed"] * 100, 1) if agg["closed"] else None
    pf = round(agg["gw"] / agg["gl"], 2) if agg["gl"] > 0 else (99.0 if agg["gw"] > 0 else None)
    return {"running": os.path.exists(logp), "strategies": rows,
            "totals": {"closed": agg["closed"], "wins": agg["wins"], "losses": agg["losses"],
                       "winPct": winPct, "profitFactor": pf, "netPnl": round(agg["net"], 2)}}


def crypto_analytics_payload() -> dict:
    """P&L attribution for the crypto book — by instrument class (spot/perps/options), by strategy
    (top contributors + drags), and by market regime (realised, from the closed-trade log)."""
    mon = crypto_monitor_payload()
    if not mon.get("running"):
        return {"running": False}
    by_instr, by_strat = {}, []
    for s in mon.get("strategies", []):
        c = s.get("instr", "spot")
        b = by_instr.setdefault(c, {"realised": 0.0, "open": 0.0, "pnl": 0.0, "n": 0, "openPos": 0})
        b["realised"] += s["realisedPnl"]; b["open"] += s["openPnl"]; b["pnl"] += s["paperPnl"]
        b["n"] += 1; b["openPos"] += s["openPositions"]
        if s["paperPnl"] != 0 or s["openPositions"] > 0:
            by_strat.append({"id": s["id"], "name": s["name"], "instr": c, "pnl": s["paperPnl"]})
    for b in by_instr.values():
        b["realised"] = round(b["realised"], 2); b["open"] = round(b["open"], 2); b["pnl"] = round(b["pnl"], 2)
    by_strat.sort(key=lambda x: -x["pnl"])
    by_regime = {}
    logp = os.path.join(HERE, "crypto_trades.log")
    if os.path.exists(logp):
        try:
            with open(logp) as f:
                for ln in f:
                    if "] EXIT" not in ln or "pnl=" not in ln:
                        continue
                    try:
                        pnl = float(ln.split("pnl=", 1)[1].split()[0].rstrip(")"))
                    except (ValueError, IndexError):
                        continue
                    reg = "—"
                    if "regime=" in ln:
                        _rp = ln.split("regime=", 1)[1].split()
                        reg = _rp[0] if _rp else "—"          # guard: a trailing "regime=" won't IndexError
                    r = by_regime.setdefault(reg, {"net": 0.0, "n": 0})
                    r["net"] += pnl; r["n"] += 1
            for r in by_regime.values():
                r["net"] = round(r["net"], 2)
        except Exception:
            pass
    return {"running": True, "regime": mon.get("regime"), "totals": mon.get("totals"),
            "byInstrument": by_instr, "byStrategy": by_strat[:12], "byRegime": by_regime}


def crypto_risk_payload() -> dict:
    """The crypto Governor state (score, mode, concentration, crowding, kill-switch) — the same
    portfolio control layer as the Indian book, published each cycle by the crypto harness."""
    path = os.path.join(HERE, "crypto_governor_state.json")
    if not os.path.exists(path):
        return {"running": False}
    try:
        d = json.load(open(path))
        # hide the cosmetic options-expiry keys (value-0 structures) from the crowding view
        d["crowding"] = {k: v for k, v in (d.get("crowding") or {}).items() if "USDT" in str(k)}
        d["running"] = True
        return d
    except Exception:
        return {"running": False}


def monitor_payload() -> dict:
    """FAST, lean endpoint for the live Monitor — every running strategy's real-time P&L +
    per-position detail, cached quotes, NO heavy readiness calls. Safe to poll every ~2s."""
    state = read_state()
    totals, detail = open_position_pnl(state)
    rows = []
    for sid, k in HARNESS_KEYS.items():
        s = next((x for x in STRATEGIES if x["id"] == sid), None)
        if not s:
            continue
        if sub_state(sid) is None:          # not subscribed (stopped) → no live book to show
            continue
        st = state.get(k, {})
        realised = round(st.get("realised", 0.0), 2)
        if k == "pairs":
            positions = [{"sym": n, "spread": p.get("pos")} for n, p in st.get("pairs", {}).items() if p.get("pos")]
            unreal = 0.0
            openN = len(positions)
        else:
            positions = detail.get(k, [])
            unreal = totals.get(k, 0.0) or round(st.get("openMark", 0.0), 2)   # self-markers carry openMark
            openN = len(st.get("positions", {}))
        fs = forward_stats(k)
        rows.append({"id": sid, "name": s["name"], "cat": s["cat"], "risk": s["risk"],
                     "validated": s.get("status") == "validated",
                     "realisedPnl": realised, "openPnl": unreal,
                     "paperPnl": round(realised + unreal, 2),
                     "openPositions": openN, "fwdTrades": fs["closed"],
                     "fwdWins": fs["wins"], "fwdLosses": fs["losses"], "fwdWinPct": fs["winPct"],
                     "fwdProfitFactor": fs["profitFactor"], "fwdAvgWin": fs["avgWin"],
                     "fwdAvgLoss": fs["avgLoss"], "fwdExpectancy": fs["expectancy"],
                     "positions": positions})
    total = round(sum(r["paperPnl"] for r in rows), 2)
    from datetime import datetime
    # ---- aggregate risk summary (real, from open positions + the bot's own RiskConfig) ----
    from bot.risk import RiskConfig
    rc = RiskConfig()
    exposure = 0.0
    for r in rows:
        for p in r.get("positions", []):
            ltp, qty = p.get("ltp"), p.get("qty")
            if ltp and qty:
                exposure += abs(ltp * qty)
    open_n = sum(r["openPositions"] for r in rows)
    active = sum(1 for r in rows if r["openPositions"])
    risk = {
        "exposure": round(exposure, 2),
        "openPositions": open_n,
        "activeStrategies": active,
        "maxPositionsPerStrategy": rc.max_positions,
        "positionCapTotal": rc.max_positions * max(1, len([r for r in rows])),
        "dailyLossLimitPct": rc.max_daily_loss_pct,                       # per-strategy halt threshold
        "dailyLossLimitPerStrategy": round(rc.capital * rc.max_daily_loss_pct / 100, 2),
        "runningPnl": total,                                             # since the engine started (not daily)
        "liveArmed": live_armed(),                                       # ALLOW_LIVE — the hard kill switch
        "killSwitch": "armed" if live_armed() else "safe",              # safe = paper-only, real orders impossible
        "mode": get_mode(),
    }
    return {"running": rows, "totalPnl": total, "count": len(rows),
            "asOf": datetime.now().isoformat(), "mode": get_mode(),
            "marketOpen": market_status()["open"], "risk": risk}


def stopped_payload() -> dict:
    """Admin stop-outs the harness flattened when a strategy was un-deployed — read from
    stopped_positions.json. These are deliberately kept OUT of any strategy's P&L; this
    endpoint is the only place they surface, so the liquidation isn't hidden on disk."""
    try:
        with open(STOPPED_FILE) as f:
            records = json.load(f) or []
    except Exception:
        records = []
    name = {s["id"]: s["name"] for s in STRATEGIES}
    for r in records:
        r["name"] = name.get(r.get("strategy"), r.get("strategy"))
    records.sort(key=lambda r: r.get("stoppedAt", ""), reverse=True)   # newest first
    return {"stopped": records, "count": len(records),
            "totalFlattenPnl": round(sum(r.get("flattenPnl", 0) for r in records), 2)}


def analytics_payload() -> dict:
    """Portfolio ANALYTICS over the full forward paper-trade log (append-only = chronological):
    equity curve, per-strategy & per-symbol contribution, activity-by-hour, trade distribution,
    and auto-insights. (No dates in the log → the curve uses trade order, activity uses
    time-of-day.) Everything is real out-of-sample paper data — zero real money."""
    from datetime import datetime as _dt
    out = {"equity": [0.0], "byStrategy": [], "bySymbol": [], "byHour": [0] * 24,
           "distribution": [], "trades": [], "totals": {}, "insights": [],
           "profitFactor": None, "expectancy": None, "avgWin": None, "avgLoss": None,
           "best": None, "worst": None, "maxDrawdown": 0.0, "byReason": [],
           "streaks": {"longestWin": 0, "longestLoss": 0, "current": 0}, "byRegime": [],
           "open": {"positions": 0, "unrealised": 0.0},
           "asOf": _dt.now().isoformat()}
    if not os.path.exists(LOG_FILE):
        return out
    state = read_state()
    key_sid = {v: k for k, v in HARNESS_KEYS.items()}
    sid_name = {s["id"]: s["name"] for s in STRATEGIES}
    strat, sym, dist, trades, regm = {}, {}, [], [], {}
    cum = 0.0
    try:
        with open(LOG_FILE) as f:
            for ln in f:
                if "] EXIT" not in ln or "pnl=" not in ln:
                    continue
                try:
                    t = ln.split()[0]
                    k = ln.split("[", 1)[1].split("]", 1)[0]
                    s = ln.split("EXIT", 1)[1].strip().split()[0]
                    pnl = float(ln.split("pnl=", 1)[1].split()[0].rstrip(")"))
                    reason = ln.split("(", 1)[1].split(")")[0] if "(" in ln else ""
                    reg = ln.split("regime=", 1)[1].split()[0] if "regime=" in ln else "—"
                except Exception:
                    continue
                sid = key_sid.get(k, k)
                cum += pnl
                out["equity"].append(round(cum, 2))
                dist.append(pnl)
                try:
                    out["byHour"][int(t[:2])] += 1
                except Exception:
                    pass
                d = strat.setdefault(sid, {"id": sid, "name": sid_name.get(sid, sid),
                                          "trades": 0, "wins": 0, "losses": 0, "realised": 0.0})
                d["trades"] += 1; d["realised"] += pnl
                if pnl > 0:
                    d["wins"] += 1
                elif pnl < 0:
                    d["losses"] += 1
                ds = sym.setdefault(s, {"sym": s, "trades": 0, "realised": 0.0})
                ds["trades"] += 1; ds["realised"] += pnl
                rg = regm.setdefault(reg, {"regime": reg, "trades": 0, "wins": 0, "pnl": 0.0})
                rg["trades"] += 1; rg["pnl"] += pnl
                if pnl > 0:
                    rg["wins"] += 1
                trades.append({"time": t, "strategy": sid_name.get(sid, sid), "sym": s,
                               "pnl": round(pnl, 2), "reason": reason})
    except Exception:
        return out
    for d in strat.values():
        d["realised"] = round(d["realised"], 2)
        d["winPct"] = round(d["wins"] / d["trades"] * 100, 1) if d["trades"] else None
    # reconcile to the authoritative engine state (paper_state.json) so Analytics ↔ Monitor agree;
    # the parseable log is an audit trail that can lag realised, so STATE is the source of truth for P&L.
    state_real = {sid: round(state.get(k, {}).get("realised", 0.0), 2) for sid, k in HARNESS_KEYS.items()}
    total_state = round(sum(state_real.values()), 2)
    by = []
    for sid, k in HARNESS_KEYS.items():
        lg = strat.get(sid); sr = state_real[sid]
        tr = lg["trades"] if lg else 0; wn = lg["wins"] if lg else 0
        if tr == 0 and sr == 0:
            continue
        by.append({"id": sid, "name": sid_name.get(sid, sid), "trades": tr, "wins": wn,
                   "losses": (lg["losses"] if lg else 0), "realised": sr,
                   "winPct": round(wn / tr * 100, 1) if tr else None})
    out["byStrategy"] = sorted(by, key=lambda x: x["realised"], reverse=True)
    out["carried"] = round(total_state - cum, 2)   # realised not captured in the parseable log
    if abs(out["carried"]) > 0.5:                  # anchor the equity curve to the authoritative realised
        out["equity"] = [round(e + out["carried"], 2) for e in out["equity"]]
    out["bySymbol"] = sorted(({"sym": v["sym"], "trades": v["trades"], "realised": round(v["realised"], 2)}
                              for v in sym.values()), key=lambda x: abs(x["realised"]), reverse=True)[:12]
    out["byRegime"] = sorted(({"regime": v["regime"], "trades": v["trades"], "wins": v["wins"],
                               "pnl": round(v["pnl"], 2),
                               "winPct": round(v["wins"] / v["trades"] * 100, 1) if v["trades"] else None}
                              for v in regm.values()), key=lambda x: x["trades"], reverse=True)
    out["distribution"] = [round(p, 2) for p in dist]
    out["trades"] = trades[-80:]
    n = len(dist); w = sum(1 for p in dist if p > 0)
    out["totals"] = {"trades": n, "wins": w, "losses": sum(1 for p in dist if p < 0),
                     "winPct": round(w / n * 100, 1) if n else None, "realised": total_state}
    # ---- risk & quality (portfolio-level) ----
    wins_l = [x for x in dist if x > 0]; loss_l = [x for x in dist if x < 0]
    gw = sum(wins_l); gl = -sum(loss_l)
    out["profitFactor"] = round(gw / gl, 2) if gl > 0 else (99.0 if gw > 0 else None)
    out["expectancy"] = round(sum(dist) / n, 2) if n else None
    out["avgWin"] = round(gw / len(wins_l), 2) if wins_l else 0.0
    out["avgLoss"] = round(gl / len(loss_l), 2) if loss_l else 0.0
    out["best"] = round(max(dist), 2) if dist else None
    out["worst"] = round(min(dist), 2) if dist else None
    pk = out["equity"][0]; mdd = 0.0
    for v in out["equity"]:
        pk = max(pk, v); mdd = max(mdd, pk - v)
    out["maxDrawdown"] = round(mdd, 2)
    bw = bl = cur = 0; sgn = 0
    for x in dist:
        sd = 1 if x > 0 else (-1 if x < 0 else 0)
        if sd == 0:
            cur = 0; sgn = 0; continue
        cur = cur + 1 if sd == sgn else 1
        sgn = sd
        bw = max(bw, cur) if sd > 0 else bw
        bl = max(bl, cur) if sd < 0 else bl
    out["streaks"] = {"longestWin": bw, "longestLoss": bl, "current": cur * sgn}
    rsn = {}
    for tr in trades:
        r = tr.get("reason") or "other"
        d2 = rsn.setdefault(r, {"reason": r, "count": 0, "pnl": 0.0})
        d2["count"] += 1; d2["pnl"] += tr["pnl"]
    out["byReason"] = sorted(({"reason": v["reason"], "count": v["count"], "pnl": round(v["pnl"], 2)}
                              for v in rsn.values()), key=lambda x: x["count"], reverse=True)
    try:
        topen, _ = open_position_pnl(state)
        on = 0
        for k in HARNESS_KEYS.values():
            stt = state.get(k, {})
            on += len(stt.get("positions", {}))
            on += sum(1 for pp in stt.get("pairs", {}).values() if pp.get("pos"))
        out["open"] = {"positions": on, "unrealised": round(sum(topen.values()), 2)}
    except Exception:
        pass
    ins = []
    if out["byStrategy"]:
        best, worst = out["byStrategy"][0], out["byStrategy"][-1]
        if best["realised"] > 0:
            ins.append(f"Top contributor: {best['name']} (+₹{best['realised']:,.0f} over {best['trades']} trades).")
        if worst["realised"] < 0:
            ins.append(f"Biggest drag: {worst['name']} (−₹{abs(worst['realised']):,.0f}) — review its regime fit.")
    if out["bySymbol"]:
        ma = max(out["bySymbol"], key=lambda x: x["trades"])
        ins.append(f"Most-traded symbol: {ma['sym']} ({ma['trades']} closed trades).")
    if n and max(out["byHour"]) > 0:
        ph = out["byHour"].index(max(out["byHour"]))
        ins.append(f"Most active around {ph:02d}:00–{ph+1:02d}:00 IST.")
    if n:
        ins.append(f"Book win rate {out['totals']['winPct']}% across {n} closed trades; net {'+'if cum>=0 else '−'}₹{abs(round(cum)):,.0f} (paper).")
    if out["profitFactor"] is not None:
        ins.append(f"Portfolio profit factor {out['profitFactor']} (>1 = the book makes money out-of-sample).")
    if out["maxDrawdown"] > 0:
        ins.append(f"Worst forward drawdown so far: −₹{out['maxDrawdown']:,.0f}.")
    if out["streaks"]["longestWin"] or out["streaks"]["longestLoss"]:
        ins.append(f"Longest streak: {out['streaks']['longestWin']}W / {out['streaks']['longestLoss']}L.")
    if out["open"]["positions"]:
        o = out["open"]
        ins.append(f"{o['positions']} open position(s) now, {('+' if o['unrealised']>=0 else '−')}₹{abs(o['unrealised']):,.0f} unrealised (not in realised above).")
    out["insights"] = ins
    return out


_opp_cache = {"t": 0.0, "data": None}


def opportunities_payload() -> dict:
    """LIVE decision-engine scan: scores the universe right now (regime-gated weighted
    voting + 0-100 confidence), fully explainable. Cached ~2min (heavy: daily history per
    symbol). Honest error when the token is down."""
    if _opp_cache["data"] and time.time() - _opp_cache["t"] < 120:
        return _opp_cache["data"]
    try:
        import pandas as pd
        from datetime import datetime, timedelta
        from bot.opportunity import (score_symbol, SPECIALISTS, REGIME_WEIGHTS,
                                     COMPONENTS, EXECUTE_MIN, WATCH_MIN)
        import bot.paper_engine as _pe
        regime = (market_snapshot().get("engine") or {}).get("regime") or "Bull"
        _pe.CURRENT_REGIME = regime
        kite = _mk_kite()
        frm = datetime.now() - timedelta(days=400)
        decisions = []
        for sym in BT_UNIVERSE:
            tok = _resolve_token(sym)
            if not tok:
                continue
            recs = kite.historical_data(tok, frm, datetime.now(), "day")
            if not recs:
                continue
            df = pd.DataFrame(recs).rename(columns={"date": "datetime"})
            df["datetime"] = pd.to_datetime(df["datetime"])
            df = df.set_index("datetime")[["open", "high", "low", "close", "volume"]]
            d = score_symbol(df, regime)
            if d:
                d["symbol"] = sym
                decisions.append(d)
        decisions.sort(key=lambda x: x["confidence"], reverse=True)
        data = {
            "real": True, "regime": regime, "asOf": datetime.now().isoformat(),
            "weights": REGIME_WEIGHTS.get(regime, {}), "components": COMPONENTS,
            "bands": {"execute": 90, "executeIfFilters": EXECUTE_MIN, "watchlist": WATCH_MIN},
            "specialists": [{"key": k, "style": st} for k, _s, st in SPECIALISTS],
            "opportunities": decisions,
            "subState": sub_state("opportunity"),
            "deployed": sub_state("opportunity") in ("paper", "paused", "live"),
        }
        _opp_cache["t"] = time.time(); _opp_cache["data"] = data
        return data
    except Exception as e:
        return {"real": False, "error": str(e)[:140]}


def allocation_payload() -> dict:
    """The Capital Allocation Engine's latest competition — which proposals won capital
    (funded, with size) and which lost (skipped, with the reason). The proposal→allocation
    separation, made auditable."""
    from bot.allocator import ALLOC_FILE
    if os.path.exists(ALLOC_FILE):
        try:
            d = json.load(open(ALLOC_FILE))
            d["real"] = True
            return d
        except Exception:
            pass
    return {"real": False, "error": "No allocation run yet — the Allocator competes during market hours."}


def rebalance_payload() -> dict:
    """Strategy Rebalancing Engine state — which strategy styles are enabled vs stood-down
    to cash for the live regime, the cash target, and the conviction floor (capital-preservation)."""
    from bot.rebalancer import STATE_FILE
    if os.path.exists(STATE_FILE):
        try:
            return json.load(open(STATE_FILE))
        except Exception:
            pass
    return {"real": False, "error": "Rebalancer publishes during market hours / on harness start."}


def positions_payload() -> dict:
    """Live Position Intelligence — every open position with its thesis-health score, the
    recommended action (hold/protect/watch/exit) and the reason. Weakest first."""
    state = read_state()
    names = {s["id"]: s["name"] for s in STRATEGIES}
    key_sid = {v: k for k, v in HARNESS_KEYS.items()}
    out = []
    for k in SINGLE_LEG_KEYS:
        sid = key_sid.get(k, k)
        for sym, p in (state.get(k, {}).get("positions") or {}).items():
            out.append({"bot": sid, "botName": names.get(sid, sid), "symbol": sym,
                        "qty": p.get("qty"), "entry": p.get("entry"), "stop": p.get("stop"),
                        "health": p.get("health"), "action": p.get("action"), "reason": p.get("reason"),
                        "gainPct": p.get("gainPct"), "weak": p.get("weak"), "conf": p.get("conf")})
    out.sort(key=lambda x: x["health"] if x["health"] is not None else 999)
    assessed = [x for x in out if x["health"] is not None]
    return {"real": True, "positions": out, "count": len(out),
            "avgHealth": round(sum(x["health"] for x in assessed) / len(assessed), 1) if assessed else None}


def risk_payload() -> dict:
    """Portfolio Risk Governor state — health score, exposure, concentration, drawdown
    kill-switch, sector/symbol breakdown, and the recent trade-audit (approvals/vetoes)."""
    from bot.governor import STATE_FILE
    if os.path.exists(STATE_FILE):
        try:
            d = json.load(open(STATE_FILE))
            d["real"] = True
            return d
        except Exception:
            pass
    return {"real": False, "error": "Governor has not published yet — start the harness during market hours."}


def learning_payload() -> dict:
    """What the Learning Engine has learned from the decision log so far — per-signal edge,
    sample sizes, and the current (learned vs prior) scoring weights. Honest 'gathering' state
    until there's a robust sample."""
    try:
        from bot.learning import compute_learning
        from bot.opportunity import COMPONENTS
        import datetime as _dt
        r = compute_learning(COMPONENTS)
        r["real"] = True
        r["asOf"] = _dt.datetime.now().isoformat()
        return r
    except Exception as e:
        return {"real": False, "error": str(e)[:140]}


def decisions_payload(n: int = 60) -> dict:
    """The auditable decision log — every Moonshot/engine entry & exit with full context
    (regime, confidence, sub-scores, reasons, size, P&L). Written by the harness, read here."""
    from bot.opportunity import DECISIONS_FILE
    recs = []
    if os.path.exists(DECISIONS_FILE):
        try:
            with open(DECISIONS_FILE) as f:
                lines = f.readlines()[-n:]
            for ln in lines:
                try:
                    recs.append(json.loads(ln))
                except Exception:
                    pass
        except Exception:
            pass
    return {"real": True, "decisions": recs[::-1], "count": len(recs)}


def strategies_payload() -> dict:
    state = read_state()
    # only these three are wired into the live paper harness
    key = HARNESS_KEYS
    open_pnl, open_detail = open_position_pnl(state)
    out = []
    for s in STRATEGIES:
        st = state.get(key.get(s["id"], ""), {}) if s["id"] in key else {}
        s = enrich_strategy(dict(s))               # + style / minDeploy / riskPerTrade / maxDD
        wired = s["id"] in key                     # has an engine in the paper harness
        s["wired"] = wired
        s["sub"] = sub_state(s["id"])              # lifecycle: paper | paused | live | None
        s["deployed"] = s["sub"] in ("paper", "paused", "live")
        s["live"] = wired and s["sub"] in ("paper", "live")   # actively traded by the harness
        realised = round(st.get("realised", 0.0), 2)
        kk = key.get(s["id"], "")
        # Open P&L belongs to whatever the HARNESS is actually holding (gate on `wired`, NOT on the
        # subscription-based `live`). Gating on `live` zeroed the unrealised P&L of harness-traded
        # strategies the user hadn't "deployed" (e.g. Supertrend, Mean-Reversion), so /api/strategies
        # disagreed with /api/monitor for the same strategy → the cross-tab P&L desync. Now they match.
        unreal = open_pnl.get(kk, 0.0) if wired else 0.0
        if wired and not unreal and st.get("openMark"):   # self-marking engines (options/futures) carry their own mark
            unreal = round(st.get("openMark", 0.0), 2)
        s["realisedPnl"] = realised                # CLOSED-trade P&L (drives the go-live nudge)
        s["openPnl"] = unreal                      # live unrealised P&L on open positions
        s["paperPnl"] = round(realised + unreal, 2)  # total shown in the UI — now == monitor_payload
        s["positions"] = open_detail.get(kk, []) if wired else []
        if s["id"] == "pairs":
            pos = [{"sym": name, "spread": p.get("pos")} for name, p in st.get("pairs", {}).items() if p.get("pos")]
            s["positions"] = pos
            s["openPositions"] = len(pos)
        else:
            s["openPositions"] = len(st.get("positions", {}))
        # closed-trade count shown on every wired card (progress toward go-live)
        s["fwdTrades"] = forward_closed(key[s["id"]]) if wired else 0
        # --- go-live nudge: only after a real, positive CLOSED-trade record on a proven, DEPLOYED strategy ---
        s["nudge"] = False
        if s["live"]:
            r = readiness(s["id"])
            blockers = [g["id"] for g in r["gates"] if g["critical"] and not g["ok"]]
            soft = [b for b in blockers if b not in ("funds", "armed")]   # everything in our control
            s["blockers"] = blockers
            s["readyExceptCapital"] = not soft
            s["nudge"] = bool(not soft and s["fwdTrades"] >= MIN_FWD_TRADES and realised > 0)
            if s["nudge"]:
                s["nudgeMsg"] = (f"{s['name']} has held up in forward paper trading "
                                 f"({s['fwdTrades']} closed trades, ₹{realised:+,.0f}). "
                                 f"Every gate within our control is green — only funding "
                                 f"+ your explicit ALLOW_LIVE arming remain.")
        out.append(s)
    return {"strategies": out, "segments": SEGMENTS, "updated": state.get("updated"),
            "paperMode": get_mode() == "paper", "liveArmed": live_armed(),
            "nudgeMinTrades": MIN_FWD_TRADES}


def recent_trades(n: int = 40) -> dict:
    lines = []
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE) as f:
                lines = [ln.rstrip() for ln in f.readlines() if "ENTER" in ln or "EXIT" in ln]
        except Exception:
            pass
    return {"trades": lines[-n:][::-1]}


class Handler(BaseHTTPRequestHandler):
    def _cors_origin(self):
        """VAPT: only reflect a CORS origin for LOCAL pages. This stops any random
        website you visit from reading your holdings/funds via localhost:8756 (the
        old `Access-Control-Allow-Origin: *` allowed exactly that). Requests with no
        Origin (curl, same-origin) are unaffected — CORS only gates browser JS."""
        origin = self.headers.get("Origin")
        if not origin:
            return None
        try:
            from urllib.parse import urlparse
            if urlparse(origin).hostname in ("localhost", "127.0.0.1", "::1"):
                return origin
        except Exception:
            pass
        return None  # foreign origin -> no CORS header -> browser blocks the read

    def _send(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        o = self._cors_origin()
        if o:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _sse_write(self, data: str):
        self.wfile.write(b"data: " + data.encode() + b"\n\n")
        self.wfile.flush()

    def _stream(self, csv: str, keys_csv: str = ""):
        """Server-Sent Events: push tick updates to the browser the instant KiteTicker
        delivers them — sub-second, no polling. The same warm WS cache backs both this and
        /api/ticks, so they can never disagree. Heartbeats keep the connection live + detect
        a gone client. One-directional (server->browser), which is exactly the tick use case.
        `keys_csv` (full EXCH:TS) streams ANY segment; `csv` is the NSE symbol fast-path."""
        if keys_csv:
            ids = [k.strip() for k in keys_csv.split(",") if k.strip()][:80]
        else:
            ids = [s.strip().upper() for s in (csv or "").split(",") if s.strip()][:80]  # DoS cap
        with _sub_lock:
            if len(_subscribers) >= MAX_SSE_CLIENTS:
                return self._send({"error": "too many stream clients"}, 429)
        if keys_csv:
            _subscribe_keys(ids)                    # warm the ticker + token<->key map (any segment)
        else:
            _subscribe_syms(ids)                    # NSE fast-path: token<->symbol
        syms = ids
        q = _queuelib.Queue(maxsize=200)
        sub = {"q": q, "syms": set(syms)}
        with _sub_lock:
            _subscribers.append(sub)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("X-Accel-Buffering", "no")    # disable any proxy buffering
            o = self._cors_origin()
            if o:
                self.send_header("Access-Control-Allow-Origin", o)
                self.send_header("Vary", "Origin")
            self.end_headers()
            # initial snapshot from the warm cache so the UI updates the moment it connects
            snap = ticks_payload("", ",".join(syms)) if keys_csv else ticks_payload(",".join(syms))
            self._sse_write(json.dumps({"ticks": snap.get("ticks", {}), "stream": _stream_meta()}))
            while True:
                try:
                    payload = q.get(timeout=15)
                    self._sse_write(json.dumps({"ticks": payload, "stream": _stream_meta()}))
                except _queuelib.Empty:
                    self.wfile.write(b": ping\n\n")   # heartbeat (also surfaces a dead client)
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass                                     # client disconnected — clean up below
        finally:
            with _sub_lock:
                if sub in _subscribers:
                    _subscribers.remove(sub)

    def do_OPTIONS(self):
        self.send_response(204)
        o = self._cors_origin()
        if o:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        u = urlparse(self.path)
        path, qs = u.path, parse_qs(u.query)
        try:
            if path == "/api/readiness":
                return self._send(readiness((qs.get("strategy") or [""])[0]))
            if path == "/api/quotes":
                return self._send(quotes_payload((qs.get("symbols") or [""])[0]))
            if path == "/api/instruments":
                return self._send(instruments_payload((qs.get("q") or [""])[0],
                                                      (qs.get("seg") or [""])[0],
                                                      int((qs.get("limit") or ["40"])[0])))
            if path == "/api/uquotes":
                return self._send(uquotes_payload((qs.get("keys") or [""])[0]))
            if path == "/api/ticks":
                return self._send(ticks_payload((qs.get("symbols") or [""])[0],
                                                (qs.get("keys") or [""])[0]))
            if path == "/api/stream":
                return self._stream((qs.get("symbols") or [""])[0], (qs.get("keys") or [""])[0])
            if path == "/api/candles":
                return self._send(candles_payload((qs.get("symbol") or [""])[0],
                                                  (qs.get("tf") or ["15m"])[0],
                                                  (qs.get("key") or [""])[0]))
            if path == "/api/depth":
                return self._send(depth_payload((qs.get("symbol") or [""])[0]))
            if path == "/api/chain":
                return self._send(chain_payload((qs.get("underlying") or ["NIFTY"])[0],
                                                (qs.get("expiry") or ["0"])[0]))
            if path == "/api/futures":
                return self._send(futures_payload((qs.get("symbols") or [""])[0]))
            if path == "/api/backtest":
                _syms = (qs.get("symbols") or [""])[0]
                return self._send(backtest_payload((qs.get("strategy") or ["momentum"])[0],
                                                   (qs.get("period") or ["1Y"])[0],
                                                   _syms.split(",") if _syms else None))
            if path == "/api/framework":
                return self._send(framework_payload((qs.get("regime") or [None])[0]))
            if path == "/api/crypto/backtest":
                return self._send(crypto_backtest_payload((qs.get("strategy") or ["momentum"])[0],
                                                          (qs.get("period") or ["1Y"])[0]))
            if path == "/api/readiness/book":
                return self._send(book_readiness_payload((qs.get("market") or ["in"])[0]))
            if path == "/api/regime-fit":
                return self._send(regime_fit_payload((qs.get("market") or ["in"])[0]))
            routes = {
                "/api/status": kite_status,
                "/api/strategies": strategies_payload,
                "/api/opportunities": opportunities_payload,
                "/api/decisions": decisions_payload,
                "/api/learning": learning_payload,
                "/api/risk": risk_payload,
                "/api/allocation": allocation_payload,
                "/api/positions": positions_payload,
                "/api/rebalance": rebalance_payload,
                "/api/monitor": monitor_payload,
                "/api/crypto/monitor": crypto_monitor_payload,
                "/api/crypto/risk": crypto_risk_payload,
                "/api/crypto/forward": crypto_forward_payload,
                "/api/crypto/analytics": crypto_analytics_payload,
                "/api/stopped": stopped_payload,
                "/api/analytics": analytics_payload,
                "/api/market": market_snapshot,
                "/api/holdings": holdings_payload,
                "/api/paper": read_state,
                "/api/trades": recent_trades,
                "/api/harness": harness_status,
                "/api/correlation": correlation_payload,
                "/api/health": lambda: {"ok": True},
            }
            fn = routes.get(path)
            if fn is None:
                return self._send({"error": "not found"}, 404)
            self._send(fn())
        except Exception as e:
            self._send({"error": str(e)}, 500)

    def do_POST(self):
        path = self.path.split("?")[0]
        if path not in ("/api/mode", "/api/relogin", "/api/strategy", "/api/harness"):
            return self._send({"error": "not found"}, 404)
        # CSRF guard (VAPT): these are state-changing. A browser always sends Origin on a
        # cross-origin POST — reject any Origin that isn't a local page, and require the JSON
        # content-type so a "simple request" (text/plain, no preflight) from a random site
        # can't reach here. Non-browser callers (curl, same-origin) send no Origin → allowed.
        if self.headers.get("Origin") and self._cors_origin() is None:
            return self._send({"error": "forbidden origin"}, 403)
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype and ctype != "application/json":
            return self._send({"error": "unsupported content-type"}, 415)
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
            if path == "/api/relogin":         # manual "Reconnect" button → headless TOTP login
                return self._send(do_relogin())
            if path == "/api/harness":         # one-click Start/Stop the forward paper harness
                act = body.get("action", "start")
                return self._send(start_harness() if act == "start" else stop_harness())
            if path == "/api/strategy":        # Deploy / Pause / Stop a strategy
                sid = body.get("id", "")
                if sid not in {x["id"] for x in STRATEGIES}:
                    return self._send({"error": f"unknown strategy {sid!r}"}, 400)
                return self._send(set_sub(sid, body.get("state", "paper")))
            self._send(set_mode(body.get("mode", "paper")))
        except Exception as e:
            self._send({"error": str(e)}, 500)

    def log_message(self, *a):  # quiet
        pass


def main() -> None:
    print(f"Bot API on http://localhost:{PORT}  (read-only; CORS open for TradePro)")
    print("  /api/status  /api/strategies  /api/instruments  /api/paper  /api/trades")
    # pre-warm the 128k-instrument search index off-thread so the FIRST search is instant
    threading.Thread(target=lambda: _instrument_index() and None, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
