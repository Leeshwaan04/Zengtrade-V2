#!/usr/bin/env bash
# Print CBO/CPO tasks that can proceed while the paper worker is blocked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"
export ZT_QUIET_GROWTH="${ZT_QUIET_GROWTH:-1}"

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  exit 0
fi

echo "Meanwhile (worker blocked — independent of paper trades):"
any=0

if SITE="$SITE" ./scripts/check-activation-ready.sh >/dev/null 2>&1; then
  echo "  CPO  Activation UI — signup → deploy: $SITE/login?mode=signup → $SITE/dashboard"
  echo "       Trust path: deploy → View evidence → $SITE/app#forward"
  echo "       Partial verify: ./scripts/verify-activation-path.sh --partial"
  echo "       Manual E2E: ./scripts/guide-partial-e2e.sh · $SITE/ops/e2e (steps 1–2)"
  echo "       Free-tier Q9: ./scripts/guide-free-tier-test.sh"
  any=1
fi
if SITE="$SITE" ./scripts/check-billing-ready.sh >/dev/null 2>&1; then
  echo "  CBO  Billing-ready — test Pro checkout: $SITE/ops/billing"
  any=1
fi
if ./scripts/check-sales-ready.sh >/dev/null 2>&1; then
  echo "  Sales First Pro MRR — ./scripts/guide-first-pro-checkout.sh · $SITE/admin"
  any=1
fi
if SITE="$SITE" ./scripts/check-gsc-ready.sh >/dev/null 2>&1; then
  echo "  CBO  GSC-ready — ./scripts/guide-gsc-founder.sh · $SITE/ops/gsc"
  any=1
fi
if ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
  echo "  Combined standup — ./scripts/guide-founder-growth-standup.sh"
  echo "  Marketing — ./scripts/guide-marketing-founder-standup.sh"
  echo "  Marketing LinkedIn BIP — ./scripts/guide-linkedin-bip.sh"
  echo "  Marketing Coin spotlight — ./scripts/guide-coin-spotlight.sh [slug]"
  echo "  QA&VAPT parallel — ./scripts/check-qa-parallel.sh · $SITE/ops/security"
  any=1
fi

[[ $any -eq 1 ]] || echo "  (run ./scripts/check-growth-gates.sh after Pages deploy)"
echo "  Growth goal: ./scripts/print-growth-goal-summary-fast.sh · ./scripts/check-growth-goal.sh"
