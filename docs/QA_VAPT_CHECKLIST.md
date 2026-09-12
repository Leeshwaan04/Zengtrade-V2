# QA & VAPT checklist

**Owner:** QA&VAPT autopilot (`.cursor/autopilot/qavapt.md`).  
**Run:** `./scripts/security-smoke.sh` + `./tests/e2e_smoke.sh` each session.

**While worker blocked:** `./scripts/verify-activation-path.sh --partial` · `./scripts/check-qa-parallel.sh` · `docs/FOUNDER_PARALLEL.md`

| ID | Area | Check | Status | Evidence |
|----|------|-------|--------|----------|
| Q1 | Client secrets | No service_role / API keys in browser JS | ☑ | `security-smoke.sh` (2026-08-23) |
| Q2 | Auth | `establishSession` on `/js/auth.js` | ☑ | `security-smoke.sh` + prod |
| Q3 | RLS | User A ≠ User B trades/deployments | ☑ | Two real Supabase accounts, live prod, 2026-09-12 (session 220) — see below |
| Q4 | Admin | Non-admin cannot read `admin_overview` metrics | ☑ | `security-smoke.sh` admin_users 401 + RLS empty anon |
| Q5 | Billing IPN | Unsigned webhook rejected | ☑ | `security-smoke.sh` + `verify-billing.sh` |
| Q6 | Funnel | `signup_complete` not on sign-in only | ☑ | `login.html` PENDING_SIGNUP_KEY (code review) |
| Q7 | E2E smoke | Landing build + worker compile | ☑ | `e2e_smoke.sh` CI |
| Q8 | Activation | Post-P0 verify script | ☐ | `verify-activation-path.sh` (blocked: P0) |
| Q8b | Partial activation | Signup → deploy UI without worker | ☑ | `verify-activation-path.sh --partial` + `guide-partial-e2e.sh` · View evidence → `/app#forward` (2026-08-24) |
| Q9 | Free tier | Second deploy blocked with upgrade CTA | ☐ | `check-free-tier-limit.sh` in `check-qa-parallel.sh` + `./scripts/guide-free-tier-test.sh` manual |
| V1 | XSS | Dynamic HTML uses `esc()` in `/app` | ☑ | `check-xss-hygiene.sh` + `app.js` review (2026-08-23) |
| V2 | Event abuse | `event` insert policy name whitelist | ☑ | migration `0011` applied prod (2026-08-23) |
| V3 | Worker | DB creds only server-side | ☑ | no secrets in `saas/web/js` |

## RLS isolation — PASSED (2026-09-12, session 220)

Run directly against the Supabase REST API with two real, email-confirmed test accounts
(`zengtrade.qa.rls.test.{a,b}.<ts>@mailinator.com`) rather than two incognito windows - same
result, more precise (proves DB-level RLS, not just client-side query construction), and doesn't
depend on a human being available. Confirmation links retrieved from Mailinator's public inbox
(no real inbox access needed - that's what makes disposable test addresses work for this).

- **Read isolation:** User A deployed `trend_follow` (real row, real worker pickup - a live
  `ETHUSDT` position appeared in `book_state` within ~20s). User B queried `deployment`,
  `book_state`, and `trade` three ways (no filter, explicit `user_id=eq.<A's uid>`, explicit
  `id=eq.<A's row>`) and got `[]` every time - RLS enforced server-side, not just hidden by the
  app's own query shape.
- **Write isolation:** User B attempted `PATCH` (stop A's deployment) and `DELETE` against A's
  exact row id. Both returned `[]` / HTTP 200 (zero rows matched under B's RLS-scoped policy, so
  nothing was touched) - confirmed by re-reading the row as A afterward: unchanged.
- **Cleanup:** test deployment stopped after the test. The two test accounts remain in
  production `auth.users` (harmless, but founder can delete them from Supabase Studio if wanted -
  no service-role key was used or available for this test, by design).

**If retesting later:** the manual incognito-window version below still works as a human-facing
sanity check, but isn't required to reverify RLS itself.

1. Incognito A: signup → deploy → note trade count in `/app#forward`.
2. Incognito B: signup → confirm **zero** trades from A.
3. Record pass/fail + date in `docs/GROWTH_DASHBOARD.md`.

## Severity rubric

| Level | Action |
|-------|--------|
| **P0** | Blocks launch / data leak, fix same day, CTO notified |
| **P1** | Activation or billing integrity, fix before paid ads |
| **P2** | Hardening / hygiene: schedule in backlog |
