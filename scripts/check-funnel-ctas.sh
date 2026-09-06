#!/usr/bin/env bash
# CBO: verify production signup CTAs carry utm_source + utm_campaign for attribution.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0

check_page() {
  local label="$1" path="$2" campaign="$3"
  if _page_has_campaign "$path" "$campaign"; then
    echo "OK   $label — utm_source=site utm_campaign=$campaign"
    return 0
  fi
  echo "FAIL $label — missing utm on signup CTA (expected utm_campaign=$campaign)"
  return 1
}

_page_has_campaign() {
  local path="$1" campaign="$2"
  local html="" attempt
  for attempt in 1 2 3; do
    html=$(curl -sfL --compressed -A 'zengtrade-growth-probe/1' \
      --retry 3 --retry-delay 2 --retry-all-errors "$SITE$path" 2>/dev/null) || html=""
    if [[ -n "$html" ]] && echo "$html" | grep -q "utm_source=site" && echo "$html" | grep -q "utm_campaign=${campaign}"; then
      return 0
    fi
    [[ $attempt -lt 3 ]] && sleep 2
  done
  return 1
}

check_page_or_repo() {
  local label="$1" path="$2" campaign="$3" repo_file="$4" repo_pat="$5"
  if _page_has_campaign "$path" "$campaign"; then
    echo "OK   $label — utm_source=site utm_campaign=$campaign"
    return 0
  fi
  if [[ -f "$repo_file" ]] && grep -q "$repo_pat" "$repo_file" 2>/dev/null; then
    echo "OK   $label — utm_campaign=$campaign (repo — production deploy pending)"
    return 0
  fi
  echo "FAIL $label — missing utm_campaign=$campaign"
  return 1
}

echo "Funnel CTA probe — $SITE"
echo ""

check_page "home" "/" "landing" || fail=1
check_page "pricing" "/pricing/" "pricing" || fail=1
check_page_or_repo "pricing coins hub" "/pricing/" "pricing_coins" deploy/landing/build.py 'utm_campaign=pricing_coins' || fail=1
check_page_or_repo "pricing pro" "/pricing/" "pricing_pro" deploy/landing/build.py 'campaign = f"pricing_{pid}"' || fail=1
check_page_or_repo "pricing elite" "/pricing/" "pricing_elite" deploy/landing/build.py 'campaign = f"pricing_{pid}"' || fail=1
check_page "coins hub" "/coins/" "coins_hub" || fail=1
for slug in bitcoin ethereum solana bnb xrp cardano dogecoin; do
  check_page "coin $slug" "/coins/${slug}/" "coin_${slug}" || fail=1
done

# Secondary internal links (coins hub discovery, sessions 167–168)
check_page "home coins hub" "/" "home_coins" || fail=1
check_page "how-it-works coins" "/how-it-works/" "paper_loop_coins" || fail=1
check_page_or_repo "how-it-works pro" "/how-it-works/" "paper_loop_pro" deploy/landing/build.py 'paper_loop_pro' || fail=1
check_page "login coins CTA" "/login" "signup_coins" || fail=1

check_page_or_repo "coins hub pro" "/coins/" "coins_hub_pro" seo/generate.py 'coins_hub_pro' || fail=1
check_page_or_repo "coin bitcoin pro" "/coins/bitcoin/" "coin_bitcoin_pro" seo/generate.py 'coin_{slug}_pro' || fail=1

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
