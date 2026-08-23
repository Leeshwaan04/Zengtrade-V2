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

echo ""
if [[ $fail -eq 0 ]]; then
  echo "GSC-ready — founder: add property + submit $SITE/sitemap.xml"
  echo "Guide: $SITE/ops/gsc · docs/GSC_SETUP.md"
  exit 0
fi
echo "Fix failures above, then submit sitemap in Search Console."
exit 1
