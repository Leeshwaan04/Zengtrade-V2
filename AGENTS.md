# zengtrade — agent instructions

## Git workflow

- **Always work on `main`.** Commit and push directly to `origin/main`.
- **Do not create or update pull requests.** The founder does not want PR-based workflow; skip `ManagePullRequest`, draft PRs, and “merge PR #N” unblock hints unless the user explicitly asks for a PR again.

## Autopilot agents (CTO, CPO, CBO, QA&VAPT, SEO, Marketing, Sales)

Scheduled Cloud Agents should read `.cursor/autopilot/README.md` and their role charter, then:

1. Execute the top unchecked P0/P1 task
2. Update `saas/web/ops-data.json` (founder-facing HTML at **/ops**) and `docs/GROWTH_DASHBOARD.md` (agent log)
3. Commit with prefix `cto(autopilot):`, `cpo(autopilot):`, `cbo(autopilot):`, `qavapt(autopilot):`, `seo(autopilot):`, `marketing(autopilot):`, or `sales(autopilot):`

| Role | Charter | Playbook |
|------|---------|----------|
| SEO Manager | `.cursor/autopilot/seo.md` | `docs/SEO_PLAYBOOK.md` |
| Marketing Lead | `.cursor/autopilot/marketing.md` | `docs/MARKETING_PLAYBOOK.md` |
| Sales Manager | `.cursor/autopilot/sales.md` | `docs/SALES_PLAYBOOK.md` |

QA&VAPT charter: `.cursor/autopilot/qavapt.md` · checklist: `docs/QA_VAPT_CHECKLIST.md` · smoke: `./scripts/security-smoke.sh`

## Development

- Install: `.cursor/scripts/install.sh`
- Terminal: `python3 serve.py` (:8011), `cd backend && python3 crypto_api.py` (:8756)
- Smoke: `./tests/e2e_smoke.sh`
- Launch checklist: `docs/LAUNCH_RUNBOOK.md`

## Cursor Cloud specific instructions

- Customer product URL: `/dashboard` (Algo Studio + `studio.js`)
- Billing/evidence SPA: `/app` (`app.html`)
- OAuth callback must land on `/login` before `/dashboard`
- Worker (`saas/worker/`) must run in production for paper trades to populate

### Autopilot P0 blocker (founder-owned)

Migration **0011** is applied on production (funnel v2 events). Agents **cannot** deploy the paper worker without `DATABASE_URL`. **First action each autopilot turn on `main`:**

```bash
./scripts/run-p0-if-ready.sh
```

That resolves `DATABASE_URL` from Cloud Agent secrets or Railway service variables, preflights with `validate-database-credentials.sh`, then runs `apply-p0-autopilot.sh` and `post-p0-success.sh` when ready. GitHub [Apply P0](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-p0.yml) and [health-watch](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/health-watch.yml) use the same script.

Preflight credentials (no secrets printed): `./scripts/validate-database-credentials.sh` (founder hints) · `./scripts/probe-database-auth.sh` (quiet standup probe)

**Founder alternative (no Cloud Agent):** add `DATABASE_PASSWORD` (password only) or `DATABASE_URL` + `RAILWAY_API_TOKEN` to [GitHub repo Secrets](https://github.com/Leeshwaan04/Zengtrade-V2/settings/secrets/actions) → run workflow [Apply P0](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-p0.yml) → type `APPLY`. **Or** wait for [health-watch](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/health-watch.yml) (every 6h) — it auto-runs `run-p0-if-ready.sh` when those secrets are set.

**Fastest Cloud Agent unblock:** secret `DATABASE_PASSWORD` only (Supabase DB password after reset) — agent builds session pooler URI and redeploys Railway `paper-worker`.

**Note:** Account tokens from railway.com/account/tokens use `RAILWAY_API_TOKEN` (not `RAILWAY_TOKEN`). The `paper-worker` service (`0decae25-fab5-44f1-aefa-af6fcd5f070a`) is configured for `saas/worker` Dockerfile — the older `Zengtrade-V2` service was deploying the static site by mistake.

Verify with:

```bash
./scripts/status-report.sh
./scripts/audit-growth-goal.sh          # CTO/CPO/CBO goal requirements vs live probes
./scripts/check-growth-goal.sh          # alias for audit-growth-goal.sh
./scripts/print-growth-goal-summary.sh  # fast summary (do not nest from founder-parallel-work.sh)
./scripts/print-growth-goal-summary-fast.sh  # after parallel probes — skips slow DB re-probe
./scripts/check-growth-standup.sh   # daily log helper (status + parallel work)
./scripts/log-growth-session.sh N   # print status block for GROWTH_DASHBOARD.md (incl. growth goals line)
./scripts/append-growth-log.sh N "title" --cto "..." --cpo "..." --cbo "..." --seo "..." --marketing "..." --sales "..." --qa "..."
./scripts/snapshot-growth-metrics.sh  # markdown table for dashboard metrics
./scripts/sync-growth-dashboard-header.sh  # update GROWTH_DASHBOARD.md probe rows
./scripts/check-growth-gates.sh      # all production growth + P0 probes
./scripts/check-billing-ready.sh     # CBO/Sales: Pro checkout preflight
./scripts/check-sales-ready.sh       # Sales: billing + plan intent + pricing truth
./scripts/check-gsc-ready.sh       # CBO: organic/GSC preflight
./scripts/check-e2e-gates.sh       # CPO: can /ops/e2e start?
./scripts/check-activation-ready.sh  # CPO: signup → deploy UI (no worker)
./scripts/verify-activation-path.sh --partial  # CPO: migration + activation + deploy_success event
./scripts/verify-activation-path.sh --partial  # CPO: partial path without worker
./scripts/guide-partial-e2e.sh         # CPO: founder manual partial E2E steps
./scripts/guide-gsc-founder.sh         # CBO: founder manual GSC verify + sitemap
./scripts/guide-first-pro-checkout.sh  # Sales: founder manual first Pro MRR
./scripts/guide-linkedin-bip.sh        # Marketing: LinkedIn build-in-public CLI
./scripts/guide-coin-spotlight.sh      # Marketing: coin spotlight post template
./scripts/guide-monthly-gsc-review.sh  # SEO: monthly GSC review checklist
./scripts/guide-free-tier-test.sh      # CPO: Q9 manual free-tier deploy cap test
./scripts/guide-mrr-standup.sh        # Sales: weekly /admin MRR checklist
./scripts/guide-worker-recovery.sh     # CTO: P0 worker recovery CLI
./scripts/check-founder-guides.sh     # verify all guide-*.sh scripts
./scripts/check-free-tier-limit.sh     # CPO: free-tier deploy cap probes
./scripts/check-parallel-growth.sh   # CBO/CPO: partial + billing + GSC while worker down
./scripts/check-qa-parallel.sh       # QA: security + XSS + partial + sales (worker blocked)
./scripts/check-xss-hygiene.sh       # QA: /app esc() patterns
./scripts/guide-founder-parallel.sh  # Founder: all parallel playbooks in one command
./scripts/guide-cpo-founder-standup.sh   # CPO: partial activation + Q9 combined
./scripts/guide-cbo-founder-standup.sh   # CBO: GSC + first MRR combined
./scripts/guide-qa-founder-standup.sh    # QA: parallel security + activation combined
./scripts/guide-founder-growth-standup.sh # All: CPO + CBO + QA + Marketing combined
./scripts/guide-marketing-founder-standup.sh # Marketing: organic partial-proof posts
./scripts/guide-cto-founder-standup.sh    # CTO: P0 worker recovery combined
./scripts/guide-sales-founder-standup.sh  # Sales: first Pro MRR combined
./scripts/guide-seo-founder-standup.sh   # SEO: GSC + organic combined
docs/FOUNDER_PARALLEL.md             # one-page parallel work index
docs/GUIDE_INDEX.md                  # all founder guide scripts + ops links
./scripts/list-founder-guides.sh     # verify guides + print index path
./scripts/check-p0-readiness.sh   # secrets + gates before apply-p0
./scripts/check-railway-deploy.sh   # when RAILWAY_API_TOKEN is set
```

Founder checklist: **https://zengtrade.in/ops/p0** · Worker recovery: **docs/WORKER_RECOVERY.md**

After P0 green: `./scripts/post-p0-success.sh` then E2E at `/ops/e2e`. QA/VAPT: `./scripts/security-smoke.sh` and **/ops/security**.

Do not mark the growth goal complete until migration 0011 + worker + signup→deploy→trades are verified on production.

While worker is blocked, run `./scripts/check-parallel-growth.sh` — GSC, billing, and partial activation can proceed in parallel.
