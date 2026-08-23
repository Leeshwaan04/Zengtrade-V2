#!/usr/bin/env bash
# Verify NOWPayments edge functions are deployed.
set -euo pipefail
SUPABASE_URL="${SUPABASE_URL:-https://ponvarxeytfcntckczbn.supabase.co}"
SITE="${SITE:-https://zengtrade.in}"
fail=0

probe_cors() {
  local name="$1" path="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS \
    "$SUPABASE_URL/functions/v1/$path" \
    -H "Origin: $SITE" \
    -H "Access-Control-Request-Method: POST" 2>/dev/null || true)
  if [[ "$code" == "200" || "$code" == "204" ]]; then
    echo "OK   $name — OPTIONS HTTP $code"
  else
    echo "FAIL $name — OPTIONS HTTP ${code:-err} (deploy with scripts/deploy-billing.sh)"
    fail=1
  fi
}

probe_ipn() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    "$SUPABASE_URL/functions/v1/nowpayments-ipn" \
    -H "Content-Type: application/json" --data "{}" 2>/dev/null || true)
  # Unsigned POST → 401 bad signature = function is live (no CORS preflight on webhooks).
  if [[ "$code" == "401" ]]; then
    echo "OK   ipn-webhook — POST HTTP 401 (signature gate active)"
  elif [[ "$code" == "404" ]]; then
    echo "FAIL ipn-webhook — not deployed"
    fail=1
  else
    echo "WARN ipn-webhook — POST HTTP ${code:-err} (expected 401 if deployed)"
    [[ "$code" == "401" ]] || fail=1
  fi
}

probe_cors "create-invoice" "nowpayments-create-invoice"
probe_ipn

if [[ $fail -ne 0 ]]; then
  echo "Billing functions not ready — see FOUNDER_DEPLOY.md §5"
  exit 1
fi
echo "Billing edge functions reachable."
