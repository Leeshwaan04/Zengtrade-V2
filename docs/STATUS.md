# zengtrade — live status

**Last autopilot check:** 2026-08-23 (post-merge)  
**Production:** https://zengtrade.in

## Ship gate

| Check | Status |
|-------|--------|
| `/app` billing + evidence | ✅ live |
| Google OAuth (`establishSession`) | ✅ fixed auth.js deployed |
| `/dashboard` Algo Studio | ✅ + studio shim |
| Billing edge functions | ✅ NOWPayments deployed |
| Paper worker | ❌ **Down** — heartbeat stale (2026-08-11) |
| Migration 0011 | ❌ **Pending** — `signup_complete` events blocked |
| Migrations 0009–0010 | ✅ applied |

## Founder dashboard

👉 **https://zengtrade.in/ops/p0** — P0 checklist (migration + worker, ~15 min)  
👉 **https://zengtrade.in/ops** — full CTO / CPO / CBO dashboard

## PRs

| PR | Status |
|----|--------|
| [#6](https://github.com/Leeshwaan04/Zengtrade-V2/pull/6) QA&VAPT autopilot | **Merged** 2026-08-23 |
| [#5](https://github.com/Leeshwaan04/Zengtrade-V2/pull/5) autopilot health | **Merged** 2026-08-23 |
| [#3](https://github.com/Leeshwaan04/Zengtrade-V2/pull/3) autopilot | **Merged** 2026-08-23 |

> **Note:** Vercel preview deploys a separate Next.js project — **not** the `build.py` landing site. Production is **GitHub Pages** (`pages.yml` on `main`).

## Verify commands

```bash
./tests/e2e_smoke.sh
SITE=https://zengtrade.in ./scripts/check-production.sh
./scripts/founder-preflight.sh
./scripts/wait-for-p0.sh          # after founder completes P0 actions
```
