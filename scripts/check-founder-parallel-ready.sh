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

run "Parallel growth (CPO/CBO)" env ZT_QUIET_GROWTH=1 ./scripts/check-parallel-growth.sh
run "Partial activation (CPO)" env ZT_QUIET_GROWTH=1 ./scripts/verify-activation-path.sh --partial
run "QA parallel (QA&VAPT)" env ZT_QUIET_GROWTH=1 ./scripts/check-qa-parallel.sh
run "Founder guides" ./scripts/check-founder-guides.sh

echo ">> Founder parallel guide trust path"
if grep -q 'View evidence' scripts/guide-founder-parallel.sh \
  && grep -q '/app#forward' scripts/guide-founder-parallel.sh \
  && grep -qi 'trust path' docs/FOUNDER_PARALLEL.md; then
  echo "OK   guide-founder-parallel deploy-first trust path"
else
  echo "FAIL founder parallel trust path docs incomplete"
  fail=1
fi
echo ""

echo ">> Ops migrate parallel hub"
if grep -q '/ops/migrate' scripts/guide-founder-parallel.sh \
  && grep -q '/ops/migrate' docs/FOUNDER_PARALLEL.md \
  && grep -q 'parallelBox' saas/web/ops-migrate.html \
  && grep -q '/ops/migrate' saas/web/ops.html; then
  echo "OK   /ops/migrate parallel hub wired in guides + ops page"
else
  echo "FAIL /ops/migrate parallel hub incomplete"
  fail=1
fi
echo ""

echo ">> CBO founder standup guide"
if [[ -x scripts/guide-cbo-founder-standup.sh ]] \
  && grep -q 'guide-gsc-founder' scripts/guide-cbo-founder-standup.sh \
  && grep -q 'guide-first-pro-checkout' scripts/guide-cbo-founder-standup.sh; then
  echo "OK   guide-cbo-founder-standup GSC + MRR playbook"
else
  echo "FAIL guide-cbo-founder-standup incomplete"
  fail=1
fi
echo ""

echo ">> CPO founder standup guide"
if [[ -x scripts/guide-cpo-founder-standup.sh ]] \
  && grep -q 'guide-partial-e2e' scripts/guide-cpo-founder-standup.sh \
  && grep -q 'guide-free-tier-test' scripts/guide-cpo-founder-standup.sh \
  && grep -q 'guide-cpo-founder-standup' saas/web/ops-e2e.html; then
  echo "OK   guide-cpo-founder-standup partial activation playbook"
else
  echo "FAIL guide-cpo-founder-standup incomplete"
  fail=1
fi
echo ""

if [[ $fail -eq 0 ]]; then
  echo "All founder parallel probes green — manual playbooks:"
  echo "  ./scripts/guide-founder-parallel.sh"
  echo ""
  echo "Growth objective:"
  ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  exit 0
fi

echo "Fix failures above. Index: docs/FOUNDER_PARALLEL.md"
exit 1
