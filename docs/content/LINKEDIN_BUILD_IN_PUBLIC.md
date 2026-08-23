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
Next: forward paper loop once our worker is back (DB credential fix in progress).

Try the deploy path: https://zengtrade.in/login?mode=signup&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public

Not investment advice. Paper only. No live execution.
```

## After posting

1. Note date + link in `docs/GROWTH_DASHBOARD.md` (Marketing section).
2. Watch `/admin` for `signup_complete` / `deploy_click` with `utm_campaign=build_in_public`.
3. Save first screenshot when forward trades exist — upgrade post with `docs/content/WEEKLY_PROOF.md`.

## Related

- Full playbook: `docs/MARKETING_PLAYBOOK.md`
- Reddit (post after full E2E): `docs/content/REDDIT_ALGOTRADING_DRAFT.md`
