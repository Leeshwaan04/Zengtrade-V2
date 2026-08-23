# Merge & ship (founder — 5 minutes)

## 1. Merge autopilot PR

**Merge [PR #5](https://github.com/Leeshwaan04/Zengtrade-V2/pull/5)** (`cursor/autopilot-health-ff74`) into `main`.

GitHub Actions will build the landing site (includes `/ops/p0`, `/admin` P0 banner, funnel fixes) and deploy to GitHub Pages, then run `verify-production`.

## 2. Verify deploy

```bash
SITE=https://zengtrade.in ./scripts/check-production.sh
./scripts/check-sitemap.sh          # 7 coin pSEO URLs after merge
./scripts/wait-for-deploy.sh    # if CDN still propagating
```

## 3. Complete P0 (founder — ~15 min)

**https://zengtrade.in/ops/p0** — migration 0011 + paper worker (blocks trades + full funnel).

```bash
./scripts/wait-for-p0.sh        # polls until green, then activation verify
```

See **`docs/FOUNDER_DEPLOY.md`** for detail.

## 4. Track growth

- **https://zengtrade.in/ops** — CTO / CPO / CBO dashboard
- **https://zengtrade.in/admin** — metrics + funnel tiles
- `docs/GROWTH_DASHBOARD.md` — agent log
