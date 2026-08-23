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

### Metrics snapshot
- Pageviews 7d: *(fill from /admin)*
- Users / deployers / trades: *(fill from /admin)*
- Worker: *(pending Railway deploy)*
- MRR: $0


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
