#!/usr/bin/env bash
# All roles: combined CPO + CBO founder standup while paper worker is blocked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Founder growth standup (CPO + CBO + QA) — $SITE =="
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — run full growth path:"
  echo "  ./scripts/post-p0-success.sh"
  echo "  ./scripts/check-growth-gates.sh"
  echo "  ./scripts/audit-growth-goal.sh"
  exit 0
fi

echo ">> Parallel probes (all roles)"
if ! env ZT_QUIET_GROWTH=1 ./scripts/check-founder-parallel-ready.sh; then
  echo ""
  echo "Fix probe failures above."
  echo "Hub: $SITE/ops/migrate · ./scripts/guide-founder-parallel.sh"
  exit 1
fi

echo ""
echo "=========================================="
echo " CPO — partial activation"
echo "=========================================="
echo ""
./scripts/guide-cpo-founder-standup.sh

echo ""
echo "=========================================="
echo " CBO — organic + first Pro MRR"
echo "=========================================="
echo ""
./scripts/guide-cbo-founder-standup.sh

echo ""
echo "=========================================="
echo " QA&VAPT — parallel security + activation"
echo "=========================================="
echo ""
./scripts/guide-qa-founder-standup.sh

echo ""
echo "Marketing — ./scripts/guide-linkedin-bip.sh · ./scripts/guide-coin-spotlight.sh [slug]"
echo "P0 unblock — ./scripts/guide-worker-recovery.sh · $SITE/ops/worker"
