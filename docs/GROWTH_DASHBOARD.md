# zengtrade Growth Dashboard

**Updated by autopilot agents (CTO, CPO, CBO).** Founder: check this file + `/admin` for day-over-day progress.

| Metric | Baseline (Day 0) | Today | Target (30d) |
|--------|------------------|-------|----------------|
| Organic sessions / week | — | — | 500 |
| Signups (total) | — | — | 50 |
| Deployers (ever deployed) | — | — | 25 |
| Users with ≥1 closed trade | — | — | 15 |
| Paying Pro/Elite | — | — | 10 |
| MRR (USD) | $0 | $0 | $290 |
| Worker status | Unknown | Unknown | Live 99% |

*Fill "Today" from [zengtrade.in/admin](https://zengtrade.in/admin) after login.*

---

## Day 1 — 2026-08-23 (Autopilot bootstrap)

### CTO
- **Shipped:** Autopilot charters, launch runbook, E2E smoke script, plan-intent redirect fix (in PR).
- **Blocked:** Production deploy + worker hosting require founder/ops (Supabase secrets, Railway).
- **Next:** Merge PR #2; host worker; apply migration `0009`.

### CPO
- **Shipped:** Signup with `?plan=pro|elite` now routes to `/app#pricing` after auth (not lost on `/dashboard`).
- **Next:** Empty-state CTAs on evidence tabs; free-tier deploy limit in Algo Studio shim.

### CBO
- **Shipped:** Autopilot CBO charter; growth dashboard template; launch runbook SEO steps documented.
- **Next:** GSC verification; ship 5 coin pages into production build.

### Founder actions required
1. Supabase redirect URLs + Google OAuth (15 min)
2. Approve merge of PR #2 + PR #3 when ready
3. Railway/Fly: deploy worker with `DATABASE_URL` (see `saas/worker/railway.toml`)

---

## Day 1 (continued) — 2026-08-23 evening

### CTO
- **Shipped:** GitHub Actions `ci-smoke.yml` on PRs; `saas/worker/railway.toml` for one-click worker deploy.
- **Blocked:** Production merge + Railway `DATABASE_URL` still founder-owned.
- **Next:** Merge PR #2 → #3; deploy worker; apply migration `0009`.

### CPO
- **Shipped:** Free-tier deploy errors → upgrade CTA (`studio.js` + `app.js`); first-deploy nudge banner on `/dashboard`; `deploy_click` funnel events.
- **Next:** Verify nudge + deploy flow on live site after deploy.

### CBO
- **Shipped:** Founding Pro $19/mo on pricing; `docs/GSC_SETUP.md` step-by-step.
- **Next:** Founder completes GSC verification + sitemap submit.

### Day 1 (session 3) — billing + evidence UX

### CTO
- **Shipped:** `docs/FOUNDER_DEPLOY.md` (30-min checklist); NOWPayments success → `/app?paid=1`; founding Pro $19 in edge function.
- **Blocked:** Edge functions must be redeployed on Supabase for billing changes to take effect.
- **Next:** Founder runs FOUNDER_DEPLOY steps 1–6.

### CPO
- **Shipped:** Evidence tab empty states → Deploy + Algo Studio link; `signup_view` funnel on login; studio deploy upgrade redirect in terminal.
- **Next:** E2E on production after deploy.

### CBO
- **Shipped:** App billing PLANS aligned to $19 founding; checkout return lands on `/app` for tier polling.
- **Next:** GSC + first weekly proof post after worker live.

### Day 1 (session 4) — admin funnel + ops scripts

### CTO
- **Shipped:** `0010_admin_rpc_funnel.sql` (admin RPCs + worker heartbeat); `scripts/apply-migrations.sh`; `scripts/check-production.sh`.
- **Blocked:** Migrations + edge functions need Supabase apply/redeploy.
- **Next:** Founder runs migration bundle + Railway worker.

### CPO
- **Shipped:** Admin shows signup views + deploy clicks (7d) for activation tracking.
- **Next:** Watch funnel after production deploy.

### CBO
- **Shipped:** Funnel metrics in `/admin` for daily growth review.
- **Next:** GSC verification.

### Day 1 (session 5) — critical `/app` 404 fix

### CTO
- **Shipped:** `app.html` in landing build → `/app` (production was 404; broke billing + plan intent).
- **Blocked:** Merge PR #3 + Pages deploy.
- **Next:** `check-production.sh` must show OK for `/app`.

### CPO
- **Shipped:** Algo Studio link in `/app` topbar.
- **Next:** E2E Get Pro → signup → `/app#pricing`.

### CBO
- **Shipped:** `scripts/deploy-billing.sh`.
- **Next:** GSC after deploy.

### Day 1 (session 6) — cross-links + CI production verify

### CTO
- **Shipped:** `pages.yml` runs `check-production.sh` after every `main` deploy; `docs/MERGE_AND_SHIP.md`.
- **Blocked:** Awaiting PR #3 merge to `main`.
- **Next:** CI verify-production job green post-merge.

### CPO
- **Shipped:** `/dashboard` → "Evidence & billing" link to `/app`; Builder custom deploy FREE_LIMIT + funnel tracking.
- **Next:** Full funnel test post-merge.

### CBO
- **Shipped:** Merge doc for founder (single PR path).
- **Next:** GSC after `/app` live.

### Day 1 (session 7) — status board + PR watch

### CTO
- **Shipped:** `docs/STATUS.md` live gate; `fly.toml` worker config; README launch section; subscribed to PR #3 merge events.
- **Blocked:** PR #3 still open — production `/app` 404, auth.js stale.
- **Next:** Autopilot resumes verification when PR merges.

### CPO
- **Shipped:** (no code — awaiting deploy)
- **Next:** Post-merge funnel test.

### CBO
- **Shipped:** STATUS.md for founder at-a-glance.
- **Next:** GSC post-merge.

### Day 1 (session 8) — PR #3 sync, CI green

### CTO
- **Shipped:** `scripts/wait-for-deploy.sh` (poll until production probes pass); STATUS.md Vercel vs Pages note.
- **Verified:** PR #3 synchronize → **5/5 CI checks pass** (smoke, CodeRabbit, Vercel); local `e2e_smoke.sh` OK; dist build includes `/app` + `establishSession` in auth.js.
- **Blocked:** Production still pre-merge (`/app` 404, auth.js stale on zengtrade.in).
- **Next:** Founder merges PR #3 → `wait-for-deploy.sh` or CI verify-production.

### CPO
- **Shipped:** (awaiting deploy)
- **Next:** Signup → `/dashboard` → deploy → evidence tabs E2E after merge.

### CBO
- **Shipped:** Merge path documented in MERGE_AND_SHIP + wait script.
- **Next:** GSC + founding Pro checkout test post-deploy.

### Day 1 (session 9) — funnel v2 + dist probes

### CTO
- **Shipped:** `scripts/probe-dist.sh`; worker `py_compile` in smoke; `/login` + `/app` in sitemap; LAUNCH_RUNBOOK/FOUNDER_DEPLOY aligned to PR #3 only.
- **Blocked:** Production merge + Supabase migration `0011` + worker host.
- **Next:** Post-merge `check-production.sh` green; apply migrations bundle.

### CPO
- **Shipped:** Funnel events `signup_complete`, `plan_intent`, `deploy_success`; post-deploy “View evidence” nudge on `/dashboard`; admin tiles for full funnel.
- **Next:** Measure signup→deploy→trades conversion in `/admin` after deploy.

### CBO
- **Shipped:** `checkout_click` tracking on Pro/Elite; sitemap includes signup + app entry points for GSC.
- **Next:** GSC verify + submit sitemap after merge.

### Day 1 (session 10) — ship preflight + activation UX

### CTO
- **Shipped:** CI builds worker Docker image; `scripts/founder-preflight.sh`; `scripts/verify-billing.sh`.
- **Blocked:** Production `/app` 404; billing functions need deploy; worker not hosted.
- **Next:** Founder runs `founder-preflight.sh` after merge until all green.

### CPO
- **Shipped:** Activation checklist on `/app` dashboard (account → deploy → first trade) with Algo Studio link.
- **Next:** Track checklist completion via deploy_success + trades in admin.

### CBO
- **Shipped:** Billing verify script for MRR rail readiness.
- **Next:** Deploy billing + test checkout after P0.

### Day 1 (session 11) — PR #3 MERGED 🚀

### CTO
- **Shipped:** PR #3 merged to `main` (founder approved). GitHub Pages deploy + **verify-production CI green**. All `check-production.sh` probes pass (`/app`, `establishSession`).
- **Blocked:** Worker heartbeat stale (last 2026-08-11) — paper trades won't run until Railway/Fly deploy.
- **Next:** Founder `FOUNDER_DEPLOY.md` §3–4 (migrations + worker).

### CPO
- **Shipped:** Production activation UX live (`/app` checklist, `/dashboard` nudge, funnel events in code).
- **Next:** E2E signup → deploy → trades once worker live; watch `/admin` funnel tiles.

### CBO
- **Shipped:** Site + billing rail live on zengtrade.in.
- **Next:** GSC sitemap submit; test Pro checkout → tier flip.

### Day 1 (session 12) — health probes post-merge

### CTO
- **Shipped:** `check-worker.sh`, `check-migrations.sh`, `health-watch.yml` (6h cron); preflight now gates migrations + worker.
- **Verified:** Production ✅ · Billing ✅ · 0009/0010 ✅ · **0011 pending** · Worker down.
- **Next:** Founder apply `0011_funnel_events_v2.sql` + deploy worker.

### CPO
- **Shipped:** Migration probe confirms funnel v1 live; v2 blocked until 0011.
- **Next:** Full activation E2E after worker.

### CBO
- **Shipped:** Production sitemap includes `/login` + `/app`.
- **Next:** GSC + checkout test.

### Day 1 (session 13) — worker status UX + quickstart

### CTO
- **Shipped:** Worker-down banner on `/app` + `/dashboard`; `docs/WORKER_QUICKSTART.md`; `migrate-0011-only.sh`.
- **Blocked:** Worker still stale; 0011 not applied.
- **Next:** Founder Railway deploy + SQL paste.

### CPO
- **Shipped:** Users see honest “worker offline” message instead of silent no-trades.
- **Next:** E2E after worker live.

### CBO
- **Shipped:** (pending GSC — founder action)
- **Next:** Submit https://zengtrade.in/sitemap.xml after worker proof post.

### Day 1 (session 14) — Render blueprint + CBO week 1 + UX proof

### CTO
- **Shipped:** `render.yaml` worker blueprint; `scripts/status-report.sh` one-screen P0 gate.
- **Blocked:** Worker + 0011 unchanged.
- **Next:** Founder `./scripts/status-report.sh` → green.

### CPO
- **Verified:** Production pricing ($19 founding), signup page, coin SEO pages load (screenshots).
- **Next:** Logged-in activation E2E after worker.

### CBO
- **Shipped:** `docs/CBO_WEEK1.md` organic playbook; live coin pSEO confirmed on zengtrade.in.
- **Next:** GSC verify + sitemap submit.

### Day 1 (session 17) — GitHub issue notification + mobile ops PWA

### CTO
- **Shipped:** GitHub issue #4 for founder P0 approvals; ops PWA manifest (add to home screen).
- **Blocked:** Migration 0011 + worker — awaiting founder on /ops/migrate and /ops/worker.

### CPO
- **Next:** /ops/e2e after P0.

### CBO
- **Next:** /ops/billing after P0.

### Day 1 (session 18) — one-click migration workflow

### CTO
- **Shipped:** GitHub Actions `apply-migration-0011.yml` (workflow_dispatch + DATABASE_URL secret); ops/migrate updated.
- **Blocked:** Worker deploy still founder-owned.

### CPO / CBO
- **Next:** After migration + worker green on /ops.

### Day 1 (session 19) — health-watch + activation verify

### CTO
- **Shipped:** `health-watch` now fails on migration/worker (triggers founder email via `founder-alert`); `scripts/sync-ops-gates.py` + `scripts/verify-activation-path.sh`.
- **Blocked:** P0 unchanged — migration 0011 + worker heartbeat stale since 2026-08-11.
- **Next:** Founder runs /ops/migrate + /ops/worker → `./scripts/verify-activation-path.sh`.

### CPO
- **Ready:** E2E guide at /ops/e2e; activation checklist on /app once worker live.

### CBO
- **Ready:** /ops/billing + /ops/gsc after forward trades exist.

### Day 1 (session 20) — worker deploy hardening + CBO draft

### CTO
- **Shipped:** Worker startup heartbeat + DB connect retry (faster Railway health proof); ops/worker troubleshooting (session pooler 5432); health-watch auto-commits ops-data gates on main.
- **Blocked:** Migration 0011 + worker deploy still founder-owned.

### CPO
- **Shipped:** Worker-offline banner links to /how-it-works on /app.

### CBO
- **Shipped:** `docs/content/REDDIT_ALGOTRADING_DRAFT.md` (do not post until P0 green).

### Day 1 (session 21) — CPO funnel accuracy + E2E UX

### CPO
- **Shipped:** `signup_complete` only on real signups (not every sign-in); email signup sets pending flag for post-confirm tracking; /ops/e2e shows which P0 gate is blocking.
- **Blocked:** Funnel v2 events still need migration 0011 in prod.

### CTO
- **Shipped:** WORKER_QUICKSTART documents `startup heartbeat ok` log line.
- **Blocked:** P0 unchanged.

### Day 1 (session 22) — founder P0 checklist page

### CTO
- **Shipped:** `/ops/p0` — focused 15-min founder checklist with live gate probes; LAUNCH_RUNBOOK billing steps marked done.
- **Blocked:** Migration 0011 + worker deploy still founder-owned.

### CPO / CBO
- **Next:** E2E + first Pro checkout after P0 green on /ops/p0.

### Day 1 (session 23) — wait-for-p0 + CBO UTMs

### CTO
- **Shipped:** `scripts/wait-for-p0.sh` polls until P0 green then runs activation verify; founder-alert points to /ops/p0.
- **Blocked:** Migration 0011 + worker unchanged.

### CBO
- **Shipped:** Landing + pricing signup CTAs carry `utm_source=site` for organic attribution.

### Day 1 (session 24) — admin P0 alert + attribution

### CTO
- **Shipped:** `FOUNDER_DEPLOY.md` rewritten around /ops/p0; `/admin` P0 incomplete banner with fix links.
- **Blocked:** Migration 0011 + worker unchanged.

### CBO
- **Shipped:** Pageview beacon + login signup_view capture UTM query params.

### Day 1 (session 25) — merge prep + coin SEO expand

### CTO
- **Shipped:** `MERGE_AND_SHIP.md` updated for PR #5; `check-production.sh` probes `/ops` + soft-check `/ops/p0`.
- **Blocked:** P0 unchanged — merge PR #5 then founder completes /ops/p0.

### CBO
- **Shipped:** Coin SEO expanded (+Cardano, +Dogecoin) in `seo/generate.py` — 7 coin pages after next build.

### Day 1 (session 26) — product pageview funnel

### CPO / CBO
- **Shipped:** `/dashboard` (studio.js) and `/app` (app.js) emit `pageview` events for admin funnel top-of-funnel after auth.

### CTO
- **Blocked:** P0 unchanged — merge PR #5 + founder /ops/p0.

### Day 1 (session 27) — agent runbook + Pages CI P0 log

### CTO
- **Shipped:** `AGENTS.md` cloud P0 blocker docs; Pages `verify-production` logs P0 snapshot after each deploy.
- **Blocked:** Migration 0011 + worker; PR #5 open (CI green).

### Day 1 (session 28) — activation checklist worker hint

### CPO
- **Shipped:** `/app` activation checklist explains worker-offline when deployed but no trades yet.
- **Blocked:** Full funnel v2 + trades until P0 green.

### Day 1 (session 29) — completion audit + merge nudge

### Goal audit (not complete)

| Requirement | Evidence | Status |
|-------------|----------|--------|
| Production loop (auth) | `check-production.sh` ✅ | Done |
| Worker live | heartbeat stale 2026-08-11 | **Blocked** |
| Migration 0011 | `signup_complete` HTTP 401 | **Blocked** |
| Signup→deploy→trades E2E | not run (P0) | **Blocked** |
| First Pro MRR | $0, no checkout proof | **Blocked** |
| PR #5 shipped to main | `main` at a5fe630, PR open | **Blocked** |

### CTO
- **Shipped:** `/ops` shows merge PR #5 banner when `/ops/p0` not yet on production.

### Metrics snapshot
- Pageviews 7d: *(fill from /admin)*
- Users / deployers / trades: *(fill from /admin)*
- Worker: *(pending Railway deploy)*
- MRR: $0

### Day 1 (session 30) — migration verify deploy_success

### CTO
- **Shipped:** `check-migrations.sh` probes `deploy_success`; `/ops/migrate` verify button tests signup + deploy events.
- **Blocked:** Migration 0011 + worker unchanged.

### CPO
- **Shipped:** `verify-activation-path.sh` fails on `deploy_success` 401 (aligned with signup_complete gate).

### Day 1 (session 31) — workflow verify loop + status sweep

### Status (`./scripts/status-report.sh` @ 15:35Z)
- **Production:** site + OAuth + billing ✅ | migration 0011 ❌ | worker ❌ (heartbeat 2026-08-11)
- **PR #5:** OPEN, MERGEABLE, CI running — `/ops/p0` still 404 on prod until merge
- **Event probes:** `deploy_click` 201 | `signup_complete` / `deploy_success` 401

### CTO
- **Shipped:** `apply-migration-0011.yml` verifies both funnel v2 events post-apply.

### Founder P0 (unchanged)
1. Merge **PR #5** → https://zengtrade.in/ops/p0
2. Migration 0011 → https://zengtrade.in/ops/migrate
3. Paper worker → https://zengtrade.in/ops/worker
4. `./scripts/wait-for-p0.sh` → `./scripts/verify-activation-path.sh` → https://zengtrade.in/ops/e2e

### Day 1 (session 32) — funnel probe alignment + CBO checkout gate

### CTO
- **Shipped:** `check-migrations.sh` + `verify-activation-path.sh` probe `checkout_click`; ops pages verify full funnel v2 set (`/ops`, `/ops/p0`, `/ops/e2e`, `/ops/migrate`, `/ops/billing`).
- **Shipped:** `status-report.sh` + `wait-for-p0.sh` remind founder to merge PR #5 when `/ops/p0` not deployed.

### CPO
- **Shipped:** `/ops/e2e` step 7 links Pro checkout test; P0 gate checks signup + deploy events.

### CBO
- **Shipped:** `/ops/billing` live-probes `checkout_click` (MRR intent funnel) alongside billing edge function.

### Status (`./scripts/status-report.sh` @ 15:39Z)
- P0 unchanged: migration 0011 ❌ | worker ❌ | PR #5 open, CI green

### Day 1 (session 33) — CBO sitemap verify + pricing UTMs

### CBO
- **Shipped:** `scripts/check-sitemap.sh` verifies hub + 7 coin pages in production sitemap.
- **Shipped:** Pricing page CTAs use `utm_campaign=pricing` (distinct from landing).
- **Shipped:** `/ops/gsc` lists all coin URLs + `check-sitemap.sh` verify step.

### CTO
- **Shipped:** `probe-dist.sh` asserts Cardano + Dogecoin in build sitemap; `founder-preflight.sh` runs sitemap check.

### Status (`./scripts/check-sitemap.sh` @ 15:41Z)
- Production sitemap missing **cardano** + **dogecoin** until PR #5 merges to main

### Day 1 (session 34) — CPO post-deploy hint + health-watch sitemap

### CPO
- **Shipped:** `/app` shows post-deploy banner → **Forward Test** after paper deploy (worker-aware copy).
- **Impact:** Closes signup → deploy → **trades evidence** loop in Evidence app (mirrors Algo Studio hint).

### CTO
- **Shipped:** `health-watch.yml` runs `check-sitemap.sh` (warn-only); `MERGE_AND_SHIP.md` includes sitemap verify.

### CBO
- **Shipped:** `WEEKLY_PROOF.md` fee copy fixed (35 bps) + UTM on signup link.

### Status (`./scripts/status-report.sh` @ 15:43Z)
- P0 unchanged: migration 0011 ❌ | worker ❌ | PR #5 open

---

## Daily log template

Copy for each new day:

```markdown
## Day N — YYYY-MM-DD

### CTO
- Shipped:
- Blocked:
- Next:

### CPO
- Shipped:
- Blocked:
- Next:

### CBO
- Shipped:
- Blocked:
- Next:

### Metrics snapshot
- Pageviews 7d:
- Users / deployers / trades:
- Worker:
- MRR:
```
