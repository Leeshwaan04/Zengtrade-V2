# zengtrade Autopilot Agents

Nine role-based charters (R&D added 2026-09-12; Content Strategist added 2026-09-12). As of
2026-09-11, Claude Code is the senior actor for all nine roles: whenever a Claude Code session is
active (interactively or on a schedule via
CronCreate), it reads this file + `saas/web/ops-data.json` + recent commit history first, so it picks
up wherever the Cursor Cloud Agents left off rather than duplicating work. Cursor's scheduled agents
(below) stay on as the persistent floor — they're the only thing that runs work when no Claude Code
session is open, since Claude Code's own scheduling (CronCreate) is session-bound and caps at 7 days,
unlike Cursor's server-side schedule. Revisit pausing Cursor once the founder trusts the Claude Code
path.

Standing approval gate for Claude Code operating under these charters: **anything touching money**
(pricing, billing logic, payment-provider config, refunds, referral payouts) never ships silently.
As refined 2026-09-12: don't reflexively hold the work back and wait for a reply either — do the
non-money parts, write up the money part clearly, and call it out by name in the same summary rather
than a separate blocking question each time. Everything else in the charters below, it does on its
own judgment and commits directly.

Each agent reads its charter, executes the highest-priority unchecked task, updates
`saas/web/ops-data.json` and `docs/GROWTH_DASHBOARD.md`, and **commits directly to `main`** (no PRs
unless the founder asks).

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
| R&D | `.cursor/autopilot/rnd.md` | `rnd(autopilot):` |
| Content Strategist | `.cursor/autopilot/content.md` | `content(autopilot):` |

**CTO first action each run:** `./scripts/run-p0-if-ready.sh`

**P0 blocker (founder):** Railway `paper-worker` has wrong Postgres password — Cloud Agent secret `DATABASE_PASSWORD` or https://zengtrade.in/ops/worker

**Daily log:** `./scripts/append-growth-log.sh N "title" --cto "..." --cpo "..." --cbo "..." --seo "..." --marketing "..." --sales "..." --qa "..." --rnd "..." --content "..."` (auto-syncs header probes)

**While worker down:** `./scripts/check-founder-parallel-ready.sh` · `./scripts/guide-founder-parallel.sh` · `./scripts/audit-growth-goal.sh` · `./scripts/print-growth-goal-summary.sh` · `docs/GUIDE_INDEX.md`

### Single orchestrator (recommended)

One daily agent with prompt:

```
Read .cursor/autopilot/README.md and run charters in order:
CTO → CPO → CBO → SEO → Marketing → Sales → QA&VAPT → R&D → Content Strategist.
Update docs/GROWTH_DASHBOARD.md with today's date section.
Use ./scripts/append-growth-log.sh for each session log block.
Update saas/web/ops-data.json for any role that shipped work.
Commit and push to main. Summarize for the founder in 5 bullets.
Use ./scripts/append-growth-log.sh N "title" --cto "..." --cpo "..." --cbo "..." --seo "..." --marketing "..." --sales "..." --qa "..." --rnd "..." --content "..." each run.
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
| Retention, revenue experiments, GTM exploration | R&D | `.cursor/autopilot/rnd.md` |
| Content taxonomy, /learn/ + /blog/ roadmap, glossary | Content Strategist | `.cursor/autopilot/content.md` |

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
