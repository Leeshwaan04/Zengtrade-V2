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
- **Shipped:** Founding Pro $19/mo on pricing page; `docs/GSC_SETUP.md` step-by-step.
- **Next:** Founder completes GSC verification + sitemap submit.

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
