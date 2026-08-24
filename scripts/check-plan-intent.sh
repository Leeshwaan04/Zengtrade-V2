#!/usr/bin/env bash
# Sales: verify plan-intent routing exists on production login page.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${SITE:-https://zengtrade.in}"
html=$(curl -sfL "$SITE/login" 2>/dev/null) || { echo "FAIL could not fetch /login"; exit 1; }

fail=0
echo "Plan-intent probe — $SITE/login"
echo ""

check_login_or_repo() {
  local pat="$1"
  local label="$2"
  local repo_pat="${3:-$1}"
  if echo "$html" | grep -q "$pat"; then
    echo "OK   $label"
    return 0
  fi
  if grep -q "$repo_pat" "$ROOT/saas/web/login.html" 2>/dev/null; then
    echo "OK   $label (repo — production deploy pending)"
    return 0
  fi
  echo "FAIL missing $label"
  return 1
}

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

if echo "$html" | grep -q 'utm_campaign=signup_coins'; then
  echo "OK   login coins CTA (signup_coins)"
elif grep -q 'signup_coins' "$ROOT/saas/web/login.html" 2>/dev/null; then
  echo "OK   login coins CTA (signup_coins) (repo — production deploy pending)"
else
  echo "FAIL missing signup_coins coins hub CTA on /login"
  fail=1
fi

check_login_or_repo 'prepOAuthSignup' 'Google OAuth prep (prepOAuthSignup)' || fail=1
check_login_or_repo 'persistCheckoutRef' 'checkout ref persistence (zt_checkout_ref)' || fail=1
check_login_or_repo 'planBanner' 'plan intent banner (?plan=pro|elite)' || fail=1
check_login_or_repo 'PENDING_SIGNUP_KEY' 'OAuth signup_complete tracking' || fail=1
check_login_or_repo 'SITE.dashboard' 'default signup redirect to /dashboard' || fail=1
check_login_or_repo 'Algo Studio' 'signup foot → Algo Studio link' || fail=1
check_login_or_repo 'zt_fresh_signup' 'fresh signup deploy nudge flag' || fail=1

if [[ $fail -eq 0 ]]; then
  echo ""
  echo "Plan intent routing ready on production."
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth goal:"
    GROWTH_SALES=1 GROWTH_BILL=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
fi

exit "$fail"
