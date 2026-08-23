#!/usr/bin/env bash
# CBO: verify production signup CTAs carry utm_source + utm_campaign for attribution.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0

check_page() {
  local label="$1" path="$2" campaign="$3"
  local html
  html=$(curl -sfL "$SITE$path" 2>/dev/null) || { echo "FAIL $label — could not fetch $path"; fail=1; return; }
  if echo "$html" | grep -q "utm_source=site" && echo "$html" | grep -q "utm_campaign=${campaign}"; then
    echo "OK   $label — utm_source=site utm_campaign=$campaign"
  else
    echo "FAIL $label — missing utm on signup CTA (expected utm_campaign=$campaign)"
    fail=1
  fi
}

echo "Funnel CTA probe — $SITE"
echo ""

check_page "home" "/" "landing"
check_page "pricing" "/pricing/" "pricing"
check_page "coins hub" "/coins/" "coins_hub"
check_page "coin bitcoin" "/coins/bitcoin/" "coin_bitcoin"

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "Rebuild landing (deploy/landing/build.py) and redeploy main."
  exit 1
fi
echo ""
echo "All funnel CTAs tagged."
