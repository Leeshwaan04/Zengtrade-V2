# Founder guide index

One-page map of CLI playbooks while the paper worker is blocked (or after P0 green).

**Quick start:** `./scripts/guide-founder-growth-standup.sh` · `./scripts/guide-founder-parallel.sh` · **All probes:** `./scripts/check-founder-parallel-ready.sh`

## Verify scripts (automated)

| Script | What it checks |
|--------|----------------|
| `./scripts/audit-growth-goal.sh` | CTO/CPO/CBO goal audit (all role requirements) |
| `./scripts/check-growth-goal.sh` | Same as audit-growth-goal (discoverability alias) |
| `./scripts/print-growth-goal-summary.sh` | Growth goal summary (fast; used by status-report) |
| `./scripts/check-founder-parallel-ready.sh` | Parallel growth + QA parallel + all guides exist |
| `./scripts/check-parallel-growth.sh` | CPO/CBO partial activation, billing, GSC, sales (excl. worker) |
| `./scripts/check-qa-parallel.sh` | Security smoke, XSS, partial activation, sales |
| `./scripts/check-sales-ready.sh` | Billing + plan intent + pricing truth |
| `./scripts/check-founder-guides.sh` | All `guide-*.sh` scripts executable |
| `./scripts/validate-database-credentials.sh` | CTO: Postgres auth probe (no secrets printed) |
| `./scripts/run-p0-if-ready.sh` | CTO: unified P0 entry (validate → apply → post-P0) |
| `./scripts/verify-activation-path.sh --partial` | CPO: signup → deploy path without worker |

## Role playbooks (manual steps)

| Role | Script | When |
|------|--------|------|
| **All** | `./scripts/guide-founder-growth-standup.sh` | Combined CPO + CBO + QA standup (worker blocked) |
| **CTO** | `./scripts/guide-worker-recovery.sh` | P0 blocked — wrong Railway DB password |
| **CPO** | `./scripts/guide-cpo-founder-standup.sh` | Partial activation combined (signup → deploy + Q9) |
| **CPO** | `./scripts/guide-partial-e2e.sh` | Signup → deploy (steps 1–2); View evidence → `/app#forward` |
| **CPO** | `./scripts/guide-free-tier-test.sh` | Q9 — second deploy blocked on Free |
| **CBO / Sales** | `./scripts/guide-cbo-founder-standup.sh` | GSC + first Pro MRR combined (worker blocked) |
| **CBO / SEO** | `./scripts/guide-gsc-founder.sh` | GSC verify + sitemap submit |
| **SEO** | `./scripts/guide-monthly-gsc-review.sh` | Monthly GSC performance review |
| **CBO / Sales** | `./scripts/guide-first-pro-checkout.sh` | First Pro MRR checkout |
| **Sales** | `./scripts/guide-mrr-standup.sh` | Weekly `/admin` MRR + funnel review |
| **Marketing** | `./scripts/guide-linkedin-bip.sh` | LinkedIn build-in-public post |
| **Marketing** | `./scripts/guide-coin-spotlight.sh [slug]` | Coin spotlight post (e.g. `bitcoin`) |
| **QA&VAPT** | `./scripts/guide-qa-founder-standup.sh` | Parallel QA combined (security + partial + sales) |
| **QA&VAPT** | `./scripts/guide-qa-rls-isolation.sh` | Post-P0 RLS two-account test (Q3) |

## Ops pages

| Page | URL |
|------|-----|
| Migration 0011 (parallel hub) | https://zengtrade.in/ops/migrate |
| Founder ops | https://zengtrade.in/ops |
| P0 checklist | https://zengtrade.in/ops/p0 |
| Worker recovery | https://zengtrade.in/ops/worker |
| Partial E2E | https://zengtrade.in/ops/e2e |
| GSC | https://zengtrade.in/ops/gsc |
| Billing / MRR | https://zengtrade.in/ops/billing |
| QA & VAPT | https://zengtrade.in/ops/security |

## After P0 green

```bash
./scripts/post-p0-success.sh
./scripts/verify-activation-path.sh
./scripts/guide-qa-rls-isolation.sh   # Q3 RLS — /ops/e2e step 5
./scripts/audit-growth-goal.sh
```

While worker blocked:

```bash
./scripts/verify-activation-path.sh --partial
./scripts/guide-partial-e2e.sh
./scripts/guide-free-tier-test.sh       # Q9 free deploy cap
```

Trust path (partial or before checkout): `/dashboard` deploy → View evidence → `/app#forward`

Full E2E: https://zengtrade.in/ops/e2e

## Related docs

- `docs/FOUNDER_PARALLEL.md` — parallel work summary
- `docs/WORKER_RECOVERY.md` — worker runbook
- `docs/GROWTH_DASHBOARD.md` — agent daily log
