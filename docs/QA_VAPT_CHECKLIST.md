# QA & VAPT checklist

**Owner:** QA&VAPT autopilot (`.cursor/autopilot/qavapt.md`).  
**Run:** `./scripts/security-smoke.sh` + `./tests/e2e_smoke.sh` each session.

| ID | Area | Check | Status | Evidence |
|----|------|-------|--------|----------|
| Q1 | Client secrets | No service_role / API keys in browser JS | ☐ | `security-smoke.sh` |
| Q2 | Auth | `establishSession` on `/js/auth.js` | ☐ | `check-production.sh` |
| Q3 | RLS | User A ≠ User B trades/deployments | ☐ | Manual 2-account `/ops/e2e` step 5 |
| Q4 | Admin | Non-admin cannot read `admin_overview` metrics | ☐ | RPC returns null |
| Q5 | Billing IPN | Unsigned webhook rejected | ☐ | `verify-billing.sh` |
| Q6 | Funnel | `signup_complete` not on sign-in only | ☐ | `login.html` + manual |
| Q7 | E2E smoke | Landing build + worker compile | ☐ | `e2e_smoke.sh` |
| Q8 | Activation | Post-P0 verify script | ☐ | `verify-activation-path.sh` |
| V1 | XSS | Dynamic HTML uses `esc()` in `/app` | ☐ | Code review `app.js` |
| V2 | Event abuse | `event` insert policy name whitelist | ☐ | migration `0011` |
| V3 | Worker | DB creds only server-side | ☐ | `saas/worker/.env.example` |

## Manual RLS isolation (required before scale)

1. Incognito A: signup → deploy → note trade count in `/app#forward`.
2. Incognito B: signup → confirm **zero** trades from A.
3. Record pass/fail + date in `docs/GROWTH_DASHBOARD.md`.

## Severity rubric

| Level | Action |
|-------|--------|
| **P0** | Blocks launch / data leak — fix same day, CTO notified |
| **P1** | Activation or billing integrity — fix before paid ads |
| **P2** | Hardening / hygiene — schedule in backlog |
