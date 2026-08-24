#!/usr/bin/env bash
# QA&VAPT: founder combined standup — parallel QA while paper worker is blocked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== QA founder standup (parallel) — $SITE =="
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — run full QA path:"
  echo "  ./scripts/verify-activation-path.sh"
  echo "  ./scripts/guide-qa-rls-isolation.sh"
  echo "  $SITE/ops/e2e (steps 3–5)"
  exit 0
fi

echo ">> Automated probes"
fail=0
if env ZT_QUIET_GROWTH=1 ./scripts/check-qa-parallel.sh >/dev/null 2>&1; then
  echo "OK   QA parallel (security + partial + sales)"
else
  echo "FAIL QA parallel — ./scripts/check-qa-parallel.sh"
  fail=1
fi
echo ""

if [[ $fail -ne 0 ]]; then
  echo "Fix probe failures above."
  echo "Hub: $SITE/ops/security · $SITE/ops/migrate"
  exit 1
fi

echo "== Manual playbook =="
echo ""
echo "A. Security smoke — ~2 min"
echo "   → ./scripts/security-smoke.sh"
echo "   → ./scripts/check-xss-hygiene.sh"
echo ""
echo "B. Partial activation QA — ~15 min"
echo "   → ./scripts/guide-partial-e2e.sh"
echo "   → ./scripts/guide-free-tier-test.sh   # Q9 second deploy blocked"
echo "   → $SITE/ops/e2e steps 1–2 · View evidence → $SITE/app#forward"
echo ""
echo "C. Sales path sanity (billing IPN) — ~5 min"
echo "   → ./scripts/check-sales-ready.sh"
echo "   → Unsigned IPN must 401 (security-smoke)"
echo ""
echo "D. Post-P0 (after worker live)"
echo "   → ./scripts/guide-qa-rls-isolation.sh   # Q3 RLS two-account test"
echo "   → $SITE/ops/e2e steps 3–5"
echo "   → Mark docs/QA_VAPT_CHECKLIST.md Q1–V3"
echo ""
echo "Combined growth: ./scripts/guide-founder-growth-standup.sh"
echo "Playbook: docs/QA_VAPT_CHECKLIST.md · $SITE/ops/security"
echo ""
echo "Growth objective:"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
