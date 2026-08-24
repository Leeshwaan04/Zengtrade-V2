# r/algotrading draft — DO NOT POST until P0 green

**Status:** Draft only. Post after `./scripts/verify-activation-path.sh` passes and you have a real Forward Test screenshot.

**Partial (worker offline):** You may share signup → deploy only — see `./scripts/guide-partial-e2e.sh` and `docs/content/LINKEDIN_BUILD_IN_PUBLIC.md`. Do **not** claim closed trades.

---

## Title

We paper-trade crypto algos on live Binance prices (not backtest fantasy) — looking for feedback on the cost model

## Body

I've been building a small algo studio focused on **honest paper trading** before anyone touches real capital.

What it actually does today:

- You deploy a strategy to **paper** on **live Binance spot prices** (public data, no keys in the browser).
- A background worker runs the same engine we use for evaluation — ATR stops, fee-aware entry gate, anti-churn cooldown.
- Forward results show in an evidence app separate from the strategy builder (so you can't confuse "builder preview" with "what actually traded").

What it does **not** do (on purpose):

- No live exchange execution from the browser.
- No fabricated backtests — we bake in ~35bps round-trip on spot and stand strategies down in regimes that don't fit.

**Cost model:** 35bps round-trip on spot, paper notional ~$1k/position for the free tier.

I'm not asking for signups — genuinely want feedback from people who've been burned by backtests that ignore fees:

1. Is 35bps too conservative or too aggressive for spot crypto?
2. Would you trust a product that **requires** a forward paper book before any live talk?

If useful, I can share a screenshot of the forward book once we have another week of paper closes.

---

## Comment (if sub rules require link in comments)

Paper signup (free tier): https://zengtrade.in/login?mode=signup&utm_source=reddit&utm_medium=organic&utm_campaign=algotrading_draft

Coin strategies hub: https://zengtrade.in/coins/?utm_source=reddit&utm_medium=organic&utm_campaign=algotrading_coins

How it works: https://zengtrade.in/how-it-works/
