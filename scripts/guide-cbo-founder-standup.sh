#!/usr/bin/env bash
# CBO: founder combined standup: GSC organic + first Pro MRR (worker not required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== CBO founder standup (GSC + first MRR) — $SITE =="
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — run ./scripts/check-growth-gates.sh for full CBO standup"
  echo "Weekly MRR: ./scripts/guide-mrr-standup.sh"
  exit 0
fi

echo ">> Automated probes"
fail=0
if env ZT_QUIET_GROWTH=1 ./scripts/check-gsc-ready.sh >/dev/null 2>&1; then
  echo "OK   GSC-ready"
else
  echo "FAIL GSC-ready — ./scripts/check-gsc-ready.sh"
  fail=1
fi
if env ZT_QUIET_GROWTH=1 ./scripts/check-sales-ready.sh >/dev/null 2>&1; then
  echo "OK   Sales-ready"
else
  echo "FAIL Sales-ready — ./scripts/check-sales-ready.sh"
  fail=1
fi
echo ""

if [[ $fail -ne 0 ]]; then
  echo "Fix probe failures above."
  echo "Parallel hub: $SITE/ops/migrate · ./scripts/guide-founder-parallel.sh"
  exit 1
fi

echo "== Manual playbook (recommended order) =="
echo ""
echo "A. Organic (GSC) — ~30 min"
echo "   → ./scripts/guide-gsc-founder.sh"
echo "   → $SITE/ops/gsc"
echo "   Log completion date in docs/GROWTH_DASHBOARD.md (CBO section)"
echo ""
echo "B. Optional trust path — ~5 min (before checkout)"
echo "   → $SITE/dashboard deploy → View evidence → $SITE/app#forward"
echo "   → ./scripts/guide-partial-e2e.sh · $SITE/ops/e2e (steps 1–2)"
echo ""
echo "C. First Pro MRR — ~15 min"
echo "   → ./scripts/guide-first-pro-checkout.sh"
echo "   → $SITE/ops/billing"
echo "   Confirm: $SITE/admin — Paying ≥ 1 · MRR > \$0 · checkout_clicks_7d"
echo ""
echo "D. Weekly review"
echo "   → ./scripts/guide-mrr-standup.sh"
echo "   → Partial proof posts: ./scripts/guide-linkedin-bip.sh (no closed-trade claims)"
echo ""
echo "Parallel hub: $SITE/ops/migrate · ./scripts/guide-founder-parallel.sh"
echo "Playbooks: docs/GSC_SETUP.md · docs/SALES_PLAYBOOK.md"
echo ""
echo "Growth objective:"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
