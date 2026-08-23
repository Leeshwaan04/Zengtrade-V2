#!/usr/bin/env bash
# Founder preflight — run before/after merge to confirm ship readiness.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SITE="${SITE:-https://zengtrade.in}"

echo "=== zengtrade founder preflight ==="
echo ""

echo ">> Local build + dist probes"
./tests/e2e_smoke.sh
echo ""

echo ">> Production probe ($SITE)"
if SITE="$SITE" ./scripts/check-production.sh; then
  PROD_OK=1
else
  PROD_OK=0
fi
echo ""

echo ">> Billing edge functions"
if ./scripts/verify-billing.sh 2>/dev/null; then
  BILL_OK=1
else
  BILL_OK=0
fi
echo ""

echo "=== Summary ==="
[[ $PROD_OK -eq 1 ]] && echo "✅ Production site probes passed" || echo "❌ Production — merge PR #3 + wait-for-deploy.sh"
[[ $BILL_OK -eq 1 ]] && echo "✅ Billing functions deployed" || echo "❌ Billing — run scripts/deploy-billing.sh + secrets"
echo "❓ Worker — deploy saas/worker on Railway/Fly (see FOUNDER_DEPLOY.md §4)"
echo "❓ Migrations — apply 0009–0011 via scripts/apply-migrations.sh"
echo ""
echo "Full checklist: docs/FOUNDER_DEPLOY.md"
