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

if [[ $fail -eq 0 ]]; then
  echo "Sales-ready — founder manual checkout: $SITE/ops/billing"
  echo "After IPN: confirm paying + MRR in $SITE/admin"
  exit 0
fi
exit 1
