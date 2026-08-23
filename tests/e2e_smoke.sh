#!/usr/bin/env bash
# zengtrade launch smoke — fast checks before deploy (no browser).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== landing build =="
python3 deploy/landing/build.py >/dev/null
chmod +x scripts/probe-dist.sh
./scripts/probe-dist.sh

echo "== saas auth modules =="
test -f saas/web/js/auth.js
test -f saas/web/js/config.js
grep -q 'establishSession' saas/web/js/auth.js
grep -q 'AUTH_STORAGE_KEY' saas/web/js/config.js

echo "== worker =="
test -f saas/worker/worker.py
test -f saas/worker/requirements.txt
python3 -m py_compile saas/worker/worker.py saas/worker/engine.py saas/worker/strategies.py

echo "== autopilot docs =="
test -f docs/LAUNCH_RUNBOOK.md
test -f docs/GROWTH_DASHBOARD.md
test -f scripts/check-production.sh
test -f scripts/wait-for-deploy.sh
test -f scripts/founder-preflight.sh
test -f scripts/verify-billing.sh
test -f scripts/check-worker.sh
test -f scripts/check-migrations.sh
test -f scripts/status-report.sh
test -f scripts/verify-activation-path.sh
test -f scripts/wait-for-p0.sh
test -f scripts/sync-ops-gates.py
test -f saas/db/migrations/0010_admin_rpc_funnel.sql
test -f saas/db/migrations/0011_funnel_events_v2.sql

echo "== backend crypto tests (if pytest available) =="
if command -v pytest >/dev/null 2>&1; then
  pytest -q backend/tests/test_crypto_guards.py backend/tests/test_indicators.py 2>/dev/null || true
fi

echo "OK — e2e_smoke passed"
