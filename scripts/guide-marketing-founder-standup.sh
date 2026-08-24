#!/usr/bin/env bash
# Marketing/CBO: founder standup for organic partial-proof posts (worker blocked).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Marketing founder standup (organic) — $SITE =="
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — upgrade posts with forward proof:"
  echo "  docs/content/WEEKLY_PROOF.md (full templates)"
  echo "  docs/content/REDDIT_ALGOTRADING_DRAFT.md (after E2E green)"
  exit 0
fi

echo ">> Automated probes"
fail=0
if env ZT_QUIET_GROWTH=1 ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
  echo "OK   Parallel growth (honest partial posts OK)"
else
  echo "WARN Parallel growth not all green — use only honest partial-activation copy"
fi
if env SITE="$SITE" ./scripts/check-funnel-ctas.sh >/dev/null 2>&1; then
  echo "OK   Funnel CTAs (UTM tags on home/pricing/coins)"
else
  echo "FAIL Funnel CTAs — ./scripts/check-funnel-ctas.sh"
  fail=1
fi
echo ""

if [[ $fail -ne 0 ]]; then
  echo "Fix probe failures above."
  exit 1
fi

echo "== Manual playbook =="
echo ""
echo "A. LinkedIn build-in-public — ~10 min"
echo "   → ./scripts/guide-linkedin-bip.sh"
echo "   → docs/content/LINKEDIN_BUILD_IN_PUBLIC.md"
echo "   Log post URL + date in docs/GROWTH_DASHBOARD.md (Marketing)"
echo ""
echo "B. Coin spotlight — ~10 min"
echo "   → ./scripts/guide-coin-spotlight.sh bitcoin   # or ethereum, solana, …"
echo "   → docs/MARKETING_PLAYBOOK.md"
echo ""
echo "C. Partial proof copy (no closed-trade claims)"
echo "   → docs/content/WEEKLY_PROOF.md § Partial proof"
echo "   Trust path: $SITE/dashboard deploy → View evidence → $SITE/app#forward"
echo ""
echo "D. Track in /admin"
echo "   → signup_complete · deploy_click · plan_intents_7d"
echo ""
echo "CBO combined (GSC + MRR): ./scripts/guide-cbo-founder-standup.sh"
echo "All roles: ./scripts/guide-founder-growth-standup.sh"
echo "Playbook: docs/MARKETING_PLAYBOOK.md"
echo ""
echo "Growth objective:"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
