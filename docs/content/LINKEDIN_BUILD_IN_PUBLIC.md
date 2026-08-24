# LinkedIn — build in public (founder draft)

**Status:** READY TO POST (partial E2E green · `./scripts/check-parallel-growth.sh` ✅)  
**Do not** claim forward P&L or closed trades until `./scripts/check-worker.sh` is green.

## Pre-flight

```bash
./scripts/check-parallel-growth.sh
./scripts/guide-linkedin-bip.sh      # prints post copy + after-post checklist
./scripts/guide-partial-e2e.sh   # optional: confirm signup → deploy path
```

## Post copy

```
Shipping zengtrade in public — paper trading on live Binance prices.

Today on production: signup → Algo Studio → deploy is live (partial E2E steps 1–2).
Post-deploy: evidence at /app#forward (yellow banner on /dashboard links View evidence; trades when worker is back).

Try the deploy path: https://zengtrade.in/login?mode=signup&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public

Browse strategies by coin: https://zengtrade.in/coins/?utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public_coins

Founding Pro ($19/mo, unlimited paper): https://zengtrade.in/login?mode=signup&plan=pro&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public_pro

Not investment advice. Paper only. No live execution.
```

## After posting

1. Note date + link in `docs/GROWTH_DASHBOARD.md` (Marketing section).
2. Watch `/admin` for `signup_complete` / `deploy_click` with `utm_campaign=build_in_public`.
3. Save first screenshot when forward trades exist — upgrade post with `docs/content/WEEKLY_PROOF.md`.

## Related

- Full playbook: `docs/MARKETING_PLAYBOOK.md`
- Partial proof template: `docs/content/WEEKLY_PROOF.md` § Partial proof (worker offline)
- Reddit (post after full E2E): `docs/content/REDDIT_ALGOTRADING_DRAFT.md`
