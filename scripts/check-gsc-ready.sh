#!/usr/bin/env bash
# CBO/SEO: verify production is ready for Google Search Console sitemap submit.
# Does not verify GSC domain ownership (founder action).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

fail=0
section() {
  local title="$1"
  shift
  echo ">> $title"
  if "$@"; then
    echo "OK   $title"
  else
    echo "FAIL $title"
    fail=1
  fi
  echo ""
}

echo "== GSC readiness — $SITE =="
echo ""

section "Sitemap" env SITE="$SITE" ./scripts/check-sitemap.sh
section "SEO content" env SITE="$SITE" ./scripts/check-seo-content.sh
section "Funnel CTAs" env SITE="$SITE" ./scripts/check-funnel-ctas.sh

echo ">> Signup landing (GSC indexing)"
html=$(curl -sfL "$SITE/login?mode=signup" 2>/dev/null) || html=""
if [[ -n "$html" ]] && echo "$html" | grep -qiE 'signup|create account|create free account'; then
  echo "OK   Signup landing"
else
  echo "FAIL Signup landing — /login?mode=signup missing signup UI"
  fail=1
fi

login_page=$(curl -sfL "$SITE/login" 2>/dev/null) || login_page=""
if [[ -n "$login_page" ]] && echo "$login_page" | grep -q 'utm_campaign=signup_coins'; then
  echo "OK   Login coins CTA (signup_coins)"
elif grep -q 'signup_coins' "$ROOT/saas/web/login.html" 2>/dev/null; then
  echo "OK   Login coins CTA (signup_coins) (repo — production deploy pending)"
else
  echo "FAIL Login — missing signup_coins coins hub CTA"
  fail=1
fi

echo ""
if [[ $fail -eq 0 ]]; then
  echo "GSC-ready — founder: add property + submit $SITE/sitemap.xml"
  echo "Guide: $SITE/ops/gsc · docs/GSC_SETUP.md"
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth objective:"
    GROWTH_GSC=1 GROWTH_SALES=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
  exit 0
fi
echo "Fix failures above, then submit sitemap in Search Console."
exit 1
