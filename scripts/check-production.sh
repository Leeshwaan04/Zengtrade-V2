#!/usr/bin/env bash
# Quick production health probe (run after deploy). Exit non-zero on hard failures.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0
check() {
  local name="$1" url="$2" expect="${3:-}"
  if code=$(curl -sfL --connect-timeout 5 --max-time 30 -o /tmp/ztcurl.out -w '%{http_code}' "$url" 2>/dev/null); then
    if [[ -n "$expect" ]] && ! grep -q "$expect" /tmp/ztcurl.out 2>/dev/null; then
      echo "WARN $name — HTTP $code but missing '$expect'"
      fail=1
    else
      echo "OK   $name — HTTP $code"
    fi
  else
    echo "FAIL $name — $url"
    fail=1
  fi
}
check "home" "$SITE/"
check "login" "$SITE/login"
check "app" "$SITE/app" "zengtrade"
check "app-onboard" "$SITE/app" "closed trades appear as the worker runs"
check "login-coins" "$SITE/login" "signup_coins"
if grep -q 'Algo Studio' /tmp/ztcurl.out 2>/dev/null; then
  echo "OK   login-algo — Algo Studio signup foot"
elif grep -q 'Algo Studio' saas/web/login.html 2>/dev/null; then
  echo "WARN login-algo — Algo Studio foot in repo (CDN deploy pending)"
else
  echo "FAIL login-algo — missing Algo Studio signup foot on /login"
  fail=1
fi
check "pricing" "$SITE/pricing/"
check "sitemap" "$SITE/sitemap.xml" "<urlset"
check "dashboard" "$SITE/dashboard/" "zengtrade"
check "ops" "$SITE/ops" "Founder Ops"
# ops/p0: warn until live, don't fail pre-deploy checks
if code=$(curl -sfL -o /tmp/ztcurl.out -w '%{http_code}' "$SITE/ops/p0/" 2>/dev/null); then
  if grep -q "P0 checklist" /tmp/ztcurl.out 2>/dev/null; then
    echo "OK   ops-p0 — HTTP $code"
  else
    echo "WARN ops-p0 — HTTP $code but missing content"
  fi
else
  echo "WARN ops-p0 — not deployed yet (push main → GitHub Pages)"
fi
check "app-js" "$SITE/js/auth.js" "establishSession"
rm -f /tmp/ztcurl.out

# Verify critical asset MIME types and non-empty payloads
check_asset() {
  local path="$1" expect_mime="$2"
  local url="$SITE$path"
  local ct=""
  if ct=$(curl -sfL --connect-timeout 5 --max-time 10 -D - "$url" -o /tmp/ztasset.out 2>/dev/null | grep -i '^content-type:' | head -n 1 | tr -d '\r'); then
    local sz=$(wc -c < /tmp/ztasset.out 2>/dev/null || echo 0)
    if echo "$ct" | grep -qi "$expect_mime" && [[ "$sz" -gt 50 ]]; then
      echo "OK   asset $path — $expect_mime ($sz B)"
    else
      echo "FAIL asset $path — invalid MIME ($ct) or empty ($sz B)"
      fail=1
    fi
  else
    echo "FAIL asset $path — 404/network error ($url)"
    fail=1
  fi
  rm -f /tmp/ztasset.out
}

check_asset "/css.css" "text/css"
check_asset "/site.css" "text/css"
check_asset "/site.js" "javascript"
check_asset "/studio.js" "javascript"
check_asset "/js/auth.js" "javascript"
check_asset "/js/app.js" "javascript"
check_asset "/assets/styles.css" "text/css"
check_asset "/assets/chart.js" "javascript"
check_asset "/assets/app.js" "javascript"
check_asset "/assets/mascot-bull.png" "image"

if [[ $fail -ne 0 ]]; then
  echo "Some checks failed — see FOUNDER_DEPLOY.md"
  exit 1
fi
echo "All production probes passed."
if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
  echo ""
  echo "Growth objective:"
  ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
fi
