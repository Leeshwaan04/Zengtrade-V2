#!/usr/bin/env bash
# Marketing: founder manual guide for LinkedIn build-in-public (partial activation only).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== LinkedIn build-in-public guide (Marketing) — $SITE =="
echo ""

if ! ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
  echo "WARN Parallel growth gates not all green — fix with ./scripts/check-parallel-growth.sh"
  echo "      You may still post partial-activation copy (signup → deploy) if honest."
  echo ""
fi

echo "== Pre-flight =="
echo "  ./scripts/check-parallel-growth.sh"
echo "  ./scripts/guide-partial-e2e.sh   # optional: confirm signup → deploy"
echo ""
echo "== Post copy (from docs/content/LINKEDIN_BUILD_IN_PUBLIC.md) =="
echo ""
cat <<'POST'
Shipping zengtrade in public — paper trading on live Binance prices.

Today on production: signup → Algo Studio → deploy is live (partial E2E steps 1–2).
Post-deploy: evidence at /app#forward (trades when worker is back).

Try the deploy path: https://zengtrade.in/login?mode=signup&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public

Browse strategies by coin: https://zengtrade.in/coins/?utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public_coins

Founding Pro ($19/mo, unlimited paper): https://zengtrade.in/login?mode=signup&plan=pro&utm_source=linkedin&utm_medium=social&utm_campaign=build_in_public_pro

Not investment advice. Paper only. No live execution.
POST
echo ""
if ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
  echo "== Growth goal (parallel green) =="
  ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  echo ""
fi
echo "== After posting =="
echo "1. Note date + post URL in docs/GROWTH_DASHBOARD.md (Marketing)"
echo "2. Watch $SITE/admin for signup_complete / deploy_click (utm_campaign=build_in_public)"
echo "3. Upgrade post with docs/content/WEEKLY_PROOF.md after worker + trades E2E"
echo ""
echo "Do NOT post r/algotrading draft until ./scripts/check-worker.sh is green."
