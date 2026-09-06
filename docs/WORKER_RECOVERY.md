# Paper worker recovery runbook

Owner: **CTO autopilot** · Founder guide: **https://zengtrade.in/ops/worker**

The paper worker (`saas/worker/`) connects to Supabase Postgres and runs strategies for every ACTIVE paper deployment. Without a fresh heartbeat, users can **deploy** but **no trades** appear on the Forward tab.

## Symptoms

| Signal | Meaning |
|--------|---------|
| `./scripts/check-worker.sh` fails | Heartbeat older than 12 minutes |
| `/ops` Paper worker gate red | Same: check `engine_state._worker_heartbeat` |
| Railway deploy **FAILED** | Often wrong `DATABASE_URL` password (auth error at startup) |
| `validate-database-credentials.sh` → wrong password | Railway URI set but Postgres rejects auth |
| Stale `DATABASE_URL` secret + fresh `DATABASE_PASSWORD` | `run-p0-if-ready.sh` drops bad env URI and rebuilds from password (session 143) |
| Logs: `db connect retry` | Bad URI, wrong pooler port, or DNS lag on first deploy |

## Diagnose (no secrets printed)

Preflight: `./scripts/run-p0-if-ready.sh` · Founder CLI: `./scripts/guide-worker-recovery.sh` · https://zengtrade.in/ops/worker

```bash
./scripts/run-p0-if-ready.sh              # P0 summary + parallel work hints
./scripts/validate-database-credentials.sh  # env + Railway URI auth probe
./scripts/check-railway-deploy.sh         # needs RAILWAY_API_TOKEN
./scripts/check-worker.sh                 # heartbeat age
```

Supabase SQL (optional):

```sql
select key, updated_at, value
from engine_state
where key = '_worker_heartbeat';
```

Expected when healthy: `updated_at` within **12 minutes**, logs show `startup heartbeat ok`.

## Fix paths (pick one)

### A: Cloud Agent (fastest for agents)

1. Reset DB password in [Supabase → Database](https://supabase.com/dashboard/project/ponvarxeytfcntckczbn/database/settings) if unsure.
2. Add Cloud Agent secret **`DATABASE_PASSWORD`** (password only, not API keys).
3. Agent runs `./scripts/run-p0-if-ready.sh` → builds session pooler URI → updates Railway `paper-worker` → redeploys.

### B: GitHub Action

1. Add `DATABASE_PASSWORD` or full `DATABASE_URL` + `RAILWAY_API_TOKEN` to [repo Secrets](https://github.com/Leeshwaan04/Zengtrade-V2/settings/secrets/actions).
2. Run workflow [Apply P0](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-p0.yml) → type `APPLY` (preflights `validate-database-credentials.sh`, then `run-p0-if-ready.sh`).

### B2: GitHub health-watch (scheduled)

1. Same Secrets as **B** (`DATABASE_PASSWORD` or `DATABASE_URL` + `RAILWAY_API_TOKEN`).
2. [health-watch](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/health-watch.yml) runs every **6 hours** and auto-runs `run-p0-if-ready.sh` when credentials work.

### C: Manual Railway

1. Supabase **Connect** → URI → **Session** → port **5432** → copy full URI (no `[brackets]` around password).
2. [Railway paper-worker](https://railway.app/project/f5902ffd-5b3f-49ed-b87d-dad21568185b) → Variables → `DATABASE_URL` → **Deploy**.
3. Logs must show `db: supabase` and `startup heartbeat ok`.

**Correct pooler host:** `aws-0-ap-northeast-1.pooler.supabase.com:5432`  
**Wrong:** Transaction pooler port `6543` (worker needs full SQL transactions).

**URL-encode** special characters in passwords (`@`, `#`, `%`, etc.).

## Verify recovery

```bash
./scripts/validate-database-credentials.sh   # auth OK
./scripts/check-worker.sh                  # heartbeat < 12 min
./scripts/post-p0-success.sh               # full activation + growth gates + Q9 probes
```

`post-p0-success.sh` runs `verify-activation-path.sh` (must exit 0), `check-free-tier-limit.sh`, security smoke, sales/GSC probes, and `audit-growth-goal.sh`.

Manual product check:

1. https://zengtrade.in/login?mode=signup → deploy on `/dashboard`
2. Wait one worker cycle (default **300s**)
3. https://zengtrade.in/app#forward: closed trades appear
4. https://zengtrade.in/ops/e2e: steps 3–4 green

## Stop / rollback (safe)

Stopping the worker does **not** delete deployments or historical trades. Users simply stop getting new paper fills until it restarts.

- Railway: pause service or remove `DATABASE_URL` and redeploy
- VPS: `sudo systemctl stop zengtrade-worker`
- To roll back a bad deploy: redeploy previous successful Railway deployment from the dashboard

## Escalation checklist

- [ ] Password reset + new URI pasted (not placeholder `[YOUR-PASSWORD]`)
- [ ] Session pooler **5432**, not transaction **6543**
- [ ] `paper-worker` service root = `saas/worker` (not static site)
- [ ] `RAILWAY_API_TOKEN` is an **account** token from railway.com/account/tokens
- [ ] After green heartbeat: `./scripts/verify-activation-path.sh`

## While blocked: parallel growth goals

Worker down does not block partial activation or first Pro MRR prep:

```bash
./scripts/print-growth-goal-summary.sh
./scripts/guide-founder-parallel.sh
```

| Goal | Status while worker down |
|------|--------------------------|
| CTO | Blocked until `DATABASE_URL` auth passes: see fix paths above |
| CPO | Partial OK: `./scripts/guide-partial-e2e.sh` · login → `/dashboard` deploy → View evidence → `/app#forward` |
| CPO | Full OK after post-p0: closed trades in `/app#forward` + `verify-activation-path.sh` exit 0 |
| CBO | GSC + sales-ready probes green; founder: GSC verify + first Pro checkout → `/admin` MRR |

## Related docs

- `saas/worker/README.md`: local run + hosting options
- `docs/LAUNCH_RUNBOOK.md`: full launch checklist
- `docs/FOUNDER_DEPLOY.md`: 30-minute founder checklist
