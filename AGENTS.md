# zengtrade — agent instructions

## Autopilot agents (CTO, CPO, CBO)

Scheduled Cloud Agents should read `.cursor/autopilot/README.md` and their role charter, then:

1. Execute the top unchecked P0/P1 task
2. Update `saas/web/ops-data.json` (founder-facing HTML at **/ops**) and `docs/GROWTH_DASHBOARD.md` (agent log)
3. Commit with prefix `cto(autopilot):`, `cpo(autopilot):`, or `cbo(autopilot):`

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
