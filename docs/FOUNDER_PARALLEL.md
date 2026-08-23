# Founder parallel work (while paper worker is blocked)

One-page index when migration **0011** is live but trades are not running yet.

## One command

```bash
./scripts/guide-founder-parallel.sh
```

Runs `check-parallel-growth.sh`, `check-sales-ready.sh`, and prints manual playbooks.

## By role

| Role | Action | Link / script |
|------|--------|----------------|
| **CTO** | Fix worker password | https://zengtrade.in/ops/worker · `docs/WORKER_RECOVERY.md` |
| **CTO** | Cloud Agent unblock | Secret `DATABASE_PASSWORD` → `./scripts/run-p0-if-ready.sh` |
| **CPO** | Partial E2E (signup → deploy) | `./scripts/guide-partial-e2e.sh` · https://zengtrade.in/ops/e2e |
| **CBO** | GSC verify + sitemap | https://zengtrade.in/ops/gsc · `docs/GSC_SETUP.md` |
| **CBO / Sales** | First Pro checkout | https://zengtrade.in/ops/billing · `./scripts/check-sales-ready.sh` |
| **Marketing** | LinkedIn build-in-public | `docs/content/LINKEDIN_BUILD_IN_PUBLIC.md` |
| **QA&VAPT** | Security + partial activation probes | `./scripts/security-smoke.sh` · `./scripts/verify-partial-activation.sh` |

## Verify probes

```bash
./scripts/check-parallel-growth.sh   # 5/5 excl. worker
./scripts/check-sales-ready.sh
./scripts/status-report.sh
./scripts/sync-growth-dashboard-header.sh   # refresh GROWTH_DASHBOARD.md header
```

## Do not (until worker live)

- Claim forward P&L or closed trades in posts
- Post r/algotrading draft (`docs/content/REDDIT_ALGOTRADING_DRAFT.md`)

After P0 green: `./scripts/post-p0-success.sh` → full E2E at https://zengtrade.in/ops/e2e
