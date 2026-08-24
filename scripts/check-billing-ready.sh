#!/usr/bin/env bash
# CBO/Sales: verify Pro checkout path is ready on production (worker not required).
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

echo "== Billing ready (first Pro MRR) — $SITE =="
echo ""

section "Billing edge functions" ./scripts/verify-billing.sh
section "Founding Pro pricing" env SITE="$SITE" ./scripts/check-production-pricing.sh

echo ">> checkout_click funnel (migration 0011)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/event' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=minimal' \
  -d '{"name":"checkout_click","path":"/billing-ready-probe"}')
if [[ "$code" == "201" ]]; then
  echo "OK   checkout_click funnel"
else
  echo "FAIL checkout_click funnel (HTTP $code)"
  fail=1
fi

if grep -q 'signup_coins' saas/web/ops-billing.html; then
  echo "OK   ops-billing organic signup path (signup_coins)"
else
  echo "FAIL ops-billing missing signup_coins organic path"
  fail=1
fi

if grep -q 'zt_checkout_ref' saas/web/js/billing.js; then
  echo "OK   billing.js checkout attribution (zt_checkout_ref)"
else
  echo "FAIL billing.js missing zt_checkout_ref attribution"
  fail=1
fi

echo ""
if [[ $fail -eq 0 ]]; then
  echo "Billing-ready — test checkout at $SITE/ops/billing"
  echo "Note: activation E2E (deploy → trades) still needs paper worker live."
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth objective:"
    GROWTH_BILL=1 GROWTH_SALES=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
  exit 0
fi
exit 1
