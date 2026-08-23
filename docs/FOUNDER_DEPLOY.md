# Founder deploy — 30-minute production loop

Complete these in order. Autopilot CTO tracks status in `docs/LAUNCH_RUNBOOK.md`.

## 1. Merge & ship site (10 min)

```bash
# On GitHub: merge PR #3 (cursor/autopilot-ff74) into main — supersedes PR #2
# GitHub Actions → Deploy zengtrade to GitHub Pages runs on push to main
# Poll until live: ./scripts/wait-for-deploy.sh
```

## 2. Supabase Auth (5 min)

Dashboard → **Authentication → URL configuration**

- Site URL: `https://zengtrade.in`
- Redirect URLs:
  - `https://zengtrade.in/login`
  - `https://zengtrade.in/reset`

**Authentication → Providers → Google:** enable, paste OAuth client ID/secret.

## 3. Database migration (3 min)

SQL Editor → run:

```sql
-- paste contents of saas/db/migrations/0009_engine_state.sql
-- paste contents of saas/db/migrations/0010_admin_rpc_funnel.sql
-- paste contents of saas/db/migrations/0011_funnel_events_v2.sql
```

Or generate full bundle:

```bash
chmod +x scripts/apply-migrations.sh
./scripts/apply-migrations.sh > /tmp/zengtrade-migrations.sql
# paste /tmp/zengtrade-migrations.sql into SQL Editor
```

Also confirm `0005_grant_paid_and_deploy_limit.sql` is applied (free-tier deploy cap).

## 4. Paper worker on Railway (10 min)

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Set **root directory** to `saas/worker`
3. Variables:
   - `DATABASE_URL` = Supabase → Project Settings → Database → URI (use **pooler** or direct; service role not needed for worker — uses postgres connection string with password)
   - `WORKER_INTERVAL` = `300` (optional)
4. Deploy → check logs: `zengtrade worker · … featured strategies`
5. Supabase SQL: `select * from engine_state where key='_worker_heartbeat';` — should update every ~5 min

## 5. Billing (optional, when ready for MRR)

```bash
supabase login
supabase link --project-ref ponvarxeytfcntckczbn
supabase secrets set NOWPAYMENTS_API_KEY=...
supabase secrets set NOWPAYMENTS_IPN_SECRET=...
supabase functions deploy nowpayments-create-invoice --no-verify-jwt
supabase functions deploy nowpayments-ipn --no-verify-jwt
```

Test: `/app#pricing` → Pro → pay → tier flips to `pro`.

## 6. Smoke test (5 min)

```bash
chmod +x scripts/check-production.sh
SITE=https://zengtrade.in ./scripts/check-production.sh
```

1. Incognito → `https://zengtrade.in/login?mode=signup`
2. Google or email signup → lands on `/dashboard`
3. Library → Deploy **Trend Follower** (paper)
4. Wait 10 min → `/app#forward` or Monitor shows activity
5. Second account in incognito → must **not** see first account's trades

## 7. Organic (CBO)

Follow `docs/GSC_SETUP.md` — verify domain, submit sitemap.

---

**Done when:** Admin → Worker = **Live**, deployers > 0, trades increasing.
