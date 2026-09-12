#!/usr/bin/env python3
"""zengtrade glossary: short, accurate reference entries for the trading/risk vocabulary used
across the site and the engine itself. Sibling to content/articles.py (same shell(), same
markdown-body pattern) but a different content SHAPE on purpose: articles are long-form prose on
one topic; glossary entries are compact, one-term-per-page definitions meant to rank for "what is
X" / "X meaning" queries and to cross-link into the articles and coin pages that use each term.

Not a thin-content mill: `docs/SEO_PLAYBOOK.md`'s rule against keyword-stuffed filler applies here
too. Every entry below explains the term for real (what it is, why it matters, how zengtrade
specifically uses it where that's genuinely true) rather than padding a definition to hit a word
count. Terms marked platform=True are zengtrade's own engine vocabulary (cost gate, kill-switch,
etc.), nobody else's glossary defines these the same way, which is the point.

TERMS is a flat list of dicts: {term, slug, short, body, related, platform}
  short    - one-sentence definition, used for the hub card + meta description
  body     - markdown, full explanation (2-4 short paragraphs)
  related  - slugs of other glossary entries to cross-link at the bottom of the page
  platform - True if this is zengtrade's own engine terminology, not general trading vocabulary
"""
from __future__ import annotations
import html, json, os

try:
    import markdown as _markdown
except ImportError:
    _markdown = None

SITE = "https://zengtrade.in"

GLOSSARY_CSS = """
/* ---- glossary: reuses .article-body typography, adds the term-page furniture ---- */
.gl-hub-cat{margin:28px 0 14px}
.gl-hub-cat h2{font:800 18px/1.3 var(--sans);color:var(--navy);margin:0 0 4px}
.gl-hub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
@media(max-width:820px){.gl-hub-grid{grid-template-columns:1fr}}
.gl-term-card{display:block;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);text-decoration:none;transition:.15s}
.gl-term-card:hover{border-color:var(--accent);box-shadow:var(--shadow)}
.gl-term-card b{display:block;color:var(--navy);font-size:14px;margin-bottom:3px}
.gl-term-card span{color:var(--slate);font-size:12.5px;line-height:1.4}
.gl-badge{display:inline-block;font:700 10px/1 var(--mono);letter-spacing:.04em;text-transform:uppercase;color:var(--accent-d);background:var(--accent-soft,var(--surface-2));border-radius:99px;padding:4px 9px;margin-bottom:10px}
.gl-related{margin-top:28px;padding-top:18px;border-top:1px solid var(--line)}
.gl-related h2{font:800 15px/1.3 var(--sans);color:var(--navy);margin:0 0 10px}
.gl-related-row{display:flex;flex-wrap:wrap;gap:8px}
.gl-related-row a{font:600 12.5px/1 var(--sans);color:var(--navy);background:var(--surface-2);border:1px solid var(--line);border-radius:99px;padding:7px 12px;text-decoration:none}
.gl-related-row a:hover{border-color:var(--accent);color:var(--accent-d)}
"""

# ============================================================================================
TERMS = [
  # ---------------- Risk & position sizing ----------------
  {"term":"Average True Range (ATR)","slug":"average-true-range-atr","cat":"Risk & position sizing",
   "short":"A volatility measure: the average of how far price has moved (high to low, or from the prior close) over recent bars.",
   "body":"""Average True Range (ATR) measures how much a market typically moves over a given period, in price terms. It's computed as a rolling average of the "true range" of each bar (the greatest of high minus low, high minus prior close, and prior close minus low), usually over 14 periods.

ATR doesn't say anything about direction, only magnitude. A coin with a high ATR is moving a lot bar to bar, whichever way it's going. A low-ATR coin is quiet.

Every strategy in zengtrade's library uses ATR for the same job: sizing the stop. Instead of a fixed dollar or percent stop, positions exit at a multiple of the current ATR, so the stop automatically widens on a volatile coin and tightens on a calm one, rather than being blown out by normal noise on a wild day or sitting uselessly far away on a quiet one.""",
   "related":["chandelier-exit","stop-loss","drawdown"],"platform":False},

  {"term":"Drawdown","slug":"drawdown","cat":"Risk & position sizing",
   "short":"The decline from a portfolio's peak value to its lowest point since, the real, lived cost of a losing stretch.",
   "body":"""Drawdown measures the drop from an equity curve's high-water mark to its subsequent low, usually shown as a percentage. If a book grows to $10,000 and then falls to $8,500 before recovering, that's a 15% drawdown, regardless of how the win rate or average trade looked on the way there.

**Maximum drawdown** is the worst drawdown seen over the whole track record: the single number that answers "how bad did it get." It's arguably more important than average returns for judging whether a strategy (or a person) can actually survive running it live. A strategy with a great CAGR but a 60% max drawdown is a strategy most people abandon at the worst possible moment.

zengtrade's Risk Governor watches live drawdown continuously and steps sizing down, or halts new entries entirely via the kill-switch, as drawdown deepens, rather than letting a losing stretch compound unchecked.""",
   "related":["kill-switch","risk-governor","position-sizing"],"platform":False},

  {"term":"Position Sizing","slug":"position-sizing","cat":"Risk & position sizing",
   "short":"How much capital goes into a single trade, the decision that determines whether a losing streak is survivable or account-ending.",
   "body":"""Position sizing answers one question: how much of the book should ride on this one trade? It's separate from, and arguably more important than, the entry/exit signal itself. A great strategy with reckless sizing can ruin an account; a mediocre strategy with disciplined sizing usually just underperforms.

Common approaches range from a fixed dollar amount per trade, to a fixed percentage of capital, to volatility-based sizing (risking less on a wild coin, more on a calm one, see ATR), to formal frameworks like the Kelly criterion.

zengtrade caps every paper position notional and layers portfolio-level limits on top through the Risk Governor: per-symbol exposure, sector/category concentration (so "all altcoins" doesn't quietly become one correlated bet), and a crowding cap on how many strategies can hold the same name at once.""",
   "related":["kelly-criterion","risk-governor","average-true-range-atr"],"platform":False},

  {"term":"Kelly Criterion","slug":"kelly-criterion","cat":"Risk & position sizing",
   "short":"A formula for the mathematically optimal fraction of capital to risk per bet, given a known win rate and payoff ratio.",
   "body":"""The Kelly criterion computes the bet size that maximizes long-run compound growth, given a strategy's win probability and its win/loss payoff ratio. The formula is `f* = W − (1−W)/R`, where W is win rate and R is the average win divided by the average loss.

In practice, full Kelly sizing is aggressive. It assumes the win-rate and payoff inputs are exactly right, and real strategies have uncertain, drifting edges. Most systematic traders run "fractional Kelly" (a quarter or half of what the formula suggests) specifically to survive the estimation error.

It's a useful mental model for why position sizing matters as much as signal quality. The same strategy can be a long-run winner or a bankroll-ending mistake purely based on how much is staked per trade, even where a desk uses a simpler rule day to day.""",
   "related":["position-sizing","expectancy","win-rate"],"platform":False},

  {"term":"Risk Per Trade","slug":"risk-per-trade","cat":"Risk & position sizing",
   "short":"The share of total capital a single trade can lose if its stop is hit, the dial that ties position size to the stop distance.",
   "body":"""Risk per trade is usually expressed as a percentage. "Risk 1% per trade" means position size is set so that if the stop-loss is hit, the loss equals 1% of account equity, no more, regardless of how far away that stop happens to be in price terms.

This is why position size and stop distance are linked, not independent choices: a wider ATR-based stop on a volatile coin means a smaller position (in units), and a tight stop on a calm coin allows a larger one, while the dollar risk per trade stays constant either way.

Keeping risk-per-trade small and consistent is what makes a long losing streak survivable. Ten losses in a row at 1% risk each costs about 10% of the account; the same streak at 5% risk per trade costs closer to half of it.""",
   "related":["position-sizing","average-true-range-atr","stop-loss"],"platform":False},

  {"term":"Stop-Loss","slug":"stop-loss","cat":"Risk & position sizing",
   "short":"A predetermined exit price that closes a losing position before the loss grows further.",
   "body":"""A stop-loss is an exit rule set before (or immediately after) a trade opens: if price moves against the position past a certain level, the position closes automatically, capping the loss at a known amount rather than letting it run unchecked.

Stops can be fixed (a set price or percentage from entry) or trailing (moving up as a winning position gains, locking in profit while still giving the trade room to breathe, see chandelier exit). zengtrade's engine sizes stops as an ATR multiple rather than a fixed percentage, so the stop distance adapts to how much a specific coin is actually moving.

A stop-loss doesn't guarantee the exit fills at exactly that price. In fast markets, slippage means the real fill can be somewhat worse than the stop level.""",
   "related":["average-true-range-atr","chandelier-exit","slippage"],"platform":False},

  {"term":"Chandelier Exit","slug":"chandelier-exit","cat":"Risk & position sizing",
   "short":"A trailing stop set a fixed ATR multiple below the highest high since entry, it only ever moves up, never down.",
   "body":"""A chandelier exit trails a stop below the highest price reached since a trade opened (for a long position), at a distance of some multiple of ATR, commonly 3x. As the trade makes new highs, the stop ratchets up with it; if price pulls back without making a new high, the stop stays put rather than tightening further.

The name comes from the stop "hanging" from the ceiling (the trade's peak) like a chandelier. It only ever moves toward price, never away from it, so a winning trade can never turn into a full round-trip loss once it's moved far enough in profit.

It's the exit style zengtrade's trend-following strategies use: no fixed take-profit target, because the whole point of a trend trade is to let a genuine trend run as far as it will. The chandelier exit is what closes it once the trend actually reverses, rather than the trader guessing a target in advance.""",
   "related":["average-true-range-atr","stop-loss","trend-following"],"platform":False},

  # ---------------- Indicators & signals ----------------
  {"term":"Relative Strength Index (RSI)","slug":"rsi","cat":"Indicators & signals",
   "short":"A 0-100 momentum oscillator measuring the speed and size of recent price moves, used to spot overbought/oversold conditions.",
   "body":"""RSI compares the average size of recent up-moves to recent down-moves over a lookback period (commonly 14 bars, though zengtrade's fast mean-reversion strategy uses a much shorter 2-bar window), scaled to 0-100. Readings above roughly 70 are traditionally read as "overbought," below roughly 30 as "oversold," though what actually counts as extreme is regime- and asset-dependent.

RSI is a reversion signal, not a trend signal. A strategy buying "RSI oversold" is betting the recent stretch snaps back toward the mean, which only works reliably inside a broader uptrend. Buying every oversold reading in a genuine downtrend just buys every leg down.

zengtrade's RSI-based strategies pair the RSI trigger with a trend filter for exactly this reason: RSI decides timing, the trend filter decides whether reversion is even the right bet to make right now.""",
   "related":["mean-reversion","z-score","choppy-market"],"platform":False},

  {"term":"Moving Average (SMA / EMA)","slug":"moving-average","cat":"Indicators & signals",
   "short":"A smoothed price line. The Simple Moving Average weights every bar equally; the Exponential Moving Average weights recent bars more heavily.",
   "body":"""A Simple Moving Average (SMA) is the plain average of closing price over N bars. A 50-day SMA is just the average close of the last 50 days, recalculated every day. It smooths out noise to show the underlying direction, at the cost of lagging behind sudden moves.

An Exponential Moving Average (EMA) does the same job but weights recent bars more heavily, so it reacts faster to new information while still smoothing out single-bar noise. That's the tradeoff between the two: SMA is steadier and slower, EMA is quicker and slightly noisier.

Both anchor a huge share of systematic trading: trend filters ("only trade long above the 200-SMA"), crossover signals (fast MA crossing above slow MA), and warmup gates that keep a strategy from acting before it has enough real history to compute a signal from.""",
   "related":["golden-cross-death-cross","trend-following","macd"],"platform":False},

  {"term":"Golden Cross / Death Cross","slug":"golden-cross-death-cross","cat":"Indicators & signals",
   "short":"A golden cross is a shorter moving average crossing above a longer one (bullish signal); a death cross is the reverse.",
   "body":"""A golden cross happens when a shorter-term moving average, classically the 50-day, crosses above a longer-term one, classically the 200-day. It's read as a signal that a new uptrend is establishing itself, since recent price action is now, on average, stronger than the longer-term trend.

A death cross is the mirror image: the shorter average crosses below the longer one, read as a bearish trend signal.

These are lagging signals by construction. By the time two long moving averages have actually crossed, a meaningful part of the move that caused the cross has already happened. zengtrade's crossover strategies use faster pairs (20/50 EMA rather than 50/200) specifically to react sooner, trading some noise-resistance for less lag.""",
   "related":["moving-average","trend-following","macd"],"platform":False},

  {"term":"MACD","slug":"macd","cat":"Indicators & signals",
   "short":"Moving Average Convergence/Divergence: the gap between two EMAs, plus a signal line, used to spot momentum shifts.",
   "body":"""MACD is the difference between a fast EMA (typically 12-period) and a slow EMA (typically 26-period). A "signal line," usually a 9-period EMA of the MACD line itself, is plotted alongside it. A MACD crossing above its signal line is read as a bullish momentum shift, crossing below as bearish.

Because it's built from two EMAs, MACD is essentially a smoothed, momentum-flavored version of a moving-average crossover. It reacts a bit faster to genuine shifts than watching the raw MAs directly, since it's tracking the rate of change in their relationship, not just their relative position.

It's a widely-used building block in rule-based systems (including as a selectable signal in zengtrade's Strategy Builder) precisely because it's transparent: the calculation is fully known, with no hidden parameters.""",
   "related":["moving-average","golden-cross-death-cross","trend-following"],"platform":False},

  {"term":"Bollinger Bands","slug":"bollinger-bands","cat":"Indicators & signals",
   "short":"A moving average with two bands plotted a set number of standard deviations above and below it, tracking how stretched price is.",
   "body":"""Bollinger Bands consist of a middle line (usually a 20-period SMA) and an upper/lower band plotted a chosen number of standard deviations (commonly 2) away from it. Because the bands are based on standard deviation, they widen automatically in volatile conditions and tighten in quiet ones. The band width itself is a volatility read.

A close outside the bands is a statistically unusual move, the basis for two opposite trading styles: reversion (buy a close below the lower band, betting on a snap back to the middle) or breakout (buy a close above the upper band after a tight "squeeze," betting the contraction is resolving into a new expansion).

zengtrade uses Bollinger Bands both ways: a reversion strategy that buys the lower-band dip inside an uptrend, and, among the strategies not yet featured to users, a squeeze-breakout variant that does the opposite.""",
   "related":["mean-reversion","z-score","average-true-range-atr"],"platform":False},

  {"term":"Z-Score","slug":"z-score","cat":"Indicators & signals",
   "short":"How many standard deviations the current price is from its recent rolling average, a statistical measure of how stretched a move really is.",
   "body":"""Z-score standardizes a stretch away from the mean into a single comparable number: `z = (price − rolling mean) / rolling standard deviation`. A z-score of −2 means price is two standard deviations below its recent average, a statistically unusual dip, whatever the coin or its normal volatility.

It does the same conceptual job as Bollinger Bands (both measure how far from the mean, in standard-deviation terms), but as a continuous number rather than a fixed band. That's useful for setting a precise, comparable trigger threshold ("enter when z is at or below −1.5") that behaves consistently across assets with very different price and volatility scales.

zengtrade's z-score reversion strategy uses a shorter, shallower trigger than its Bollinger equivalent, a faster lookback and a smaller stretch requirement, deliberately built as a quicker, more frequent alternative rather than a duplicate of the same trade.""",
   "related":["bollinger-bands","mean-reversion","rsi"],"platform":False},

  {"term":"Average Directional Index (ADX)","slug":"adx","cat":"Indicators & signals",
   "short":"A 0-100 reading of trend strength, regardless of direction, the indicator built specifically to tell a real trend from chop.",
   "body":"""ADX measures how strongly a market is trending, without indicating which way. It's derived from the +DI and −DI directional indicators (which track upward vs. downward price movement), smoothed into a single strength reading. Readings above roughly 25 are conventionally read as a genuine trend; below that, the market is considered directionless, chop rather than trend.

Because ADX only measures strength, it's almost always paired with the +DI/−DI lines (or another directional signal) to determine direction. ADX confirms there's a real trend here, while +DI above −DI (or a moving-average relationship) says which way it's pointing.

zengtrade's ADX-based strategy uses exactly this pairing: it only takes a position when ADX confirms trend strength and the directional lines agree. The ADX floor is specifically what filters out the whipsaw trades that a plain moving-average crossover takes in a choppy market.""",
   "related":["choppy-market","trend-following","moving-average"],"platform":False},

  {"term":"Supertrend Indicator","slug":"supertrend-indicator","cat":"Indicators & signals",
   "short":"An ATR-band trend indicator that flips between a line above price (downtrend) and below price (uptrend), giving a clear visual trend flag.",
   "body":"""The Supertrend indicator plots a line offset from price by a multiple of ATR, above price during a downtrend, below it during an uptrend, and flips sides when price crosses it. The flip itself is the trading signal: a flip from above to below price reads as a new uptrend starting, and vice versa.

Because it's ATR-based, the band width adapts to volatility the same way an ATR stop does, wider in a volatile market, tighter in a calm one, which is part of why it's popular for both signal generation and as a trailing-stop mechanism in one indicator.

It's a well-known, transparent trend tool with no hidden parameters, easy to audit, which is exactly why it's kept in zengtrade's research library even though, on the specific cost model and universe tested so far, it hasn't cleared the bar to be recommended to users yet.""",
   "related":["average-true-range-atr","trend-following","chandelier-exit"],"platform":False},

  {"term":"VWAP (Volume-Weighted Average Price)","slug":"vwap","cat":"Indicators & signals",
   "short":"The average price paid for an asset over a session, weighted by the volume traded at each price, a real-time \"fair value\" benchmark.",
   "body":"""VWAP is calculated by weighting each price by its trading volume: prices where more volume traded count for more, so VWAP reflects where the bulk of a session's trading actually happened, not just the simple average of the high and low. It typically resets at the start of each trading session (each day, for a 24/7 market like crypto) and accumulates through the day.

It's used two opposite ways: as a reversion anchor (price stretched far below VWAP on a range day is "cheap" relative to the session's real average, a dip to fade) or as a trend/momentum filter (price holding above a rising VWAP confirms genuine buying pressure, not just a quiet drift).

zengtrade runs both styles as distinct intraday strategies, a VWAP-reversion fade and a VWAP-momentum trend-continuation play, deliberately built as opposites of each other, not variations on the same idea.""",
   "related":["mean-reversion","trend-following","volume-spike"],"platform":False},

  {"term":"Volume Spike","slug":"volume-spike","cat":"Indicators & signals",
   "short":"Trading volume on a bar well above its recent average, used as a confirmation filter that a price move has real conviction behind it.",
   "body":"""A volume spike is a bar (or session) where traded volume significantly exceeds its recent average, commonly measured as a multiple of a rolling 20-period average volume. On its own it's not a directional signal; it's a confirmation filter layered on top of a price signal.

The logic: a breakout or crossover on thin volume is far more likely to be a "fakeout," a brief poke through a level with no real participation behind it, prone to snapping back, than the same move on volume well above average, which suggests genuine broad participation.

Several of zengtrade's breakout and momentum strategies require a volume spike alongside the price trigger for exactly this reason. It's specifically the filter that rejects thin-volume breaks, which back-testing showed were a major source of false signals when the price trigger was used alone.""",
   "related":["breakout-trading","vwap","opening-range-breakout"],"platform":False},

  # ---------------- Market structure & regimes ----------------
  {"term":"Market Regime","slug":"market-regime","cat":"Market structure & regimes",
   "short":"The prevailing character of a market, trending up, trending down, or range-bound/choppy, that determines which strategies actually have an edge right now.",
   "body":"""See the full explainer: [What Is a Market Regime in Crypto Trading?](/learn/what-is-a-market-regime-in-crypto-trading/). In short, a regime is the market's current character (bull, bear, or choppy), and it matters because no single strategy wins in every regime. A trend-follower that thrives in a strong bull run typically bleeds in a choppy, range-bound market, and a mean-reversion strategy that profits from chop can get run over in a strong trend.

zengtrade's regime engine reads live price structure continuously and gates which strategy types are allowed to take new risk in the current regime, rather than running every strategy blind to what the market is actually doing.""",
   "related":["bull-market","bear-market","choppy-market","regime-engine"],"platform":False},

  {"term":"Bull Market","slug":"bull-market","cat":"Market structure & regimes",
   "short":"A sustained uptrend: rising prices, generally accompanied by broad participation and confidence.",
   "body":"""A bull market describes a sustained period of rising prices, not just one green day, but a genuine trend with higher highs and higher lows persisting over weeks or months. In crypto specifically, bull markets tend to be broad: when Bitcoin trends up strongly, most of the market usually trends with it, though not all coins participate equally.

For systematic trading, a bull regime is where trend-following and momentum strategies (buying strength, riding breakouts) tend to have their best conditions. There's a real, sustained direction to capture, and pullbacks tend to be bought rather than becoming full reversals.

It's also, historically, where over-leveraged and poorly-risk-managed accounts do fine right up until the regime changes, which is the core argument for regime-aware position sizing rather than static leverage regardless of conditions.""",
   "related":["market-regime","trend-following","bear-market"],"platform":False},

  {"term":"Bear Market","slug":"bear-market","cat":"Market structure & regimes",
   "short":"A sustained downtrend: falling prices, often with lower participation and heightened risk-aversion.",
   "body":"""A bear market is the mirror of a bull market: a sustained downtrend, lower highs and lower lows, typically persisting over weeks or months rather than a single sharp drop. Bear markets often (though not always) come with higher volatility than the bull run that preceded them. Sharp relief rallies inside an overall downtrend are common and can whipsaw naive trend-followers.

For systematic strategies, a bear regime is generally where survival matters more than offense: directional long strategies tend to stand down or reduce size, and market-neutral or defensive approaches (where available) become relatively more attractive.

zengtrade's regime engine and Risk Governor are both built around this asymmetry. Protecting capital in adverse regimes is treated as the priority, with compounding a secondary goal that only matters if the account survives to compound.""",
   "related":["market-regime","risk-governor","choppy-market"],"platform":False},

  {"term":"Choppy Market","slug":"choppy-market","cat":"Market structure & regimes",
   "short":"A range-bound market with no sustained direction, the regime where trend-following strategies tend to lose money to whipsaws.",
   "body":"""A choppy (or "range-bound") market has no persistent trend. Price oscillates within a band, making short-lived moves in both directions without ever committing to a sustained direction. It's arguably the hardest regime for most retail strategies, because it specifically punishes trend-following: every breakout attempt looks like the start of a trend and then reverses, generating a string of small losses (a "whipsaw").

Mean-reversion strategies are built for exactly this regime. Buying dips and selling rips inside a defined range is a losing idea in a strong trend, but can be a genuine edge when price is oscillating around a stable mean.

Indicators like ADX exist specifically to help tell a choppy market apart from a trending one before committing capital to a trend-following signal, since the same moving-average crossover that works beautifully in a trend is a chop-bleeding machine in a range.""",
   "related":["mean-reversion","adx","market-regime"],"platform":False},

  {"term":"Trend Following","slug":"trend-following","cat":"Market structure & regimes",
   "short":"A strategy style that buys strength and rides existing momentum, on the premise that a move in progress is more likely to continue than reverse.",
   "body":"""Trend following enters in the direction of an established move, buying a breakout to new highs, or buying when a fast moving average crosses above a slow one, and stays in as long as the trend persists, typically exiting via a trailing stop rather than a fixed target. The philosophy: don't predict where a trend ends, just ride it until it demonstrably reverses.

Trend strategies tend to have a specific win/loss shape: more losing trades than winning ones, but the winners run much larger than the losers, so the strategy is profitable on average despite a sub-50% win rate. That shape makes trend-following psychologically harder to run than the raw numbers suggest. It means tolerating a long string of small losses while waiting for the occasional large winner.

Several of zengtrade's featured strategies are trend-followers at different speeds: a slower 20/100 breakout system, a faster 20/50 EMA crossover, and an ADX-filtered variant, each a genuinely different trade profile, not the same idea repeated.""",
   "related":["chandelier-exit","adx","bull-market"],"platform":False},

  {"term":"Mean Reversion","slug":"mean-reversion","cat":"Market structure & regimes",
   "short":"A strategy style that bets a stretched price snaps back toward its recent average, the opposite premise to trend following.",
   "body":"""Mean reversion enters against a recent move, buying a dip that looks statistically overdone, on the premise that price has stretched too far from its recent average and is more likely to snap back than keep extending. It's the conceptual opposite of trend following: trend bets the move continues, reversion bets it reverses.

Because reversion strategies are effectively "buying weakness," they need a real filter to avoid catching a falling knife, a stock or coin that's cheap because it's genuinely breaking down, not because it's temporarily oversold. zengtrade's reversion strategies all pair the dip-buy trigger (RSI, Bollinger Band, or Z-score) with a longer-term uptrend filter, so the strategy only buys dips inside an established uptrend, not every stretched move regardless of the bigger picture.

Mean reversion tends to have the opposite win/loss shape to trend following: a higher win rate, with smaller, more frequent wins, and the occasional large loss when the "snap back" doesn't happen.""",
   "related":["rsi","bollinger-bands","z-score"],"platform":False},

  # ---------------- Strategy types & patterns ----------------
  {"term":"Breakout Trading","slug":"breakout-trading","cat":"Strategy types & patterns",
   "short":"Entering a position when price moves decisively beyond a defined level (a prior high/low, or a tight consolidation range).",
   "body":"""A breakout strategy waits for price to move outside a defined boundary, a prior swing high, the top of a trading range, or the edge of a volatility contraction, and enters in the direction of that break, on the premise that the move signals genuine new strength (or weakness) rather than random noise.

The classic failure mode is the "fakeout": price pokes just past the level, triggers the entry, and immediately reverses back inside the range, stopping the trade out for a small loss. Real breakout systems typically add confirmation filters, a volume requirement, a minimum distance past the level (rather than a bare touch), or a volatility-contraction precondition, specifically to reduce how often they're fooled by a fakeout.

zengtrade's breakout strategies (opening-range breakout, NR7 coil breakout, the flagship 20-day high system) each use different confirmation logic, but share the same underlying bet: a decisive move past a real level is more informative than noise around it.""",
   "related":["volume-spike","opening-range-breakout","nr7"],"platform":False},

  {"term":"Opening Range Breakout (ORB)","slug":"opening-range-breakout","cat":"Strategy types & patterns",
   "short":"An intraday strategy that marks the high/low of the first few minutes of a session, then trades a break beyond that range.",
   "body":"""Opening Range Breakout marks the high and low of the first portion of a trading session, commonly the first 15 minutes, as a defined range, then enters long on a break above that range's high (or short on a break below the low, where shorting is available). The idea: the opening period reflects the market digesting overnight/pre-session information, and a decisive break of that range signals which way the session's real conviction lies.

It's a fast, intraday style. Trades typically resolve within the same session, and it's prone to the same fakeout risk as any breakout system, which is why real implementations usually require confirmation (volume, or a minimum distance past the range) rather than acting on the first tick past the level.

zengtrade's ORB strategy runs on 5-minute bars with a 15-minute opening range, and requires both a volume-above-average confirmation and a minimum ATR-based buffer past the range high before entering, specifically to reject the thin, marginal breaks that back-testing showed were unprofitable on their own.""",
   "related":["breakout-trading","volume-spike","vwap"],"platform":False},

  {"term":"NR7 (Narrow Range 7)","slug":"nr7","cat":"Strategy types & patterns",
   "short":"A pattern where the current bar has the smallest high-low range of the last 7 bars, read as a volatility \"coil\" ahead of an expansion.",
   "body":"""NR7 identifies the single bar, out of the last 7, with the narrowest high-to-low range, a sign that volatility has contracted to an unusually tight level. The pattern is read as a coiled spring: periods of unusually low volatility tend to precede periods of unusually high volatility, so an NR7 bar is often followed by a larger-than-normal move in one direction or the other.

An NR7 breakout strategy waits for the narrow bar, then enters on a break above (or below) that specific bar's high or low, using the coil itself as the reference level, rather than a longer lookback range like ORB uses.

zengtrade's NR7 strategy only trades breaks in the direction of an existing uptrend (skipping the pattern entirely in a downtrend or sideways market), on the reasoning that a volatility contraction inside an established trend is a higher-quality setup than the same pattern with no directional context.""",
   "related":["breakout-trading","average-true-range-atr","trend-following"],"platform":False},

  {"term":"Momentum Trading","slug":"momentum-trading","cat":"Strategy types & patterns",
   "short":"Buying assets that have recently performed strongly, on the premise that recent winners tend to keep winning over the near term.",
   "body":"""Momentum trading is closely related to trend following but usually refers specifically to buying based on recent relative performance. An asset that's outperformed over the last N days/weeks is bought on the expectation that outperformance persists a while longer, a well-documented (if not permanent or risk-free) pattern across many markets and timeframes.

Single-asset momentum (buy this coin because it's been strong) and cross-sectional momentum (rank a basket of assets by recent return, buy the top performers, drop the laggards) are related but distinct approaches. The first is a timing signal on one asset, the second is a relative rotation across many.

zengtrade's momentum-based strategy uses a volatility-breakout trigger (a new high on above-average volume) as its momentum signal, the same underlying "recent strength persists" premise as classical momentum, applied at the single-asset level.""",
   "related":["trend-following","cross-sectional-momentum","breakout-trading"],"platform":False},

  {"term":"Cross-Sectional Momentum","slug":"cross-sectional-momentum","cat":"Strategy types & patterns",
   "short":"Ranking a basket of assets by recent return and rotating capital into the strongest performers, out of the weakest, a relative, not absolute, bet.",
   "body":"""Cross-sectional momentum ranks a universe of assets, say, the top 10 crypto majors, by trailing return over a lookback window, then holds the top-N ranked names, rebalancing on a schedule (weekly, for instance) as the ranking shifts. It's a relative strategy: it doesn't care whether the whole basket is up or down overall, only which members are outperforming the others right now.

This makes it structurally different from single-asset trend or momentum strategies, which take an absolute view on one thing at a time. Cross-sectional momentum can, in principle, stay invested through a broad downturn as long as it's rotated into the relatively strongest names, though in practice, momentum crashes (a sharp reversal where the prior losers violently outperform the prior winners) are the well-known failure mode of the approach across every market it's been studied in.

This is currently a roadmap strategy type for zengtrade, not yet live on the paper worker. Running it properly needs basket-level rebalancing logic the current single-asset engine doesn't have yet.""",
   "related":["momentum-trading","statistical-arbitrage","position-sizing"],"platform":False},

  {"term":"Statistical Arbitrage (Stat-Arb)","slug":"statistical-arbitrage","cat":"Strategy types & patterns",
   "short":"Trading the statistical relationship between two or more related assets, long the relatively cheap one, short the relatively rich one, rather than taking a directional bet on either.",
   "body":"""Statistical arbitrage ("stat-arb") trades the relationship between related assets rather than the direction of either one individually. A classic crypto example: if ETH and BTC historically move together, a stat-arb strategy tracks the ETH/BTC ratio, and when it stretches unusually far from its historical range, goes long the underperformer and short the outperformer, betting the ratio reverts, largely independent of whether the overall market goes up or down.

Because it's expressed as a spread (long one leg, short the other), a well-constructed stat-arb position has much lower exposure to broad market direction than either leg alone. The risk is specifically that the historical relationship breaks down (a "regime shift" in the pair itself), not that the market falls.

Like cross-sectional momentum, this is a roadmap category for zengtrade. The paired long/short mechanics need a different execution model than the single-asset long-only engine currently running.""",
   "related":["cross-sectional-momentum","mean-reversion","market-regime"],"platform":False},

  {"term":"Dollar-Cost Averaging (DCA)","slug":"dollar-cost-averaging","cat":"Strategy types & patterns",
   "short":"Investing a fixed amount at regular intervals regardless of price, so the average entry price smooths out over time instead of depending on one timing decision.",
   "body":"""Dollar-cost averaging means putting a fixed dollar amount into an asset on a set schedule, weekly or monthly, say, rather than trying to time a single large entry. Some purchases land at higher prices, some at lower, and the average cost basis smooths out over the accumulation period, removing the pressure (and the risk) of getting one big timing decision right.

DCA is a passive, disciplined-accumulation approach rather than a signal-driven trading strategy. It doesn't try to read the market at all, which is precisely its appeal for investors who'd rather not actively manage entries and exits.

It sits outside zengtrade's systematic, signal-driven strategy library by design. The product is built around proving an active edge with real forward evidence, and DCA's whole premise is that it doesn't need (or claim) one.""",
   "related":["position-sizing","bull-market","market-regime"],"platform":False},

  {"term":"Scalping","slug":"scalping","cat":"Strategy types & patterns",
   "short":"A very short-term trading style aiming for small, frequent profits on fast intraday moves, usually in and out of a position within minutes.",
   "body":"""Scalping targets small price moves captured over minutes rather than days: high trade frequency, small per-trade profit target, tight stops, and a heavy dependence on execution cost (fees plus slippage) staying low relative to the size of the move being captured, since a scalp's edge is easily erased by cost drag if trading costs eat too much of each small win.

Because the edge per trade is small, scalping strategies are especially sensitive to the honesty of the cost model used to evaluate them. A backtest that under-counts fees or slippage will look dramatically more profitable than the strategy actually is once real trading costs are applied.

zengtrade's fast intraday strategies (5-minute EMA scalp, intraday RSI reversion) sit in this category, evaluated against the same global 15bps round-trip cost model as every other strategy, specifically so a fast strategy's apparent edge can't be an artifact of ignoring the costs that would erode it live.""",
   "related":["round-trip-cost","slippage","moving-average"],"platform":False},

  # ---------------- Trading mechanics & costs ----------------
  {"term":"Slippage","slug":"slippage","cat":"Trading mechanics & costs",
   "short":"The difference between the price a strategy expects to trade at and the price it actually fills at, a real, unavoidable cost of trading.",
   "body":"""Slippage is the gap between an order's intended price and its actual execution price. It happens because price moves between the moment a signal fires and the moment the order fills, and because filling any order of meaningful size against real order-book depth moves the price somewhat. The very act of buying pushes the price up slightly, and selling pushes it down.

Slippage tends to be worse in fast-moving or thin (low-liquidity) markets, and worse for larger orders relative to available depth. A backtest that assumes zero slippage, filling every trade at exactly the signal price, will overstate real-world performance, sometimes dramatically for higher-frequency strategies.

zengtrade's cost model folds slippage into the same honest round-trip cost figure applied to every backtest and every paper fill, rather than showing a slippage-free number that would look better but wouldn't survive contact with a live order book.""",
   "related":["round-trip-cost","scalping","backtesting"],"platform":False},

  {"term":"Round-Trip Cost","slug":"round-trip-cost","cat":"Trading mechanics & costs",
   "short":"The total cost of entering and exiting a position, trading fees plus slippage on both legs, expressed as a single percentage.",
   "body":"""Round-trip cost bundles every real cost of completing a trade, the exchange fee on the entry, the exchange fee on the exit, and the slippage incurred on each, into one honest number, usually expressed in basis points (bps; 100 bps equals 1%). It's the true hurdle a trade's expected move has to clear before the trade is worth taking at all.

A strategy that "wins" on 55% of trades but only captures moves smaller than its round-trip cost isn't actually profitable. It's donating the difference to the exchange on every single trade, win or lose. This is why cost-aware backtesting matters more than raw win rate: a strategy needs edge net of round-trip cost, not just a directionally-correct signal.

zengtrade applies a single global round-trip cost figure (currently 15bps for crypto spot) uniformly across every backtest, every strategy, and every forward paper fill, the same honest number everywhere, not a favorable number for the marketing page and a different one for the actual engine.""",
   "related":["slippage","cost-gate","profit-factor"],"platform":False},

  {"term":"Profit Factor","slug":"profit-factor","cat":"Trading mechanics & costs",
   "short":"Gross profit divided by gross loss, a single number summarizing whether winners meaningfully outweigh losers, independent of win rate.",
   "body":"""Profit factor is calculated as total gains from winning trades divided by total losses from losing trades. A profit factor of 1.0 means a strategy's wins and losses exactly offset (break-even before any costs); above 1.0 means genuine profitability; below 1.0 means the strategy loses money net of its own trades, regardless of how good the win rate looks in isolation.

It's a more complete picture than win rate alone, because it captures the size of wins versus losses, not just how often each happens. A strategy that wins only 35% of the time can still have a strong profit factor if its average winner is several times larger than its average loser (the classic trend-following shape), and a strategy that wins 70% of the time can have a weak profit factor if its rare losses are disproportionately large.

zengtrade's go-live readiness bar requires a minimum profit factor (alongside a minimum trade count and multi-regime evidence) before a strategy is even considered for live-execution eligibility.""",
   "related":["win-rate","expectancy","go-live-bar"],"platform":False},

  {"term":"Win Rate","slug":"win-rate","cat":"Trading mechanics & costs",
   "short":"The percentage of trades that close profitably, informative, but meaningless without knowing the size of wins versus losses too.",
   "body":"""Win rate is simply the share of closed trades that ended in profit. It's the most intuitive strategy statistic, and the most commonly misread in isolation: a high win rate says nothing about profitability on its own, because a strategy can win 90% of its trades and still lose money overall if the rare losses are large enough to outweigh many small wins (and the reverse is equally true, a 35% win rate can be very profitable, see profit factor).

Win rate matters most when read together with average win size, average loss size, and trade frequency, which is exactly why zengtrade's Forward Test and Accuracy tabs always show win rate alongside profit factor and expectancy, never as a number on its own.""",
   "related":["profit-factor","expectancy","trend-following"],"platform":False},

  {"term":"Expectancy","slug":"expectancy","cat":"Trading mechanics & costs",
   "short":"The average amount a strategy makes or loses per trade, net of costs, the single number that answers whether this is actually worth doing.",
   "body":"""Expectancy is the average net profit or loss per trade across a track record: total net P&L divided by number of trades. A positive expectancy means the strategy makes money on average per trade, net of every cost applied; a negative expectancy means it loses money on average, no matter how the win rate or profit factor look individually.

It's arguably the single cleanest summary statistic for whether an edge actually exists, net of reality, since it's already netted against real trading costs rather than shown as a gross, pre-cost number.

Every one of zengtrade's Forward Test and go-live evidence gates includes a positive-expectancy requirement specifically because it's possible to pass a win-rate or trade-count bar while still having an expectancy at or below zero once real costs are applied. A strategy with non-positive expectancy has no business being recommended to anyone, regardless of what its other numbers say.""",
   "related":["profit-factor","round-trip-cost","go-live-bar"],"platform":False},

  {"term":"Out-of-Sample Testing","slug":"out-of-sample-testing","cat":"Trading mechanics & costs",
   "short":"Testing a strategy on data it wasn't built or tuned on, the honest check for whether an edge is real or just curve-fit to history.",
   "body":"""Out-of-sample testing splits historical data into two parts: an "in-sample" period used to build or tune a strategy, and a held-out "out-of-sample" period the strategy never saw during development, used purely to check whether its edge survives on unseen data. A strategy that looks great in-sample but falls apart out-of-sample was likely curve-fit. Its rules were, consciously or not, shaped to fit the specific noise of the training period rather than a real, repeatable pattern.

Live forward-testing (running a strategy on genuinely new, real-time data after development is finished) is the strictest possible form of out-of-sample testing. There's no way to have curve-fit to data that didn't exist yet when the strategy was built.

zengtrade runs both: an in-sample/out-of-sample split inside every backtest ("the honest cut"), and then a full live paper-forward track record on top of that as the real, un-fittable evidence before any strategy is considered for the go-live bar.""",
   "related":["backtesting","go-live-bar","expectancy"],"platform":False},

  {"term":"Backtesting","slug":"backtesting","cat":"Trading mechanics & costs",
   "short":"Simulating a strategy against historical price data to see how it would have performed, the first evidence step, not the last.",
   "body":"""See the full explainer: [Backtest vs. Forward Test](/learn/backtest-vs-forward-test/). In short, backtesting runs a strategy's rules against historical data to estimate how it would have performed, using real historical prices with honest costs applied (round-trip fees plus slippage), out-of-sample splits, and no look-ahead bias.

A backtest is necessary but not sufficient evidence: it can still be curve-fit to the specific history it was tested on, however carefully it's built. That's why zengtrade treats a backtest as the starting hurdle, not the finish line. Every strategy still has to earn a live forward paper track record before the go-live bar even considers it.""",
   "related":["out-of-sample-testing","round-trip-cost","go-live-bar"],"platform":False},

  {"term":"Perpetual Futures","slug":"perpetual-futures","cat":"Trading mechanics & costs",
   "short":"A derivative contract that tracks an asset's price with no expiry date, using a periodic funding payment between longs and shorts to keep it anchored to spot.",
   "body":"""Perpetual futures ("perps") let traders take leveraged long or short exposure to an asset without ever taking delivery of it and without the contract expiring, unlike traditional futures. To keep the perpetual's price tracking the underlying spot price, exchanges use a funding rate: a periodic payment between long and short position-holders, paid by whichever side is pushing the perp's price away from spot.

Perps allow strategies unavailable to spot-only trading: shorting an asset without borrowing it, or running market-neutral trades like funding-rate carry (holding spot long and perp short simultaneously to collect the funding payment while staying roughly market-direction-neutral).

zengtrade is currently a spot-only platform. Perpetuals (and the funding-rate-carry strategy type that depends on them) are a real roadmap item, not yet built: they need a derivatives venue integration the current engine doesn't have.""",
   "related":["non-custodial-trading","funding-rate","market-regime"],"platform":False},

  {"term":"Funding Rate","slug":"funding-rate","cat":"Trading mechanics & costs",
   "short":"The periodic payment exchanged between long and short holders of a perpetual futures contract, the mechanism that keeps its price anchored to spot.",
   "body":"""A funding rate is a payment made directly between traders (not to the exchange) on a perpetual futures contract, typically every 8 hours. When the perp trades above spot, longs pay shorts; when it trades below spot, shorts pay longs. The size of the payment scales with how far the perp has drifted from spot, which is precisely what pulls it back toward spot over time: a persistent premium makes staying long progressively more expensive, drawing in arbitrage sellers.

A positive funding rate usually signals bullish positioning (more traders paying to stay long), a negative rate signals bearish positioning, and either extreme can itself become a contrarian signal when it gets unusually stretched.

Funding-rate carry (going long spot and short the equivalent perp size to collect funding while staying roughly market-neutral) is the classic strategy built around this mechanism, and it's exactly the strategy type zengtrade can't run yet without a derivatives venue integration, see perpetual futures.""",
   "related":["perpetual-futures","statistical-arbitrage","market-regime"],"platform":False},

  {"term":"Limit Order","slug":"limit-order","cat":"Trading mechanics & costs",
   "short":"An order to buy or sell at a specified price or better, guarantees the fill price but not that the order fills at all.",
   "body":"""A limit order names an exact price (or better): a buy limit only fills at that price or lower, a sell limit only at that price or higher. If the market never reaches the limit price, the order simply never fills, sitting on the order book until it does, gets cancelled, or expires.

The trade-off with a market order is direct: a limit order controls price at the cost of certainty of execution, a market order guarantees execution at the cost of controlling price. Limit orders also add liquidity to the order book (they're often called "maker" orders for exactly this reason, and some exchanges charge lower fees for them) rather than taking it.

Where an exchange venue exposes them, limit orders are the more cost-conscious default for a signal that isn't time-critical, since they can avoid the slippage a market order accepts by definition.""",
   "related":["market-order","slippage","round-trip-cost"],"platform":False},

  {"term":"Market Order","slug":"market-order","cat":"Trading mechanics & costs",
   "short":"An order to buy or sell immediately at the best available price, prioritizes certainty of execution over price control.",
   "body":"""A market order doesn't specify a price at all: it instructs the exchange to fill immediately against whatever orders are currently resting on the book, working through the available depth until the full size is filled. That's what makes it fast and (for a small order in a liquid market) usually cheap, and also what exposes it directly to slippage: a larger order, or a thinner order book, means the fill walks further up (or down) the book before completing, at a progressively worse average price.

Market orders are "taker" orders (they remove existing liquidity from the book rather than adding to it), which is why many exchanges charge a higher fee for them than for limit orders.

A signal-driven strategy generally uses market orders when the entry/exit timing itself is the edge and waiting for a limit fill risks missing the move entirely, accepting some slippage as the cost of that certainty.""",
   "related":["limit-order","slippage","round-trip-cost"],"platform":False},

  {"term":"Basis Points (bps)","slug":"basis-points-bps","cat":"Trading mechanics & costs",
   "short":"One hundredth of one percent (0.01%), the standard unit for quoting small costs and rates precisely without a string of decimal places.",
   "body":"""A basis point is 1/100th of a percentage point: 100 bps equals 1%, 15 bps equals 0.15%. Trading costs, fees, and spreads are almost always quoted in bps rather than raw percentages, since the numbers involved are typically small enough that "0.15%" invites rounding errors and misreads that "15 bps" doesn't.

It's the unit zengtrade's own cost model is expressed in: a 15bps round-trip cost figure means exactly that, 0.15% of position value lost to fees and slippage on the full entry-plus-exit round trip, applied identically to every backtest and every live paper fill rather than varying by context.

Reading strategy performance in bps terms also makes cost comparisons concrete: a strategy generating an average 40bps of edge per trade against a 15bps round-trip cost has a real margin of safety; one generating 18bps of edge against that same 15bps cost is trading on the edge of profitability, however good its win rate looks.""",
   "related":["round-trip-cost","slippage","cost-drag"],"platform":False},

  {"term":"Cost Drag","slug":"cost-drag","cat":"Trading mechanics & costs",
   "short":"The cumulative erosion of a strategy's returns by trading costs (fees plus slippage) compounding across many trades, worse for high-frequency strategies.",
   "body":"""Cost drag is what happens when a strategy's real per-trade edge is evaluated against how often it trades: a strategy with a small edge per trade can still be strongly profitable at low frequency, but the same small edge gets progressively eaten away as trade frequency rises and round-trip costs compound across more and more trades. Two strategies with identical gross returns can have very different net returns purely based on how many times each one paid the round-trip cost to get there.

This is precisely why a backtest that under-counts fees and slippage flatters high-frequency strategies the most: the gap between gross and cost-drag-adjusted net returns widens with trade count, so the strategies most vulnerable to an unrealistic cost assumption are exactly the ones a careless backtest makes look best.

zengtrade's cost gate exists specifically to police this: it refuses signals whose expected edge doesn't clear a multiple of round-trip cost, keeping cost drag from quietly turning an active-looking strategy into a net loser.""",
   "related":["round-trip-cost","cost-gate","scalping"],"platform":False},

  {"term":"Sharpe Ratio","slug":"sharpe-ratio","cat":"Trading mechanics & costs",
   "short":"A risk-adjusted return measure: average return divided by the volatility (standard deviation) of those returns, higher means more return per unit of risk taken.",
   "body":"""The Sharpe ratio divides a strategy's average excess return (over a risk-free rate, often approximated as zero for simplicity in crypto) by the standard deviation of its returns. Two strategies with identical average returns can have very different Sharpe ratios if one achieves its returns smoothly and the other via a wild, volatile ride, the smoother one wins on Sharpe even though the raw returns tie.

It's a useful single-number way to compare strategies (or the same strategy across regimes) on a risk-adjusted basis rather than on raw return alone, since raw return says nothing about how much volatility, and therefore how much emotional and financial risk, was tolerated to earn it.

Sharpe has a well-known limitation: it penalizes upside volatility the same as downside volatility, even though a strategy with occasional huge wins (which raises the standard deviation) isn't actually undesirable the way one with occasional huge losses is. Metrics like the Sortino ratio (which only penalizes downside deviation) exist specifically to address this asymmetry.""",
   "related":["drawdown","profit-factor","expectancy"],"platform":False},

  {"term":"Compound Annual Growth Rate (CAGR)","slug":"cagr","cat":"Trading mechanics & costs",
   "short":"The smoothed annual growth rate that would take a starting value to an ending value over a period, assuming steady compounding, useful for comparing returns across different timeframes.",
   "body":"""CAGR answers "what constant annual growth rate would have produced this same total return, compounding every year?" It smooths an actual, lumpy return path (a great year followed by a flat one, say) into one comparable annualized figure, which is what makes it useful for comparing a strategy's returns over 18 months against another strategy's returns over 3 years on equal footing.

CAGR on its own says nothing about the ride along the way. A strategy with an attractive CAGR and a 60% max drawdown is a very different proposition from one with a similar CAGR and a 15% max drawdown, even though CAGR alone can't tell the two apart.

This is exactly why zengtrade's evidence gates never show CAGR (or any return figure) in isolation: it's always paired with drawdown, profit factor, and expectancy, so a smoothed annual number can't hide a genuinely rough or fragile path underneath it.""",
   "related":["drawdown","sharpe-ratio","expectancy"],"platform":False},

  {"term":"Whipsaw","slug":"whipsaw","cat":"Market structure & regimes",
   "short":"A sharp price move that reverses direction almost immediately, stopping out a position shortly after entry, the characteristic failure mode of trend strategies in choppy markets.",
   "body":"""A whipsaw is what happens when a strategy enters on what looks like a genuine breakout or trend signal, only for price to reverse hard almost immediately, hitting the stop for a loss before any real move develops. One whipsaw is just a losing trade; a string of them, each triggered by the same signal type in quick succession, is the specific pattern that erodes a trend-following strategy's edge fastest.

Whipsaws cluster in choppy, range-bound markets by nature: every attempted breakout looks identical to a real one at the moment of entry, and it's only the market's subsequent behavior that reveals which kind it was.

This is the concrete, trade-level cost that indicators like ADX exist to reduce: filtering for confirmed trend strength before acting on a crossover or breakout signal doesn't eliminate whipsaws, but it does reduce how often a strategy pays for one.""",
   "related":["choppy-market","adx","trend-following"],"platform":False},

  {"term":"Market Capitalization","slug":"market-capitalization","cat":"Market structure & regimes",
   "short":"An asset's total value: circulating supply multiplied by current price, the standard way to rank and compare coins by size rather than by price alone.",
   "body":"""Market capitalization ("market cap") is simply circulating supply times price. It's the standard way to compare the size of two assets that have wildly different unit prices and supply counts, a coin trading at $0.01 with a huge supply can have a far larger market cap, and represent a far larger, more established asset, than a coin trading at $100 with a tiny supply.

Market cap is a size ranking, not a quality or safety signal on its own. A large market cap generally correlates with deeper liquidity and more participants, but plenty of large-cap assets have still gone through severe drawdowns, and a shrinking market cap can persist for a long time before a coin is meaningfully "small" by any other measure.

zengtrade's coin universe is ranked by market cap specifically because it's a stable, hard-to-game ordering. Raw 24-hour volume, by contrast, can spike a low-quality, low-liquidity coin to the top of a volume ranking for a single noisy day.""",
   "related":["liquidity","bull-market","bear-market"],"platform":False},

  {"term":"Liquidity","slug":"liquidity","cat":"Market structure & regimes",
   "short":"How easily an asset can be bought or sold in size without moving its price meaningfully, deeper order books mean lower slippage for the same trade size.",
   "body":"""Liquidity describes how much size a market can absorb, on either side, before price moves meaningfully in response. A liquid market has a deep order book: large buy and sell orders resting close to the current price, so a typical trade barely nudges the price at all. A thin, illiquid market has little resting size nearby, so even a modest order can walk noticeably up or down the book before it's fully filled.

Liquidity is the direct driver of slippage: the same order size produces far more slippage in a thin market than a deep one, which is exactly why a strategy's real-world costs depend on which coins it trades, not just how good its signal is.

It's also why zengtrade's coin universe is filtered to Binance USDT-spot pairs specifically: a coin with a real regime read and a real backtest still needs a real, tradable market underneath it for that evidence to mean anything live, not just a market-cap ranking on a data provider.""",
   "related":["market-capitalization","slippage","round-trip-cost"],"platform":False},

  {"term":"Paper Trading","slug":"paper-trading","cat":"Trading mechanics & costs",
   "short":"Simulating trades on live prices without risking real money, tracking exactly what a strategy would have done, and won or lost, had it been live.",
   "body":"""See the full explainer: [What Is Paper Trading Crypto?](/learn/what-is-paper-trading-crypto/). In short, paper trading runs a strategy's real rules against live, real-time prices, but with a simulated account instead of real capital: every entry, exit, and cost is tracked exactly as it would be live, without ever risking a dollar.

The honesty of a paper implementation is what makes it useful evidence rather than a toy. zengtrade's paper book marks to live Binance spot prices every cycle and applies the same round-trip cost model as live execution, specifically so paper results are a genuine preview of live performance, not an optimistic fiction.""",
   "related":["backtesting","forward-testing","non-custodial-trading"],"platform":False},

  {"term":"Forward Testing","slug":"forward-testing","cat":"Trading mechanics & costs",
   "short":"Running a strategy on live, real-time data after development is finished, the strictest form of out-of-sample evidence since the data genuinely didn't exist when the strategy was built.",
   "body":"""See the full explainer: [Backtest vs. Forward Test](/learn/backtest-vs-forward-test/). In short, forward testing (running a strategy live, on paper, going forward in time) is out-of-sample testing in its strongest form: there's no possibility the strategy was curve-fit to data that hadn't happened yet when its rules were written.

A backtest is necessary evidence but a forward track record is what actually earns trust, which is why zengtrade's go-live bar is built entirely on forward paper results, not backtest results, however good the backtest looked.""",
   "related":["backtesting","out-of-sample-testing","go-live-bar"],"platform":False},

  # ---------------- Platform-specific: zengtrade's own engine vocabulary ----------------
  {"term":"Cost Gate","slug":"cost-gate","cat":"zengtrade engine terms",
   "short":"An engine rule that refuses to take a trade if its expected edge doesn't clear a multiple of round-trip trading cost, anti-churn by design.",
   "body":"""The cost gate is a rule built into zengtrade's execution engine: a signal only becomes a real trade if its expected edge exceeds `EDGE_MULT × round-trip cost`, a multiple of what the round trip will actually cost in fees and slippage. A marginal signal that would only barely clear costs (or wouldn't clear them at all) is skipped entirely, rather than taken and quietly bled away by fees.

This exists specifically to stop high-frequency, low-edge strategies from "churning," generating a large number of trades that look active but net out to a loss (or a wash) once real trading costs are subtracted from each one.

It's applied uniformly, to every strategy in the library and every custom Builder strategy alike. The cost gate isn't a setting users tune per-strategy, it's a fixed rail the engine enforces underneath whatever signal a strategy (or a user-composed rule) generates.""",
   "related":["round-trip-cost","expectancy","risk-governor"],"platform":True},

  {"term":"Regime Engine","slug":"regime-engine","cat":"zengtrade engine terms",
   "short":"zengtrade's live classifier that reads current market structure (Bull / Bear / Choppy) and gates which strategy types are allowed to take new risk.",
   "body":"""The regime engine continuously reads live price structure to classify the current market state, then uses that read to gate strategy behavior, standing down directional strategies that don't fit the current regime, and allowing the strategies proven to fit it to keep taking new positions.

It's the mechanism behind zengtrade's core positioning: the same book of strategies doesn't blindly trade through every condition the same way. A trend-follower that's a strong fit in a trending regime gets stood down in a choppy one, and vice versa for a mean-reversion strategy, matched to conditions rather than run open-loop regardless of what the market is actually doing.

See [What Is a Market Regime in Crypto Trading?](/learn/what-is-a-market-regime-in-crypto-trading/) for the full explanation of how the underlying regime read itself works.""",
   "related":["market-regime","risk-governor","trend-following"],"platform":True},

  {"term":"Risk Governor","slug":"risk-governor","cat":"zengtrade engine terms",
   "short":"zengtrade's portfolio-level control layer: symbol/sector concentration limits, a crowding cap, and a drawdown kill-switch, sitting above every individual strategy.",
   "body":"""The Risk Governor operates above individual strategy signals, at the portfolio level: capping how much exposure any single symbol or sector/category can accumulate (so "long five different altcoins" doesn't quietly become one large correlated bet), limiting how many strategies can hold the same name at once (a crowding cap), and stepping position sizing down, or triggering the kill-switch entirely, as portfolio drawdown deepens.

No individual strategy signal can override the Governor: a strategy can generate a valid entry signal and still have that trade reduced in size, or blocked outright, if taking it would breach a portfolio-level limit the Governor is enforcing.

This is the layer specifically responsible for "survival first" as an actual mechanism, not just a stated value. It's what stops a string of correlated signals across multiple strategies from compounding into a concentration risk no single strategy's own rules would have caught on its own.""",
   "related":["kill-switch","drawdown","cost-gate"],"platform":True},

  {"term":"Kill-Switch","slug":"kill-switch","cat":"zengtrade engine terms",
   "short":"An automatic halt on new positions once portfolio drawdown crosses a defined threshold, the Risk Governor's hardest stop.",
   "body":"""The kill-switch is the most severe rung of the Risk Governor's drawdown ladder: once portfolio-level drawdown crosses a defined threshold, the engine blocks new entries across every strategy, not just the one that's currently losing, until drawdown recovers. Existing positions continue to be managed (stops and exits still fire normally); it's specifically new risk that gets shut off.

Below the kill-switch threshold, the Governor typically runs intermediate risk-reduction tiers first, sizing new positions smaller as drawdown deepens, rather than jumping straight from "normal" to "fully halted." The kill-switch is the last rung on that ladder, not the only one.

It exists because the deepest, account-threatening drawdowns are rarely caused by one single strategy failing in isolation. They're caused by several strategies losing at the same time, which a per-strategy stop-loss alone has no mechanism to catch.""",
   "related":["risk-governor","drawdown","cost-gate"],"platform":True},

  {"term":"Go-Live Bar","slug":"go-live-bar","cat":"zengtrade engine terms",
   "short":"The evidence threshold a strategy must clear on its live paper track record, minimum trade count, profit factor, regime coverage, and positive expectancy, before live execution is even considered.",
   "body":"""The go-live bar is a fixed set of evidence gates every strategy must clear on its forward (live paper) track record before it's eligible for real-money execution at all: a minimum number of closed trades (so the sample is large enough to mean something), a minimum profit factor, proof across multiple market regimes (not just one lucky trending stretch), and positive expectancy net of real trading costs.

Clearing the go-live bar is necessary but not sufficient for going live. See three-key safety for the additional account-level and capital-gate requirements layered on top of the evidence bar itself.

The bar exists to replace "trust the backtest" with "prove it forward, on money-losing conditions too." A strategy that's only ever traded in a friendly bull stretch hasn't actually cleared multi-regime evidence yet, however good its numbers look in that one window.""",
   "related":["three-key-safety","out-of-sample-testing","expectancy"],"platform":True},

  {"term":"Three-Key Safety","slug":"three-key-safety","cat":"zengtrade engine terms",
   "short":"Live trading requires three independent things to all be true at once: the strategy cleared its go-live bar, the OS-level ALLOW_LIVE flag is armed, and the user explicitly arms it. No single point of failure flips real money on by accident.",
   "body":"""Three-key safety is zengtrade's model for how live (real-money) execution can ever activate: it requires three separate, independent conditions to all be true simultaneously. The specific strategy has cleared its go-live evidence bar; an OS-level `ALLOW_LIVE` flag is armed on the machine actually running the engine (something a browser session can never set on its own); and the user has explicitly and deliberately armed live trading themselves.

No single one of these is sufficient on its own. A strategy clearing its evidence bar doesn't arm live trading by itself, and a user "wanting" to go live doesn't matter if the strategy hasn't earned it or the machine-level flag isn't set. All three have to align.

The design intent is straightforward: no single bug, misclick, or compromised session can flip real capital into live execution. It takes an evidence gate, a machine-level flag, and a deliberate human action, together.""",
   "related":["go-live-bar","non-custodial-trading","risk-governor"],"platform":True},

  {"term":"Non-Custodial Trading","slug":"non-custodial-trading","cat":"zengtrade engine terms",
   "short":"zengtrade never holds user funds or has withdrawal access. Trades execute through the user's own exchange account and API keys, not a pooled platform wallet.",
   "body":"""Non-custodial means zengtrade never takes possession of user funds. Paper trading involves no real money at all; if live execution is ever armed for an eligible strategy (see three-key safety), orders are placed directly through the user's own exchange account via their own API keys, scoped to trading only, never withdrawal, rather than funds being deposited into a platform-controlled wallet.

This is structurally different from custodial platforms, where users deposit funds into the platform's own accounts and trust the platform to manage withdrawals correctly and keep those pooled funds secure. That's a model with a much larger blast radius if the platform itself is compromised or mismanaged.

The practical implication for users: connect an exchange API key with trade permissions only (never withdrawal-enabled), and funds never leave the user's own exchange account under zengtrade's control at any point.""",
   "related":["three-key-safety","perpetual-futures","go-live-bar"],"platform":True},
]

CATEGORY_ORDER = ["Risk & position sizing","Indicators & signals","Market structure & regimes",
                   "Strategy types & patterns","Trading mechanics & costs","zengtrade engine terms"]

BY_SLUG = {t["slug"]: t for t in TERMS}


def _render_md(text):
    if _markdown:
        return _markdown.markdown(text, extensions=["extra"])
    return f"<pre>{html.escape(text)}</pre>"


def term_parts(t):
    """Same (title, desc, canonical, main_html, extra_head) shape as article_parts()."""
    e = html.escape
    title = f"{t['term']} - Definition | zengtrade Glossary"
    canonical = f"{SITE}/learn/glossary/{t['slug']}/"
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Learn", "item": f"{SITE}/learn/"},
        {"@type": "ListItem", "position": 3, "name": "Glossary", "item": f"{SITE}/learn/glossary/"},
        {"@type": "ListItem", "position": 4, "name": t["term"], "item": canonical},
    ]}
    define_schema = {
        "@context": "https://schema.org", "@type": "DefinedTerm",
        "name": t["term"], "description": t["short"],
        "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "zengtrade Glossary", "url": f"{SITE}/learn/glossary/"},
    }
    extra_head = (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
                  f'<script type="application/ld+json">{json.dumps(define_schema)}</script>')
    related_html = ""
    if t.get("related"):
        chips = "".join(
            f'<a href="/learn/glossary/{e(r)}/">{e(BY_SLUG[r]["term"])}</a>'
            for r in t["related"] if r in BY_SLUG)
        if chips:
            related_html = f'<div class="gl-related"><h2>Related terms</h2><div class="gl-related-row">{chips}</div></div>'
    badge = '<span class="gl-badge">zengtrade engine term</span>' if t.get("platform") else ""
    main = f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-term">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/learn/">Learn</a> &rsaquo; <a href="/learn/glossary/">Glossary</a> &rsaquo; {e(t['term'])}</nav>
      {badge}
      <h1 id="h-term" class="lp-h1">{e(t['term'])}</h1>
      <p class="lp-sub">{e(t['short'])}</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Definition">
    <div class="lp-wrap article-body">
      {_render_md(t['body'])}
      {related_html}
      <p class="lp-fineprint">Educational content, not investment advice. zengtrade is paper-first and non-custodial.</p>
      <div class="lp-cta-row center" style="margin-top:20px">
      <a class="lp-cta primary" href="/login/?mode=signup&amp;utm_source=site&amp;utm_medium=organic&amp;utm_campaign=glossary_{e(t['slug'])}">Start free, paper-trade any coin</a>
      <a class="lp-cta ghost" href="/learn/glossary/">Browse the full glossary</a>
      </div>
    </div>
  </section>
</main>"""
    return title, t["short"], canonical, main, extra_head


def glossary_hub_schema(terms):
    """JSON-LD for the /learn/glossary/ hub: a BreadcrumbList (Home -> Learn -> Glossary) plus a
    CollectionPage/ItemList naming every term, mirroring coin_hub_schema()/learn_hub_schema()."""
    crumb = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "Learn", "item": f"{SITE}/learn/"},
        {"@type": "ListItem", "position": 3, "name": "Glossary", "item": f"{SITE}/learn/glossary/"}]}
    item_list = {"@context": "https://schema.org", "@type": "CollectionPage",
                 "name": "Trading & Risk Glossary",
                 "url": f"{SITE}/learn/glossary/",
                 "mainEntity": {"@type": "ItemList", "itemListElement": [
                     {"@type": "ListItem", "position": i + 1, "name": t["term"],
                      "url": f"{SITE}/learn/glossary/{t['slug']}/"}
                     for i, t in enumerate(terms)]}}
    return (f'<script type="application/ld+json">{json.dumps(crumb)}</script>'
            f'<script type="application/ld+json">{json.dumps(item_list)}</script>')


def glossary_hub_main():
    e = html.escape
    by_cat = {}
    for t in TERMS:
        by_cat.setdefault(t["cat"], []).append(t)
    sections = ""
    for cat in CATEGORY_ORDER:
        items = by_cat.get(cat, [])
        if not items:
            continue
        cards = "".join(
            f'<a class="gl-term-card" href="/learn/glossary/{e(t["slug"])}/"><b>{e(t["term"])}</b>'
            f'<span>{e(t["short"])}</span></a>' for t in items)
        sections += f'<div class="gl-hub-cat"><h2>{e(cat)}</h2><div class="gl-hub-grid">{cards}</div></div>'
    return f"""<main id="main">
  <section class="lp-hero" aria-labelledby="h-glossary">
    <div class="lp-wrap">
      <nav class="coin-crumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/learn/">Learn</a> &rsaquo; Glossary</nav>
      <div class="lp-eyebrow"><span class="dot"></span> reference</div>
      <h1 id="h-glossary" class="lp-h1">Trading &amp; risk <span class="hl">glossary</span></h1>
      <p class="lp-sub">{len(TERMS)} terms: indicators, risk mechanics, strategy types, and the vocabulary zengtrade's own engine uses (regime engine, cost gate, Risk Governor). Plain-English, no filler.</p>
    </div>
  </section>
  <section class="lp-sec" aria-label="Glossary terms">
    <div class="lp-wrap">{sections}</div>
  </section>
</main>"""
