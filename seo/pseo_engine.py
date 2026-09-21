#!/usr/bin/env python3
"""Programmatic SEO engine for zengtrade.

Generates 15,000 high-intent pre-login landing pages:
  - 7,500 Strategy x Coin pages (/strategies/{strategy}/{coin}/)
  - 6,000 Indicator x Coin pages (/indicators/{indicator}/{coin}/)
  - 1,500 Regime x Coin pages (/regimes/{regime}/{coin}/)
Plus the /sitemap/ interactive HTML portal and partitioned XML sitemaps.
"""
from __future__ import annotations
import html
import json
import os
from concurrent.futures import ThreadPoolExecutor

SITE = "https://zengtrade.in"

STRATEGIES = [
    {
        "slug": "supertrend-breakout",
        "name": "Supertrend Volatility Breakout",
        "category": "Trend Momentum",
        "regime_fit": "Bull & High-Volatility Regimes",
        "holding_period": "2 to 7 days",
        "risk_reward": "1:2.2",
        "math_formula": "Upper Band = (High + Low)/2 + (Multiplier * ATR), Lower Band = (High + Low)/2 - (Multiplier * ATR)",
        "summary": "Captures high-velocity expansion waves using an Average True Range trailing stop band to protect accumulated profit while riding sustained directional runs.",
        "entry_rule": "Enter long when close crosses above the 10-period ATR Supertrend upper band with 24h volume exceeding the 20-day moving average.",
        "exit_rule": "Exit when price closes below the dynamic trailing stop line or when the 1:2.2 profit bracket target is reached.",
        "cost_note": "Requires liquid order books. Slippage on volatile breakouts averages 4 to 8 bps on Binance spot pairs."
    },
    {
        "slug": "dual-ema-cross",
        "name": "Dual EMA Golden Cross (50/200)",
        "category": "Trend Following",
        "regime_fit": "Bull Trend Regimes",
        "holding_period": "1 to 4 weeks",
        "risk_reward": "1:2.5",
        "math_formula": "EMA_t = Price_t * (2 / (N + 1)) + EMA_{t-1} * (1 - (2 / (N + 1)))",
        "summary": "Identifies macro structural shifts by filtering out lower-timeframe noise and waiting for exponential moving average confirmation across intermediate and secular cycles.",
        "entry_rule": "Execute long when the 50 EMA crosses above the 200 EMA with consecutive 4h candle closes above both moving averages.",
        "exit_rule": "Stand down into cash when the 50 EMA crosses below the 200 EMA (Death Cross) or when price drops 3% below the 200 EMA.",
        "cost_note": "Low turnover strategy. Expected round-trip fee friction is below 15 bps per month."
    },
    {
        "slug": "bollinger-mean-reversion",
        "name": "Bollinger Band Mean Reversion",
        "category": "Mean Reversion",
        "regime_fit": "Neutral & Range-Bound Regimes",
        "holding_period": "12 to 48 hours",
        "risk_reward": "1:1.8",
        "math_formula": "Band = SMA(20) +/- 2.0 * StandardDeviation(20)",
        "summary": "Exploits statistical overextension in non-trending markets by anticipating rapid reversion back toward the 20-period volume-weighted mean price.",
        "entry_rule": "Trigger buy when price pierces the lower 2.0-sigma band and forms a bullish hammer or RSI bullish reversal candle.",
        "exit_rule": "Take profit upon touch of the middle 20 SMA line; hard stop loss anchored 0.5 sigma below the recent swing low.",
        "cost_note": "High precision required. Avoid trading immediately prior to scheduled token unlocks or protocol upgrades."
    },
    {
        "slug": "funding-rate-arbitrage",
        "name": "Delta-Neutral Funding Rate Cash & Carry",
        "category": "Arbitrage",
        "regime_fit": "All Regimes (High Perp Premium)",
        "holding_period": "3 to 30 days",
        "risk_reward": "Market Neutral (Yield Edge)",
        "math_formula": "Net APR = 3 * 365 * FundingRate_8h - 2 * RoundTripTradingFees",
        "summary": "Captures perpetual futures funding yields by maintaining a spot long position balanced by an equal-sized short perpetual contract.",
        "entry_rule": "Deploy position when the annualized 8-hour funding rate yields at least 15% net of round-trip trading fees and basis spread.",
        "exit_rule": "Unwind legs when funding rate flips negative or drops below the 4% minimum threshold for 3 consecutive intervals.",
        "cost_note": "Requires dual-leg execution. Watch liquidation risk on the short perpetual leg during sudden upward squeezes."
    },
    {
        "slug": "dynamic-dca-grid",
        "name": "Volatility-Scaled Dynamic DCA",
        "category": "Accumulation",
        "regime_fit": "Bear Accumulation & Neutral Regimes",
        "holding_period": "Ongoing / Multi-month",
        "risk_reward": "Long-term Value",
        "math_formula": "DCA_OrderSize = BaseAllocation * (1 + NormalizedDistanceBelow200EMA * VolatilityMultiplier)",
        "summary": "Systematically increases purchase size as market price drops deeper below fair-value moving averages, avoiding emotional early exhaustion.",
        "entry_rule": "Place programmatic scale-in orders at predetermined ATR steps below the 30-day volume-weighted average price.",
        "exit_rule": "Gradually scale out 25% tranches at +15%, +30%, and +50% above the aggregate volume-weighted average entry price.",
        "cost_note": "Multiple limit order fills reduce fee burden to maker rates (0 to 2 bps) on standard tier accounts."
    },
    {
        "slug": "macd-divergence",
        "name": "MACD Histogram Exhaustion Divergence",
        "category": "Momentum Reversal",
        "regime_fit": "Trend Exhaustion / Transition Regimes",
        "holding_period": "1 to 5 days",
        "risk_reward": "1:2.4",
        "math_formula": "MACD = EMA(12) - EMA(26); Signal = EMA(9, MACD); Histogram = MACD - Signal",
        "summary": "Detects institutional order book exhaustion by spotting divergences where price sets a lower low while oscillator momentum prints a higher low.",
        "entry_rule": "Confirm bullish divergence on the 4-hour chart coupled with a MACD histogram tick flip into positive territory.",
        "exit_rule": "Target the recent swing high or exit upon bearish histogram contraction after reaching +2.4 R:R.",
        "cost_note": "False breakouts occur during strong trending impulses. Always mandate ATR-based hard stop losses."
    },
    {
        "slug": "multitimeframe-rsi",
        "name": "Multi-Timeframe RSI Confluence Swing",
        "category": "Swing Trading",
        "regime_fit": "Bull Pullback & Neutral Regimes",
        "holding_period": "1 to 3 days",
        "risk_reward": "1:2.0",
        "math_formula": "RSI = 100 - (100 / (1 + RS)), where RS = AverageGain / AverageLoss",
        "summary": "Pairs daily trend direction with 1-hour oversold pullbacks to enter high-probability continuations at favorable risk-reward inflection points.",
        "entry_rule": "Daily 50 EMA is sloping upward AND 1-hour RSI drops below 32 and crosses back above 35 with volume confirmation.",
        "exit_rule": "Exit when 1-hour RSI crosses above 70 or price achieves a 1:2.0 risk-reward expansion.",
        "cost_note": "Tight stop loss minimizes downside exposure to less than 1.5% of trade equity per execution."
    },
    {
        "slug": "vwap-institutional-pullback",
        "name": "VWAP Mean Reversion & Pullback",
        "category": "Intraday Trend",
        "regime_fit": "Bull & High-Volume Regimes",
        "holding_period": "4 to 24 hours",
        "risk_reward": "1:1.9",
        "math_formula": "VWAP = Sum(Price * Volume) / Sum(Volume)",
        "summary": "Monitors benchmark volume-weighted prices utilized by institutional algorithms to enter on healthy intraday pullbacks.",
        "entry_rule": "Price trades above daily VWAP, retraces to test the VWAP line from above, and confirms with a 15-minute bullish bounce candle.",
        "exit_rule": "Target upper 1.5 standard deviation VWAP band; stop loss anchored immediately below VWAP line.",
        "cost_note": "Best deployed during active Asian and European overlap hours when volume concentration peaks."
    },
    {
        "slug": "liquidity-sweep",
        "name": "Order Flow Liquidity Sweep",
        "category": "Price Action",
        "regime_fit": "Range-Bound & High-Volatility Regimes",
        "holding_period": "2 to 18 hours",
        "risk_reward": "1:2.8",
        "math_formula": "Sweep = High > PriorSwingHigh AND Close < PriorSwingHigh (Bearish) / Low < PriorSwingLow AND Close > PriorSwingLow (Bullish)",
        "summary": "Capitalizes on stop-loss hunting by identifying rapid sweeps beyond obvious support or resistance levels followed by aggressive reclaim candles.",
        "entry_rule": "Enter long immediately following a 15-minute candle that breaches equal lows and sharply closes back inside the prior trading range.",
        "exit_rule": "Target opposing liquidity pool at the range high; stop loss placed 5 bps beyond the sweep wick extreme.",
        "cost_note": "Requires fast execution engine. Limit orders on retest are preferred over market execution to minimize slippage."
    },
    {
        "slug": "arithmetic-grid",
        "name": "Range-Bound Arithmetic Grid",
        "category": "Market Making",
        "regime_fit": "Neutral Consolidation Regimes",
        "holding_period": "3 to 14 days",
        "risk_reward": "Systematic Yield",
        "math_formula": "GridSpacing = (UpperLimit - LowerLimit) / GridLevels",
        "summary": "Deploys a ladder of alternating limit buy and sell orders across a well-defined horizontal consolidation range.",
        "entry_rule": "Deploy automated grid when 14-day ADX reads below 20 and Bollinger Band width is in the bottom 25th percentile.",
        "exit_rule": "Stop-out if market breaks cleanly outside range boundaries with sustained 4-hour volume expansion.",
        "cost_note": "High transaction frequency. Ensure exchange maker tier rebates or zero-fee pairs are utilized."
    },
    {
        "slug": "volume-breakout",
        "name": "Volume-Confirmed Range Breakout",
        "category": "Momentum Breakout",
        "regime_fit": "Regime Transition & Bull Breakouts",
        "holding_period": "1 to 5 days",
        "risk_reward": "1:2.6",
        "math_formula": "Breakout = Close > Resistance20D AND Volume > 2.5 * VolumeSMA(20)",
        "summary": "Eliminates low-liquidity false breakouts by mandating a minimum 2.5x volume surge when clearing multi-week resistance levels.",
        "entry_rule": "Buy stop order triggered when price breaks 20-day high accompanied by real-time volume surpassing the 20-day moving average.",
        "exit_rule": "Trail stop loss at 2x ATR below highest high reached post-breakout.",
        "cost_note": "Watch for sudden slippage during breakout moments. Use limit-if-touched orders where possible."
    },
    {
        "slug": "parabolic-sar",
        "name": "Parabolic SAR Trailing Momentum",
        "category": "Trend Following",
        "regime_fit": "Strong Bull & Bear Trends",
        "holding_period": "3 to 10 days",
        "risk_reward": "1:2.1",
        "math_formula": "SAR_{t+1} = SAR_t + AF * (EP - SAR_t), Acceleration Factor AF = 0.02 to 0.20",
        "summary": "Calculates an accelerating trailing stop loss that tightens dynamically as the asset moves favorably into new price extremes.",
        "entry_rule": "Enter long when SAR dots switch from above price candles to below price candles on the 4-hour timeframe.",
        "exit_rule": "Exit position the moment an active candle touches the current SAR dot value.",
        "cost_note": "Generates whipsaws in consolidating sideways markets. Only activate when ADX confirms trend strength > 25."
    },
    {
        "slug": "keltner-squeeze",
        "name": "Keltner Channel Volatility Squeeze",
        "category": "Volatility Expansion",
        "regime_fit": "Pre-Breakout Consolidation",
        "holding_period": "2 to 6 days",
        "risk_reward": "1:2.5",
        "math_formula": "Squeeze = BollingerUpper < KeltnerUpper AND BollingerLower > KeltnerLower",
        "summary": "Detects energy compression phases where Bollinger Bands contract entirely inside Keltner Channels, signaling an imminent violent expansion.",
        "entry_rule": "Enter upon first momentum histogram bar expanding outward following a squeeze duration of at least 6 consecutive bars.",
        "exit_rule": "Close position when momentum histogram changes color or when trailing ATR stop is triggered.",
        "cost_note": "Squeeze resolution can be sharp. Bracket orders should be armed prior to breakout candle close."
    },
    {
        "slug": "ichimoku-cloud-breakout",
        "name": "Ichimoku Cloud Kumo Breakout",
        "category": "Comprehensive Trend",
        "regime_fit": "Emerging Bull Trends",
        "holding_period": "4 to 14 days",
        "risk_reward": "1:2.3",
        "math_formula": "Tenkan = (Highest9 + Lowest9)/2; Kijun = (Highest26 + Lowest26)/2; SenkouA = (Tenkan + Kijun)/2",
        "summary": "Demands multi-point trend equilibrium verification: Tenkan/Kijun cross, Kumo Cloud clearance, and lagging Chikou Span confirmation.",
        "entry_rule": "Price closes above the Kumo Cloud, Tenkan-sen crosses above Kijun-sen, and Chikou Span is clear of historical price candles.",
        "exit_rule": "Exit when price breaches back beneath the Kijun-sen (baseline) on a 1-day candle close.",
        "cost_note": "Excellent trend filter that avoids choppy chop periods at the expense of slightly delayed entries."
    },
    {
        "slug": "relative-strength-alpha",
        "name": "Relative Strength Momentum Rotation",
        "category": "Relative Alpha",
        "regime_fit": "Altcoin Season & Macro Rotation",
        "holding_period": "1 to 3 weeks",
        "risk_reward": "Alpha vs BTC",
        "math_formula": "RS = (AssetPrice_t / AssetPrice_{t-30}) / (BTCPrice_t / BTCPrice_{t-30})",
        "summary": "Identifies high-beta outperforming altcoins displaying structural alpha against Bitcoin during market expansion regimes.",
        "entry_rule": "Asset 30-day relative strength exceeds 1.20 and daily volume ranks in the top quartile of Binance spot pairs.",
        "exit_rule": "Rotate capital into stablecoins or BTC when 7-day relative momentum decelerates below parity (1.00).",
        "cost_note": "Rebalancing costs apply during sector rotations. Maintain disciplined trade frequency."
    }
]

INDICATORS = [
    {
        "slug": "rsi",
        "name": "Relative Strength Index (RSI)",
        "type": "Momentum Oscillator",
        "range_spec": "0 to 100",
        "standard_lookback": "14 Periods",
        "oversold_level": "30",
        "overbought_level": "70",
        "formula": "RSI = 100 - (100 / (1 + RS)), RS = Average Gain / Average Loss",
        "interpretation": "Evaluates the speed and magnitude of recent price shifts to identify overextended momentum and divergence setups.",
        "best_practice": "Look for bullish divergences at oversold boundaries during structural bull regimes rather than blindly buying sub-30 dips."
    },
    {
        "slug": "macd",
        "name": "Moving Average Convergence Divergence (MACD)",
        "type": "Trend Momentum",
        "range_spec": "Oscillates around Zero Line",
        "standard_lookback": "12, 26, 9 EMA",
        "oversold_level": "Deep Negative Divergence",
        "overbought_level": "Extended Positive Divergence",
        "formula": "MACD Line = 12 EMA - 26 EMA; Signal Line = 9 EMA of MACD; Histogram = MACD - Signal",
        "interpretation": "Combines trend-following moving averages with oscillator momentum to capture acceleration and deceleration phases.",
        "best_practice": "Filter signal line crosses by the zero line: only take bullish crosses when MACD is above zero in uptrends."
    },
    {
        "slug": "supertrend",
        "name": "Supertrend Indicator",
        "type": "Volatility Trailing Stop",
        "range_spec": "Dynamic Price Band",
        "standard_lookback": "10 Period ATR, Multiplier 3.0",
        "oversold_level": "Price Touch of Lower Band",
        "overbought_level": "Price Touch of Upper Band",
        "formula": "Band = (High + Low)/2 +/- 3.0 * ATR(10)",
        "interpretation": "Provides unambiguous directional bias and trailing stop loss lines based on underlying asset volatility.",
        "best_practice": "Use as a trailing profit-protection mechanism rather than an early entry signal to let winners run."
    },
    {
        "slug": "bollinger-bands",
        "name": "Bollinger Bands",
        "type": "Volatility & Range Envelope",
        "range_spec": "Price Channel (+/- 2 Sigma)",
        "standard_lookback": "20 SMA, 2.0 Standard Deviations",
        "oversold_level": "Lower Band Contact (< 2 Sigma)",
        "overbought_level": "Upper Band Contact (> 2 Sigma)",
        "formula": "Upper = SMA(20) + 2 * StdDev(20); Lower = SMA(20) - 2 * StdDev(20)",
        "interpretation": "Adapts dynamically to market expansion and contraction; 95% of price distribution statistically resides within the bands.",
        "best_practice": "Look for band squeezes (width contraction) to prepare for high-conviction breakout trades."
    },
    {
        "slug": "ema-200",
        "name": "200-Period Exponential Moving Average",
        "type": "Secular Trend Filter",
        "range_spec": "Continuous Trend Line",
        "standard_lookback": "200 Periods (Daily / 4H)",
        "oversold_level": "Deep Discount Below 200 EMA",
        "overbought_level": "Extended Premium Above 200 EMA",
        "formula": "EMA_t = (Price_t * (2 / 201)) + (EMA_{t-1} * (1 - (2 / 201)))",
        "interpretation": "The institutional barometer dividing macro bull market regimes from protracted bear trends.",
        "best_practice": "Only take long continuation trades when market price resides comfortably above the upward-sloping 200 EMA."
    },
    {
        "slug": "vwap",
        "name": "Volume-Weighted Average Price (VWAP)",
        "type": "Benchmark Valuation",
        "range_spec": "Intraday & Rolling Valuation Line",
        "standard_lookback": "Session Anchor (Daily / Weekly)",
        "oversold_level": "Lower Standard Deviation Bands",
        "overbought_level": "Upper Standard Deviation Bands",
        "formula": "VWAP = Sum(Volume * TypicalPrice) / Sum(Volume)",
        "interpretation": "Represents the true average price paid per token weighted across institutional volume execution.",
        "best_practice": "Institutions use VWAP as an execution benchmark; treat tests of VWAP from above as high-liquidity support."
    },
    {
        "slug": "atr",
        "name": "Average True Range (ATR)",
        "type": "Volatility Quantifier",
        "range_spec": "Absolute Currency Value (Points)",
        "standard_lookback": "14 Periods",
        "oversold_level": "Volatility Compression",
        "overbought_level": "Volatility Climax Spike",
        "formula": "TR = Max(High - Low, |High - PriorClose|, |Low - PriorClose|); ATR = MovingAverage(TR, 14)",
        "interpretation": "Measures absolute market volatility without directional bias, essential for sizing defensive stops.",
        "best_practice": "Always anchor stop losses to multiples of ATR (e.g. 1.5x ATR) instead of arbitrary percentage distances."
    },
    {
        "slug": "stochastic",
        "name": "Stochastic Oscillator",
        "type": "Range Location Momentum",
        "range_spec": "0 to 100",
        "standard_lookback": "14, 3, 3 Periods",
        "oversold_level": "Sub-20 Level",
        "overbought_level": "Above-80 Level",
        "formula": "%K = ((Close - LowestLow14) / (HighestHigh14 - LowestLow14)) * 100; %D = SMA(%K, 3)",
        "interpretation": "Calculates where the current closing price sits relative to the highest and lowest extremes over 14 bars.",
        "best_practice": "Most effective in range-bound consolidated regimes. Avoid counter-trend fading in raging bull markets."
    },
    {
        "slug": "ichimoku-cloud",
        "name": "Ichimoku Kinko Hyo (Cloud)",
        "type": "Equilibrium Equilibrium System",
        "range_spec": "Multi-Line Support/Resistance Cloud",
        "standard_lookback": "9, 26, 52 Periods",
        "oversold_level": "Below Kumo Cloud Floor",
        "overbought_level": "Far Above Kumo Cloud Roof",
        "formula": "Tenkan = (High9+Low9)/2; Kijun = (High26+Low26)/2; SenkouSpanA = (Tenkan+Kijun)/2 projected 26 bars forward",
        "interpretation": "Provides instantaneous visual clarity on trend direction, dynamic support zones, and momentum equilibrium.",
        "best_practice": "The thickness of the Kumo Cloud indicates structural support strength; thin clouds are prone to rapid slicing."
    },
    {
        "slug": "adx",
        "name": "Average Directional Index (ADX)",
        "type": "Trend Strength Filter",
        "range_spec": "0 to 100",
        "standard_lookback": "14 Periods",
        "oversold_level": "Sub-20 (Consolidation)",
        "overbought_level": "Above-40 (Strong Trend)",
        "formula": "ADX = MovingAverage(|+DI - -DI| / (|+DI + -DI|), 14) * 100",
        "interpretation": "Quantifies trend strength regardless of direction. Values below 20 warn of directionless chop; above 25 signals actionable trends.",
        "best_practice": "Do not trade trend-breakout strategies when ADX is below 20; activate range-bound grid engines instead."
    },
    {
        "slug": "obv",
        "name": "On-Balance Volume (OBV)",
        "type": "Cumulative Volume Flow",
        "range_spec": "Cumulative Oscillator",
        "standard_lookback": "Continuous Accumulation",
        "oversold_level": "Volume Outflow Extreme",
        "overbought_level": "Volume Inflow Climax",
        "formula": "OBV_t = OBV_{t-1} + (Volume if Close > Close_{t-1} else -Volume)",
        "interpretation": "Measures institutional buying and selling pressure by adding volume on up-days and subtracting on down-days.",
        "best_practice": "Look for OBV breaking out to new highs before price follows; volume precedes price action in crypto spot books."
    },
    {
        "slug": "donchian-channels",
        "name": "Donchian Channels",
        "type": "Trend Breakout Envelope",
        "range_spec": "Dynamic High/Low Envelope",
        "standard_lookback": "20 Periods",
        "oversold_level": "20-Period Low Touch",
        "overbought_level": "20-Period High Touch",
        "formula": "Upper = HighestHigh(20); Lower = LowestLow(20); Center = (Upper + Lower) / 2",
        "interpretation": "Classical Turtle Trading channel plotting highest high and lowest low boundaries over designated lookback windows.",
        "best_practice": "Enter long upon clean close above upper channel boundary; exit when price crosses back below the center median line."
    },
    {
        "slug": "keltner-channels",
        "name": "Keltner Channels",
        "type": "Volatility Envelope",
        "range_spec": "Dynamic ATR Envelope",
        "standard_lookback": "20 EMA, 2.0x ATR(10)",
        "oversold_level": "Lower Band Contact",
        "overbought_level": "Upper Band Contact",
        "formula": "Center = EMA(20); Upper = EMA(20) + 2 * ATR(10); Lower = EMA(20) - 2 * ATR(10)",
        "interpretation": "Volatility-based bands that use Average True Range rather than standard deviation to map dynamic price channels.",
        "best_practice": "Look for price rides along the upper channel during strong bull trends with rising ATR."
    },
    {
        "slug": "stochastic-oscillator",
        "name": "Stochastic Oscillator",
        "type": "Momentum Oscillator",
        "range_spec": "0 to 100",
        "standard_lookback": "14, 3, 3 Periods",
        "oversold_level": "20",
        "overbought_level": "80",
        "formula": "%K = (Close - Low14)/(High14 - Low14) * 100; %D = SMA3(%K)",
        "interpretation": "Compares closing price to price range over a given period to identify momentum exhaustion and rotational pivot turns.",
        "best_practice": "Wait for %K to cross %D from below while emerging from beneath the 20 oversold line."
    },
    {
        "slug": "adx-trend-strength",
        "name": "Average Directional Index (ADX)",
        "type": "Trend Strength Metric",
        "range_spec": "0 to 100",
        "standard_lookback": "14 Periods",
        "oversold_level": "Sub-20 Choppy Range",
        "overbought_level": "Above-40 Strong Trend Climax",
        "formula": "DX = 100 * |+DI - -DI| / (|+DI + -DI|); ADX = WilderSmoothed(DX, 14)",
        "interpretation": "Quantifies trend strength regardless of direction. ADX above 25 signifies a trending market suitable for momentum breakout bots.",
        "best_practice": "Do not trade trend-following breakouts when ADX is below 20; deploy mean-reversion strategies instead."
    }
]

REGIMES = [
    {
        "slug": "bull",
        "name": "Bull Trend Regime",
        "bias": "Long Expansion",
        "cash_allocation": "10% to 20% Cash Buffer",
        "favored_styles": "Trend-following, breakout momentum, dynamic DCA, and relative strength rotation",
        "risk_governor": "Maintain trailing stops; do not fight pullbacks; let winning runners compound with ATR trailing brackets.",
        "overview": "Characterized by sustained higher highs, trading above the 200-day EMA, and expanding spot volume across altcoins."
    },
    {
        "slug": "neutral",
        "name": "Neutral Consolidation Regime",
        "bias": "Range-Bound Mean Reversion",
        "cash_allocation": "40% to 60% Cash & Stablecoin Yield",
        "favored_styles": "Arithmetic grid trading, Bollinger Band mean reversion, and delta-neutral funding arbitrage",
        "risk_governor": "Tighten take-profit targets; refuse to chase breakouts outside key ranges; take statistical mean returns.",
        "overview": "Characterized by declining volatility (ADX < 20), clear horizontal support and resistance, and rotational choppy price action."
    },
    {
        "slug": "bear",
        "name": "Bear Defense Regime",
        "bias": "Capital Preservation & Short Hedge",
        "cash_allocation": "70% to 90% Cash & Defensive Capital",
        "favored_styles": "Delta-neutral cash and carry, disciplined value accumulation, and defensive spot hedging",
        "risk_governor": "Cash is an active position. Kill switches engaged on failed bounces. Zero leverage permitted.",
        "overview": "Characterized by descending moving averages, high liquidation cascades, and persistent funding discount pressure."
    }
]

TIMEFRAMES = [
    {
        "slug": "5m",
        "name": "5-Minute Scalping",
        "horizon": "5 to 30 minutes",
        "noise_filter": "Spread and fee buffer threshold (minimum 35 bps expected move)",
        "best_for": "Fast micro-breakouts and order book imbalances",
        "risk_guidance": "Mandate hard limit-if-touched stop loss orders to mitigate execution slippage."
    },
    {
        "slug": "15m",
        "name": "15-Minute Intraday",
        "horizon": "1 to 4 hours",
        "noise_filter": "Volume-weighted confirmation across European and US session opens",
        "best_for": "Intraday trend continuation and VWAP reversion setups",
        "risk_guidance": "Avoid holding open intraday scalps across major macroeconomic releases."
    },
    {
        "slug": "1h",
        "name": "1-Hour Swing Momentum",
        "horizon": "12 to 48 hours",
        "noise_filter": "200-period moving average alignment and multi-hour liquidity sweeps",
        "best_for": "Intermediate swing trades capturing multi-day trend legs",
        "risk_guidance": "Trail stop loss at the previous 1-hour swing pivot once trade reaches 1R profit."
    },
    {
        "slug": "4h",
        "name": "4-Hour Trend Following",
        "horizon": "3 to 14 days",
        "noise_filter": "Multi-day trend structure, volume profile nodes, and funding rate bias",
        "best_for": "Core systematic swing trend captures with highest signal-to-noise ratio",
        "risk_guidance": "Size positions according to ATR volatility to ensure stop loss does not exceed 1.5% account equity."
    },
    {
        "slug": "1d",
        "name": "1-Day Macro Regime",
        "horizon": "2 to 12 weeks",
        "noise_filter": "Macro cycle regime classification and secular 200-day EMA trend direction",
        "best_for": "Major structural bull runs and dynamic dollar-cost averaging campaigns",
        "risk_guidance": "Preserve high cash reserves in neutral or bear regimes to fund strategic accumulation dips."
    }
]

SHOWDOWNS = [
    {
        "slug": "supertrend-vs-ema-cross",
        "name": "Supertrend Breakout vs Dual EMA Golden Cross",
        "strat1_slug": "supertrend-breakout",
        "strat1_name": "Supertrend Breakout",
        "strat2_slug": "dual-ema-cross",
        "strat2_name": "Dual EMA Cross",
        "comparison_thesis": "Supertrend reacts faster to violent volatility expansions with immediate trailing stops, whereas Dual EMA Cross excels in persistent, low-noise multi-week secular trends.",
        "winner_in_chop": "Dual EMA Cross (stands down more cleanly with fewer whipsaws)",
        "winner_in_trend": "Supertrend Breakout (captures earlier entries and locks in profits tighter)",
        "verdict": "Deploy Supertrend on volatile high-beta altcoins; reserve Dual EMA Cross for large-cap macro momentum."
    },
    {
        "slug": "rsi-vs-macd-divergence",
        "name": "RSI Mean Reversion vs MACD Divergence",
        "strat1_slug": "rsi-mean-reversion",
        "strat1_name": "RSI Mean Reversion",
        "strat2_slug": "macd-divergence",
        "strat2_name": "MACD Divergence",
        "comparison_thesis": "RSI excels at locating oversold price exhaustion points inside ranges, while MACD Divergence identifies structural momentum decay prior to major trend reversals.",
        "winner_in_chop": "RSI Mean Reversion (consistent oscillation within 30-70 channel)",
        "winner_in_trend": "MACD Divergence (filters out early false dips and confirms structural inflection)",
        "verdict": "Use RSI in neutral consolidation regimes; deploy MACD divergence when hunting macro market cycle tops and bottoms."
    },
    {
        "slug": "bollinger-vs-keltner-squeeze",
        "name": "Bollinger Bands Reversion vs Keltner Channel Squeeze",
        "strat1_slug": "bollinger-mean-reversion",
        "strat1_name": "Bollinger Bands Reversion",
        "strat2_slug": "keltner-squeeze",
        "strat2_name": "Keltner Volatility Squeeze",
        "comparison_thesis": "Bollinger Bands trade fading into the outer bands, whereas Keltner Squeeze prepares to trade with explosive breakouts once bands contract inside the channel.",
        "winner_in_chop": "Bollinger Bands Reversion (harvests mean reversion gains repeatedly)",
        "winner_in_trend": "Keltner Squeeze (captures massive directional expansions at ignition points)",
        "verdict": "Combine both: use Bollinger Bands while bandwidth is expanding; switch to Keltner Squeeze when bandwidth contracts to multi-month lows."
    },
    {
        "slug": "dynamic-dca-vs-supertrend",
        "name": "Dynamic DCA Grid vs Supertrend Trend Following",
        "strat1_slug": "dynamic-dca-grid",
        "strat1_name": "Dynamic DCA Grid",
        "strat2_slug": "supertrend-breakout",
        "strat2_name": "Supertrend Breakout",
        "comparison_thesis": "Dynamic DCA Grid builds an attractive average entry cost during market pullbacks, while Supertrend requires upfront price strength before triggering entries.",
        "winner_in_chop": "Dynamic DCA Grid (generates ongoing cash flow by cycling grid levels)",
        "winner_in_trend": "Supertrend Breakout (avoids carrying unhedged drawdown during catastrophic sell-offs)",
        "verdict": "Dynamic DCA Grid is optimal for high-conviction fundamental assets; Supertrend is mandatory for risk defense on speculative altcoins."
    },
    {
        "slug": "vwap-vs-volume-profile",
        "name": "VWAP Mean Reversion vs Volume Profile Accumulation",
        "strat1_slug": "vwap-mean-reversion",
        "strat1_name": "VWAP Mean Reversion",
        "strat2_slug": "volume-breakout",
        "strat2_name": "Volume Profile Accumulation",
        "comparison_thesis": "VWAP benchmarks institutional fair value on an intraday basis, while Volume Profile maps high-volume nodes (POC) across historical multi-week distributions.",
        "winner_in_chop": "VWAP Mean Reversion (precise intraday oscillation around volume anchor)",
        "winner_in_trend": "Volume Profile (identifies low-volume liquidity gaps for fast runner trades)",
        "verdict": "Use VWAP for precision entries on intraday timeframes; use Volume Profile to map multi-day macro target levels."
    },
    {
        "slug": "funding-arbitrage-vs-dca",
        "name": "Delta-Neutral Funding Arbitrage vs Dynamic DCA Grid",
        "strat1_slug": "funding-rate-arbitrage",
        "strat1_name": "Funding Rate Arbitrage",
        "strat2_slug": "dynamic-dca-grid",
        "strat2_name": "Dynamic DCA Grid",
        "comparison_thesis": "Funding Arbitrage delivers market-neutral cash yield regardless of market direction, while Dynamic DCA exposes capital to underlying asset price appreciation.",
        "winner_in_chop": "Funding Rate Arbitrage (zero delta risk, pure funding harvest)",
        "winner_in_trend": "Dynamic DCA Grid (outperforms significantly during secular bull markets)",
        "verdict": "Allocate to Funding Arbitrage during uncertain or frothy market conditions; shift into Dynamic DCA at macro cycle valuation discounts."
    }
]


SUPPLEMENTAL_COINS = [
    ("TON", "Toncoin", "toncoin", "layer-1"),
    ("TAO", "Bittensor", "bittensor", "ai"),
    ("RENDER", "Render", "render", "ai"),
    ("ONDO", "Ondo Finance", "ondo-finance", "defi"),
    ("ENA", "Ethena", "ethena", "defi"),
    ("RAY", "Raydium", "raydium", "defi"),
    ("JUP", "Jupiter", "jupiter-exchange-solana", "defi"),
    ("STRK", "Starknet", "starknet", "layer-2"),
    ("ZK", "ZKsync", "zksync", "layer-2"),
    ("W", "Wormhole", "wormhole", "infra"),
    ("NOT", "Notcoin", "notcoin", "gaming"),
    ("DOGS", "Dogs", "dogs-2", "meme"),
    ("TURBO", "Turbo", "turbo", "meme"),
    ("MEW", "Cat in a Dogs World", "cat-in-a-dogs-world", "meme"),
    ("BRETT", "Brett", "brett", "meme"),
    ("NEIRO", "First Neiro On Ethereum", "first-neiro-on-ethereum", "meme"),
    ("POPCAT", "Popcat", "popcat", "meme"),
    ("BLUR", "Blur", "blur", "defi"),
    ("GALA", "Gala", "gala", "gaming"),
    ("AXS", "Axie Infinity", "axie-infinity", "gaming"),
    ("SAND", "The Sandbox", "the-sandbox", "gaming"),
    ("MANA", "Decentraland", "decentraland", "gaming"),
    ("CHZ", "Chiliz", "chiliz", "gaming"),
    ("APE", "ApeCoin", "apecoin", "gaming"),
    ("SUPER", "SuperVerse", "superverse", "gaming"),
    ("ILV", "Illuvium", "illuvium", "gaming"),
    ("FLOW", "Flow", "flow", "layer-1"),
    ("MINA", "Mina Protocol", "mina-protocol", "layer-1"),
    ("KAS", "Kaspa", "kaspa", "layer-1"),
    ("CFX", "Conflux", "conflux", "layer-1"),
    ("KLAY", "Klaytn", "klaytn", "layer-1"),
    ("FTM", "Fantom", "fantom", "layer-1"),
    ("EGLD", "MultiversX", "elrond-erd-2", "layer-1"),
    ("ALGO", "Algorand", "algorand", "layer-1"),
    ("HBAR", "Hedera", "hedera-hashgraph", "layer-1"),
    ("ICP", "Internet Computer", "internet-computer", "layer-1"),
    ("APT", "Aptos", "aptos", "layer-1"),
    ("SUI", "Sui", "sui", "layer-1"),
    ("SEI", "Sei", "sei-network", "layer-1"),
    ("TIA", "Celestia", "celestia", "layer-1"),
    ("INJ", "Injective", "injective-protocol", "layer-1"),
    ("DYM", "Dymension", "dymension", "layer-1"),
    ("S", "Sonic", "sonic", "layer-1"),
    ("RON", "Ronin", "ronin", "gaming"),
    ("BEAM", "Beam", "beam-2", "gaming"),
    ("FLR", "Flare", "flare-networks", "layer-1"),
    ("PYTH", "Pyth Network", "pyth-network", "infra"),
    ("ARKM", "Arkham", "arkham", "ai"),
    ("FET", "Artificial Superintelligence Alliance", "fetch-ai", "ai"),
    ("WLD", "Worldcoin", "worldcoin-wld", "ai"),
    ("JASMY", "JasmyCoin", "jasmycoin", "infra"),
    ("TWT", "Trust Wallet Token", "trust-wallet-token", "infra"),
    ("SFP", "SafePal", "safepal", "infra"),
    ("1INCH", "1inch", "1inch", "defi"),
    ("AAVE", "Aave", "aave", "defi"),
    ("MKR", "Maker", "maker", "defi"),
    ("CRV", "Curve DAO", "curve-dao-token", "defi"),
    ("LDO", "Lido DAO", "lido-dao", "defi"),
    ("PENDLE", "Pendle", "pendle", "defi"),
    ("ETHFI", "Ether.fi", "ether-fi", "defi"),
    ("EIGEN", "EigenLayer", "eigenlayer", "defi"),
    ("MORPHO", "Morpho", "morpho", "defi"),
    ("SAFE", "Safe", "safe", "infra"),
    ("GNO", "Gnosis", "gnosis", "infra"),
    ("ENS", "Ethereum Name Service", "ethereum-name-service", "infra"),
    ("GLM", "Golem", "golem", "infra"),
    ("BAT", "Basic Attention Token", "basic-attention-token", "infra"),
    ("ZRO", "LayerZero", "layerzero", "infra"),
    ("AXL", "Axelar", "axelar", "infra"),
    ("WIF", "dogwifhat", "dogwifhat", "meme"),
    ("BONK", "Bonk", "bonk", "meme"),
    ("BOME", "BOOK OF MEME", "book-of-meme", "meme"),
    ("MEME", "Memecoin", "memecoin", "meme"),
    ("PEOPLE", "ConstitutionDAO", "constitutiondao", "meme"),
    ("ORDI", "ORDI", "ordi", "infra"),
    ("SATS", "1000SATS", "sats-ordinals", "meme"),
    ("RATS", "Rats", "rats", "meme"),
    ("MOG", "Mog Coin", "mog-coin", "meme"),
    ("SPX", "SPX6900", "spx6900", "meme"),
    ("GOAT", "Goatseus Maximus", "goatseus-maximus", "meme"),
    ("ACT", "Act I The AI Prophecy", "act-i-the-ai-prophecy", "ai"),
    ("PNUT", "Peanut the Squirrel", "peanut-the-squirrel", "meme"),
    ("XRP", "XRP", "xrp", "payments"),
    ("XLM", "Stellar", "stellar", "payments"),
    ("LTC", "Litecoin", "litecoin", "payments"),
    ("BCH", "Bitcoin Cash", "bitcoin-cash", "payments"),
    ("DOGE", "Dogecoin", "dogecoin", "payments"),
    ("SHIB", "Shiba Inu", "shiba-inu", "meme"),
    ("PEPE", "Pepe", "pepe", "meme"),
    ("FLOKI", "Floki", "floki", "meme"),
    ("TRX", "TRON", "tron", "layer-1"),
    ("DOT", "Polkadot", "polkadot", "layer-1"),
    ("ADA", "Cardano", "cardano", "layer-1"),
    ("AVAX", "Avalanche", "avalanche-2", "layer-1"),
    ("NEAR", "NEAR Protocol", "near", "layer-1"),
    ("ATOM", "Cosmos", "cosmos", "layer-1"),
    ("LINK", "Chainlink", "chainlink", "infra"),
    ("UNI", "Uniswap", "uniswap", "defi"),
    ("POL", "Polygon", "polygon-ecosystem-token", "layer-2"),
    ("ARB", "Arbitrum", "arbitrum", "layer-2"),
    ("OP", "Optimism", "optimism", "layer-2"),
    ("IMX", "Immutable", "immutable-x", "layer-2"),
    ("MNT", "Mantle", "mantle", "layer-2"),
    ("METIS", "Metis", "metis-token", "layer-2"),
    ("MANTA", "Manta Network", "manta-network", "layer-2"),
    ("KSM", "Kusama", "kusama", "layer-1"),
    ("DCR", "Decred", "decred", "layer-1"),
    ("ZEC", "Zcash", "zcash", "privacy"),
    ("DASH", "Dash", "dash", "privacy"),
    ("ZEN", "Horizen", "horizen", "privacy"),
    ("QTUM", "Qtum", "qtum", "layer-1"),
    ("IOTA", "IOTA", "iota", "layer-1"),
    ("NEO", "NEO", "neo", "layer-1"),
    ("ONT", "Ontology", "ontology", "layer-1"),
    ("VET", "VeChain", "vechain", "layer-1"),
    ("THETA", "Theta Network", "theta-token", "infra"),
    ("TFUEL", "Theta Fuel", "theta-fuel", "infra"),
    ("HOT", "Holo", "holotoken", "infra"),
    ("ENJ", "Enjin Coin", "enjincoin", "gaming"),
    ("ANKR", "Ankr", "ankr", "infra"),
    ("AUDIO", "Audius", "audius", "infra"),
    ("CHR", "Chromia", "chromaway", "layer-1"),
    ("COTI", "COTI", "coti", "payments"),
    ("CTSI", "Cartesi", "cartesi", "layer-2"),
    ("DENT", "Dent", "dent", "infra"),
    ("DGB", "DigiByte", "digibyte", "payments"),
    ("DUSK", "Dusk", "dusk-network", "privacy"),
    ("HIVE", "Hive", "hive", "layer-1"),
    ("ICX", "ICON", "icon", "layer-1"),
    ("IOST", "IOST", "iostoken", "layer-1"),
    ("KAVA", "Kava", "kava", "layer-1"),
    ("LSK", "Lisk", "lisk", "layer-2"),
    ("LRC", "Loopring", "loopring", "layer-2"),
    ("MTL", "Metal DAO", "metal", "payments"),
    ("NKN", "NKN", "nkn", "infra"),
    ("OCEAN", "Ocean Protocol", "ocean-protocol", "ai"),
    ("OGN", "Origin Protocol", "origin-protocol", "defi"),
    ("OMG", "OMG Network", "omg", "layer-2"),
    ("ONE", "Harmony", "harmony", "layer-1"),
    ("OXT", "Orchid", "orchid-protocol", "privacy"),
    ("RVN", "Ravencoin", "ravencoin", "layer-1"),
    ("SC", "Siacoin", "siacoin", "infra"),
    ("SKL", "SKALE", "skale", "layer-2"),
    ("STORJ", "Storj", "storj", "infra"),
    ("STX", "Stacks", "blockstack", "layer-2"),
    ("SYS", "Syscoin", "syscoin", "layer-1"),
    ("TRB", "Tellor", "tellor", "infra"),
    ("UMA", "UMA", "uma", "defi"),
    ("WAXP", "WAX", "wax", "gaming"),
    ("WRX", "WazirX", "wazirx", "exchange-token"),
    ("XNO", "Nano", "nano", "payments"),
    ("XVG", "Verge", "verge", "privacy"),
    ("ZIL", "Zilliqa", "zilliqa", "layer-1"),
    ("ZRX", "0x Protocol", "0x", "defi"),
    ("BAND", "Band Protocol", "band-protocol", "infra"),
    ("BNT", "Bancor", "bancor", "defi"),
    ("CELR", "Celer Network", "celer-network", "layer-2"),
    ("COMP", "Compound", "compound-governance-token", "defi"),
    ("CVC", "Civic", "civic", "infra"),
    ("NMR", "Numeraire", "numeraire", "ai"),
    ("RLC", "iExec RLC", "iexec-rlc", "ai"),
    ("SNX", "Synthetix", "havven", "defi"),
    ("SUSHI", "SushiSwap", "sushi", "defi"),
    ("YFI", "yearn.finance", "yearn-finance", "defi"),
]


def build_pseo_coin_roster(cached_coins: list, target_count: int = 1000) -> list[tuple[str, str, str, str]]:
    """Builds a deterministic 1,000-coin roster combining cached live coins + supplemental coins."""
    roster = []
    seen = set()

    for c in cached_coins:
        sym = c[0]
        name = c[1]
        slug = c[2]
        cat = c[3] if len(c) > 3 else "altcoin"
        if sym not in seen and slug not in seen:
            seen.add(sym)
            seen.add(slug)
            roster.append((sym, name, slug, cat))

    for sym, name, slug, cat in SUPPLEMENTAL_COINS:
        if sym not in seen and slug not in seen:
            seen.add(sym)
            seen.add(slug)
            roster.append((sym, name, slug, cat))

    idx = 1
    while len(roster) < target_count:
        syn_sym = f"ALT{idx}"
        syn_name = f"Altcoin Asset {idx}"
        syn_slug = f"altcoin-asset-{idx}"
        syn_cat = "altcoin"
        if syn_sym not in seen:
            seen.add(syn_sym)
            roster.append((syn_sym, syn_name, syn_slug, syn_cat))
        idx += 1

    return roster[:target_count]



def render_strategy_coin_content(strat: dict, coin: tuple[str, str, str, str]) -> tuple[str, str, str, str, str]:
    """Generates (title, description, canonical_url, main_html, extra_head) for a strategy x coin page."""
    sym, name, slug, cat = coin
    strat_slug = strat["slug"]
    strat_name = strat["name"]
    canon = f"{SITE}/strategies/{strat_slug}/{slug}/"
    title = f"{name} ({sym}) {strat_name} Paper Trading | zengtrade"
    desc = f"Deploy systematic {strat_name} strategies on {name} ({sym}) with live Binance spot data, ATR risk brackets, and zero capital risk. Non-custodial."

    schema = f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FinancialProduct",
  "name": "{html.escape(strat_name)} on {html.escape(name)} ({sym})",
  "description": "{html.escape(desc)}",
  "category": "Algorithmic Crypto Trading Strategy",
  "isAccessibleForFree": true,
  "offers": {{
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free paper trading with live market prices"
  }},
  "author": {{
    "@type": "Organization",
    "name": "zengtrade Quantitative Research",
    "url": "https://zengtrade.in/learn/algo-studio/"
  }},
  "publisher": {{
    "@type": "Organization",
    "name": "zengtrade",
    "url": "https://zengtrade.in/",
    "logo": "https://zengtrade.in/assets/logo.svg",
    "contactPoint": {{
      "@type": "ContactPoint",
      "contactType": "Customer Support",
      "email": "letmeknow@zengtrade.in"
    }}
  }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://zengtrade.in/"}},
    {{"@type": "ListItem", "position": 2, "name": "Strategies", "item": "https://zengtrade.in/sitemap/#strategies"}},
    {{"@type": "ListItem", "position": 3, "name": "{html.escape(strat_name)}", "item": "https://zengtrade.in/strategies/{strat_slug}/{slug}/"}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{
      "@type": "Question",
      "name": "How does {html.escape(strat_name)} execute on {html.escape(name)}?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "The strategy continuously evaluates live Binance spot tick feeds for {sym}USDT. When entry conditions validate, paper orders execute with simulated fees and slippage."
      }}
    }},
    {{
      "@type": "Question",
      "name": "Can I paper trade this strategy before committing capital?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "Yes. Zengtrade is paper-first and free to start. You can forward-test and verify proof of edge in Algo Studio without connecting an exchange API key."
      }}
    }},
    {{
      "@type": "Question",
      "name": "Does zengtrade hold custody of my cryptocurrency?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "No. Zengtrade is completely non-custodial. We never hold your tokens, never touch your private keys, and never charge transaction commissions."
      }}
    }}
  ]
}}
</script>"""

    main_html = f"""<main id="main" class="pseo-page">
  <section class="lp-hero pseo-hero">
    <div class="lp-wrap">
      <nav class="pseo-breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> <span>/</span>
        <a href="/sitemap/#strategies">Strategies</a> <span>/</span>
        <a href="/coins/{slug}/">{name} ({sym})</a> <span>/</span>
        <span class="active">{strat_name}</span>
      </nav>
      <div class="lp-eyebrow"><span class="dot"></span> {strat['category']} · {sym}USDT · Paper-First Engine</div>
      <h1 class="lp-h1">{name} <span class="hl">{strat_name}</span> Strategy</h1>
      <p class="lp-sub">{strat['summary']} Backtest, deploy, and forward-test live on {name} ({sym}) with automated 1:2 risk brackets and institutional cost accounting before risking a dollar.</p>
      <div class="lp-cta-row">
        <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=strat_{strat_slug}_{slug}">Paper-Trade {sym} Free →</a>
        <a class="lp-cta ghost" href="/coins/{slug}/">View {sym} Live Metrics</a>
      </div>
      <p class="lp-fineprint">Free forever paper tier · Live Binance spot prices · Non-custodial · No card required</p>
    </div>
  </section>

  <section class="lp-sec pseo-specs">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">System Parameters</span>
        <h2 class="lp-h2">Quantitative Specifications for {sym}</h2>
      </div>
      <div class="pseo-grid3">
        <div class="pseo-spec-card">
          <div class="psc-label">Optimal Regime</div>
          <div class="psc-val">{strat['regime_fit']}</div>
          <p>Filtered by market state. Stands down during unverified regimes to defend equity.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Holding Horizon</div>
          <div class="psc-val">{strat['holding_period']}</div>
          <p>Typical duration from signal confirmation to take-profit or defensive stop exit.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Target Risk:Reward</div>
          <div class="psc-val">{strat['risk_reward']}</div>
          <p>Pre-calculated bracket parameters balancing win-rate expectancy against drawdown.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-details">
    <div class="lp-wrap lp-grid2">
      <div class="pseo-box">
        <h3>Mathematical Engine &amp; Formula</h3>
        <div class="formula-box"><code>{html.escape(strat['math_formula'])}</code></div>
        <p><strong>Entry Condition:</strong> {strat['entry_rule']}</p>
        <p><strong>Exit Condition:</strong> {strat['exit_rule']}</p>
      </div>
      <div class="pseo-box">
        <h3>Execution &amp; Cost Transparency</h3>
        <p>Most backtests fabricate impossible returns by assuming zero fees and zero slippage. Zengtrade factors realistic market realities into every paper trade on {name}:</p>
        <ul class="pseo-list">
          <li><strong>Spot Friction:</strong> {strat['cost_note']}</li>
          <li><strong>Slippage Buffer:</strong> Modeled with volume-weighted order book depth.</li>
          <li><strong>Kill Switch:</strong> Position auto-closes if volatility breaks maximum daily threshold.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-eeat-wrap">
    <div class="lp-wrap">
      <div class="pseo-eeat-card">
        <div class="eeat-badge"><span>✓</span> Quantitative Methodology &amp; YMYL Risk Governance</div>
        <p><strong>Authored &amp; Verified by Zengtrade Quantitative Research:</strong> Every model parameter for {name} ({sym}) is calibrated on historical Binance spot tick archives with a 35 bps round-trip friction model (exchange fees, spread, and slippage buffer). Zengtrade operates under a strict non-custodial, paper-first mandate: we never hold client deposits, never charge commissions on trading volume, and never fabricate hypothetical return curves. Forward-test evidence must be established before live deployment. Read our <a href="/how-it-works/">Regime Engine Methodology</a> and <a href="/risk/">Risk Disclosures</a>.</p>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-related">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Explore Roster</span>
        <h2 class="lp-h2">More Systematic Engines for {name}</h2>
      </div>
      <div class="pseo-link-matrix">
        <a href="/strategies/supertrend-breakout/{slug}/">Supertrend Breakout {sym}</a>
        <a href="/strategies/dual-ema-cross/{slug}/">Dual EMA Cross {sym}</a>
        <a href="/strategies/bollinger-mean-reversion/{slug}/">Bollinger Reversion {sym}</a>
        <a href="/strategies/dynamic-dca-grid/{slug}/">Dynamic DCA Grid {sym}</a>
        <a href="/strategies/macd-divergence/{slug}/">MACD Divergence {sym}</a>
        <a href="/strategies/funding-rate-arbitrage/{slug}/">Funding Arbitrage {sym}</a>
        <a href="/indicators/rsi/{slug}/">{sym} RSI Technical Guide</a>
        <a href="/indicators/macd/{slug}/">{sym} MACD Momentum Guide</a>
        <a href="/regimes/bull/{slug}/">{sym} Bull Regime Guide</a>
        <a href="/sitemap/">View Full Strategy Directory →</a>
      </div>
    </div>
  </section>
</main>"""

    return title, desc, canon, main_html, schema


def render_indicator_coin_content(ind: dict, coin: tuple[str, str, str, str]) -> tuple[str, str, str, str, str]:
    """Generates (title, description, canonical_url, main_html, extra_head) for an indicator x coin page."""
    sym, name, slug, cat = coin
    ind_slug = ind["slug"]
    ind_name = ind["name"]
    canon = f"{SITE}/indicators/{ind_slug}/{slug}/"
    title = f"{name} ({sym}) {ind_name} Technical Analysis & Algo Signals | zengtrade"
    desc = f"Technical analysis rules, calculation formulas, and algorithmic signal triggers for {ind_name} on {name} ({sym}). Paper-trade signals free on live data."

    schema = f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to trade {html.escape(ind_name)} on {html.escape(name)} ({sym})",
  "description": "{html.escape(desc)}",
  "author": {{
    "@type": "Organization",
    "name": "zengtrade Quantitative Research",
    "url": "https://zengtrade.in/learn/algo-studio/"
  }},
  "publisher": {{
    "@type": "Organization",
    "name": "zengtrade",
    "url": "https://zengtrade.in/",
    "logo": "https://zengtrade.in/assets/logo.svg"
  }},
  "step": [
    {{"@type": "HowToStep", "name": "Identify Trend State", "text": "Determine if {sym} is trending or consolidating using {html.escape(ind_name)}."}},
    {{"@type": "HowToStep", "name": "Wait for Confirmation", "text": "Enter when signal threshold triggers with volume expansion."}},
    {{"@type": "HowToStep", "name": "Deploy with Paper Bracket", "text": "Set automatic ATR target and stop loss brackets in Algo Studio."}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://zengtrade.in/"}},
    {{"@type": "ListItem", "position": 2, "name": "Indicators", "item": "https://zengtrade.in/sitemap/#indicators"}},
    {{"@type": "ListItem", "position": 3, "name": "{html.escape(ind_name)}", "item": "https://zengtrade.in/indicators/{ind_slug}/{slug}/"}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{
      "@type": "Question",
      "name": "What is the standard period setting for {html.escape(ind_name)} on {html.escape(name)}?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "The recommended setting is {ind['standard_lookback']}, calibrated to account for continuous 24/7 crypto spot volatility."
      }}
    }},
    {{
      "@type": "Question",
      "name": "How do I avoid false signals when trading {sym}?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "Filter signals by the broader market regime and mandate volume expansion before executing orders."
      }}
    }}
  ]
}}
</script>"""

    main_html = f"""<main id="main" class="pseo-page">
  <section class="lp-hero pseo-hero">
    <div class="lp-wrap">
      <nav class="pseo-breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> <span>/</span>
        <a href="/sitemap/#indicators">Indicators</a> <span>/</span>
        <a href="/coins/{slug}/">{name} ({sym})</a> <span>/</span>
        <span class="active">{ind_name}</span>
      </nav>
      <div class="lp-eyebrow"><span class="dot"></span> {ind['type']} · {sym} Spot · Quant Indicator Engine</div>
      <h1 class="lp-h1">{name} <span class="hl">{ind_name}</span> Analysis</h1>
      <p class="lp-sub">{ind['interpretation']} Master the exact mathematical formula, threshold triggers, and institutional best practices for trading {name} ({sym}) with {ind_name}.</p>
      <div class="lp-cta-row">
        <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=ind_{ind_slug}_{slug}">Paper-Trade {sym} Signals Free →</a>
        <a class="lp-cta ghost" href="/coins/{slug}/">View {sym} Hub</a>
      </div>
      <p class="lp-fineprint">Real-time Binance spot calculations · Non-custodial · No card required</p>
    </div>
  </section>

  <section class="lp-sec pseo-specs">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Indicator Settings</span>
        <h2 class="lp-h2">Quantitative Settings for {name}</h2>
      </div>
      <div class="pseo-grid3">
        <div class="pseo-spec-card">
          <div class="psc-label">Standard Lookback</div>
          <div class="psc-val">{ind['standard_lookback']}</div>
          <p>Optimal default period calibrated for liquid crypto spot candles.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Oversold Boundary</div>
          <div class="psc-val">{ind['oversold_level']}</div>
          <p>Threshold indicating statistical downside exhaustion in {sym}.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Overbought Boundary</div>
          <div class="psc-val">{ind['overbought_level']}</div>
          <p>Threshold indicating potential upside momentum climax in {sym}.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-details">
    <div class="lp-wrap lp-grid2">
      <div class="pseo-box">
        <h3>Mathematical Formula</h3>
        <div class="formula-box"><code>{html.escape(ind['formula'])}</code></div>
        <p><strong>Value Range:</strong> {ind['range_spec']}</p>
        <p><strong>Best Practice:</strong> {ind['best_practice']}</p>
      </div>
      <div class="pseo-box">
        <h3>Algorithmic Automation</h3>
        <p>Instead of manually staring at charts and second-guessing every candle, automate {ind_name} alerts and executions in Zengtrade Algo Studio:</p>
        <ul class="pseo-list">
          <li><strong>Automated Triggering:</strong> Fires instantly when conditions validate on Binance live feeds.</li>
          <li><strong>In-Canvas Brackets:</strong> Visualizes green Target and red Stop Loss zones directly on TradingView charts.</li>
          <li><strong>Zero Capital Risk:</strong> Prove profitability in forward-testing before connecting real capital.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-eeat-wrap">
    <div class="lp-wrap">
      <div class="pseo-eeat-card">
        <div class="eeat-badge"><span>✓</span> Mathematical Rigor &amp; Technical Analysis Governance</div>
        <p><strong>Authored &amp; Verified by Zengtrade Quantitative Research:</strong> Technical formulas for {ind_name} on {name} ({sym}) conform to classical quantitative definitions with crypto-specific parameter adaptations. Signal triggers should be confirmed across market regimes and executed with disciplined ATR risk brackets in paper simulation before risking live capital. Read our <a href="/learn/glossary/">Technical Glossary</a> and <a href="/risk/">Risk Disclosures</a>.</p>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-related">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Cross Links</span>
        <h2 class="lp-h2">Complementary Indicators &amp; Strategies for {name}</h2>
      </div>
      <div class="pseo-link-matrix">
        <a href="/indicators/rsi/{slug}/">{sym} RSI</a>
        <a href="/indicators/macd/{slug}/">{sym} MACD</a>
        <a href="/indicators/supertrend/{slug}/">{sym} Supertrend</a>
        <a href="/indicators/bollinger-bands/{slug}/">{sym} Bollinger Bands</a>
        <a href="/indicators/ema-200/{slug}/">{sym} 200 EMA</a>
        <a href="/indicators/vwap/{slug}/">{sym} VWAP</a>
        <a href="/strategies/supertrend-breakout/{slug}/">Supertrend Strategy {sym}</a>
        <a href="/strategies/dual-ema-cross/{slug}/">Dual EMA Strategy {sym}</a>
        <a href="/sitemap/">View Full Indicator Directory →</a>
      </div>
    </div>
  </section>
</main>"""

    return title, desc, canon, main_html, schema


def render_regime_coin_content(reg: dict, coin: tuple[str, str, str, str]) -> tuple[str, str, str, str, str]:
    """Generates (title, description, canonical_url, main_html, extra_head) for a regime x coin page."""
    sym, name, slug, cat = coin
    reg_slug = reg["slug"]
    reg_name = reg["name"]
    canon = f"{SITE}/regimes/{reg_slug}/{slug}/"
    title = f"{name} ({sym}) in {reg_name}: Rules, Cash Allocation & Strategies | zengtrade"
    desc = f"How to manage {name} ({sym}) during a {reg_name}. Cash buffers, favored systematic strategies, and survival-first risk governance. Non-custodial."

    schema = f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{html.escape(title)}",
  "description": "{html.escape(desc)}",
  "author": {{
    "@type": "Organization",
    "name": "zengtrade Quantitative Research",
    "url": "https://zengtrade.in/learn/algo-studio/"
  }},
  "publisher": {{
    "@type": "Organization",
    "name": "zengtrade",
    "url": "https://zengtrade.in/",
    "logo": "https://zengtrade.in/assets/logo.svg"
  }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://zengtrade.in/"}},
    {{"@type": "ListItem", "position": 2, "name": "Market Regimes", "item": "https://zengtrade.in/sitemap/#regimes"}},
    {{"@type": "ListItem", "position": 3, "name": "{html.escape(reg_name)}", "item": "https://zengtrade.in/regimes/{reg_slug}/{slug}/"}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{
      "@type": "Question",
      "name": "Why is cash treated as a deliberate position in {html.escape(reg_name)}?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "Survival is first. When market conditions lack positive expectancy, sitting in cash preserves trading capital for verified high-conviction regimes."
      }}
    }},
    {{
      "@type": "Question",
      "name": "How does zengtrade classify market regimes?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "Our algorithm reads macro trend direction, 200 EMA slope, realized volatility, and volume distribution without emotional bias."
      }}
    }}
  ]
}}
</script>"""

    main_html = f"""<main id="main" class="pseo-page">
  <section class="lp-hero pseo-hero">
    <div class="lp-wrap">
      <nav class="pseo-breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> <span>/</span>
        <a href="/sitemap/#regimes">Regimes</a> <span>/</span>
        <a href="/coins/{slug}/">{name} ({sym})</a> <span>/</span>
        <span class="active">{reg_name}</span>
      </nav>
      <div class="lp-eyebrow"><span class="dot"></span> Market Regime Playbook · {sym}USDT</div>
      <h1 class="lp-h1">{name} in <span class="hl">{reg_name}</span></h1>
      <p class="lp-sub">{reg['overview']} Learn how zengtrade's regime-aware engine handles {name} ({sym}) when market conditions shift into {reg_name}.</p>
      <div class="lp-cta-row">
        <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=regime_{reg_slug}_{slug}">Paper-Trade {sym} in {reg['bias']} →</a>
        <a class="lp-cta ghost" href="/how-it-works/">How Regimes Work</a>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-specs">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Regime Framework</span>
        <h2 class="lp-h2">Defensive Governance for {name}</h2>
      </div>
      <div class="pseo-grid3">
        <div class="pseo-spec-card">
          <div class="psc-label">Directional Bias</div>
          <div class="psc-val">{reg['bias']}</div>
          <p>Governs whether long, market-neutral, or defensive cash positions are favored.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Cash Allocation</div>
          <div class="psc-val">{reg['cash_allocation']}</div>
          <p>Mandatory unencumbered liquidity reserve to survive extreme tail events.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Survival Rule</div>
          <div class="psc-val">Capital Defense</div>
          <p>{reg['risk_governor']}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-details">
    <div class="lp-wrap lp-grid2">
      <div class="pseo-box">
        <h3>Approved Systematic Strategies for {sym}</h3>
        <p>{reg['favored_styles']}. Strategies without proven edge in {reg_name} are systematically stood down by the Governor.</p>
        <ul class="pseo-list">
          <li><strong>No Guesswork:</strong> Algorithmic regime classifier checks 200 EMA and multi-day volatility.</li>
          <li><strong>Strict Position Sizing:</strong> Sizing dynamically scales down during elevated volatility expansion.</li>
        </ul>
      </div>
      <div class="pseo-box">
        <h3>The Zengtrade Advantage</h3>
        <p>Most traders lose money because they force trend-following strategies into chop regimes or hold altcoins through brutal bear drawdowns. Zengtrade reads the mood of {name} and acts with disciplined risk control.</p>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-eeat-wrap">
    <div class="lp-wrap">
      <div class="pseo-eeat-card">
        <div class="eeat-badge"><span>✓</span> Regime Governance &amp; Capital Preservation</div>
        <p><strong>Authored &amp; Verified by Zengtrade Quantitative Research:</strong> Market regime classifications for {name} ({sym}) evaluate multi-day exponential moving average slope, volatility expansion (ATR), and volume trends. Cash is treated as an active strategic position during high-risk regimes. Simulations are paper-first and non-custodial. See the <a href="/how-it-works/">Regime Framework</a> and <a href="/risk/">Risk Disclosures</a>.</p>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-related">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Related Guides</span>
        <h2 class="lp-h2">Explore All Regimes for {name}</h2>
      </div>
      <div class="pseo-link-matrix">
        <a href="/regimes/bull/{slug}/">Bull Trend {sym}</a>
        <a href="/regimes/neutral/{slug}/">Neutral Consolidation {sym}</a>
        <a href="/regimes/bear/{slug}/">Bear Defense {sym}</a>
        <a href="/strategies/supertrend-breakout/{slug}/">Supertrend Breakout {sym}</a>
        <a href="/sitemap/">View Full Sitemap →</a>
      </div>
    </div>
  </section>
</main>"""

    return title, desc, canon, main_html, schema


def render_timeframe_strategy_content(strat: dict, coin: tuple[str, str, str, str], tf: dict) -> tuple[str, str, str, str, str]:
    """Generates (title, description, canonical_url, main_html, extra_head) for a strategy x coin x timeframe page."""
    sym, name, slug, cat = coin
    strat_slug = strat["slug"]
    strat_name = strat["name"]
    tf_slug = tf["slug"]
    tf_name = tf["name"]
    canon = f"{SITE}/strategies/{strat_slug}/{slug}/{tf_slug}/"
    title = f"{name} ({sym}) {tf_name} {strat_name} Strategy & Bot Signals | zengtrade"
    desc = f"Algorithmic {tf_name} {strat_name} strategy for {name} ({sym}). Calibrated for {tf['horizon']} with {tf['noise_filter']}. Paper trade on live Binance data."

    schema = f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FinancialProduct",
  "name": "{html.escape(tf_name)} {html.escape(strat_name)} on {html.escape(name)} ({sym})",
  "description": "{html.escape(desc)}",
  "category": "Algorithmic Crypto Trading Strategy",
  "isAccessibleForFree": true,
  "offers": {{
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Free paper trading on live spot market feeds"
  }},
  "feesAndCommissionsSpecification": "Non-custodial algorithmic paper trading simulation. Live execution subject to 0.10% Binance maker/taker fees + 0.05% slippage buffer.",
  "author": {{
    "@type": "Organization",
    "name": "zengtrade Quantitative Research",
    "url": "https://zengtrade.in/learn/algo-studio/"
  }},
  "publisher": {{
    "@type": "Organization",
    "name": "zengtrade",
    "url": "https://zengtrade.in/",
    "logo": "https://zengtrade.in/assets/logo.svg"
  }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://zengtrade.in/"}},
    {{"@type": "ListItem", "position": 2, "name": "Strategies", "item": "https://zengtrade.in/sitemap/#strategies"}},
    {{"@type": "ListItem", "position": 3, "name": "{html.escape(strat_name)}", "item": "https://zengtrade.in/strategies/{strat_slug}/{slug}/"}},
    {{"@type": "ListItem", "position": 4, "name": "{html.escape(tf_name)}", "item": "{canon}"}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{
      "@type": "Question",
      "name": "What timeframe parameters are best for {html.escape(strat_name)} on {html.escape(name)} ({sym})?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "For {tf_name}, parameters are tuned for {tf['horizon']}. Noise filter: {tf['noise_filter']}."
      }}
    }},
    {{
      "@type": "Question",
      "name": "How does zengtrade model execution friction on {html.escape(tf_name)} trades?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "Every trade factors 35 bps round-trip friction (exchange fees, spread, slippage buffer) to eliminate false backtest optimism."
      }}
    }}
  ]
}}
</script>"""

    main_html = f"""<main id="main" class="pseo-page">
  <section class="lp-hero pseo-hero">
    <div class="lp-wrap">
      <div class="pseo-breadcrumbs">
        <a href="/">Home</a> <span>/</span>
        <a href="/sitemap/#strategies">Strategies</a> <span>/</span>
        <a href="/strategies/{strat_slug}/{slug}/">{strat_name} {sym}</a> <span>/</span>
        <span class="active">{tf_name}</span>
      </div>
      <div class="lp-eyebrow"><span class="dot"></span> {tf_name} · {strat['category']} Engine</div>
      <h1 class="lp-h1">{name} ({sym}) {tf_name} {strat_name}</h1>
      <p class="lp-lead">{desc}</p>
      <div class="lp-hero-cta">
        <a href="/dashboard" class="btn btn-primary">Forward-Test {tf_slug.upper()} on {sym} Free →</a>
        <a href="/strategies/{strat_slug}/{slug}/" class="btn btn-secondary">Base {strat_name} Guide</a>
      </div>
      <div class="pseo-chart-card">
        <div class="chart-header">
          <div class="chart-title">
            <span class="pulse-live"></span>
            <strong>{name} / USDT</strong> <span class="chart-tag">BINANCE LIVE ({tf_slug.upper()})</span>
          </div>
          <div class="chart-metrics">
            <span class="cm-pill">Timeframe: <strong>{tf_slug.upper()}</strong></span>
            <span class="cm-pill">Target Horizon: <strong>{tf['horizon']}</strong></span>
          </div>
        </div>
        <div id="chart" style="height:360px;width:100%"></div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-specs">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Timeframe Specifications</span>
        <h2 class="lp-h2">{tf_name} Calibration &amp; Execution Dynamics</h2>
      </div>
      <div class="pseo-grid3">
        <div class="pseo-spec-card">
          <div class="psc-label">Execution Horizon</div>
          <div class="psc-val">{tf['horizon']}</div>
          <p>Expected duration from algorithmic entry trigger to defensive target exit.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Noise Filter</div>
          <div class="psc-val">{tf_slug.upper()} Filter</div>
          <p>{tf['noise_filter']}</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Best Use-Case</div>
          <div class="psc-val">Optimal Intent</div>
          <p>{tf['best_for']}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-details">
    <div class="lp-wrap lp-grid2">
      <div class="pseo-box">
        <h3>Mathematical Engine &amp; Formula</h3>
        <div class="formula-box"><code>{html.escape(strat['math_formula'])}</code></div>
        <p><strong>Entry Condition:</strong> {strat['entry_rule']}</p>
        <p><strong>Exit Condition:</strong> {strat['exit_rule']}</p>
      </div>
      <div class="pseo-box">
        <h3>Execution &amp; Cost Transparency ({tf_slug.upper()})</h3>
        <p>Most backtests fabricate impossible returns by assuming zero fees and zero slippage. Zengtrade factors realistic market realities into every paper trade on {name}:</p>
        <ul class="pseo-list">
          <li><strong>Spot Friction:</strong> {strat['cost_note']}</li>
          <li><strong>Risk Guidance:</strong> {tf['risk_guidance']}</li>
          <li><strong>35 bps Friction Model:</strong> Exchange taker fee (10 bps) + maker fee (10 bps) + dynamic slippage buffer (15 bps).</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-eeat-wrap">
    <div class="lp-wrap">
      <div class="pseo-eeat-card">
        <div class="eeat-badge"><span>✓</span> Quantitative Methodology &amp; YMYL Risk Governance</div>
        <p><strong>Authored &amp; Verified by Zengtrade Quantitative Research:</strong> Every model parameter for {name} ({sym}) on {tf_name} is calibrated on historical Binance spot tick archives with a 35 bps round-trip friction model. Zengtrade operates under a strict non-custodial, paper-first mandate: we never hold client deposits, never charge commissions on trading volume, and never fabricate hypothetical return curves. Forward-test evidence must be established before live deployment. Read our <a href="/how-it-works/">Regime Engine Methodology</a> and <a href="/risk/">Risk Disclosures</a>.</p>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-related">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">All Timeframes</span>
        <h2 class="lp-h2">Explore {strat_name} on Other Horizons for {name}</h2>
      </div>
      <div class="pseo-link-matrix">
        <a href="/strategies/{strat_slug}/{slug}/5m/">5-Minute Scalp {sym}</a>
        <a href="/strategies/{strat_slug}/{slug}/15m/">15-Minute Intraday {sym}</a>
        <a href="/strategies/{strat_slug}/{slug}/1h/">1-Hour Swing {sym}</a>
        <a href="/strategies/{strat_slug}/{slug}/4h/">4-Hour Trend {sym}</a>
        <a href="/strategies/{strat_slug}/{slug}/1d/">1-Day Macro {sym}</a>
        <a href="/strategies/{strat_slug}/{slug}/">Base {strat_name} Hub</a>
        <a href="/sitemap/">View Full Directory →</a>
      </div>
    </div>
  </section>
</main>"""

    return title, desc, canon, main_html, schema


def render_timeframe_indicator_content(ind: dict, coin: tuple[str, str, str, str], tf: dict) -> tuple[str, str, str, str, str]:
    """Generates (title, description, canonical_url, main_html, extra_head) for an indicator x coin x timeframe page."""
    sym, name, slug, cat = coin
    ind_slug = ind["slug"]
    ind_name = ind["name"]
    tf_slug = tf["slug"]
    tf_name = tf["name"]
    canon = f"{SITE}/indicators/{ind_slug}/{slug}/{tf_slug}/"
    title = f"{name} ({sym}) {tf_name} {ind_name} Technical Analysis & Signals | zengtrade"
    desc = f"Technical analysis rules, calculation formulas, and algorithmic signal triggers for {ind_name} on {name} ({sym}) on {tf_name}. Paper-trade signals free on live data."

    schema = f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to trade {html.escape(ind_name)} on {html.escape(name)} ({sym}) on {html.escape(tf_name)}",
  "description": "{html.escape(desc)}",
  "author": {{
    "@type": "Organization",
    "name": "zengtrade Quantitative Research",
    "url": "https://zengtrade.in/learn/algo-studio/"
  }},
  "publisher": {{
    "@type": "Organization",
    "name": "zengtrade",
    "url": "https://zengtrade.in/",
    "logo": "https://zengtrade.in/assets/logo.svg"
  }},
  "step": [
    {{"@type": "HowToStep", "name": "Set Timeframe to {html.escape(tf_name)}", "text": "Select {tf_slug.upper()} on your TradingView chart canvas."}},
    {{"@type": "HowToStep", "name": "Compute {html.escape(ind_name)}", "text": "Apply formula: {html.escape(ind['formula'])}."}},
    {{"@type": "HowToStep", "name": "Filter False Breaks", "text": "{tf['noise_filter']}."}},
    {{"@type": "HowToStep", "name": "Deploy Forward Paper Simulation", "text": "Forward-test with automated ATR risk brackets in Zengtrade Algo Studio."}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://zengtrade.in/"}},
    {{"@type": "ListItem", "position": 2, "name": "Indicators", "item": "https://zengtrade.in/sitemap/#indicators"}},
    {{"@type": "ListItem", "position": 3, "name": "{html.escape(ind_name)}", "item": "https://zengtrade.in/indicators/{ind_slug}/{slug}/"}},
    {{"@type": "ListItem", "position": 4, "name": "{html.escape(tf_name)}", "item": "{canon}"}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{
      "@type": "Question",
      "name": "What is the recommended {html.escape(ind_name)} lookback on {html.escape(tf_name)} for {sym}?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "The standard lookback is {ind['standard_lookback']}, with noise filtering tuned for {tf['horizon']}."
      }}
    }},
    {{
      "@type": "Question",
      "name": "How to prevent false signals on {html.escape(tf_name)}?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "{tf['noise_filter']} and verify market regime context before executing orders."
      }}
    }}
  ]
}}
</script>"""

    main_html = f"""<main id="main" class="pseo-page">
  <section class="lp-hero pseo-hero">
    <div class="lp-wrap">
      <div class="pseo-breadcrumbs">
        <a href="/">Home</a> <span>/</span>
        <a href="/sitemap/#indicators">Indicators</a> <span>/</span>
        <a href="/indicators/{ind_slug}/{slug}/">{ind_name} {sym}</a> <span>/</span>
        <span class="active">{tf_name}</span>
      </div>
      <div class="lp-eyebrow"><span class="dot"></span> {tf_name} · {ind['type']}</div>
      <h1 class="lp-h1">{name} ({sym}) {tf_name} {ind_name}</h1>
      <p class="lp-lead">{desc}</p>
      <div class="lp-hero-cta">
        <a href="/dashboard" class="btn btn-primary">Automate {ind_name} on {sym} ({tf_slug.upper()}) →</a>
        <a href="/indicators/{ind_slug}/{slug}/" class="btn btn-secondary">Base Indicator Hub</a>
      </div>
      <div class="pseo-chart-card">
        <div class="chart-header">
          <div class="chart-title">
            <span class="pulse-live"></span>
            <strong>{name} / USDT</strong> <span class="chart-tag">BINANCE LIVE ({tf_slug.upper()})</span>
          </div>
          <div class="chart-metrics">
            <span class="cm-pill">Lookback: <strong>{ind['standard_lookback']}</strong></span>
            <span class="cm-pill">Horizon: <strong>{tf['horizon']}</strong></span>
          </div>
        </div>
        <div id="chart" style="height:360px;width:100%"></div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-specs">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Indicator Thresholds</span>
        <h2 class="lp-h2">{ind_name} Values &amp; Interpretation on {tf_name}</h2>
      </div>
      <div class="pseo-grid3">
        <div class="pseo-spec-card">
          <div class="psc-label">Standard Lookback</div>
          <div class="psc-val">{ind['standard_lookback']}</div>
          <p>Tuned for continuous {tf_name} volatility cycles.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Oversold Boundary</div>
          <div class="psc-val">{ind['oversold_level']}</div>
          <p>Potential downside momentum exhaustion zone on {tf_slug.upper()}.</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Overbought Boundary</div>
          <div class="psc-val">{ind['overbought_level']}</div>
          <p>Potential upside momentum climax zone on {tf_slug.upper()}.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-details">
    <div class="lp-wrap lp-grid2">
      <div class="pseo-box">
        <h3>Mathematical Formula</h3>
        <div class="formula-box"><code>{html.escape(ind['formula'])}</code></div>
        <p><strong>Value Range:</strong> {ind['range_spec']}</p>
        <p><strong>Best Practice:</strong> {ind['best_practice']}</p>
      </div>
      <div class="pseo-box">
        <h3>Algorithmic Automation ({tf_slug.upper()})</h3>
        <p>Automate {ind_name} signals and alerts without manual screen staring:</p>
        <ul class="pseo-list">
          <li><strong>Noise Reduction:</strong> {tf['noise_filter']}</li>
          <li><strong>In-Canvas Brackets:</strong> Visualizes green Target and red Stop Loss zones directly on TradingView charts.</li>
          <li><strong>Zero Capital Risk:</strong> Forward-test profitability on live data before risking live capital.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-eeat-wrap">
    <div class="lp-wrap">
      <div class="pseo-eeat-card">
        <div class="eeat-badge"><span>✓</span> Mathematical Rigor &amp; Technical Analysis Governance</div>
        <p><strong>Authored &amp; Verified by Zengtrade Quantitative Research:</strong> Technical formulas for {ind_name} on {name} ({sym}) conform to classical quantitative definitions with crypto-specific parameter adaptations. Signal triggers should be confirmed across market regimes and executed with disciplined ATR risk brackets in paper simulation before risking live capital. Read our <a href="/learn/glossary/">Technical Glossary</a> and <a href="/risk/">Risk Disclosures</a>.</p>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-related">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Timeframes</span>
        <h2 class="lp-h2">Explore {ind_name} on Other Horizons for {name}</h2>
      </div>
      <div class="pseo-link-matrix">
        <a href="/indicators/{ind_slug}/{slug}/15m/">15-Minute Intraday {sym}</a>
        <a href="/indicators/{ind_slug}/{slug}/1h/">1-Hour Swing {sym}</a>
        <a href="/indicators/{ind_slug}/{slug}/1d/">1-Day Macro {sym}</a>
        <a href="/indicators/{ind_slug}/{slug}/">Base {ind_name} Hub</a>
        <a href="/sitemap/">View Full Directory →</a>
      </div>
    </div>
  </section>
</main>"""

    return title, desc, canon, main_html, schema


def render_strategy_comparison_content(comp: dict, coin: tuple[str, str, str, str]) -> tuple[str, str, str, str, str]:
    """Generates (title, description, canonical_url, main_html, extra_head) for a strategy comparison x coin page."""
    sym, name, slug, cat = coin
    comp_slug = comp["slug"]
    comp_name = comp["name"]
    s1_name = comp["strat1_name"]
    s2_name = comp["strat2_name"]
    canon = f"{SITE}/compare/{comp_slug}/{slug}/"
    title = f"{s1_name} vs {s2_name} on {name} ({sym}) | zengtrade"
    desc = f"Quantitative comparison of {s1_name} vs {s2_name} on {name} ({sym}). Win rates, drawdown profiles, regime fit, and paper trading simulation."

    schema = f"""<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{html.escape(title)}",
  "description": "{html.escape(desc)}",
  "author": {{
    "@type": "Organization",
    "name": "zengtrade Quantitative Research",
    "url": "https://zengtrade.in/learn/algo-studio/"
  }},
  "publisher": {{
    "@type": "Organization",
    "name": "zengtrade",
    "url": "https://zengtrade.in/",
    "logo": "https://zengtrade.in/assets/logo.svg"
  }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{"@type": "ListItem", "position": 1, "name": "Home", "item": "https://zengtrade.in/"}},
    {{"@type": "ListItem", "position": 2, "name": "Strategy Showdowns", "item": "https://zengtrade.in/sitemap/#showdowns"}},
    {{"@type": "ListItem", "position": 3, "name": "{html.escape(comp_name)} on {html.escape(sym)}", "item": "{canon}"}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{
      "@type": "Question",
      "name": "Which strategy performs better on {html.escape(name)} ({sym}): {html.escape(s1_name)} or {html.escape(s2_name)}?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "{comp['verdict']}"
      }}
    }},
    {{
      "@type": "Question",
      "name": "How do these strategies handle choppy market regimes?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "{comp['winner_in_chop']}"
      }}
    }}
  ]
}}
</script>"""

    main_html = f"""<main id="main" class="pseo-page">
  <section class="lp-hero pseo-hero">
    <div class="lp-wrap">
      <div class="pseo-breadcrumbs">
        <a href="/">Home</a> <span>/</span>
        <a href="/sitemap/#showdowns">Strategy Showdowns</a> <span>/</span>
        <span class="active">{s1_name} vs {s2_name} ({sym})</span>
      </div>
      <div class="lp-eyebrow"><span class="dot"></span> Quantitative Strategy Showdown · Head-to-Head Comparison</div>
      <h1 class="lp-h1">{s1_name} vs {s2_name} on {name} ({sym})</h1>
      <p class="lp-lead">{comp['comparison_thesis']}</p>
      <div class="lp-hero-cta">
        <a href="/dashboard" class="btn btn-primary">Forward-Test Both Strategies on {sym} Free →</a>
        <a href="/sitemap/" class="btn btn-secondary">Browse All 150,000 Hubs</a>
      </div>
      <div class="pseo-chart-card">
        <div class="chart-header">
          <div class="chart-title">
            <span class="pulse-live"></span>
            <strong>{name} / USDT</strong> <span class="chart-tag">BINANCE LIVE</span>
          </div>
          <div class="chart-metrics">
            <span class="cm-pill">Strategy A: <strong>{s1_name}</strong></span>
            <span class="cm-pill">Strategy B: <strong>{s2_name}</strong></span>
          </div>
        </div>
        <div id="chart" style="height:360px;width:100%"></div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-specs">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Head-to-Head Comparison</span>
        <h2 class="lp-h2">Quantitative Matrix: {s1_name} vs {s2_name}</h2>
      </div>
      <div class="pseo-grid3">
        <div class="pseo-spec-card">
          <div class="psc-label">Trending Market Edge</div>
          <div class="psc-val">{s1_name if 'Supertrend' in s1_name or 'Breakout' in s1_name else s2_name}</div>
          <p>{comp['winner_in_trend']}</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Choppy Range Defense</div>
          <div class="psc-val">{s2_name if 'EMA' in s2_name or 'DCA' in s2_name or 'Reversion' in s1_name else s1_name}</div>
          <p>{comp['winner_in_chop']}</p>
        </div>
        <div class="pseo-spec-card">
          <div class="psc-label">Quantitative Verdict</div>
          <div class="psc-val">Optimal Allocation</div>
          <p>{comp['verdict']}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-details">
    <div class="lp-wrap lp-grid2">
      <div class="pseo-box">
        <h3>Execution Dynamics for {sym}</h3>
        <p>Trading edge is not about picking a single strategy for all market conditions. It requires regime-aware execution:</p>
        <ul class="pseo-list">
          <li><strong>{s1_name}:</strong> Best suited when directional volume expands and trend persistence is verified.</li>
          <li><strong>{s2_name}:</strong> Best deployed during mean-reverting or structural accumulation phases.</li>
          <li><strong>Execution Friction:</strong> Both models factor 35 bps round-trip friction for honest paper testing.</li>
        </ul>
      </div>
      <div class="pseo-box">
        <h3>Dual Simulation in Algo Studio</h3>
        <p>Deploy both models concurrently on live Binance spot feeds with zero financial capital at risk:</p>
        <ul class="pseo-list">
          <li><strong>Side-by-Side Paper Tracking:</strong> Compare real-time equity curves, maximum drawdowns, and Sharpe ratios.</li>
          <li><strong>In-Canvas Brackets:</strong> Inspect live Target Price and Stop Loss orders plotted directly on your TradingView chart canvas.</li>
          <li><strong>Non-Custodial Security:</strong> Your exchange keys remain strictly read/trade only.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-eeat-wrap">
    <div class="lp-wrap">
      <div class="pseo-eeat-card">
        <div class="eeat-badge"><span>✓</span> Strategy Governance &amp; Comparative Methodology</div>
        <p><strong>Authored &amp; Verified by Zengtrade Quantitative Research:</strong> Strategy comparison metrics evaluate historical win rates, maximum drawdown recovery periods, and parameter stability across {name} ({sym}) spot archives. 35 bps round-trip fee and slippage friction is modeled on all executions. Paper-first forward testing is mandatory before capital deployment. Read our <a href="/how-it-works/">Quantitative Methodology</a> and <a href="/risk/">Risk Disclosures</a>.</p>
      </div>
    </div>
  </section>

  <section class="lp-sec pseo-related">
    <div class="lp-wrap">
      <div class="lp-sec-head">
        <span class="lp-tag">Individual Strategy Hubs</span>
        <h2 class="lp-h2">Deep Dive into Each Engine for {name}</h2>
      </div>
      <div class="pseo-link-matrix">
        <a href="/strategies/{comp['strat1_slug']}/{slug}/">{s1_name} {sym} Hub</a>
        <a href="/strategies/{comp['strat2_slug']}/{slug}/">{s2_name} {sym} Hub</a>
        <a href="/sitemap/">View Full Directory →</a>
      </div>
    </div>
  </section>
</main>"""

    return title, desc, canon, main_html, schema


def generate_llms_txt(dist_dir: str):
    """Generates /llms.txt per the llmstxt.org specification for LLM crawler ingestion."""
    content = f"""# zengtrade

> Non-custodial quantitative crypto trading platform featuring rule-based systematic strategies, real-time TradingView charting, forward paper trading simulations, and risk governance.

## Overview
Zengtrade provides retail and institutional traders with zero-capital-risk forward paper testing on live Binance spot feeds, automated risk brackets, and regime-based capital preservation.

## Systematic Trading Strategies (15 Models)
- Supertrend Volatility Breakout: https://zengtrade.in/strategies/supertrend-breakout/bitcoin/
- Dual EMA Golden Cross (50/200): https://zengtrade.in/strategies/dual-ema-cross/bitcoin/
- Bollinger Band Mean Reversion: https://zengtrade.in/strategies/bollinger-mean-reversion/bitcoin/
- Delta-Neutral Funding Rate Cash & Carry: https://zengtrade.in/strategies/funding-rate-arbitrage/bitcoin/
- Dynamic DCA Grid Accumulation: https://zengtrade.in/strategies/dynamic-dca-grid/bitcoin/
- MACD Momentum Divergence: https://zengtrade.in/strategies/macd-divergence/bitcoin/
- RSI Dynamic Mean Reversion: https://zengtrade.in/strategies/rsi-mean-reversion/bitcoin/
- Volume Breakout & Liquidity Absorption: https://zengtrade.in/strategies/volume-breakout/bitcoin/
- Parabolic SAR Trailing Momentum: https://zengtrade.in/strategies/parabolic-sar/bitcoin/
- Keltner Channel Volatility Squeeze: https://zengtrade.in/strategies/keltner-squeeze/bitcoin/
- Ichimoku Cloud Kumo Breakout: https://zengtrade.in/strategies/ichimoku-cloud-breakout/bitcoin/
- Stochastic RSI Overbought/Oversold Reversal: https://zengtrade.in/strategies/stochastic-rsi/bitcoin/
- ATR Trailing Profit Ladder: https://zengtrade.in/strategies/atr-trailing-ladder/bitcoin/
- OBV Institutional Flow Confirmation: https://zengtrade.in/strategies/obv-institutional-flow/bitcoin/
- Donchian Channel Trend Breakout: https://zengtrade.in/strategies/donchian-breakout/bitcoin/

## Technical Indicators (15 Models)
- RSI (Relative Strength Index): https://zengtrade.in/indicators/rsi/bitcoin/
- MACD (Moving Average Convergence Divergence): https://zengtrade.in/indicators/macd/bitcoin/
- Supertrend: https://zengtrade.in/indicators/supertrend/bitcoin/
- Bollinger Bands: https://zengtrade.in/indicators/bollinger-bands/bitcoin/
- 200 EMA (Exponential Moving Average): https://zengtrade.in/indicators/ema-200/bitcoin/
- VWAP (Volume-Weighted Average Price): https://zengtrade.in/indicators/vwap/bitcoin/
- ATR (Average True Range): https://zengtrade.in/indicators/atr/bitcoin/
- Stochastic RSI: https://zengtrade.in/indicators/stochastic-rsi/bitcoin/
- OBV (On-Balance Volume): https://zengtrade.in/indicators/obv/bitcoin/
- Donchian Channels: https://zengtrade.in/indicators/donchian-channels/bitcoin/
- Keltner Channels: https://zengtrade.in/indicators/keltner-channels/bitcoin/
- Stochastic Oscillator: https://zengtrade.in/indicators/stochastic-oscillator/bitcoin/
- ADX Trend Strength: https://zengtrade.in/indicators/adx-trend-strength/bitcoin/

## Market Regimes & Capital Preservation
- Bull Trend Regime (Long Expansion, 10-20% Cash Buffer): https://zengtrade.in/regimes/bull/bitcoin/
- Neutral Consolidation Regime (Mean Reversion, 40-60% Cash): https://zengtrade.in/regimes/neutral/bitcoin/
- Bear Defense Regime (Capital Preservation, 70-90% Cash): https://zengtrade.in/regimes/bear/bitcoin/

## Execution Modeling & Governance
- Round-trip Friction Model: 35 basis points (exchange maker/taker fees + spread + slippage buffer).
- Architecture: Strict non-custodial design (zero client deposits, read/trade-only API keys, no commission on trading volume).
- Documentation: https://zengtrade.in/how-it-works/
- Risk Disclosures: https://zengtrade.in/risk/
- Glossary & Research: https://zengtrade.in/learn/glossary/
"""
    with open(os.path.join(dist_dir, "llms.txt"), "w", encoding="utf-8") as f:
        f.write(content)


def generate_llms_full_txt(dist_dir: str):
    """Generates /llms-full.txt with complete programmatic quant methodology for AI indexing."""
    strat_details = "\n".join([f"### {s['name']}\n- Formula: `{s['math_formula']}`\n- Entry: {s['entry_rule']}\n- Exit: {s['exit_rule']}\n- Regime Fit: {s['regime_fit']}\n" for s in STRATEGIES])
    ind_details = "\n".join([f"### {i['name']}\n- Formula: `{i['formula']}`\n- Standard Lookback: {i['standard_lookback']}\n- Interpretation: {i['interpretation']}\n" for i in INDICATORS])
    comp_details = "\n".join([f"### {c['name']}\n- Thesis: {c['comparison_thesis']}\n- Verdict: {c['verdict']}\n" for c in SHOWDOWNS])

    content = f"""# zengtrade Full Knowledge Base & Technical Documentation

> Non-custodial quantitative algorithmic crypto trading engine, forward paper trading simulation, and market regime governance.

## Systematic Trading Engine Formulas
{strat_details}

## Technical Indicator Specifications
{ind_details}

## Strategy Head-to-Head Comparison Framework
{comp_details}

## Risk Governance & Execution Transparency
Every paper trade in Zengtrade Algo Studio factors:
1. 0.10% Spot exchange taker fee
2. 0.10% Spot exchange maker fee
3. 0.15% Volume-weighted dynamic slippage buffer
Total Round-Trip Friction: 35 basis points.

Learn more at https://zengtrade.in/how-it-works/ and https://zengtrade.in/risk/.
"""
    with open(os.path.join(dist_dir, "llms-full.txt"), "w", encoding="utf-8") as f:
        f.write(content)


def generate_sitemap_html(coins: list, strategies: list, indicators: list, regimes: list) -> tuple[str, str, str, str]:
    """Generates the /sitemap/ human-navigable interactive HTML directory."""
    canon = f"{SITE}/sitemap/"
    title = "Sitemap & Systematic Trading Directory | zengtrade"
    desc = "Complete index of 150,000 systematic crypto trading strategies, technical indicators, coin hubs, market regimes, timeframes, and educational guides on zengtrade."

    top_coins = coins[:50]

    main_html = f"""<main id="main" class="sitemap-page">
  <section class="lp-hero sm-hero">
    <div class="lp-wrap">
      <div class="lp-eyebrow"><span class="dot"></span> Systematic Trading Hubs &middot; Complete Directory</div>
      <h1 class="lp-h1">Zengtrade <span class="hl">Sitemap &amp; Directory</span></h1>
      <p class="lp-sub">Explore our comprehensive programmatic directory of quantitative trading strategies, indicator benchmarks, timeframe calibrations, strategy showdowns, and crypto coin analytics.</p>
      <div class="sm-search-bar">
        <input type="search" id="smSearchInput" placeholder="Filter strategies, indicators, timeframes, or coins (e.g. Bitcoin, 5m, RSI, Supertrend, Solana)..." aria-label="Search directory">
      </div>
    </div>
  </section>

  <section class="lp-sec sm-content">
    <div class="lp-wrap">
      <div class="sm-tabs" role="tablist">
        <button class="sm-tab active" data-tab="core">Core Platform</button>
        <button class="sm-tab" data-tab="strategies">Strategies</button>
        <button class="sm-tab" data-tab="indicators">Indicators</button>
        <button class="sm-tab" data-tab="timeframes">Timeframes</button>
        <button class="sm-tab" data-tab="showdowns">Showdowns</button>
        <button class="sm-tab" data-tab="regimes">Regimes</button>
        <button class="sm-tab" data-tab="coins">Coins Hub</button>
        <button class="sm-tab" data-tab="learn">Learn &amp; Docs</button>
      </div>

      <!-- Core Platform -->
      <div class="sm-panel active" id="tab-core">
        <h2 class="lp-h2">Platform &amp; Workstations</h2>
        <div class="sm-grid">
          <a class="sm-card" href="/"><strong>Home</strong><span>Regime-aware crypto trading overview</span></a>
          <a class="sm-card" href="/how-it-works/"><strong>How It Works</strong><span>Regime engine, risk governor, and go-live bar</span></a>
          <a class="sm-card" href="/pricing/"><strong>Pricing</strong><span>Free paper tier and Pro subscription details</span></a>
          <a class="sm-card" href="/dashboard/"><strong>Algo Studio</strong><span>Strategy builder, backtest, and forward-test</span></a>
          <a class="sm-card" href="/login/"><strong>Login &amp; Signup</strong><span>Authentication and non-custodial onboarding</span></a>
          <a class="sm-card" href="/app/"><strong>Account &amp; Evidence</strong><span>Paper trade tracking and analytics</span></a>
          <a class="sm-card" href="/llms.txt"><strong>LLMs Directory</strong><span>Machine-readable documentation for AI agents</span></a>
          <a class="sm-card" href="/risk/"><strong>Risk Disclosures</strong><span>Non-custodial trading transparency</span></a>
        </div>
      </div>

      <!-- Strategies -->
      <div class="sm-panel" id="tab-strategies">
        <h2 class="lp-h2">Systematic Trading Strategies</h2>
        <div class="sm-strat-list">
"""
    for s in strategies:
        main_html += f"""          <div class="sm-strat-block">
            <h3>{s['name']} <span class="sm-cat">{s['category']}</span></h3>
            <p>{s['summary']} (Fit: <em>{s['regime_fit']}</em> · R:R: <em>{s['risk_reward']}</em>)</p>
            <div class="sm-coin-chips">
"""
        for sym, name, slug, cat in top_coins[:12]:
            main_html += f'              <a href="/strategies/{s["slug"]}/{slug}/">{sym}</a>\n'
        main_html += f"""              <a href="/strategies/{s['slug']}/bitcoin/" class="more-link">+ more coins →</a>
            </div>
          </div>
"""
    main_html += """        </div>
      </div>

      <!-- Indicators -->
      <div class="sm-panel" id="tab-indicators">
        <h2 class="lp-h2">Technical Indicators &amp; Signal Triggers</h2>
        <div class="sm-strat-list">
"""
    for ind in indicators:
        main_html += f"""          <div class="sm-strat-block">
            <h3>{ind['name']} <span class="sm-cat">{ind['type']}</span></h3>
            <p>{ind['interpretation']} (Standard: <em>{ind['standard_lookback']}</em>)</p>
            <div class="sm-coin-chips">
"""
        for sym, name, slug, cat in top_coins[:12]:
            main_html += f'              <a href="/indicators/{ind["slug"]}/{slug}/">{sym}</a>\n'
        main_html += f"""              <a href="/indicators/{ind['slug']}/bitcoin/" class="more-link">+ more coins →</a>
            </div>
          </div>
"""
    main_html += """        </div>
      </div>

      <!-- Timeframes -->
      <div class="sm-panel" id="tab-timeframes">
        <h2 class="lp-h2">Multi-Timeframe Horizon Calibrations</h2>
        <div class="sm-strat-list">
"""
    for tf in TIMEFRAMES:
        main_html += f"""          <div class="sm-strat-block">
            <h3>{tf['name']} ({tf['slug'].upper()}) <span class="sm-cat">{tf['horizon']}</span></h3>
            <p>{tf['best_for']}. Noise filter: <em>{tf['noise_filter']}</em>.</p>
            <div class="sm-coin-chips">
"""
        for sym, name, slug, cat in top_coins[:10]:
            main_html += f'              <a href="/strategies/supertrend-breakout/{slug}/{tf["slug"]}/">{sym} Supertrend ({tf["slug"]})</a>\n'
        main_html += f"""              <a href="/strategies/supertrend-breakout/bitcoin/{tf['slug']}/" class="more-link">+ more pairs →</a>
            </div>
          </div>
"""
    main_html += """        </div>
      </div>

      <!-- Showdowns -->
      <div class="sm-panel" id="tab-showdowns">
        <h2 class="lp-h2">Strategy Showdowns &amp; Comparisons</h2>
        <div class="sm-strat-list">
"""
    for comp in SHOWDOWNS:
        main_html += f"""          <div class="sm-strat-block">
            <h3>{comp['name']}</h3>
            <p>{comp['comparison_thesis']}</p>
            <div class="sm-coin-chips">
"""
        for sym, name, slug, cat in top_coins[:12]:
            main_html += f'              <a href="/compare/{comp["slug"]}/{slug}/">{sym}</a>\n'
        main_html += f"""              <a href="/compare/{comp['slug']}/bitcoin/" class="more-link">+ all 1,000 coins →</a>
            </div>
          </div>
"""
    main_html += """        </div>
      </div>

      <!-- Regimes -->
      <div class="sm-panel" id="tab-regimes">
        <h2 class="lp-h2">Market Regimes &amp; Cash Allocations</h2>
        <div class="sm-strat-list">
"""
    for r in regimes:
        main_html += f"""          <div class="sm-strat-block">
            <h3>{r['name']} <span class="sm-cat">{r['cash_allocation']}</span></h3>
            <p>{r['overview']} Risk Governor: <em>{r['risk_governor']}</em></p>
            <div class="sm-coin-chips">
"""
        for sym, name, slug, cat in top_coins[:12]:
            main_html += f'              <a href="/regimes/{r["slug"]}/{slug}/">{sym}</a>\n'
        main_html += f"""              <a href="/regimes/{r['slug']}/bitcoin/" class="more-link">+ more coins →</a>
            </div>
          </div>
"""
    main_html += f"""        </div>
      </div>

      <!-- Coins Hub -->
      <div class="sm-panel" id="tab-coins">
        <h2 class="lp-h2">Monitored Crypto Assets</h2>
        <div class="sm-coins-grid">
"""
    for sym, name, slug, cat in coins:
        main_html += f"""          <a class="sm-coin-card" href="/coins/{slug}/">
            <span class="sm-sym">{sym}</span>
            <span class="sm-name">{name}</span>
            <span class="sm-cat">{cat}</span>
          </a>
"""
    main_html += """        </div>
      </div>

      <!-- Learn -->
      <div class="sm-panel" id="tab-learn">
        <h2 class="lp-h2">Educational Guides &amp; Glossary</h2>
        <div class="sm-grid">
          <a class="sm-card" href="/learn/investing/"><strong>Investing Track</strong><span>Long-horizon accumulation, dollar-cost averaging, and portfolio survival</span></a>
          <a class="sm-card" href="/learn/trading/"><strong>Trading Track</strong><span>Technical momentum, support and resistance, and risk-reward brackets</span></a>
          <a class="sm-card" href="/learn/algo-studio/"><strong>Algo Studio Track</strong><span>Quantitative backtesting, execution modeling, and rule-based trading</span></a>
          <a class="sm-card" href="/learn/glossary/"><strong>Risk &amp; Trading Glossary</strong><span>Comprehensive encyclopedia of quantitative terms</span></a>
        </div>
      </div>
    </div>
  </section>
</main>
<script>
document.addEventListener('DOMContentLoaded', function() {{
  var tabs = document.querySelectorAll('.sm-tab');
  var panels = document.querySelectorAll('.sm-panel');
  tabs.forEach(function(tab) {{
    tab.addEventListener('click', function() {{
      tabs.forEach(function(t) {{ t.classList.remove('active'); }});
      panels.forEach(function(p) {{ p.classList.remove('active'); }});
      tab.classList.add('active');
      var target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) target.classList.add('active');
    }});
  }});

  var search = document.getElementById('smSearchInput');
  if (search) {{
    search.addEventListener('input', function(e) {{
      var q = e.target.value.toLowerCase().trim();
      var cards = document.querySelectorAll('.sm-strat-block, .sm-card, .sm-coin-card');
      cards.forEach(function(card) {{
        if (!q || card.textContent.toLowerCase().includes(q)) {{
          card.style.display = '';
        }} else {{
          card.style.display = 'none';
        }}
      }});
    }});
  }}
}});
</script>"""

    return title, desc, canon, main_html


def resolve_pseo_page(clean_path: str, shell_func, coin_roster: list) -> str | None:
    """Dynamically resolves and renders any of the 150,000 pSEO pages on the fly."""
    parts = [p for p in clean_path.strip("/").split("/") if p]
    if not parts:
        return None

    coin_map = {c[2]: c for c in coin_roster}
    strat_map = {s["slug"]: s for s in STRATEGIES}
    ind_map = {i["slug"]: i for i in INDICATORS}
    reg_map = {r["slug"]: r for r in REGIMES}
    tf_map = {t["slug"]: t for t in TIMEFRAMES}
    showdown_map = {s["slug"]: s for s in SHOWDOWNS}

    # /strategies/{strat}/{coin}/
    if len(parts) == 3 and parts[0] == "strategies" and parts[1] in strat_map and parts[2] in coin_map:
        title, desc, canon, mhtml, extra = render_strategy_coin_content(strat_map[parts[1]], coin_map[parts[2]])
        return shell_func(title, desc, canon, mhtml, extra_head=extra)

    # /strategies/{strat}/{coin}/{tf}/
    if len(parts) == 4 and parts[0] == "strategies" and parts[1] in strat_map and parts[2] in coin_map and parts[3] in tf_map:
        title, desc, canon, mhtml, extra = render_timeframe_strategy_content(strat_map[parts[1]], coin_map[parts[2]], tf_map[parts[3]])
        return shell_func(title, desc, canon, mhtml, extra_head=extra)

    # /indicators/{ind}/{coin}/
    if len(parts) == 3 and parts[0] == "indicators" and parts[1] in ind_map and parts[2] in coin_map:
        title, desc, canon, mhtml, extra = render_indicator_coin_content(ind_map[parts[1]], coin_map[parts[2]])
        return shell_func(title, desc, canon, mhtml, extra_head=extra)

    # /indicators/{ind}/{coin}/{tf}/
    if len(parts) == 4 and parts[0] == "indicators" and parts[1] in ind_map and parts[2] in coin_map and parts[3] in tf_map:
        title, desc, canon, mhtml, extra = render_timeframe_indicator_content(ind_map[parts[1]], coin_map[parts[2]], tf_map[parts[3]])
        return shell_func(title, desc, canon, mhtml, extra_head=extra)

    # /regimes/{reg}/{coin}/
    if len(parts) == 3 and parts[0] == "regimes" and parts[1] in reg_map and parts[2] in coin_map:
        title, desc, canon, mhtml, extra = render_regime_coin_content(reg_map[parts[1]], coin_map[parts[2]])
        return shell_func(title, desc, canon, mhtml, extra_head=extra)

    # /compare/{showdown}/{coin}/
    if len(parts) == 3 and parts[0] == "compare" and parts[1] in showdown_map and parts[2] in coin_map:
        title, desc, canon, mhtml, extra = render_strategy_comparison_content(showdown_map[parts[1]], coin_map[parts[2]])
        return shell_func(title, desc, canon, mhtml, extra_head=extra)

    return None


def emit_pseo_catalog(dist_dir: str, shell_func, coin_roster: list, sample_only: bool = False) -> dict[str, list[str]]:
    """Emits strategy, indicator, regime, timeframe, and comparison pages.

    Returns a dict with lists of canonical URLs for XML sitemap generation.
    """
    strat_urls = []
    ind_urls = []
    reg_urls = []
    tf_strat_urls = []
    tf_ind_urls = []
    comp_urls = []

    coins_to_run = coin_roster[:5] if sample_only else coin_roster

    def minify_html(raw: str) -> str:
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        return "\n".join(lines)

    def write_page(out_dir: str, content: str):
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(minify_html(content))

    tasks = []

    # 1. Strategies (15 x coins)
    for s in STRATEGIES:
        for c in coins_to_run:
            title, desc, canon, mhtml, extra = render_strategy_coin_content(s, c)
            out_d = os.path.join(dist_dir, "strategies", s["slug"], c[2])
            tasks.append((out_d, shell_func(title, desc, canon, mhtml, extra_head=extra)))
            strat_urls.append(canon)

    # 2. Indicators (15 x coins)
    for ind in INDICATORS:
        for c in coins_to_run:
            title, desc, canon, mhtml, extra = render_indicator_coin_content(ind, c)
            out_d = os.path.join(dist_dir, "indicators", ind["slug"], c[2])
            tasks.append((out_d, shell_func(title, desc, canon, mhtml, extra_head=extra)))
            ind_urls.append(canon)

    # 3. Regimes (3 x coins)
    for reg in REGIMES:
        for c in coins_to_run:
            title, desc, canon, mhtml, extra = render_regime_coin_content(reg, c)
            out_d = os.path.join(dist_dir, "regimes", reg["slug"], c[2])
            tasks.append((out_d, shell_func(title, desc, canon, mhtml, extra_head=extra)))
            reg_urls.append(canon)

    # 4. Timeframe Strategies (15 x 5 x coins)
    for s in STRATEGIES:
        for tf in TIMEFRAMES:
            for c in coins_to_run:
                title, desc, canon, mhtml, extra = render_timeframe_strategy_content(s, c, tf)
                out_d = os.path.join(dist_dir, "strategies", s["slug"], c[2], tf["slug"])
                tasks.append((out_d, shell_func(title, desc, canon, mhtml, extra_head=extra)))
                tf_strat_urls.append(canon)

    # 5. Timeframe Indicators (12 x 3 x coins)
    tf_ind_subset = [tf for tf in TIMEFRAMES if tf["slug"] in ("15m", "1h", "1d")]
    for ind in INDICATORS[:12]:
        for tf in tf_ind_subset:
            for c in coins_to_run:
                title, desc, canon, mhtml, extra = render_timeframe_indicator_content(ind, c, tf)
                out_d = os.path.join(dist_dir, "indicators", ind["slug"], c[2], tf["slug"])
                tasks.append((out_d, shell_func(title, desc, canon, mhtml, extra_head=extra)))
                tf_ind_urls.append(canon)

    # 6. Strategy Showdowns (6 x coins)
    for comp in SHOWDOWNS:
        for c in coins_to_run:
            title, desc, canon, mhtml, extra = render_strategy_comparison_content(comp, c)
            out_d = os.path.join(dist_dir, "compare", comp["slug"], c[2])
            tasks.append((out_d, shell_func(title, desc, canon, mhtml, extra_head=extra)))
            comp_urls.append(canon)

    print(f"Emitting {len(tasks)} programmatic SEO pages into dist...")
    with ThreadPoolExecutor(max_workers=16) as ex:
        list(ex.map(lambda t: write_page(t[0], t[1]), tasks))

    print(f"Successfully generated {len(strat_urls)} strategies, {len(ind_urls)} indicators, {len(reg_urls)} regimes, {len(tf_strat_urls)} tf-strategies, {len(tf_ind_urls)} tf-indicators, and {len(comp_urls)} showdowns.")
    return {
        "strategies": strat_urls,
        "indicators": ind_urls,
        "regimes": reg_urls,
        "timeframes_strat": tf_strat_urls,
        "timeframes_ind": tf_ind_urls,
        "compare": comp_urls
    }


def emit_xml_sitemaps(dist_dir: str, partitions: dict[str, list[str]], build_date: str):
    """Emits partitioned XML sitemaps chunked under 45,000 URLs and a root sitemap-index.xml for GSC compliance."""
    sub_sitemaps = []
    MAX_CHUNK = 45000

    for name, url_list in partitions.items():
        if not url_list:
            continue

        if len(url_list) > MAX_CHUNK:
            chunks = [url_list[i:i + MAX_CHUNK] for i in range(0, len(url_list), MAX_CHUNK)]
            for part_idx, chunk in enumerate(chunks, 1):
                sm_filename = f"sitemap-{name}-{part_idx}.xml"
                sub_sitemaps.append(f"{SITE}/{sm_filename}")
                xml_body = ['<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
                for u in chunk:
                    xml_body.append(f"  <url><loc>{u}</loc><lastmod>{build_date}</lastmod><changefreq>weekly</changefreq></url>\n")
                xml_body.append("</urlset>\n")
                with open(os.path.join(dist_dir, sm_filename), "w", encoding="utf-8") as f:
                    f.write("".join(xml_body))
                print(f"  ✓ {sm_filename} ({len(chunk)} URLs)")
        else:
            sm_filename = f"sitemap-{name}.xml"
            sub_sitemaps.append(f"{SITE}/{sm_filename}")
            xml_body = ['<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
            for u in url_list:
                xml_body.append(f"  <url><loc>{u}</loc><lastmod>{build_date}</lastmod><changefreq>weekly</changefreq></url>\n")
            xml_body.append("</urlset>\n")
            with open(os.path.join(dist_dir, sm_filename), "w", encoding="utf-8") as f:
                f.write("".join(xml_body))
            print(f"  ✓ {sm_filename} ({len(url_list)} URLs)")

    # 1. Emit sitemap-index.xml
    index_body = ['<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
    for sm_url in sub_sitemaps:
        index_body.append(f"  <sitemap><loc>{sm_url}</loc><lastmod>{build_date}</lastmod></sitemap>\n")
    index_body.append("</sitemapindex>\n")
    with open(os.path.join(dist_dir, "sitemap-index.xml"), "w", encoding="utf-8") as f:
        f.write("".join(index_body))
    print(f"  ✓ Partitioned sitemap-index.xml written with {len(sub_sitemaps)} sub-sitemaps.")

    # 2. Emit master sitemap.xml containing all key URLs for probe-dist and unified crawlers
    all_urls = []
    for name, url_list in partitions.items():
        if name in ("core", "coins", "learn", "regimes", "compare"):
            all_urls.extend(url_list)
        else:
            # Add up to 500 representative sample URLs from each large partition
            all_urls.extend(url_list[:500])
    master_body = ['<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n']
    for u in all_urls:
        master_body.append(f"  <url><loc>{u}</loc><lastmod>{build_date}</lastmod><changefreq>weekly</changefreq></url>\n")
    master_body.append("</urlset>\n")
    with open(os.path.join(dist_dir, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write("".join(master_body))
    print(f"  ✓ Master sitemap.xml written with {len(all_urls)} URLs.")


PSEO_CSS = """
/* ---- Programmatic SEO & Sitemap Styles ---- */
.pseo-page{padding-bottom:60px}
.pseo-hero{padding:48px 0 24px;text-align:left}
.pseo-breadcrumbs{font-size:12px;color:var(--slate);margin-bottom:16px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.pseo-breadcrumbs a{color:var(--slate);text-decoration:none}
.pseo-breadcrumbs a:hover{color:var(--navy);text-decoration:underline}
.pseo-breadcrumbs .active{color:var(--navy);font-weight:600}
.pseo-specs{padding:32px 0}
.pseo-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:18px}
.pseo-spec-card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px}
.psc-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--slate)}
.psc-val{font-size:20px;font-weight:800;color:var(--navy);margin:6px 0 8px}
.pseo-spec-card p{font-size:12.5px;color:var(--slate);margin:0;line-height:1.5}
.pseo-details{padding:24px 0}
.pseo-box{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:24px}
.pseo-box h3{font-size:17px;font-weight:800;color:var(--navy);margin:0 0 14px}
.formula-box{background:rgba(0,0,0,0.3);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin-bottom:16px;overflow-x:auto}
.formula-box code{font-family:monospace;font-size:13px;color:var(--accent)}
.pseo-list{margin:12px 0 0;padding-left:18px;color:var(--slate);font-size:13px;line-height:1.7}
.pseo-list strong{color:var(--navy)}

/* E-E-A-T & Trust Methodology Card */
.pseo-eeat-wrap{padding:16px 0}
.pseo-eeat-card{background:rgba(0,171,78,0.04);border:1px solid rgba(0,171,78,0.25);border-radius:14px;padding:20px 24px}
.eeat-badge{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:var(--accent);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px}
.eeat-badge span{background:var(--accent);color:#04140a;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:900}
.pseo-eeat-card p{font-size:13px;color:var(--slate);line-height:1.6;margin:0}
.pseo-eeat-card a{color:var(--navy);font-weight:600;text-decoration:underline}
.pseo-eeat-card a:hover{color:var(--accent)}

.pseo-related{padding:32px 0}
.pseo-link-matrix{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.pseo-link-matrix a{display:inline-block;padding:7px 14px;background:var(--surface);border:1px solid var(--line);border-radius:8px;font-size:12.5px;color:var(--navy);text-decoration:none;transition:border-color 0.15s,background 0.15s}
.pseo-link-matrix a:hover{border-color:var(--accent);background:rgba(0,171,78,0.08);color:var(--accent)}

/* Sitemap Hub Portal */
.sitemap-page{padding-bottom:80px}
.sm-hero{padding:48px 0 24px;text-align:center}
.sm-search-bar{max-width:640px;margin:24px auto 0}
#smSearchInput{width:100%;padding:14px 20px;background:var(--surface);border:1px solid var(--line);border-radius:12px;font-size:14px;color:var(--navy);outline:none;transition:border-color 0.15s,box-shadow 0.15s}
#smSearchInput:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(0,171,78,0.15)}
.sm-tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:32px 0 24px}
.sm-tab{padding:9px 18px;background:var(--surface);border:1px solid var(--line);border-radius:24px;font-size:13px;font-weight:600;color:var(--slate);cursor:pointer;transition:all 0.15s}
.sm-tab:hover{color:var(--navy);border-color:var(--slate)}
.sm-tab.active{background:var(--accent);border-color:var(--accent);color:#04140a}
.sm-panel{display:none}
.sm-panel.active{display:block;animation:fadeUp 0.25s ease both}
.sm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;margin-top:18px}
.sm-card{display:flex;flex-direction:column;gap:6px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;text-decoration:none;transition:border-color 0.15s,transform 0.15s}
.sm-card:hover{border-color:var(--accent);transform:translateY(-2px)}
.sm-card strong{font-size:14px;color:var(--navy)}
.sm-card span{font-size:12px;color:var(--slate);line-height:1.4}
.sm-strat-list{display:flex;flex-direction:column;gap:18px;margin-top:20px}
.sm-strat-block{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px}
.sm-strat-block h3{margin:0 0 6px;font-size:16px;color:var(--navy)}
.sm-strat-block p{margin:0 0 14px;font-size:13px;color:var(--slate)}
.sm-coin-chips{display:flex;flex-wrap:wrap;gap:8px}
.sm-coin-chips a{display:inline-block;padding:4px 10px;background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:6px;font-size:11.5px;color:var(--navy);text-decoration:none}
.sm-coin-chips a:hover{border-color:var(--accent);color:var(--accent)}
.sm-coin-chips a.more-link{background:none;border-color:transparent;color:var(--accent);font-weight:600}
.sm-coins-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:18px}
.sm-coin-card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px;text-decoration:none;display:flex;flex-direction:column;align-items:flex-start}
.sm-coin-card:hover{border-color:var(--accent)}
.sm-sym{font-size:14px;font-weight:800;color:var(--navy)}
.sm-name{font-size:11.5px;color:var(--slate);margin:2px 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}
.sm-cat{font-size:9.5px;text-transform:uppercase;letter-spacing:0.4px;color:var(--accent);padding:2px 6px;background:rgba(0,171,78,0.1);border-radius:4px}
@media(max-width:820px){.pseo-grid3{grid-template-columns:1fr}}
"""
