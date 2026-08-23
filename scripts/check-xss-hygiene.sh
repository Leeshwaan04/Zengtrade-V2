#!/usr/bin/env bash
# QA&VAPT: verify /app SPA escapes user-influenced HTML (no exploit payloads).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0

ok() { echo "OK   $1"; }
bad() { echo "FAIL $1"; fail=1; }

echo "== check-xss-hygiene (QA&VAPT) =="
echo ""

grep -q 'export function esc' saas/web/js/ui.js && ok "ui.js exports esc()" || bad "ui.js missing esc()"

grep -q 'esc(msg)' saas/web/js/ui.js && ok "toast escapes message text" || bad "toast missing esc(msg)"

grep -q 'from "./ui.js"' saas/web/js/app.js && grep -q '\besc\b' saas/web/js/app.js && \
  ok "app.js imports esc from ui.js" || bad "app.js missing esc import"

# User-controlled fields in innerHTML must use esc()
if grep -E 'innerHTML.*\$\{user\.' saas/web/js/app.js 2>/dev/null | grep -qv 'esc(user'; then
  bad "app.js innerHTML exposes unescaped user.* fields"
else
  ok "app.js user fields escaped in innerHTML"
fi

# Strategy / trade fields rendered via innerHTML should use esc()
risky=$(grep -E 'innerHTML.*\$\{(meta|t|s)\.' saas/web/js/app.js 2>/dev/null | grep -v 'esc(' || true)
if [[ -n "$risky" ]]; then
  bad "app.js innerHTML may expose unescaped dynamic fields"
  echo "$risky"
else
  ok "app.js dynamic fields use esc() in innerHTML templates"
fi

echo ""
if [[ $fail -ne 0 ]]; then
  echo "check-xss-hygiene failed — review saas/web/js/app.js + ui.js"
  exit 1
fi
echo "check-xss-hygiene passed."
