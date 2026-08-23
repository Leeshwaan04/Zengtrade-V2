#!/usr/bin/env bash
# Print CBO/CPO tasks that can proceed while the paper worker is blocked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  exit 0
fi

echo "Meanwhile (worker blocked — independent of paper trades):"
any=0

if SITE="$SITE" ./scripts/check-activation-ready.sh >/dev/null 2>&1; then
  echo "  CPO  Activation UI — signup → deploy: $SITE/login?mode=signup → $SITE/dashboard"
  echo "       Partial verify: ./scripts/guide-partial-e2e.sh · $SITE/ops/e2e (steps 1–2)"
  any=1
fi
if SITE="$SITE" ./scripts/check-billing-ready.sh >/dev/null 2>&1; then
  echo "  CBO  Billing-ready — test Pro checkout: $SITE/ops/billing"
  any=1
fi
if ./scripts/check-sales-ready.sh >/dev/null 2>&1; then
  echo "  Sales Sales-ready — ./scripts/check-sales-ready.sh · first Pro MRR in $SITE/admin"
  any=1
fi
if SITE="$SITE" ./scripts/check-gsc-ready.sh >/dev/null 2>&1; then
  echo "  CBO  GSC-ready — verify domain + submit sitemap: $SITE/ops/gsc"
  any=1
fi

[[ $any -eq 1 ]] || echo "  (run ./scripts/check-growth-gates.sh after Pages deploy)"
