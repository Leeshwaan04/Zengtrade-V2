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

echo ""
echo ">> Plan intent"
if SITE="$SITE" ./scripts/check-plan-intent.sh >/dev/null 2>&1; then
  echo "OK   plan intent routing"
else
  echo "FAIL plan intent routing"
  fail=1
fi

echo ""
if [[ $fail -eq 0 ]]; then
  echo "Activation UI ready — trades need paper worker: ./scripts/check-worker.sh"
  echo "Manual E2E when worker live: $SITE/ops/e2e"
  echo ""
  echo "Growth objective:"
  GROWTH_PARTIAL=1 GROWTH_MIG=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  exit 0
fi
exit 1
