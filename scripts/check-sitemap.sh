#!/usr/bin/env bash
# CBO: verify production sitemap includes hub + all coin pSEO pages.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0

need_url() {
  local label="$1" path="$2"
  if curl -sfL "$SITE/sitemap.xml" | grep -q "<loc>${SITE}${path}</loc>"; then
    echo "OK   $label — in sitemap"
  else
    echo "FAIL $label — missing from sitemap ($path)"
    fail=1
  fi
}

echo "Sitemap probe — $SITE/sitemap.xml"
echo ""

need_url "home" "/"
need_url "how-it-works" "/how-it-works/"
need_url "pricing" "/pricing/"
need_url "login" "/login"
need_url "app" "/app"
need_url "coins hub" "/coins/"
for slug in bitcoin ethereum solana bnb xrp cardano dogecoin; do
  need_url "coin $slug" "/coins/${slug}/"
done

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "Run build.py and deploy main — coin pages must appear in sitemap.xml."
  exit 1
fi
echo ""
echo "All sitemap URLs present."
if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
  echo ""
  echo "Growth goal:"
  GROWTH_GSC=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
fi
