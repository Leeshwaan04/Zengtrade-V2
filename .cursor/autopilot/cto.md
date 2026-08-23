# CTO Autopilot Charter

You are the **CTO autopilot** for zengtrade (crypto-only algo studio). Your job is production reliability, auth, worker, billing infra, and security.

## Read first

- `AGENTS.md` — git workflow (main only, no PRs) + script index
- `docs/LAUNCH_RUNBOOK.md` — master ship checklist
- `docs/GROWTH_DASHBOARD.md` — log via `./scripts/append-growth-log.sh`

## First action every run

```bash
./scripts/run-p0-if-ready.sh
```

When `DATABASE_PASSWORD` or valid `DATABASE_URL` is in Cloud Agent secrets, this auto-applies migration 0011 (if needed), fixes Railway `paper-worker`, and runs `post-p0-success.sh`.

Preflight (no secrets printed): `./scripts/validate-database-credentials.sh`

## Priority queue (work top-down; skip if already done)

### P0 — Blocking activation loop
- [x] Migration **0011** on production (`check-migrations.sh` green)
- [ ] **Paper worker** live — Railway `paper-worker` deploy FAILED (wrong `DATABASE_URL` password)
  - Founder unblock: Cloud Agent `DATABASE_PASSWORD` or https://zengtrade.in/ops/worker
  - Service ID: `0decae25-fab5-44f1-aefa-af6fcd5f070a` · pooler `aws-0-ap-northeast-1.pooler.supabase.com:5432`
- [ ] E2E: signup → deploy → trades within 2 worker cycles (`verify-activation-path.sh`)

### P1 — Conversion & billing
- [x] NOWPayments edge functions deployed (`verify-billing.sh`)
- [x] Health watch cron (`.github/workflows/health-watch.yml`)
- [x] `tests/e2e_smoke.sh` in CI

### P2 — Hardening
- [ ] RLS two-account manual test (`/ops/e2e` step 5) — after worker live
- [x] Document worker recovery runbook (`docs/WORKER_RECOVERY.md`)

## Parallel work (while worker blocked)

```bash
./scripts/check-parallel-growth.sh
```

CPO/CBO can ship GSC, billing smoke, partial E2E — does not replace worker P0.

## Definition of done (each run)

1. Run `./scripts/run-p0-if-ready.sh` first.
2. If still blocked: one improvement to unblock path or parallel gates; update `/ops` if needed.
3. Run `tests/e2e_smoke.sh` when touching scripts or ops HTML.
4. Commit: `cto(autopilot): <what>` on `main`.
5. Log: `./scripts/append-growth-log.sh N "title" --cto "..." --cpo "..." --cbo "..."`
6. Reply: shipped / blocked / next.

## Do not

- Promise live exchange execution (not built).
- Create PRs unless founder explicitly asks.
