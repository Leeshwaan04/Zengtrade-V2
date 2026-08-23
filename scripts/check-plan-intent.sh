#!/usr/bin/env bash
# Sales: verify plan-intent routing exists on production login page.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
html=$(curl -sfL "$SITE/login" 2>/dev/null) || { echo "FAIL could not fetch /login"; exit 1; }

fail=0
echo "Plan-intent probe — $SITE/login"
echo ""

if echo "$html" | grep -q 'zt_intent_plan'; then
  echo "OK   zt_intent_plan localStorage key"
else
  echo "FAIL missing zt_intent_plan handling"
  fail=1
fi

if echo "$html" | grep -q 'plan_intent'; then
  echo "OK   plan_intent funnel event"
else
  echo "FAIL missing plan_intent event"
  fail=1
fi

if echo "$html" | grep -q 'SITE.app+"#pricing"'; then
  echo "OK   post-auth redirect to /app#pricing"
else
  echo "FAIL missing /app#pricing redirect after plan intent"
  fail=1
fi

exit "$fail"
