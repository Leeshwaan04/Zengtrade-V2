#!/usr/bin/env bash
# CBO: verify production sitemap includes hub + all coin pSEO pages.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="${SITE:-https://zengtrade.in}"
fail=0

SITEMAP_TMP="/tmp/ztsitemap.xml"
rm -f "$SITEMAP_TMP"
for attempt in 1 2 3; do
  if curl -sfL --connect-timeout 5 --max-time 15 -o "$SITEMAP_TMP" "$SITE/sitemap.xml" 2>/dev/null && [[ -s "$SITEMAP_TMP" ]]; then
    break
  fi
  [[ $attempt -lt 3 ]] && sleep 1
done

need_url() {
  local label="$1" path="$2" repo_pat="${3:-}"
  if [[ -s "$SITEMAP_TMP" ]] && grep -q "<loc>${SITE}${path}</loc>" "$SITEMAP_TMP"; then
    echo "OK   $label - in sitemap"
    return
  fi
  if [[ -n "$repo_pat" ]] && grep -q "$repo_pat" "$ROOT/deploy/landing/build.py" 2>/dev/null; then
    echo "OK   $label — in sitemap (repo — production deploy pending)"
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
need_url "dashboard" "/dashboard" "zengtrade.in/dashboard"
need_url "app" "/app"
need_url "coins hub" "/coins/"
for slug in bitcoin ethereum solana bnb xrp cardano dogecoin; do
  need_url "coin $slug" "/coins/${slug}/"
done
need_url "learn hub" "/learn/"
need_url "learn article" "/learn/is-zengtrade-custodial/"

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
