# Founder deploy — production loop

**Fast path:** bookmark **https://zengtrade.in/ops/p0** (~15 min, live gate checks).

Autopilot tracks status in `docs/LAUNCH_RUNBOOK.md` and `docs/GROWTH_DASHBOARD.md`.

## 1. Verify production deploy

PR #5 and #6 are merged to `main`. After any new push, GitHub Actions → **Deploy zengtrade to GitHub Pages** must succeed.

```bash
./scripts/wait-for-deploy.sh
SITE=https://zengtrade.in ./scripts/check-production.sh
./scripts/founder-next-action.sh   # single next founder step
```

## 2. Supabase Auth (5 min)

Dashboard → **Authentication → URL configuration**

- Site URL: `https://zengtrade.in`
- Redirect URLs: `https://zengtrade.in/login`, `https://zengtrade.in/reset`
- **Google provider:** enabled with OAuth client

## 3. Migration 0011 + paper worker (P0)

**While worker is blocked** (wrong `DATABASE_URL` password), CPO/CBO can still ship:

```bash
./scripts/check-parallel-growth.sh   # partial activation + billing + GSC
./scripts/verify-partial-activation.sh
```

Links: https://zengtrade.in/ops/e2e (steps 1–2) · https://zengtrade.in/ops/gsc · https://zengtrade.in/ops/billing

**Option A — one-shot GitHub Action (recommended):** add `DATABASE_PASSWORD` (password only) or `DATABASE_URL` + `RAILWAY_API_TOKEN` to [repo Secrets](https://github.com/Leeshwaan04/Zengtrade-V2/settings/secrets/actions) → run [Apply P0](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-p0.yml) → type `APPLY`.

**Option B — Cloud Agent:** add `DATABASE_PASSWORD` (password only) or full `DATABASE_URL` to Cursor secrets → `./scripts/validate-database-credentials.sh` then `./scripts/run-p0-if-ready.sh`.

**Option C — migration only (GitHub):** [Apply migration 0011](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-migration-0011.yml) with `DATABASE_URL` secret.

**Option D — manual:** https://zengtrade.in/ops/migrate → copy SQL → Supabase SQL Editor; worker at https://zengtrade.in/ops/worker.

```bash
./scripts/check-migrations.sh   # signup_complete, deploy_success, checkout_click must return OK
./scripts/check-worker.sh       # heartbeat < 12 min
```

## 4. Paper worker

Already deployed by Apply P0 workflow. Manual guide: https://zengtrade.in/ops/worker — Railway root `saas/worker`, `DATABASE_URL` on port **5432** (session pooler).

## 5. Billing (live — test when ready)

Edge functions are deployed (`./scripts/verify-billing.sh` ✅).

Test: https://zengtrade.in/ops/billing → Pro checkout → `/admin` MRR tile.

## 6. Verify full loop

```bash
./scripts/wait-for-p0.sh        # polls until P0 green, then activation verify
# or manually:
./scripts/founder-preflight.sh
```

E2E: https://zengtrade.in/ops/e2e — signup → deploy → trades within ~15 min.

## 7. Organic (CBO)

https://zengtrade.in/ops/gsc — verify domain + submit sitemap (**can run while worker is blocked**). First proof posts after forward trades exist (`docs/content/WEEKLY_PROOF.md`).

---

**Done when:** `/admin` → Worker **Live**, deployers > 0, trades increasing, funnel tiles moving.
