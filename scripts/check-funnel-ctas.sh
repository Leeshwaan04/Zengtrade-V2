#!/usr/bin/env bash
# CBO: verify production signup CTAs carry utm_source + utm_campaign for attribution.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0

check_page() {
  local label="$1" path="$2" campaign="$3"
  local html="" attempt
  for attempt in 1 2 3; do
    html=$(curl -sfL --compressed -A 'zengtrade-growth-probe/1' \
      --retry 3 --retry-delay 2 --retry-all-errors "$SITE$path" 2>/dev/null) || html=""
    if [[ -n "$html" ]] && echo "$html" | grep -q "utm_source=site" && echo "$html" | grep -q "utm_campaign=${campaign}"; then
      echo "OK   $label — utm_source=site utm_campaign=$campaign"
      return 0
    fi
    [[ $attempt -lt 3 ]] && sleep 2
  done
  echo "FAIL $label — missing utm on signup CTA (expected utm_campaign=$campaign)"
  return 1
}

echo "Funnel CTA probe — $SITE"
echo ""

check_page "home" "/" "landing" || fail=1
check_page "pricing" "/pricing/" "pricing" || fail=1
if check_page "pricing coins hub" "/pricing/" "pricing_coins"; then
  true
elif grep -q 'utm_campaign=pricing_coins' deploy/landing/build.py 2>/dev/null; then
  echo "OK   pricing coins hub — utm_campaign=pricing_coins (repo — production deploy pending)"
else
  echo "FAIL pricing coins hub — missing pricing_coins in build.py"
  fail=1
fi
if check_page "pricing pro" "/pricing/" "pricing_pro"; then
  true
elif grep -q 'campaign = f"pricing_{pid}"' deploy/landing/build.py 2>/dev/null; then
  echo "OK   pricing pro — utm_campaign=pricing_pro (repo — production deploy pending)"
else
  echo "FAIL pricing pro — missing pricing_pro in build.py"
  fail=1
fi
if check_page "pricing elite" "/pricing/" "pricing_elite"; then
  true
elif grep -q 'campaign = f"pricing_{pid}"' deploy/landing/build.py 2>/dev/null; then
  echo "OK   pricing elite — utm_campaign=pricing_elite (repo — production deploy pending)"
else
  echo "FAIL pricing elite — missing pricing_elite in build.py"
  fail=1
fi
check_page "coins hub" "/coins/" "coins_hub" || fail=1
for slug in bitcoin ethereum solana bnb xrp cardano dogecoin; do
  check_page "coin $slug" "/coins/${slug}/" "coin_${slug}" || fail=1
done

# Secondary internal links (coins hub discovery — sessions 167–168)
check_page "home coins hub" "/" "home_coins" || fail=1
check_page "how-it-works coins" "/how-it-works/" "paper_loop_coins" || fail=1
if check_page "how-it-works pro" "/how-it-works/" "paper_loop_pro"; then
  true
elif grep -q 'paper_loop_pro' deploy/landing/build.py 2>/dev/null; then
  echo "OK   how-it-works pro — utm_campaign=paper_loop_pro (repo — production deploy pending)"
else
  echo "FAIL how-it-works pro — missing paper_loop_pro in build.py"
  fail=1
fi
check_page "login coins CTA" "/login" "signup_coins" || fail=1

if check_page "coins hub pro" "/coins/" "coins_hub_pro"; then
  true
elif grep -q 'coins_hub_pro' seo/generate.py 2>/dev/null; then
  echo "OK   coins hub pro — utm_campaign=coins_hub_pro (repo — production deploy pending)"
else
  echo "FAIL coins hub pro — missing coins_hub_pro in generate.py"
  fail=1
fi
if check_page "coin bitcoin pro" "/coins/bitcoin/" "coin_bitcoin_pro"; then
  true
elif grep -q 'coin_{slug}_pro' seo/generate.py 2>/dev/null; then
  echo "OK   coin bitcoin pro — utm_campaign=coin_bitcoin_pro (repo — production deploy pending)"
else
  echo "FAIL coin bitcoin pro — missing coin_*_pro in generate.py"
  fail=1
fi

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
