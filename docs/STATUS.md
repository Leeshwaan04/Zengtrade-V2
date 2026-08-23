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

## Founder action (remaining P0)

👉 **[WORKER_QUICKSTART.md](WORKER_QUICKSTART.md)** — deploy worker (10 min)  
👉 **[FOUNDER_DEPLOY.md](FOUNDER_DEPLOY.md)** — full backend checklist

```bash
./scripts/founder-preflight.sh   # production + billing + migrations + worker
./scripts/check-migrations.sh    # probe 0008–0011
./scripts/check-worker.sh        # heartbeat freshness
```

## Autopilot agents

Daily updates: **[GROWTH_DASHBOARD.md](GROWTH_DASHBOARD.md)**  
Charters: `.cursor/autopilot/{cto,cpo,cbo}.md`

## PRs

| PR | Status |
|----|--------|
| [#3](https://github.com/Leeshwaan04/Zengtrade-V2/pull/3) autopilot | **Merged** 2026-08-23 |
| [#2](https://github.com/Leeshwaan04/Zengtrade-V2/pull/2) crypto-only | Merged (superseded by #3) |

> **Note:** Vercel preview deploys a separate Next.js project — **not** the `build.py` landing site. Production is **GitHub Pages** (`pages.yml` on `main`).

## Verify commands

```bash
./tests/e2e_smoke.sh
SITE=https://zengtrade.in ./scripts/check-production.sh
./scripts/founder-preflight.sh
```
