# zengtrade — live status

**Last autopilot check:** 2026-08-23 (session 108)  
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
| Paper worker | ❌ **Down** — heartbeat stale (2026-08-11); Railway deploy **FAILED** (wrong `DATABASE_URL` password) |

## P0 blocker (founder)

Reset Supabase DB password → update Railway `paper-worker` `DATABASE_URL` → Deploy.

**Fastest:** Cloud Agent secret `DATABASE_PASSWORD` only → `./scripts/run-p0-if-ready.sh`

👉 **https://zengtrade.in/ops/worker** · **https://zengtrade.in/ops/p0**

## Parallel work (while worker blocked)

| Role | Link |
|------|------|
| CPO partial E2E | https://zengtrade.in/ops/e2e (steps 1–2) |
| CBO GSC | https://zengtrade.in/ops/gsc |
| CBO billing | https://zengtrade.in/ops/billing |
| CLI | `./scripts/check-parallel-growth.sh` |

## Founder dashboards

👉 **https://zengtrade.in/ops** — CTO / CPO / CBO live gates  
👉 **https://zengtrade.in/admin** — signups, MRR, funnel (login required)

## Verify commands

```bash
./scripts/run-p0-if-ready.sh           # agent entry — auto-apply when credentials set
./scripts/check-parallel-growth.sh     # parallel gates while worker down
./scripts/check-growth-standup.sh      # daily standup + metrics table
./scripts/log-growth-session.sh 108    # paste block for GROWTH_DASHBOARD.md
./scripts/founder-preflight.sh
./tests/e2e_smoke.sh
```

> Production is **GitHub Pages** (`pages.yml` on `main`). Vercel previews are a separate project.
