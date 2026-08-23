# Merge & ship (founder — 5 minutes)

## 1. Merge one PR

**Merge [PR #3](https://github.com/Leeshwaan04/Zengtrade-V2/pull/3)** (`cursor/autopilot-ff74`) into `main`.

Close PR #2 as superseded (same changes included).

GitHub Actions will:
- Build landing site (includes `/app`, `/dashboard`, `/login`)
- Deploy to GitHub Pages
- Run `check-production.sh` against `zengtrade.in`

## 2. Verify deploy (automatic + manual)

CI job **verify-production** must pass. Or run locally:

```bash
SITE=https://zengtrade.in ./scripts/check-production.sh
```

Expect:
- `/app` → 200
- `/js/auth.js` contains `establishSession`

## 3. Backend (30 min — still required)

Code deploy alone does **not** start paper trading. Complete **`docs/FOUNDER_DEPLOY.md`** steps 2–5:

- Supabase auth URLs + Google
- Migrations (`./scripts/apply-migrations.sh`)
- Railway worker

## 4. Track growth

- `docs/GROWTH_DASHBOARD.md` — agent daily log
- https://zengtrade.in/admin — live metrics
