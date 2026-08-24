#!/usr/bin/env bash
# CBO: verify production signup CTAs carry utm_source + utm_campaign for attribution.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0

check_page() {
  local label="$1" path="$2" campaign="$3"
  local html="" attempt
  for attempt in 1 2 3; do
    html=$(curl -sfL "$SITE$path" 2>/dev/null) || html=""
    if [[ -n "$html" ]] && echo "$html" | grep -q "utm_source=site" && echo "$html" | grep -q "utm_campaign=${campaign}"; then
      echo "OK   $label — utm_source=site utm_campaign=$campaign"
      return
    fi
    [[ $attempt -lt 3 ]] && sleep 2
  done
  echo "FAIL $label — missing utm on signup CTA (expected utm_campaign=$campaign)"
  fail=1
}

echo "Funnel CTA probe — $SITE"
echo ""

check_page "home" "/" "landing"
check_page "pricing" "/pricing/" "pricing"
check_page "coins hub" "/coins/" "coins_hub"
for slug in bitcoin ethereum solana bnb xrp cardano dogecoin; do
  check_page "coin $slug" "/coins/${slug}/" "coin_${slug}"
done

# Secondary internal links (coins hub discovery — sessions 167–168)
check_page "home coins hub" "/" "home_coins"
check_page "how-it-works coins" "/how-it-works/" "paper_loop_coins"
check_page "login coins CTA" "/login" "signup_coins"

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "Rebuild landing (deploy/landing/build.py) and redeploy main."
  exit 1
fi
echo ""
echo "All funnel CTAs tagged."
if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
  echo ""
  echo "Growth goal:"
  GROWTH_GSC=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
fi
