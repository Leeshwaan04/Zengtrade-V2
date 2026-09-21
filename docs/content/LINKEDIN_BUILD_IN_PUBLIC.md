# LinkedIn: build in public (founder draft)

**Status:** READY TO POST (Full E2E green · worker active · `./scripts/check-growth-gates.sh` ✅)  
Worker is live with fresh heartbeat and forward paper trades populating on production.

## Pre-flight

```bash
./scripts/status-report.sh
./scripts/guide-linkedin-bip.sh      # prints post copy + after-post checklist
```

## Post copy (Option 1: Live Engine + 3 Institutional Modes)

```
Shipping zengtrade in public: algorithmic crypto trading, paper trading on live Binance prices.

Today on production:
1. Investing Mode: Macro regime shield + interactive DCA vs. Lump-Sum simulator with live volatility modeling.
2. Trading Mode: Multi-timeframe confluence ribbon (5m to 4h) + automated Risk/Reward bracket HUD with 35 bps friction disclosure.
3. Algo Studio: Walk-forward 3-regime resilience matrix across bull, crab, and bear market cycles.

Our paper execution worker is live, tracking simulated fills in real time against live market order books.

Try the deploy path: https://zengtrade.in/login?mode=signup&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public

Browse 150k+ coin and strategy variations: https://zengtrade.in/coins/?utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public_coins

Founding Pro ($19/mo, unlimited paper): https://zengtrade.in/login?mode=signup&plan=pro&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public_pro

Not investment advice. Paper trading only. No live execution.
```

## Post copy (Option 2: Concise Build-In-Public)

```
Shipping zengtrade in public: paper trading on live Binance prices.

Today on production: signup -> Algo Studio -> 1-click strategy deploy is live with real-time paper execution.
Post-deploy: live trade evidence and forward paper performance at /app#forward.

Try the deploy path: https://zengtrade.in/login?mode=signup&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public

Browse strategies by coin: https://zengtrade.in/coins/?utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public_coins

Founding Pro ($19/mo, unlimited paper): https://zengtrade.in/login?mode=signup&plan=pro&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public_pro

Not investment advice. Paper only. No live execution.
```

## After posting

1. Note date + link in `docs/GROWTH_DASHBOARD.md` (Marketing section).
2. Watch `/admin` for `signup_complete` / `deploy_click` with `utm_campaign=build_in_public`.
3. Save first screenshot when forward trades exist, upgrade post with `docs/content/WEEKLY_PROOF.md`.

## Related

- Full playbook: `docs/MARKETING_PLAYBOOK.md`
- Partial proof template: `docs/content/WEEKLY_PROOF.md` § Partial proof (worker offline)
- Reddit (post after full E2E): `docs/content/REDDIT_ALGOTRADING_DRAFT.md`
