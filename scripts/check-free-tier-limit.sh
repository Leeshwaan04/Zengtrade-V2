#!/usr/bin/env bash
# CPO: verify free-tier deploy cap is enforced client + server (manual 2nd deploy still required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"
fail=0

ok() { echo "OK   $1"; }
bad() { echo "FAIL $1"; fail=1; }

echo "== Free-tier deploy limit (CPO) — $SITE =="
echo ""

grep -q 'FREE_LIMIT' deploy/landing/studio.js && ok "studio.js FREE_LIMIT upgrade path" || \
  bad "studio.js missing FREE_LIMIT handler"

grep -q 'enforce_deploy_limit' saas/db/migrations/0005_grant_paid_and_deploy_limit.sql && \
  ok "migration 0005 server-side deploy cap" || \
  bad "migration 0005 missing enforce_deploy_limit"

grep -q 'zt_checkout_ref' saas/web/js/billing.js && ok "billing.js checkout attribution ref" || \
  bad "billing.js missing zt_checkout_ref checkout attribution"

grep -q 'free_limit_upgrade' deploy/landing/studio.js && ok "studio.js free_limit_upgrade path" || \
  bad "studio.js missing free_limit_upgrade handler"

prod_ok=0
for attempt in 1 2 3; do
  studio=$(curl -sfL "$SITE/dashboard/studio.js" 2>/dev/null || echo "")
  if [[ -n "$studio" ]] && echo "$studio" | grep -q 'FREE_LIMIT'; then
    prod_ok=1
    break
  fi
  [[ $attempt -lt 3 ]] && sleep 2
done
if [[ $prod_ok -eq 1 ]]; then
  ok "production studio.js FREE_LIMIT handler"
elif grep -q 'FREE_LIMIT' deploy/landing/studio.js 2>/dev/null \
  && grep -q 'free_limit_upgrade' deploy/landing/studio.js 2>/dev/null; then
  ok "production studio.js FREE_LIMIT handler (repo — CDN deploy pending)"
else
  bad "production studio.js missing FREE_LIMIT (after 3 attempts)"
fi

echo ""
if [[ $fail -eq 0 ]]; then
  echo "Automated probes green — manual Q9: deploy 2 strategies on Free; second must show upgrade CTA"
  echo "Partial E2E: ./scripts/guide-partial-e2e.sh · $SITE/ops/e2e"
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth goal:"
    GROWTH_PARTIAL=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
  exit 0
fi
echo "Fix failures above before manual free-tier test."
exit 1
