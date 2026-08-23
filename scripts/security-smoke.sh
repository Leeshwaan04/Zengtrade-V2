#!/usr/bin/env bash
# QA/VAPT lightweight smoke — safe for CI; no exploit payloads.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0

ok() { echo "OK   $1"; }
bad() { echo "FAIL $1"; fail=1; }

echo "== security-smoke (QA&VAPT) =="
echo ""

# --- client secret hygiene ---
if grep -rE 'service_role|sb_secret|NOWPAYMENTS_API|DATABASE_URL|sk_live' saas/web/js deploy/landing/studio.js 2>/dev/null | grep -v 'publishable'; then
  bad "possible secret in client JS (review output above)"
else
  ok "no obvious secrets in client JS"
fi

if grep -rE '(service_role|sb_secret|NOWPAYMENTS_API)\s*[:=]' saas/web/*.html 2>/dev/null; then
  bad "possible secret in saas/web HTML"
else
  ok "no hardcoded secrets in ops HTML"
fi

# --- auth module present ---
test -f saas/web/js/auth.js && grep -q 'establishSession' saas/web/js/auth.js && ok "auth.js establishSession" || bad "auth.js missing establishSession"

# --- billing webhook gate (production) ---
ipn_code="000"
for attempt in 1 2 3; do
  ipn_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    'https://ponvarxeytfcntckczbn.supabase.co/functions/v1/nowpayments-ipn' \
    -H 'Content-Type: application/json' \
    -d '{"test":true}' 2>/dev/null || echo "000")
  if [[ "$ipn_code" == "401" || "$ipn_code" == "403" ]]; then
    break
  fi
  [[ "$ipn_code" == "502" || "$ipn_code" == "503" || "$ipn_code" == "000" ]] || break
  sleep 2
done
if [[ "$ipn_code" == "401" || "$ipn_code" == "403" ]]; then
  ok "ipn-webhook rejects unsigned POST (HTTP $ipn_code)"
else
  bad "ipn-webhook expected 401/403 without signature (HTTP $ipn_code)"
fi

# --- admin RPC not open to anon ---
rpc_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/rpc/admin_users' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' \
  -H 'Content-Type: application/json' \
  -d '{}' 2>/dev/null || echo "000")
if [[ "$rpc_code" == "401" ]]; then
  ok "admin_users RPC requires auth (HTTP 401)"
else
  bad "admin_users RPC should require auth (HTTP $rpc_code)"
fi

# --- RLS: anon cannot enumerate user rows (empty set, not open read) ---
SUPA="${SUPABASE_URL:-https://ponvarxeytfcntckczbn.supabase.co}"
ANON="${ANON_KEY:-sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1}"
for table in deployment trade; do
  body=$(curl -sfL "$SUPA/rest/v1/${table}?select=user_id&limit=5" \
    -H "apikey: $ANON" 2>/dev/null || echo "ERR")
  if [[ "$body" == "[]" ]]; then
    ok "RLS $table — anon read returns empty"
  elif [[ "$body" == "ERR" ]]; then
    bad "RLS $table — could not probe"
  else
    bad "RLS $table — anon may have read rows (review)"
  fi
done

# --- charter + checklist exist ---
test -f .cursor/autopilot/qavapt.md && ok "qavapt charter present" || bad "missing .cursor/autopilot/qavapt.md"
test -f docs/QA_VAPT_CHECKLIST.md && ok "QA_VAPT_CHECKLIST.md present" || bad "missing docs/QA_VAPT_CHECKLIST.md"

# --- XSS hygiene (/app SPA) ---
if ./scripts/check-xss-hygiene.sh >/dev/null 2>&1; then
  ok "xss-hygiene (/app esc patterns)"
else
  bad "xss-hygiene — run ./scripts/check-xss-hygiene.sh"
fi

echo ""
if [[ $fail -ne 0 ]]; then
  echo "security-smoke failed — see docs/QA_VAPT_CHECKLIST.md"
  exit 1
fi
echo "security-smoke passed."
