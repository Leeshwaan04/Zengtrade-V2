#!/usr/bin/env bash
# Quick production health probe (run after deploy). Exit non-zero on hard failures.
set -euo pipefail
SITE="${SITE:-https://zengtrade.in}"
fail=0
check() {
  local name="$1" url="$2" expect="${3:-}"
  if code=$(curl -sfL -o /tmp/ztcurl.out -w '%{http_code}' "$url" 2>/dev/null); then
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
check "pricing" "$SITE/pricing/"
check "sitemap" "$SITE/sitemap.xml" "<urlset"
check "dashboard" "$SITE/dashboard/" "zengtrade"
check "ops" "$SITE/ops" "Founder Ops"
# ops/p0 ships with PR #5 — warn until live, don't fail pre-merge deploys
if code=$(curl -sfL -o /tmp/ztcurl.out -w '%{http_code}' "$SITE/ops/p0" 2>/dev/null); then
  if grep -q "P0 checklist" /tmp/ztcurl.out 2>/dev/null; then
    echo "OK   ops-p0 — HTTP $code"
  else
    echo "WARN ops-p0 — HTTP $code but missing content"
  fi
else
  echo "WARN ops-p0 — not deployed yet (merge PR #5 for /ops/p0)"
fi
check "app-js" "$SITE/js/auth.js" "establishSession"
rm -f /tmp/ztcurl.out
if [[ $fail -ne 0 ]]; then
  echo "Some checks failed — see FOUNDER_DEPLOY.md"
  exit 1
fi
echo "All production probes passed."
