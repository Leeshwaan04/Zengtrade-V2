#!/usr/bin/env bash
# Founder: parallel growth playbook while paper worker is blocked (no trades yet).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Founder parallel growth — $SITE =="
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker is live — run full growth standup:"
  echo "  ./scripts/check-growth-gates.sh"
  echo "  ./scripts/post-p0-success.sh"
  exit 0
fi

env ZT_QUIET_GROWTH=1 ./scripts/check-parallel-growth.sh || true
echo ""
echo "One-shot probes: ./scripts/check-founder-parallel-ready.sh"
echo "Combined standup: ./scripts/guide-founder-growth-standup.sh   # CPO + CBO + QA"
echo "Parallel hub (migration live): $SITE/ops/migrate"
echo ""

if ./scripts/check-sales-ready.sh 2>/dev/null; then
  echo ""
else
  echo "WARN Sales-ready probe failed — see ./scripts/check-sales-ready.sh"
  echo ""
fi

echo "== Manual playbooks =="
echo ""
echo "CTO  Unblock worker (P0):"
echo "     ./scripts/guide-cto-founder-standup.sh   # P0 recovery combined"
echo "     ./scripts/guide-worker-recovery.sh"
echo "     $SITE/ops/worker"
echo "     docs/WORKER_RECOVERY.md"
echo "     Cloud Agent secret DATABASE_PASSWORD → ./scripts/run-p0-if-ready.sh"
echo ""
echo "CPO  Partial activation (signup → deploy):"
echo "     ./scripts/guide-cpo-founder-standup.sh   # partial E2E + Q9 combined"
echo "     ./scripts/verify-activation-path.sh --partial"
echo "     ./scripts/guide-partial-e2e.sh"
echo "     ./scripts/guide-free-tier-test.sh   # Q9: second deploy blocked"
echo "     $SITE/ops/e2e (steps 1–2)"
echo "     View evidence: post-deploy hint or worker-offline banner → $SITE/app#forward"
echo ""
echo "CBO  Organic + first Pro MRR:"
echo "     ./scripts/guide-cbo-founder-standup.sh   # GSC + MRR combined (worker blocked)"
echo "     Trust path: $SITE/dashboard deploy → View evidence → $SITE/app#forward → checkout"
echo "     ./scripts/guide-gsc-founder.sh"
echo "     $SITE/ops/gsc — GSC completion log (docs/GSC_SETUP.md)"
echo "     $SITE/ops/billing — first Pro checkout → confirm /admin MRR"
echo ""
echo "Sales First Pro checkout:"
echo "     ./scripts/guide-first-pro-checkout.sh"
echo "     ./scripts/check-sales-ready.sh"
echo "     $SITE/ops/billing · docs/SALES_PLAYBOOK.md § First Pro checkout"
echo "     ./scripts/guide-mrr-standup.sh   # weekly /admin MRR"
echo ""
echo "Marketing  Build-in-public (partial activation — no trades claim):"
echo "     ./scripts/guide-marketing-founder-standup.sh   # organic posts combined"
echo "     ./scripts/guide-linkedin-bip.sh"
echo "     ./scripts/guide-coin-spotlight.sh [bitcoin|ethereum|solana|...]"
echo "     docs/content/LINKEDIN_BUILD_IN_PUBLIC.md"
echo ""
echo "SEO  Monthly GSC review:"
echo "     ./scripts/guide-monthly-gsc-review.sh"
echo ""
echo "QA&VAPT  Security + partial activation (no worker):"
echo "     ./scripts/guide-qa-founder-standup.sh   # QA parallel combined"
echo "     ./scripts/check-qa-parallel.sh"
echo "     $SITE/ops/security · docs/QA_VAPT_CHECKLIST.md"
echo ""
echo "CLI  ./scripts/validate-database-credentials.sh (no secrets printed)"
echo "     ./scripts/audit-growth-goal.sh — CTO/CPO/CBO goal audit"
echo "     ./scripts/check-growth-goal.sh · ./scripts/print-growth-goal-summary-fast.sh"
echo ""
echo "== Growth objective =="
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
