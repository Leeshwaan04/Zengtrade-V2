# Merge & ship (founder: 5 minutes)

## 1. Merge autopilot PR ✅

**[PR #5](https://github.com/Leeshwaan04/Zengtrade-V2/pull/5)** merged to `main` on 2026-08-23 (`8336d9c`). GitHub Pages deploy succeeded.

## 2. Verify deploy

```bash
SITE=https://zengtrade.in ./scripts/check-production.sh
./scripts/check-sitemap.sh          # 7 coin pSEO URLs after merge
./scripts/wait-for-deploy.sh    # if CDN still propagating
```

## 3. Complete P0 (founder: ~15 min)

**https://zengtrade.in/ops/p0**: migration 0011 + paper worker (blocks trades + full funnel).

```bash
./scripts/wait-for-p0.sh        # polls until green, then post-p0-success.sh
# or when already green:
./scripts/post-p0-success.sh
./scripts/guide-qa-rls-isolation.sh   # after trades in /app#forward
```

See **`docs/FOUNDER_DEPLOY.md`** for detail.

## 4. Track growth

- **https://zengtrade.in/ops**: CTO / CPO / CBO dashboard
- **https://zengtrade.in/admin**: metrics + funnel tiles
- `docs/GROWTH_DASHBOARD.md`: agent log
