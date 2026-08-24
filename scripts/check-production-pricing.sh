#!/usr/bin/env bash
# Sales: verify founding Pro pricing copy on production /app and /pricing.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0

check_page() {
  local label="$1" path="$2"
  local html
  html=$(curl -sfL "$SITE$path" 2>/dev/null) || { echo "FAIL $label — could not fetch $path"; fail=1; return; }
  if echo "$html" | grep -q '\$19' && echo "$html" | grep -qi 'founding\|Pro'; then
    echo "OK   $label — founding Pro \$19 visible"
  else
    echo "FAIL $label — missing founding \$19 Pro copy on $path"
    fail=1
  fi
}

echo "Production pricing probe — $SITE"
echo ""

check_page "pricing page" "/pricing/"

html=$(curl -sfL "$SITE/js/billing.js" 2>/dev/null) || { echo "FAIL billing.js — could not fetch"; exit 1; }
if echo "$html" | grep -q 'monthly: 19' && echo "$html" | grep -qi 'founding'; then
  echo "OK   billing.js — founding Pro \$19/mo"
else
  echo "FAIL billing.js — missing founding \$19 Pro plan"
  fail=1
fi

if [[ $fail -ne 0 ]]; then
  exit 1
fi
echo ""
echo "Founding Pro pricing present on production."
if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
  echo ""
  echo "Growth goal:"
  GROWTH_SALES=1 GROWTH_BILL=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
fi
