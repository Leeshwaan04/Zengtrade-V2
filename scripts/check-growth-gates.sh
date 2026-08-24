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
echo ""
echo "Growth objective:"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
echo ""

run "Production site" env SITE="$SITE" ./scripts/check-production.sh
run "Billing ready (MRR)" env SITE="$SITE" ./scripts/check-billing-ready.sh
run "Migration 0011" "./scripts/check-migrations.sh"
run "Activation UI (CPO)" env SITE="$SITE" ./scripts/check-activation-ready.sh

echo ""
echo ">> Paper worker"
if ./scripts/check-worker.sh; then
  echo "OK   Paper worker"
else
  echo "FAIL Paper worker (P0 blocker — /ops/worker)"
  fail=1
  echo ""
  echo ">> Partial activation (worker blocked)"
  if ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1; then
    echo "OK   Partial activation — signup → deploy (verify-activation-path --partial)"
  else
    echo "WARN Partial activation — run ./scripts/verify-activation-path.sh --partial"
  fi
fi

run "GSC readiness" env SITE="$SITE" ./scripts/check-gsc-ready.sh
run "Plan intent" "./scripts/check-plan-intent.sh"
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
echo ""
echo "Growth goal:"
GROWTH_PROD=0 GROWTH_MIG=0 GROWTH_WORK=0
SITE="$SITE" ./scripts/check-production.sh >/dev/null 2>&1 && GROWTH_PROD=1
./scripts/check-migrations.sh >/dev/null 2>&1 && GROWTH_MIG=1
./scripts/check-worker.sh >/dev/null 2>&1 && GROWTH_WORK=1
export GROWTH_PROD GROWTH_MIG GROWTH_WORK GROWTH_DB_AUTH=0
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null || true
exit 1
