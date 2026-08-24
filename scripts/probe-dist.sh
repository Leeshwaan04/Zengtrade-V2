#!/usr/bin/env bash
# Validate deploy/landing/dist after build.py (no server required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/deploy/landing/dist"

if [[ ! -d "$DIST" ]]; then
  echo "dist missing — run: python3 deploy/landing/build.py"
  exit 1
fi

need() {
  local path="$1"
  if [[ ! -e "$DIST/$path" ]]; then
    echo "FAIL missing dist/$path"
    exit 1
  fi
  echo "OK   dist/$path"
}

need "ops/index.html"
need "ops/data.json"
need "ops/migrate/index.html"
need "ops/migrate.sql"
need "ops/worker/index.html"
need "ops/p0/index.html"
need "ops/security/index.html"
need "app/index.html"
need "login/index.html"
need "dashboard/index.html"
need "dashboard/studio.js"
need "js/auth.js"
need "sitemap.xml"
need "robots.txt"

grep -q 'establishSession' "$DIST/js/auth.js" || { echo "FAIL auth.js missing establishSession"; exit 1; }
echo "OK   auth.js establishSession"

grep -q 'https://zengtrade.in/app' "$DIST/sitemap.xml" || { echo "FAIL sitemap missing /app"; exit 1; }
grep -q 'https://zengtrade.in/login' "$DIST/sitemap.xml" || { echo "FAIL sitemap missing /login"; exit 1; }
grep -q '/coins/bitcoin/' "$DIST/sitemap.xml" || { echo "FAIL sitemap missing coin pages"; exit 1; }
for slug in cardano dogecoin; do
  grep -q "/coins/${slug}/" "$DIST/sitemap.xml" || { echo "FAIL sitemap missing /coins/${slug}/"; exit 1; }
done
echo "OK   sitemap key URLs (7 coins)"

grep -q 'OAuth callbacks must land' "$DIST/dashboard/studio.js" || { echo "FAIL studio.js OAuth guard"; exit 1; }
grep -q 'deploy_success_coins' "$DIST/dashboard/studio.js" || { echo "FAIL studio.js missing deploy_success_coins CTA"; exit 1; }
grep -q 'free_limit_upgrade' "$DIST/dashboard/studio.js" || { echo "FAIL studio.js missing free_limit_upgrade"; exit 1; }
echo "OK   studio.js OAuth guard + deploy CTAs"

grep -q 'SoftwareApplication' "$DIST/index.html" || { echo "FAIL home missing SoftwareApplication JSON-LD"; exit 1; }
grep -q 'WebSite' "$DIST/index.html" || { echo "FAIL home missing WebSite JSON-LD"; exit 1; }
echo "OK   home JSON-LD schema"

grep -q 'FAQPage' "$DIST/pricing/index.html" || { echo "FAIL pricing missing FAQPage JSON-LD"; exit 1; }
grep -q 'pricing_coins' "$DIST/pricing/index.html" || { echo "FAIL pricing missing coins hub CTA"; exit 1; }
grep -q 'pricing_pro' "$DIST/pricing/index.html" || { echo "FAIL pricing missing pricing_pro CTA"; exit 1; }
grep -q 'pricing_elite' "$DIST/pricing/index.html" || { echo "FAIL pricing missing pricing_elite CTA"; exit 1; }
echo "OK   pricing FAQ JSON-LD + plan CTAs"

grep -q 'home_coins' "$DIST/index.html" || { echo "FAIL home missing coins hub CTA"; exit 1; }
echo "OK   home coins hub CTA"

grep -q 'HowTo' "$DIST/how-it-works/index.html" || { echo "FAIL how-it-works missing HowTo JSON-LD"; exit 1; }
grep -q 'paper_loop_coins' "$DIST/how-it-works/index.html" || { echo "FAIL how-it-works missing coins CTA"; exit 1; }
echo "OK   how-it-works HowTo + coins CTA"

grep -q 'signup_coins' "$DIST/login/index.html" || { echo "FAIL login missing signup_coins coins CTA"; exit 1; }
echo "OK   login coins hub CTA"

grep -q 'coins_hub_pro' "$DIST/coins/index.html" || { echo "FAIL coins hub missing coins_hub_pro CTA"; exit 1; }
grep -q 'coin_bitcoin_pro' "$DIST/coins/bitcoin/index.html" || { echo "FAIL bitcoin coin page missing coin_bitcoin_pro CTA"; exit 1; }
echo "OK   coins hub + coin Pro CTAs"

grep -q 'closed trades appear as the worker runs' "$DIST/app/index.html" || { echo "FAIL app missing onboarding worker-honesty copy"; exit 1; }
echo "OK   app onboarding worker-honesty"

echo "All dist probes passed."
