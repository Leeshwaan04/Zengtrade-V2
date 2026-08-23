#!/usr/bin/env bash
# CBO/Sales/SEO: run all production growth + P0 probes (founder standup one-liner).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

fail=0
run() {
  local title="$1"
  shift
  echo ""
  echo ">> $title"
  if "$@"; then
    echo "OK   $title"
  else
    echo "FAIL $title"
    fail=1
  fi
}

echo "== zengtrade growth gates — $SITE =="

run "Production site" env SITE="$SITE" ./scripts/check-production.sh
run "Billing functions" "./scripts/verify-billing.sh"
run "Migration 0011" "./scripts/check-migrations.sh"

echo ""
echo ">> Paper worker"
if ./scripts/check-worker.sh; then
  echo "OK   Paper worker"
else
  echo "FAIL Paper worker (P0 blocker — /ops/worker)"
  fail=1
fi

run "GSC readiness" env SITE="$SITE" ./scripts/check-gsc-ready.sh
run "Plan intent" "./scripts/check-plan-intent.sh"
run "Founding pricing" "./scripts/check-production-pricing.sh"
run "Pricing truth (repo)" "./scripts/check-pricing-truth.sh"
run "Security smoke" "./scripts/security-smoke.sh"

if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  echo ""
  echo ">> Railway paper-worker"
  ./scripts/check-railway-deploy.sh 2>/dev/null || true
fi

echo ""
if [[ $fail -eq 0 ]]; then
  echo "All growth gates green — run ./scripts/post-p0-success.sh and E2E at /ops/e2e"
  exit 0
fi
echo "Some gates failed — see ./scripts/status-report.sh and ./scripts/founder-next-action.sh"
./scripts/founder-next-action.sh 2>/dev/null || true
exit 1
