---
slug: bull-bear-choppy-position-sizing
title: Position Sizing by Crypto Market Regime
description: The same position size behaves very differently in a bull run, bear market, or choppy range - here is how sizing should change with the regime.
date: 2026-09-07
---
A strategy's rules matter, but so does how much capital it puts behind each trade - and the right size isn't a fixed number. It should change depending on the market regime, because the same size that's reasonable in a calm bull trend can be reckless in a violent, choppy one.

## Why one fixed size is a mistake

Position size determines how much a single bad trade can cost. If size stays fixed regardless of regime, two things go wrong:

- **In a high-volatility regime**, a fixed size that was fine in calm conditions now risks a much bigger loss per trade, because the coin can move several times as far in the same amount of time.
- **In a choppy regime**, a fixed size sized for trending conditions gets used to take many more losing trades (false breakouts, failed reversals), compounding the damage of a market that doesn't reward the strategy's core assumption in the first place.

Sizing has to answer the same question every time: *how much could this specific trade, in this specific regime, realistically cost if it's wrong?*

## How sizing changes by regime

**Bull.** Trend confirmation is more reliable, and reversals tend to be gradual rather than violent. This is where a trend-following strategy can reasonably size up - not recklessly, but with more conviction than in choppier conditions.

**Bear.** Directional longs are stood down or sized down sharply, since down-moves in crypto are often sharper and faster than up-moves. Market-neutral and short-premium approaches, which don't depend on picking a direction, become the more reasonable places to hold size.

**Choppy / Neutral.** No clear trend to lean on. This is where a trend-following strategy should size *down*, not up - every signal is more likely to be a false start. Mean-reversion strategies can be more appropriate here, but even they should size conservatively, since a genuinely choppy market can break in either direction without warning.

**High-volatility.** Regardless of direction, larger average moves mean a given position size represents more real risk. The reasonable response is smaller size, wider stops relative to normal, or standing down entirely until volatility normalizes.

## Layer-1s, DeFi, and meme coins don't size the same way either

Regime isn't the only input - a coin's own category matters too. A high-beta layer-1 that can swing much harder than Bitcoin in either direction gets sized smaller than a large-cap major, even in the same regime. A meme coin, driven more by social momentum than fundamentals, gets an even smaller size and a faster exit, because its moves are less about a trend maturing and more about a narrative catching or fading quickly.

## How zengtrade applies this

zengtrade's risk governor combines the current regime read with a coin's own category profile to size every position - not as a single global number, but as a function of both. A trailing "chandelier" exit lets a genuine trend run further before cutting it, while a fixed-target exit locks in a reversion trade once it's captured the move it was designed for. Position sizing and exit style aren't decorations on top of a strategy; in a real sense, they *are* the strategy - two systems with identical entry signals but different sizing and exit rules will produce very different outcomes over time.

None of this removes risk. It's a framework for taking a *known, bounded* amount of risk per trade rather than letting the market's mood decide it for you.
