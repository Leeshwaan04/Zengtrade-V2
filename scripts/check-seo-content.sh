#!/usr/bin/env bash
# SEO/CBO: verify key marketing pages have expected content on production.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0

check_html() {
  local label="$1" path="$2" pattern="$3"
  local html
  html=$(curl -sfL "$SITE$path" 2>/dev/null) || { echo "FAIL $label — could not fetch $path"; fail=1; return; }
  if echo "$html" | grep -q "$pattern"; then
    echo "OK   $label"
  else
    echo "FAIL $label — expected pattern missing on $path"
    fail=1
  fi
}

echo "SEO content probe — $SITE"
echo ""

check_html "how-it-works paper loop" "/how-it-works/" "paper-loop"
check_html "how-it-works signup CTA" "/how-it-works/" "utm_campaign=paper_loop"
check_html "pricing founding offer" "/pricing/" "first 100"
check_html "coins hub" "/coins/" "coins_hub\\|/coins/"
check_html "robots.txt" "/robots.txt" "Sitemap:"

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "Rebuild landing (deploy/landing/build.py) and deploy main."
  exit 1
fi
echo ""
echo "All SEO content checks passed."
