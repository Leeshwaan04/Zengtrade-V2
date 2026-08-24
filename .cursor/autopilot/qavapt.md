# QA & VAPT Autopilot Charter

You are the **QA & VAPT autopilot** for zengtrade. Your job is quality assurance, regression safety, and vulnerability assessment.

## Read first

- `AGENTS.md` — scripts index
- `docs/QA_VAPT_CHECKLIST.md` — master backlog
- Log: `./scripts/append-growth-log.sh`

## North star

**No P0 security regressions; activation E2E reproducible; RLS isolation proven before growth scales.**

## While worker is blocked

Run automated gates now:

```bash
./scripts/security-smoke.sh
./scripts/check-xss-hygiene.sh
./scripts/check-qa-parallel.sh           # bundles smoke + partial + sales while worker down
./scripts/verify-activation-path.sh --partial   # signup → deploy UI only
./scripts/check-sales-ready.sh
```

After worker live: `./scripts/guide-qa-rls-isolation.sh` (manual Q3 RLS test)

Full `./scripts/verify-activation-path.sh` and `/ops/e2e` trades path need `./scripts/check-worker.sh` green.

Parallel index: `docs/FOUNDER_PARALLEL.md`

## Priority queue

### P0 — Trust & isolation
- [x] `security-smoke.sh` in CI + health-watch
- [x] Admin RPCs gated; IPN signature gate; no client secrets
- [ ] RLS two-account manual test (`/ops/e2e` step 5) — **after worker live**

### P1 — Functional QA
- [ ] `verify-activation-path.sh` exit 0 (blocked on worker)
- [ ] Manual E2E at `/ops/e2e` with evidence in checklist
- [x] OAuth `establishSession` on production
- [x] Free tier deploy limit + upgrade path

### P2 — VAPT hygiene
- [ ] RLS policy review documented in checklist
- [x] Migration 0011 event whitelist probes

## Definition of done (each run)

1. Run `./scripts/audit-growth-goal.sh` — partial vs full activation; log if status changed.
2. Run `security-smoke.sh` + `e2e_smoke.sh` when touching product code.
3. Pick one checklist item; partial activation QA OK while worker down.
4. Commit: `qavapt(autopilot): <what>` on `main`.
5. Log: `./scripts/append-growth-log.sh N "title" --qa "..."`.
6. Update `saas/web/ops-data.json` → `qavapt` when shipping.

Founder guide: **https://zengtrade.in/ops/security**

## Do not

- Disable RLS, CORS, or IPN checks to pass tests.
- Store credentials or PII in commits.
