#!/usr/bin/env bash
# CBO/CPO parallel gates — runnable while paper worker is blocked (no trades).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — run ./scripts/check-growth-gates.sh for full standup"
  exit 0
fi

echo "== Parallel growth (worker blocked) — $SITE =="
echo ""

fail=0
run() {
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

run "Partial activation (CPO)" ./scripts/verify-partial-activation.sh
run "Billing-ready (CBO)" env SITE="$SITE" ./scripts/check-billing-ready.sh
run "GSC-ready (CBO)" env SITE="$SITE" ./scripts/check-gsc-ready.sh

if [[ $fail -eq 0 ]]; then
  echo "All parallel gates green — worker is sole P0 blocker: https://zengtrade.in/ops/worker"
  exit 0
fi

echo "Fix failures above, then unblock worker for trades E2E."
./scripts/founder-next-action.sh 2>/dev/null || true
exit 1
