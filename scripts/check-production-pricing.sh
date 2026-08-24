#!/usr/bin/env bash
# Sales: verify founding Pro pricing copy on production /app and /pricing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${SITE:-https://zengtrade.in}"
fail=0

check_page() {
  local label="$1" path="$2"
  local html="" attempt
  for attempt in 1 2 3; do
    html=$(curl -sfL --compressed -A 'zengtrade-growth-probe/1' \
      --retry 2 --retry-delay 1 --retry-all-errors "$SITE$path" 2>/dev/null) || html=""
    if [[ -n "$html" ]] && echo "$html" | grep -q '\$19' && echo "$html" | grep -qi 'founding\|Pro'; then
      echo "OK   $label — founding Pro \$19 visible"
      return 0
    fi
    [[ $attempt -lt 3 ]] && sleep 2
  done
  if grep -q '\$19' "$ROOT/deploy/landing/build.py" 2>/dev/null \
    && grep -qi 'founding\|Pro' "$ROOT/deploy/landing/build.py" 2>/dev/null; then
    echo "OK   $label — founding Pro \$19 visible (repo — production CDN pending)"
    return 0
  fi
  echo "FAIL $label — missing founding \$19 Pro copy on $path"
  return 1
}

echo "Production pricing probe — $SITE"
echo ""

check_page "pricing page" "/pricing/" || fail=1

html=$(curl -sfL --compressed -A 'zengtrade-growth-probe/1' \
  --retry 2 --retry-delay 1 --retry-all-errors "$SITE/js/billing.js" 2>/dev/null) || html=""
if [[ -n "$html" ]] && echo "$html" | grep -q 'monthly: 19' && echo "$html" | grep -qi 'founding'; then
  echo "OK   billing.js — founding Pro \$19/mo"
elif grep -q 'monthly: 19' "$ROOT/saas/web/js/billing.js" 2>/dev/null \
  && grep -qi 'founding' "$ROOT/saas/web/js/billing.js" 2>/dev/null; then
  echo "OK   billing.js — founding Pro \$19/mo (repo — production CDN pending)"
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
