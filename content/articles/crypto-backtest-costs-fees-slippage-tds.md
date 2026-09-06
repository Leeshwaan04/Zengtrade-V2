---
slug: crypto-backtest-costs-fees-slippage-tds
title: "Crypto Backtest Costs: Fees, Slippage & TDS"
description: A backtest that ignores fees, slippage, and tax isn't a backtest - it's a fantasy. Here's exactly what each cost is and why it's subtracted from every trade.
date: 2026-09-07
---
Most crypto backtests you'll see online quietly ignore trading costs, or model them so lightly that the "edge" they show evaporates the moment it meets a real exchange. Here's what the real costs actually are, and why every one of them is subtracted from every backtest and paper trade on zengtrade.

## The three costs that eat a strategy's edge

**Fees.** The exchange's own trading fee, charged on both the entry and the exit. It looks small per trade - often a few basis points - but a strategy that trades often compounds that cost fast. A strategy with a real 0.3% average edge per trade and 0.2% round-trip fees only nets 0.1%; double the fee and the "edge" is gone.

**Slippage.** The difference between the price you expected and the price you actually got filled at. Order books aren't infinitely deep - a market order large enough, or placed during a fast move, fills at a worse average price than the last quoted tick. Backtests that assume a fill at the exact candle close are quietly overstating every single trade.

**The 1% TDS (India-specific).** India applies a 1% Tax Deducted at Source on crypto transactions. For Indian users, this isn't optional or avoidable - it's deducted at the transaction level, on top of exchange fees and slippage. A strategy that looks profitable in USD-denominated, TDS-free backtests can be a net loser once this is correctly applied.

## Why zengtrade models a single, honest round-trip cost

Rather than pretending these costs don't exist, zengtrade applies a combined round-trip cost model (currently ~35 basis points for crypto spot, covering fee plus a realistic slippage estimate) to every backtest and every paper trade. "Round-trip" means it's charged once for entering a position and once for exiting it - the full cost of a complete trade, not just half of it.

This has a direct, sometimes uncomfortable consequence: strategies that look good gross often look mediocre or even negative net of cost. That's not a flaw in the model - it's the model doing its job. A strategy whose apparent edge disappears under a realistic cost assumption was never a real edge; it was a backtest artifact.

## The cost gate: refusing trades that can't clear the bar

Beyond just subtracting costs after the fact, zengtrade's engine applies a **cost gate** before a trade is even taken: if the expected move is smaller than some multiple of the round-trip cost, the trade is skipped entirely. This is specifically designed to stop high-turnover strategies from death-by-a-thousand-cuts - churning in and out of small moves that individually look fine but collectively bleed the account through fees alone.

## What this means for you as a reader of any backtest

Whenever you see a backtest - on zengtrade or anywhere else - the first question worth asking isn't "what's the return," it's "what costs were subtracted to get that number." A gross backtest and a net-of-cost backtest can tell completely different stories about the same strategy. zengtrade shows net numbers by default specifically so the figure you see is the one that would have actually landed in an account, not the one that looks best in a pitch.
