#!/usr/bin/env bash
# CPO: verify signup → deploy UI path on production (worker not required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"
ANON_KEY="sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1"
SUPA="https://ponvarxeytfcntckczbn.supabase.co"
fail=0

probe_event() {
  local name="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    "$SUPA/rest/v1/event" \
    -H "apikey: $ANON_KEY" \
    -H 'Content-Type: application/json' \
    -H 'Prefer: return=minimal' \
    -d "{\"name\":\"$name\",\"path\":\"/activation-ready-probe\"}")
  if [[ "$code" == "201" ]]; then
    echo "OK   $name event"
  else
    echo "FAIL $name event (HTTP $code)"
    fail=1
  fi
}

echo "== Activation ready (signup → deploy) — $SITE =="
echo ""

probe_event signup_complete
probe_event deploy_click
probe_event deploy_success

echo ""
echo ">> Algo Studio deploy surface"
studio=$(curl -sfL "$SITE/dashboard/studio.js" 2>/dev/null) || studio=""
if echo "$studio" | grep -q 'deployCustom' || echo "$studio" | grep -q 'deployments'; then
  echo "OK   studio.js deploy path"
else
  echo "FAIL studio.js — deploy flow not found"
  fail=1
fi

dash=$(curl -sfL "$SITE/dashboard/" 2>/dev/null) || dash=""
if echo "$dash" | grep -q 'studio.js'; then
  echo "OK   /dashboard loads studio"
else
  echo "FAIL /dashboard missing studio.js"
  fail=1
fi

signup=$(curl -sfL "$SITE/login?mode=signup" 2>/dev/null) || signup=""
if echo "$signup" | grep -qiE 'signup|create account|create free account'; then
  echo "OK   signup landing"
else
  echo "FAIL signup landing"
  fail=1
fi

if grep -q 'utm_campaign=signup_coins' saas/web/login.html; then
  echo "OK   login coins CTA (signup_coins)"
else
  echo "FAIL login.html missing signup_coins coins hub CTA"
  fail=1
fi

if grep -q 'deploy_success_coins' deploy/landing/studio.js; then
  echo "OK   studio.js deploy_success_coins post-deploy CTA"
else
  echo "FAIL studio.js missing deploy_success_coins post-deploy CTA"
  fail=1
fi

if grep -q 'deploy_success_coins' saas/web/js/app.js; then
  echo "OK   app.js deploy_success_coins post-deploy CTA"
else
  echo "FAIL app.js missing deploy_success_coins post-deploy CTA"
  fail=1
fi

echo ""
echo ">> Plan intent"
if SITE="$SITE" ./scripts/check-plan-intent.sh >/dev/null 2>&1; then
  echo "OK   plan intent routing"
else
  echo "FAIL plan intent routing"
  fail=1
fi

echo ""
echo ">> Evidence app (worker-offline UX)"
prod_ok=0
for attempt in 1 2 3; do
  appjs=$(curl -sfL "$SITE/js/app.js" 2>/dev/null) || appjs=""
  if [[ -n "$appjs" ]] && echo "$appjs" | grep -q '/ops/e2e'; then
    prod_ok=1
    break
  fi
  [[ $attempt -lt 3 ]] && sleep 2
done
if [[ $prod_ok -eq 1 ]]; then
  echo "OK   app.js worker-offline E2E hints (production)"
  if echo "$appjs" | grep -q 'Paper deploy is live'; then
    echo "OK   app.js pricing worker-honesty (production)"
  else
    echo "WARN app.js pricing worker-honesty not on CDN yet"
  fi
elif grep -q '/ops/e2e' saas/web/js/app.js; then
  echo "OK   app.js worker-offline E2E hints (repo — production CDN may lag)"
  if grep -q 'Paper deploy is live' saas/web/js/app.js; then
    echo "OK   app.js pricing worker-honesty (repo — production CDN may lag)"
  fi
else
  echo "FAIL app.js missing /ops/e2e worker-offline hints"
  fail=1
fi

if grep -q 'closed trades appear as the worker runs' saas/web/app.html; then
  echo "OK   onboarding worker-honesty copy"
else
  echo "FAIL app.html missing onboarding worker-honesty copy"
  fail=1
fi

echo ""
if [[ $fail -eq 0 ]]; then
  echo "Activation UI ready — trades need paper worker: ./scripts/check-worker.sh"
  echo "Manual E2E when worker live: $SITE/ops/e2e"
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth objective:"
    GROWTH_PARTIAL=1 GROWTH_MIG=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
  exit 0
fi
exit 1
