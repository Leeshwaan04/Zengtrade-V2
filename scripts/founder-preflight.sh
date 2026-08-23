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

echo ">> Database migrations"
if ./scripts/check-migrations.sh 2>/dev/null; then
  MIG_OK=1
else
  MIG_OK=0
fi
echo ""

echo ">> Paper worker"
if ./scripts/check-worker.sh 2>/dev/null; then
  WORK_OK=1
else
  WORK_OK=0
fi
echo ""

echo "=== Summary ==="
[[ $PROD_OK -eq 1 ]] && echo "✅ Production site probes passed" || echo "❌ Production — check Pages deploy"
[[ $BILL_OK -eq 1 ]] && echo "✅ Billing functions deployed" || echo "❌ Billing — run scripts/deploy-billing.sh + secrets"
[[ $MIG_OK -eq 1 ]] && echo "✅ Migrations applied" || echo "❌ Migrations — apply 0009–0011 (see apply-migrations.sh)"
[[ $WORK_OK -eq 1 ]] && echo "✅ Worker heartbeat fresh" || echo "❌ Worker — deploy saas/worker (FOUNDER_DEPLOY.md §4)"
echo ""
if SITE="$SITE" ./scripts/check-sitemap.sh 2>/dev/null; then
  echo "✅ Sitemap includes all coin pSEO pages"
else
  echo "⚠️  Sitemap — merge PR #5 for Cardano + Dogecoin coin pages"
fi
echo ""
echo "Full checklist: docs/FOUNDER_DEPLOY.md"
echo "After P0 green: ./scripts/verify-activation-path.sh"
