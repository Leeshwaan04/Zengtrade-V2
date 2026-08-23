# zengtrade Autopilot Agents

Seven role-based Cloud Agent charters run on a schedule (or on demand). Each agent reads its charter, executes the highest-priority unchecked task, updates `saas/web/ops-data.json` and `docs/GROWTH_DASHBOARD.md`, and **commits directly to `main`** (no PRs unless the founder asks).

## How to enable true autopilot (Cursor)

1. **Cursor → Automations** (or Cloud Agents): create scheduled agents (or one daily orchestrator).
2. **Repository:** `Leeshwaan04/Zengtrade-V2`
3. **Base branch:** `main` (commit and push to `main` only)
4. **Schedule:** daily 09:00 UTC (adjust to your timezone)
5. **Paste the prompt** from each charter file below.

| Agent | Charter file | Commit prefix |
|-------|----------------|---------------|
| CTO | `.cursor/autopilot/cto.md` | `cto(autopilot):` |
| CPO | `.cursor/autopilot/cpo.md` | `cpo(autopilot):` |
| CBO | `.cursor/autopilot/cbo.md` | `cbo(autopilot):` |
| QA&VAPT | `.cursor/autopilot/qavapt.md` | `qavapt(autopilot):` |
| SEO Manager | `.cursor/autopilot/seo.md` | `seo(autopilot):` |
| Marketing Lead | `.cursor/autopilot/marketing.md` | `marketing(autopilot):` |
| Sales Manager | `.cursor/autopilot/sales.md` | `sales(autopilot):` |

**CTO first action each run:** `./scripts/run-p0-if-ready.sh`

**P0 blocker (founder):** Railway `paper-worker` has wrong Postgres password — Cloud Agent secret `DATABASE_PASSWORD` or https://zengtrade.in/ops/worker

**Daily log:** `./scripts/append-growth-log.sh N "title" --cto "..." --cpo "..." --cbo "..."` (auto-syncs header probes via `sync-growth-dashboard-header.sh`)

**While worker down:** `./scripts/guide-founder-parallel.sh` · `docs/FOUNDER_PARALLEL.md`

### Single orchestrator (recommended)

One daily agent with prompt:

```
Read .cursor/autopilot/README.md and run charters in order:
CTO → CPO → CBO → SEO → Marketing → Sales → QA&VAPT.
Update docs/GROWTH_DASHBOARD.md with today's date section.
Use ./scripts/append-growth-log.sh for each session log block.
Update saas/web/ops-data.json for any role that shipped work.
Commit and push to main. Summarize for the founder in 5 bullets.
Use ./scripts/append-growth-log.sh N "title" --cto "..." --cpo "..." --cbo "..." each run.
```

### Growth squad (who owns what)

| Function | Agent | Playbook |
|----------|-------|----------|
| Production, auth, worker, billing infra | CTO | `docs/LAUNCH_RUNBOOK.md` |
| Activation UX, signup→deploy→trades | CPO | `docs/CRYPTO_PRODUCT.md` |
| Organic strategy, pricing truth, first MRR | CBO | `deploy/landing/build.py` |
| Technical SEO, sitemap, pSEO, GSC | SEO Manager | `docs/SEO_PLAYBOOK.md` |
| Brand, content, campaigns, community | Marketing Lead | `docs/MARKETING_PLAYBOOK.md` |
| Pro conversion, checkout, MRR | Sales Manager | `docs/SALES_PLAYBOOK.md` |
| Security smoke, RLS, VAPT | QA&VAPT | `docs/QA_VAPT_CHECKLIST.md` |

## Founder dashboard (bookmark this)

**https://zengtrade.in/ops/p0** — P0 checklist (~15 min: migration 0011 + worker).  
**https://zengtrade.in/ops** — full autopilot dashboard (all roles).  
**https://zengtrade.in/ops/security** — QA & VAPT playbook.

Agents update `saas/web/ops-data.json` on each run (not markdown for the founder).

## Daily digest (agents)

`docs/GROWTH_DASHBOARD.md` — internal agent log. Founders use **/ops** instead.

## Metrics sources

| Metric | Where |
|--------|--------|
| Pageviews, signups, deployers, MRR | `/admin` (Supabase RPCs) |
| Worker health | Admin tile + `engine_state` key `_worker_heartbeat` |
| Code / ship status | `main` branch, `docs/LAUNCH_RUNBOOK.md` |
| Organic | Google Search Console (manual until wired) |
| Funnel events | `signup_complete`, `deploy_success`, `checkout_click` |

## Rules for all agents

- **Paper-first:** never enable live execution or overpromise in copy.
- **Ship smallest fix** that unblocks activation or revenue.
- **Test** before commit (smoke script, landing build).
- **Do not** force-push or merge PRs unless the user explicitly asks.
