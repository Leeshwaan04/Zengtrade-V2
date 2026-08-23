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

grep -q 'FREE_DEPLOY_LIMIT' saas/web/js/billing.js && ok "billing.js FREE_DEPLOY_LIMIT" || \
  bad "billing.js missing FREE_DEPLOY_LIMIT"

studio=$(curl -sfL "$SITE/dashboard/studio.js" 2>/dev/null || echo "")
if [[ -n "$studio" ]] && echo "$studio" | grep -q 'FREE_LIMIT'; then
  ok "production studio.js FREE_LIMIT handler"
else
  bad "production studio.js missing FREE_LIMIT"
fi

echo ""
if [[ $fail -eq 0 ]]; then
  echo "Automated probes green — manual Q9: deploy 2 strategies on Free; second must show upgrade CTA"
  echo "Partial E2E: ./scripts/guide-partial-e2e.sh · $SITE/ops/e2e"
  exit 0
fi
echo "Fix failures above before manual free-tier test."
exit 1
