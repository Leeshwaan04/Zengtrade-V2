#!/usr/bin/env bash
# CTO: founder CLI for paper worker recovery (P0 unblock).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== Worker recovery guide (CTO P0) — $SITE =="
echo ""

./scripts/run-p0-if-ready.sh 2>&1 | head -22 || true
echo ""

echo "== Diagnose (no secrets printed) =="
./scripts/validate-database-credentials.sh 2>&1 | head -20 || true
echo ""
if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  echo ">> Railway paper-worker"
  ./scripts/check-railway-deploy.sh 2>/dev/null | head -8 || true
  echo ""
fi
echo ">> Heartbeat"
./scripts/check-worker.sh 2>&1 || true
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker is live — run ./scripts/post-p0-success.sh"
  exit 0
fi

echo "== Fix paths (pick one) =="
echo ""
echo "A) Cloud Agent (fastest)"
echo "   1. Reset DB password: https://supabase.com/dashboard/project/ponvarxeytfcntckczbn/database/settings"
echo "   2. Add secret DATABASE_PASSWORD only"
echo "   3. ./scripts/run-p0-if-ready.sh"
echo ""
echo "B) GitHub Action"
echo "   Secrets DATABASE_PASSWORD + RAILWAY_API_TOKEN → Apply P0 workflow (type APPLY)"
echo "   Preflight: validate-database-credentials → run-p0-if-ready"
echo "   https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-p0.yml"
echo ""
echo "D) GitHub health-watch (scheduled)"
echo "   Same Secrets as B — health-watch runs every 6h and auto-runs run-p0-if-ready"
echo "   https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/health-watch.yml"
echo ""
echo "C) Manual Railway"
echo "   Supabase Connect → Session URI port 5432 → Railway paper-worker DATABASE_URL → Deploy"
echo "   https://railway.app/project/f5902ffd-5b3f-49ed-b87d-dad21568185b"
echo "   $SITE/ops/worker"
echo ""
echo "== Verify after fix =="
echo "  ./scripts/validate-database-credentials.sh"
echo "  ./scripts/check-worker.sh"
echo "  ./scripts/post-p0-success.sh"
echo ""
echo "Full runbook: docs/WORKER_RECOVERY.md"
echo "Parallel work while blocked: ./scripts/guide-founder-parallel.sh"
echo ""
echo "== Growth goal (while blocked) =="
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null || true
