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

./scripts/check-parallel-growth.sh || true
echo ""
echo "One-shot probes: ./scripts/check-founder-parallel-ready.sh"
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
echo "     $SITE/ops/worker"
echo "     docs/WORKER_RECOVERY.md"
echo "     Cloud Agent secret DATABASE_PASSWORD → ./scripts/run-p0-if-ready.sh"
echo ""
echo "CPO  Partial activation (signup → deploy):"
echo "     ./scripts/guide-partial-e2e.sh"
echo "     ./scripts/guide-free-tier-test.sh   # Q9: second deploy blocked"
echo "     $SITE/ops/e2e (steps 1–2)"
echo ""
echo "CBO  Organic + first Pro MRR:"
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
echo "     ./scripts/guide-linkedin-bip.sh"
echo "     docs/content/LINKEDIN_BUILD_IN_PUBLIC.md"
echo ""
echo "SEO  Monthly GSC review:"
echo "     ./scripts/guide-monthly-gsc-review.sh"
echo ""
echo "QA&VAPT  Security + partial activation (no worker):"
echo "     ./scripts/check-qa-parallel.sh"
echo "     $SITE/ops/security · docs/QA_VAPT_CHECKLIST.md"
echo ""
echo "CLI  ./scripts/validate-database-credentials.sh (no secrets printed)"
