#!/usr/bin/env bash
# CBO funnel truth: Pro must not promise live execution as shipped today.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

# App billing + evidence upsell copy
for f in saas/web/js/billing.js saas/web/js/app.js; do
  if grep -qE 'live execution (on your own exchange|when a strategy clears)' "$f" 2>/dev/null \
     && ! grep -q 'coming soon' "$f" 2>/dev/null; then
    echo "FAIL $f — Pro/upsell promises live execution without coming-soon qualifier"
    fail=1
  else
    echo "OK   $f Pro/upsell copy"
  fi
done

# Landing pricing build source
if grep -q 'Live execution on your own exchange' deploy/landing/build.py 2>/dev/null; then
  echo "FAIL build.py — pricing still promises live execution as shipped"
  fail=1
else
  echo "OK   build.py pricing copy"
fi

if grep -q 'coming soon' deploy/landing/build.py saas/web/js/billing.js; then
  echo "OK   coming-soon qualifier present"
else
  echo "FAIL missing coming-soon qualifier on live execution"
  fail=1
fi

if grep -q 'Paper deploy is live' saas/web/js/app.js; then
  echo "OK   app.js pricing worker-honesty note"
else
  echo "FAIL app.js missing pricing worker-honesty note"
  fail=1
fi

if [[ $fail -eq 0 ]]; then
  echo ""
  echo "Pricing truth checks passed — no live execution overpromise."
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth goal:"
    GROWTH_SALES=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
fi

exit "$fail"
