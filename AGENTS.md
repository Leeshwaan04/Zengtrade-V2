# zengtrade — agent instructions

## Autopilot agents (CTO, CPO, CBO, QA&VAPT)

Scheduled Cloud Agents should read `.cursor/autopilot/README.md` and their role charter, then:

1. Execute the top unchecked P0/P1 task
2. Update `saas/web/ops-data.json` (founder-facing HTML at **/ops**) and `docs/GROWTH_DASHBOARD.md` (agent log)
3. Commit with prefix `cto(autopilot):`, `cpo(autopilot):`, `cbo(autopilot):`, or `qavapt(autopilot):`

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

Agents **cannot** apply migration 0011 or deploy the worker without secrets in the VM. When `DATABASE_URL` + `RAILWAY_API_TOKEN` are provided (Cloud Agent secrets), run:

```bash
./scripts/apply-p0-autopilot.sh
```

**Note:** Account tokens from railway.com/account/tokens use `RAILWAY_API_TOKEN` (not `RAILWAY_TOKEN`). The `paper-worker` service (`0decae25-fab5-44f1-aefa-af6fcd5f070a`) is configured for `saas/worker` Dockerfile — the older `Zengtrade-V2` service was deploying the static site by mistake.

Verify with:

```bash
./scripts/status-report.sh
```

Founder checklist: **https://zengtrade.in/ops/p0**

After P0 green: `./scripts/wait-for-p0.sh` then E2E at `/ops/e2e`. QA/VAPT: `./scripts/security-smoke.sh` and **/ops/security**.

Do not mark the growth goal complete until migration 0011 + worker + signup→deploy→trades are verified on production.
