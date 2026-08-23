#!/usr/bin/env bash
# CBO funnel truth — Pro must not promise live execution as shipped today.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

# App billing copy
if grep -q 'Live execution on your own exchange' saas/web/js/billing.js 2>/dev/null; then
  echo "FAIL billing.js — Pro still promises live execution without coming-soon qualifier"
  fail=1
else
  echo "OK   billing.js Pro copy"
fi

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

exit "$fail"
