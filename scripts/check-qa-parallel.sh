#!/usr/bin/env bash
# QA&VAPT parallel gates — runnable while paper worker is blocked (no trades).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — run ./scripts/verify-activation-path.sh for full QA"
  exit 0
fi

echo "== QA parallel (worker blocked) — ${SITE:-https://zengtrade.in} =="
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

run "Security smoke" ./scripts/security-smoke.sh
run "XSS hygiene (/app)" ./scripts/check-xss-hygiene.sh
run "Partial activation (CPO)" ./scripts/verify-activation-path.sh --partial
run "Sales-ready (billing)" ./scripts/check-sales-ready.sh

if [[ $fail -eq 0 ]]; then
  echo "All QA parallel gates green — full E2E needs worker: https://zengtrade.in/ops/e2e"
  exit 0
fi

echo "Fix failures above. Founder guide: https://zengtrade.in/ops/security"
exit 1
