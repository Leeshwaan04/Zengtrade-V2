#!/usr/bin/env bash
# All roles: combined founder standup while paper worker is blocked.
# Quick mode: ZT_QUICK_GROWTH_STANDUP=1 or --quick (probes + role index only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

QUICK=0
[[ "${1:-}" == "--quick" ]] && QUICK=1
[[ -n "${ZT_QUICK_GROWTH_STANDUP:-}" ]] && QUICK=1

echo "== Founder growth standup (all roles + CTO P0) — $SITE =="
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

if [[ $QUICK -eq 1 ]]; then
  echo "Quick mode — probes green. Run role standups for detail:"
  echo ""
  printf "  %-14s %s\n" "CTO (P0)" "./scripts/guide-cto-founder-standup.sh"
  printf "  %-14s %s\n" "CPO" "./scripts/guide-cpo-founder-standup.sh"
  printf "  %-14s %s\n" "CBO" "./scripts/guide-cbo-founder-standup.sh"
  printf "  %-14s %s\n" "SEO" "./scripts/guide-seo-founder-standup.sh"
  printf "  %-14s %s\n" "Sales" "./scripts/guide-sales-founder-standup.sh"
  printf "  %-14s %s\n" "QA&VAPT" "./scripts/guide-qa-founder-standup.sh"
  printf "  %-14s %s\n" "Marketing" "./scripts/guide-marketing-founder-standup.sh"
  echo ""
  echo "Full run: ./scripts/guide-founder-growth-standup.sh"
  echo "Hub: $SITE/ops/migrate · $SITE/ops"
  exit 0
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
echo " SEO — GSC + organic"
echo "=========================================="
echo ""
./scripts/guide-seo-founder-standup.sh

echo ""
echo "=========================================="
echo " Sales — first Pro MRR"
echo "=========================================="
echo ""
./scripts/guide-sales-founder-standup.sh

echo ""
echo "=========================================="
echo " QA&VAPT — parallel security + activation"
echo "=========================================="
echo ""
./scripts/guide-qa-founder-standup.sh

echo ""
echo "=========================================="
echo " Marketing — organic partial proof"
echo "=========================================="
echo ""
./scripts/guide-marketing-founder-standup.sh

echo ""
echo "=========================================="
echo " CTO — P0 worker unblock (growth blocker)"
echo "=========================================="
echo ""
./scripts/guide-cto-founder-standup.sh
