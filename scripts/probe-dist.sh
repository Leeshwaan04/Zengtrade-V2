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
echo "OK   sitemap key URLs"

grep -q 'OAuth callbacks must land' "$DIST/dashboard/studio.js" || { echo "FAIL studio.js OAuth guard"; exit 1; }
echo "OK   studio.js OAuth guard"

echo "All dist probes passed."
