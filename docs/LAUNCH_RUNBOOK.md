# zengtrade Launch Runbook

Production checklist for `zengtrade.in`. Autopilot CTO agent maintains this file.

**Quick start:** `docs/FOUNDER_DEPLOY.md` (30-minute founder checklist)  
**Merge first:** `docs/MERGE_AND_SHIP.md` (5-minute GitHub merge)

## P0 — Ship the core loop

| Step | Action | Owner | Done |
|------|--------|-------|------|
| 1 | Merge PR #3 (`cursor/autopilot-ff74`) → `main` (close PR #2) | CEO/CTO | ☑ |
| 2 | GitHub Pages deploy + `verify-production` CI green (or `./scripts/wait-for-deploy.sh`) | CTO | ☑ |
| 3 | Supabase Auth → URL config: `https://zengtrade.in/login`, `https://zengtrade.in/reset` | CEO | ☐ |
| 4 | Enable Google provider + OAuth client | CEO | ☐ |
| 5 | SQL: run migrations `0009` + `0010` + **`0011`** (or `./scripts/check-migrations.sh`) | CTO | ☑ (0011 live on production) |
| 6 | Host `saas/worker` (see `saas/worker/README.md`) with prod `DATABASE_URL` | CTO | ☐ (Railway deploy FAILED — wrong password) |
| 7 | E2E manual: signup → `/dashboard` → deploy → trades in ≤15 min | CPO | ☐ (partial: steps 1–2 at `/ops/e2e` while worker blocked) |
| 8 | Run `./tests/e2e_smoke.sh` | CTO | ☑ (also runs on PR via `.github/workflows/ci-smoke.yml`) |

## P1 — Revenue rail

| Step | Action | Done |
|------|--------|------|
| 9 | `supabase secrets set NOWPAYMENTS_API_KEY=...` | ☑ (edge functions live — `./scripts/verify-billing.sh`) |
| 10 | Deploy `nowpayments-create-invoice` + `nowpayments-ipn` | ☑ |
| 11 | Test checkout → `profile.tier` = pro | ☐ (founder: <https://zengtrade.in/ops/billing>) |
| 12 | Remove "Opening soon" on paid plans when #11 passes | ☑ (`checkoutReady()` live) |

## P2 — Growth

| Step | Action | Done |
|------|--------|------|
| 13 | Google Search Console verify + submit sitemap | CBO |
| 14 | Integrate `seo/out` coin pages into landing build | CBO | ☑ (`build.py` fetches live coin pages + sitemap) |
| 15 | Founding Pro offer live on `/pricing/` | CBO | ☑ ($19/mo founding copy in build) |

**Founder P0 (blocking activation):** <https://zengtrade.in/ops/p0>  
**Full ops dashboard:** <https://zengtrade.in/ops>

**While step 6 is blocked** (wrong Railway `DATABASE_URL` password), CPO/CBO parallel work:

```bash
./scripts/check-parallel-growth.sh   # partial activation + billing + GSC
```

- CPO partial E2E: <https://zengtrade.in/ops/e2e> (steps 1–2)
- CBO GSC: <https://zengtrade.in/ops/gsc>
- CBO billing smoke: <https://zengtrade.in/ops/billing>
- Unblock: Cloud Agent `DATABASE_PASSWORD` or <https://zengtrade.in/ops/worker>

```bash
cd saas/worker
# Set DATABASE_URL in Railway dashboard (Supabase → Settings → Database → URI)
railway up
# Or Docker: see saas/worker/Dockerfile
```

## Verify worker

```sql
-- Supabase SQL editor
select count(*) from trade;
select key, updated_at from engine_state where key = '_worker_heartbeat';
```

## Smoke test

```bash
./tests/e2e_smoke.sh
```

## Rollback

Redeploy previous `dist` artifact; worker can be stopped without data loss (deployments persist).
