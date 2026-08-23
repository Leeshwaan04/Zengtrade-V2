# Founder parallel work (while paper worker is blocked)

One-page index when migration **0011** is live but trades are not running yet.

## One command

```bash
./scripts/guide-founder-parallel.sh
```

Runs parallel growth probes and prints manual playbooks by role.

Index: **docs/GUIDE_INDEX.md** · `./scripts/list-founder-guides.sh`

## By role

| Role | Action | Link / script |
|------|--------|----------------|
| **CTO** | Fix worker password | `./scripts/guide-worker-recovery.sh` · https://zengtrade.in/ops/worker · `docs/WORKER_RECOVERY.md` |
| **CTO** | Cloud Agent unblock | Secret `DATABASE_PASSWORD` → `./scripts/run-p0-if-ready.sh` |
| **CTO** | GitHub auto-P0 | Repo Secrets → [health-watch](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/health-watch.yml) (every 6h) or [Apply P0](https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-p0.yml) |
| **CPO** | Partial verify (CLI) | `./scripts/verify-activation-path.sh --partial` |
| **CPO** | Partial E2E (signup → deploy) | `./scripts/guide-partial-e2e.sh` · https://zengtrade.in/ops/e2e · `./scripts/guide-free-tier-test.sh` |
| **SEO** | Monthly GSC review | `./scripts/guide-monthly-gsc-review.sh` · `docs/SEO_PLAYBOOK.md` |
| **CBO** | GSC verify + sitemap | `./scripts/guide-gsc-founder.sh` · https://zengtrade.in/ops/gsc · `docs/GSC_SETUP.md` |
| **CBO / Sales** | First Pro checkout | `./scripts/guide-first-pro-checkout.sh` · https://zengtrade.in/ops/billing · `/admin` MRR |
| **Sales** | Weekly MRR standup | `./scripts/guide-mrr-standup.sh` · https://zengtrade.in/admin |
| **Marketing** | LinkedIn build-in-public | `./scripts/guide-linkedin-bip.sh` · `docs/content/LINKEDIN_BUILD_IN_PUBLIC.md` |
| **Marketing** | Coin spotlight post | `./scripts/guide-coin-spotlight.sh [slug]` · `docs/MARKETING_PLAYBOOK.md` |
| **QA&VAPT** | Security + partial activation | `./scripts/check-qa-parallel.sh` · `./scripts/guide-qa-rls-isolation.sh` (post-P0) |

## Verify probes

```bash
./scripts/check-founder-parallel-ready.sh   # parallel + partial activation + QA + guides
./scripts/verify-activation-path.sh --partial   # CPO: signup → deploy (no worker)
./scripts/check-parallel-growth.sh   # partial + billing + GSC + sales (excl. worker)
./scripts/check-qa-parallel.sh       # security + XSS + partial + sales
./scripts/check-sales-ready.sh
./scripts/status-report.sh
./scripts/check-p0-readiness.sh    # P0 secrets + unblock paths (no secrets printed)
./scripts/sync-growth-dashboard-header.sh   # refresh GROWTH_DASHBOARD.md header
```

## Do not (until worker live)

- Claim forward P&L or closed trades in posts
- Post r/algotrading draft (`docs/content/REDDIT_ALGOTRADING_DRAFT.md`)

After P0 green: `./scripts/post-p0-success.sh` → full E2E at https://zengtrade.in/ops/e2e
