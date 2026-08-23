#!/usr/bin/env bash
# Founder: all parallel growth + QA + sales probes in one command (worker blocked).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — run ./scripts/check-growth-gates.sh"
  exit 0
fi

echo "== Founder parallel ready — $SITE =="
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

run "Parallel growth (CPO/CBO)" ./scripts/check-parallel-growth.sh
run "Partial activation (CPO)" ./scripts/verify-activation-path.sh --partial
run "QA parallel (QA&VAPT)" ./scripts/check-qa-parallel.sh
run "Founder guides" ./scripts/check-founder-guides.sh

if [[ $fail -eq 0 ]]; then
  echo "All founder parallel probes green — manual playbooks:"
  echo "  ./scripts/guide-founder-parallel.sh"
  exit 0
fi

echo "Fix failures above. Index: docs/FOUNDER_PARALLEL.md"
exit 1
