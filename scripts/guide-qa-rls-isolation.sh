#!/usr/bin/env bash
# QA&VAPT: manual RLS isolation test (Q3): run after worker + trades E2E.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== RLS isolation test guide (QA Q3) — $SITE =="
echo ""

if ! ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "BLOCKED: Paper worker offline — complete P0 first:"
  echo "  $SITE/ops/worker · docs/WORKER_RECOVERY.md"
  echo ""
  echo "While blocked, run parallel QA instead:"
  echo "  ./scripts/check-qa-parallel.sh"
  echo ""
  echo "Growth objective:"
  ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  exit 1
fi

echo "Prerequisites:"
echo "  ./scripts/verify-activation-path.sh exit 0"
echo "  Account A has ≥1 closed trade in /app#forward"
echo ""
echo "== Manual steps =="
echo ""
echo "1. Incognito A (already activated)"
echo "   → Sign in as User A · note trade count in $SITE/app#forward"
echo ""
echo "2. Incognito B (fresh signup)"
echo "   → $SITE/login?mode=signup"
echo "   → Deploy one strategy · check $SITE/app#forward and $SITE/app#activity"
echo ""
echo "3. Pass criteria"
echo "   → User B sees ZERO trades/deployments from User A"
echo "   → User B only sees their own data (RLS enforced)"
echo ""
echo "4. Record result"
echo "   → Mark Q3 in docs/QA_VAPT_CHECKLIST.md (pass/fail + date)"
echo "   → Log in docs/GROWTH_DASHBOARD.md (QA&VAPT section)"
echo ""
echo "E2E checklist: $SITE/ops/e2e step 5"
echo "Automated preflight: ./scripts/security-smoke.sh (RLS anon probes)"
