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

That resolves `DATABASE_URL` from Cloud Agent secrets or Railway service variables, then runs `apply-p0-autopilot.sh` and `post-p0-success.sh` when ready.

**Founder alternative (no Cloud Agent):** add `DATABASE_URL` + `RAILWAY_API_TOKEN` to [GitHub repo Secrets](https://github.com/Leeshwaan04/Zengtrade-V2/settings/secrets/actions) → run workflow [Apply P0](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-p0.yml) → type `APPLY`.

**Note:** Account tokens from railway.com/account/tokens use `RAILWAY_API_TOKEN` (not `RAILWAY_TOKEN`). The `paper-worker` service (`0decae25-fab5-44f1-aefa-af6fcd5f070a`) is configured for `saas/worker` Dockerfile — the older `Zengtrade-V2` service was deploying the static site by mistake.

Verify with:

```bash
./scripts/status-report.sh
./scripts/check-p0-readiness.sh   # secrets + gates before apply-p0
./scripts/check-railway-deploy.sh   # when RAILWAY_API_TOKEN is set
```

Founder checklist: **https://zengtrade.in/ops/p0**

After P0 green: `./scripts/post-p0-success.sh` then E2E at `/ops/e2e`. QA/VAPT: `./scripts/security-smoke.sh` and **/ops/security**.

Do not mark the growth goal complete until migration 0011 + worker + signup→deploy→trades are verified on production.
