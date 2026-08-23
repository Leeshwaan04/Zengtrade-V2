# zengtrade Autopilot Agents

Three role-based Cloud Agent charters run on a schedule (or on demand). Each agent reads its charter, executes the highest-priority unchecked task, updates `docs/GROWTH_DASHBOARD.md`, commits to `cursor/autopilot-ff74` (or merges to `main` when ready), and posts a short summary.

## How to enable true autopilot (Cursor)

1. **Cursor → Automations** (or Cloud Agents): create **three** scheduled agents (or one daily orchestrator).
2. **Repository:** `Leeshwaan04/Zengtrade-V2`
3. **Base branch:** `main` (or `cursor/autopilot-ff74` while iterating)
4. **Schedule:** daily 09:00 UTC (adjust to your timezone)
5. **Paste the prompt** from each charter file below.

| Agent | Charter file | Branch prefix |
|-------|----------------|---------------|
| CTO | `.cursor/autopilot/cto.md` | `cursor/cto-*-ff74` |
| CPO | `.cursor/autopilot/cpo.md` | `cursor/cpo-*-ff74` |
| CBO | `.cursor/autopilot/cbo.md` | `cursor/cbo-*-ff74` |

### Single orchestrator (simpler)

One daily agent with prompt:

```
Read .cursor/autopilot/README.md and run CTO, then CPO, then CBO charters in order.
Update docs/GROWTH_DASHBOARD.md with today's date section.
Commit, push, update open PR if any. Summarize for the founder in 5 bullets.
```

## Founder dashboard (bookmark this)

**https://zengtrade.in/ops** — live HTML progress for CTO / CPO / CBO (auto-refresh, approval alerts).

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
