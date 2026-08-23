# zengtrade Launch Runbook

Production checklist for `zengtrade.in`. Autopilot CTO agent maintains this file.

## P0 — Ship the core loop

| Step | Action | Owner | Done |
|------|--------|-------|------|
| 1 | Merge PR #2 (`cursor/crypto-only-ff74`) → `main` | CEO/CTO | ☐ |
| 2 | Deploy `deploy/landing/dist` to hosting (Pages/Hostinger) | CTO | ☐ |
| 3 | Supabase Auth → URL config: `https://zengtrade.in/login`, `https://zengtrade.in/reset` | CEO | ☐ |
| 4 | Enable Google provider + OAuth client | CEO | ☐ |
| 5 | SQL: run `saas/db/migrations/0009_engine_state.sql` | CTO | ☐ |
| 6 | Host `saas/worker` (see `saas/worker/README.md`) with prod `DATABASE_URL` | CTO | ☐ |
| 7 | E2E manual: signup → `/dashboard` → deploy → trades in ≤15 min | CPO | ☐ |
| 8 | Run `./tests/e2e_smoke.sh` | CTO | ☑ (also runs on PR via `.github/workflows/ci-smoke.yml`) |

## P1 — Revenue rail

| Step | Action | Done |
|------|--------|------|
| 9 | `supabase secrets set NOWPAYMENTS_API_KEY=...` | ☐ |
| 10 | Deploy `nowpayments-create-invoice` + `nowpayments-ipn` | ☐ |
| 11 | Test checkout → `profile.tier` = pro | ☐ |
| 12 | Remove "Opening soon" on paid plans when #11 passes | ☐ |

## P2 — Growth

| Step | Action | Done |
|------|--------|------|
| 13 | Google Search Console verify + submit sitemap | CBO |
| 14 | Integrate `seo/out` coin pages into landing build | CBO | ☑ (`build.py` fetches live coin pages + sitemap) |
| 15 | Founding Pro offer live on `/pricing/` | CBO | ☑ ($19/mo founding copy in build) |

## Worker quick start (Railway)

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
