# zengtrade Autopilot Agents

Four role-based Cloud Agent charters run on a schedule (or on demand). Each agent reads its charter, executes the highest-priority unchecked task, updates `saas/web/ops-data.json` and `docs/GROWTH_DASHBOARD.md`, and **commits directly to `main`** (no PRs unless the founder asks).

## How to enable true autopilot (Cursor)

1. **Cursor → Automations** (or Cloud Agents): create **four** scheduled agents (or one daily orchestrator).
2. **Repository:** `Leeshwaan04/Zengtrade-V2`
3. **Base branch:** `main` (commit and push to `main` only)
4. **Schedule:** daily 09:00 UTC (adjust to your timezone)
5. **Paste the prompt** from each charter file below.

| Agent | Charter file |
|-------|----------------|
| CTO | `.cursor/autopilot/cto.md` |
| CPO | `.cursor/autopilot/cpo.md` |
| CBO | `.cursor/autopilot/cbo.md` |
| QA&VAPT | `.cursor/autopilot/qavapt.md` |

**CTO first action each run:** `./scripts/run-p0-if-ready.sh`

### Single orchestrator (simpler)

One daily agent with prompt:

```
Read .cursor/autopilot/README.md and run CTO, CPO, CBO, then QA&VAPT charters in order.
Update docs/GROWTH_DASHBOARD.md with today's date section.
Commit and push to main. Summarize for the founder in 5 bullets.
```

## Founder dashboard (bookmark this)

**https://zengtrade.in/ops/p0** — P0 checklist (~15 min: migration 0011 + worker).  
**https://zengtrade.in/ops** — full CTO / CPO / CBO / QA&VAPT dashboard.  
**https://zengtrade.in/ops/security** — QA & VAPT playbook.

Agents update `saas/web/ops-data.json` on each run (not markdown for the founder).

## Daily digest (agents)

`docs/GROWTH_DASHBOARD.md` — internal agent log. Founders use **/ops** instead.

## Metrics sources

| Metric | Where |
|--------|--------|
| Pageviews, signups, deployers | `/admin` (Supabase RPCs) |
| Worker health | Admin tile + `engine_state` key `_worker_heartbeat` |
| Code / ship status | GitHub PRs, `docs/LAUNCH_RUNBOOK.md` checklist |
| Organic | Google Search Console (manual until wired) |

## Rules for all agents

- **Paper-first:** never enable live execution or overpromise in copy.
- **Ship smallest fix** that unblocks activation or revenue.
- **Test** before commit (smoke script, landing build).
- **Do not** force-push or merge PRs unless the user explicitly asks.
