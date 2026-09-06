#!/usr/bin/env bash
# CPO: founder manual guide for free-tier deploy limit (Q9, second deploy blocked).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Free-tier deploy limit test (CPO Q9) — $SITE =="
echo ""

if ! ./scripts/check-free-tier-limit.sh; then
  echo ""
  echo "Fix automated probes above before manual test."
  exit 1
fi

echo ""
echo "== Manual steps (incognito, Free account) =="
echo ""
echo "1. Sign up Free (no plan intent)"
echo "   → $SITE/login?mode=signup"
echo ""
echo "2. Deploy first strategy"
echo "   → $SITE/dashboard → Library → Deploy (e.g. Trend Follower)"
echo "   Expect: success toast; deploy count = 1; post-deploy hint → View evidence ($SITE/app#forward)"
echo ""
echo "3. Deploy second strategy"
echo "   → Deploy another strategy from Library or Builder"
echo "   Expect: FREE_LIMIT message + upgrade CTA to $SITE/app#pricing"
echo ""
echo "4. Verify server-side cap (optional)"
echo "   → Supabase: free user cannot insert 2nd distinct strategy_key in deployment"
echo ""
echo "Related: ./scripts/guide-partial-e2e.sh · $SITE/ops/e2e"
echo "After Pro upgrade: unlimited paper strategies (honest copy — live coming soon)"
echo ""
echo "Growth objective:"
GROWTH_PARTIAL=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
