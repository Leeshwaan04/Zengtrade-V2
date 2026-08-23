# zengtrade — live status

**Last autopilot check:** 2026-08-23  
**Production:** https://zengtrade.in

## Ship gate

| Check | Production now | After PR #3 merge |
|-------|----------------|-------------------|
| `/app` | ❌ 404 | ✅ billing + evidence |
| Google OAuth (`establishSession`) | ❌ old auth.js | ✅ fixed |
| `/dashboard` Algo Studio | ✅ 200 | ✅ + studio shim updates |
| Paper worker | ❓ unknown | needs Railway/Fly |

## Founder action

👉 **[MERGE_AND_SHIP.md](MERGE_AND_SHIP.md)** — merge PR #3 (5 min)  
👉 **[FOUNDER_DEPLOY.md](FOUNDER_DEPLOY.md)** — Supabase + worker (30 min)

## Autopilot agents

Daily updates: **[GROWTH_DASHBOARD.md](GROWTH_DASHBOARD.md)**  
Charters: `.cursor/autopilot/{cto,cpo,cbo}.md`

## PRs

| PR | Status | Action |
|----|--------|--------|
| [#3](https://github.com/Leeshwaan04/Zengtrade-V2/pull/3) autopilot | Open | **Merge to main** |
| [#2](https://github.com/Leeshwaan04/Zengtrade-V2/pull/2) crypto-only | Open | Close (superseded by #3) |

## Verify commands

```bash
./tests/e2e_smoke.sh
SITE=https://zengtrade.in ./scripts/check-production.sh
```
