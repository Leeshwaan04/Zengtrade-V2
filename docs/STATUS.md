# zengtrade — live status

**Last autopilot check:** 2026-08-24 (session 214)  
**Production:** https://zengtrade.in

## Ship gate

| Check | Status |
|-------|--------|
| `/app` billing + evidence | ✅ live |
| Google OAuth (`establishSession`) | ✅ |
| `/dashboard` Algo Studio | ✅ |
| Billing edge functions | ✅ NOWPayments + founding $19 |
| Migration 0011 (funnel v2) | ✅ `signup_complete`, `deploy_click`, `deploy_success`, `checkout_click` |
| Parallel growth (excl. worker) | ✅ `./scripts/check-parallel-growth.sh` |
| Growth goal audit | ✅ `./scripts/audit-growth-goal.sh` (CTO/CPO/CBO probes) |
| Partial activation (signup→deploy) | ✅ `./scripts/verify-activation-path.sh --partial` |
| Sales-ready (Pro checkout path) | ✅ `./scripts/check-sales-ready.sh` |
| QA parallel (excl. worker) | ✅ `./scripts/check-qa-parallel.sh` |
| DATABASE_URL auth (Railway) | ❌ wrong password — `./scripts/validate-database-credentials.sh` |
| Growth: CTO loop | ❌ auth+worker+DB — `/ops/worker` |
| Growth: CPO trades | partial ✅ — full E2E needs worker |
| Growth: CBO infra | ✅ GSC+sales-ready · first MRR founder `/admin` |
| Paper worker | ❌ **Down** — heartbeat stale (2026-08-11); Railway deploy **FAILED** (wrong `DATABASE_URL` password) |

## P0 blocker (founder)

Reset Supabase DB password → update Railway `paper-worker` `DATABASE_URL` → Deploy.

**Fastest:** Cloud Agent secret `DATABASE_PASSWORD` only → `./scripts/run-p0-if-ready.sh`

**Verify:** `./scripts/validate-database-credentials.sh` (detects invalid Railway password when `RAILWAY_API_TOKEN` is set)

👉 **https://zengtrade.in/ops/worker** · **docs/WORKER_RECOVERY.md** · **https://zengtrade.in/ops/p0**

## Parallel work (while worker blocked)

| Role | Guide |
|------|--------|
| **All** | `./scripts/guide-founder-parallel.sh` · **docs/GUIDE_INDEX.md** · `./scripts/list-founder-guides.sh` |
| CTO | `./scripts/guide-worker-recovery.sh` · **https://zengtrade.in/ops/worker** |
| CPO | `./scripts/guide-partial-e2e.sh` · `./scripts/guide-free-tier-test.sh` |
| CBO / Sales | `./scripts/guide-gsc-founder.sh` · `./scripts/guide-first-pro-checkout.sh` |
| Marketing | `./scripts/guide-linkedin-bip.sh` · `./scripts/guide-coin-spotlight.sh` |
| SEO | `./scripts/guide-monthly-gsc-review.sh` |
| QA&VAPT | `./scripts/check-qa-parallel.sh` · `./scripts/guide-qa-rls-isolation.sh` (post-P0) |
| **All probes** | `./scripts/check-founder-parallel-ready.sh` |

Index: **docs/FOUNDER_PARALLEL.md**

## Founder dashboards

👉 **https://zengtrade.in/ops** — CTO / CPO / CBO live gates  
👉 **https://zengtrade.in/admin** — signups, MRR, funnel (login required)

## After P0 green

```bash
./scripts/post-p0-success.sh
./scripts/verify-activation-path.sh
./scripts/guide-qa-rls-isolation.sh   # after trades visible — /ops/e2e step 5
./scripts/audit-growth-goal.sh
```

Full E2E: **https://zengtrade.in/ops/e2e** (signup → deploy → trades → RLS)

## Agent log

Daily updates: **docs/GROWTH_DASHBOARD.md** · `./scripts/append-growth-log.sh`
