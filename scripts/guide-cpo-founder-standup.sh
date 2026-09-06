#!/usr/bin/env bash
# CPO: founder combined standup: partial activation (signup → deploy, no trades).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== CPO founder standup (partial activation) — $SITE =="
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — run full activation:"
  echo "  ./scripts/verify-activation-path.sh"
  echo "  ./scripts/guide-partial-e2e.sh   # then steps 3–4 at $SITE/ops/e2e"
  echo "  ./scripts/post-p0-success.sh"
  exit 0
fi

echo ">> Automated probes"
fail=0
if env ZT_QUIET_GROWTH=1 ./scripts/verify-activation-path.sh --partial >/dev/null 2>&1; then
  echo "OK   Partial activation (signup → deploy)"
else
  echo "FAIL Partial activation — ./scripts/verify-activation-path.sh --partial"
  fail=1
fi
if env ZT_QUIET_GROWTH=1 ./scripts/check-free-tier-limit.sh >/dev/null 2>&1; then
  echo "OK   Free-tier deploy cap (Q9 probes)"
else
  echo "FAIL Free-tier limit — ./scripts/check-free-tier-limit.sh"
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
echo "A. Partial E2E — ~10 min (steps 1–2)"
echo "   → ./scripts/guide-partial-e2e.sh"
echo "   → $SITE/ops/e2e"
echo "   Trust path: deploy → View evidence → $SITE/app#forward"
echo ""
echo "B. Free-tier limit (Q9) — ~5 min"
echo "   → ./scripts/guide-free-tier-test.sh"
echo "   Expect: second deploy blocked on Free → upgrade CTA"
echo ""
echo "C. Trades (blocked until P0)"
echo "   → $SITE/ops/worker — fix DATABASE_URL password"
echo "   → After worker live: $SITE/ops/e2e steps 3–4"
echo "   → ./scripts/verify-activation-path.sh (full)"
echo ""
echo "D. Parallel CBO (optional)"
echo "   → ./scripts/guide-cbo-founder-standup.sh"
echo ""
echo "Parallel hub: $SITE/ops/migrate · ./scripts/guide-founder-parallel.sh"
echo "Playbook: docs/CRYPTO_PRODUCT.md · $SITE/ops/e2e"
echo ""
echo "Growth objective:"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
