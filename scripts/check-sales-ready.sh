#!/usr/bin/env bash
# Sales/CBO: Pro checkout path ready on production (worker not required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

fail=0
section() {
  local title="$1"
  shift
  echo ">> $title"
  if "$@"; then
    echo "OK   $title"
  else
    echo "FAIL $title"
    fail=1
  fi
  echo ""
}

echo "== Sales ready (first Pro MRR) — $SITE =="
echo ""

section "Billing-ready" env SITE="$SITE" ./scripts/check-billing-ready.sh
section "Plan intent routing" env SITE="$SITE" ./scripts/check-plan-intent.sh
section "Pricing truth (no live overpromise)" ./scripts/check-pricing-truth.sh

echo ">> Admin first-MRR founder surface"
if grep -q 'first Pro MRR' saas/web/admin.html \
  && grep -q 'View evidence' saas/web/admin.html \
  && grep -q '/dashboard' saas/web/admin.html \
  && grep -q 'guide-first-pro-checkout' saas/web/admin.html; then
  echo "OK   admin MRR alert deploy-first trust path"
else
  echo "FAIL admin.html missing deploy-first trust path in MRR alert"
  fail=1
fi
echo ""

if [[ $fail -eq 0 ]]; then
  echo "Sales-ready — founder manual checkout: $SITE/ops/billing"
  echo "After IPN: confirm paying + MRR in $SITE/admin"
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth objective:"
    GROWTH_SALES=1 GROWTH_GSC=1 GROWTH_BILL=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
  exit 0
fi
exit 1
