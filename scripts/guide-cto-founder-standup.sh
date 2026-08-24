#!/usr/bin/env bash
# CTO: founder combined standup for P0 worker recovery (auth + paper worker).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export SITE="${SITE:-https://zengtrade.in}"

echo "== CTO founder standup (P0 worker) — $SITE =="
echo ""

if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "Worker live — run post-P0:"
  echo "  ./scripts/post-p0-success.sh"
  echo "  ./scripts/verify-activation-path.sh"
  echo "  ./scripts/audit-growth-goal.sh"
  exit 0
fi

echo ">> P0 readiness"
./scripts/check-p0-readiness.sh 2>&1 | head -40 || true
echo ""

echo ">> Database auth (no secrets printed)"
./scripts/validate-database-credentials.sh 2>&1 | head -18 || true
echo ""

if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  echo ">> Railway paper-worker deploy"
  ./scripts/check-railway-deploy.sh 2>/dev/null | head -8 || true
  echo ""
fi

echo ">> Heartbeat"
./scripts/check-worker.sh 2>&1 || true
echo ""

echo "== Fix paths (pick one) =="
echo ""
echo "A) Cloud Agent (fastest)"
echo "   1. Reset DB password: https://supabase.com/dashboard/project/ponvarxeytfcntckczbn/database/settings"
echo "   2. Add secret DATABASE_PASSWORD only"
echo "   3. ./scripts/run-p0-if-ready.sh"
echo ""
echo "B) GitHub Action — Secrets DATABASE_PASSWORD + RAILWAY_API_TOKEN"
echo "   → Apply P0 workflow (type APPLY)"
echo "   https://github.com/Leeshwaan04/Zengtrade-V2/actions/workflows/apply-p0.yml"
echo ""
echo "C) GitHub health-watch — same Secrets; auto-runs every 6h"
echo ""
echo "D) Manual Railway — Session URI :5432 → paper-worker DATABASE_URL → Deploy"
echo "   $SITE/ops/worker"
echo ""
echo "== After fix =="
echo "  ./scripts/run-p0-if-ready.sh"
echo "  ./scripts/validate-database-credentials.sh"
echo "  ./scripts/check-worker.sh"
echo "  ./scripts/post-p0-success.sh"
echo ""
echo "Detail: ./scripts/guide-worker-recovery.sh · docs/WORKER_RECOVERY.md"
echo "Parallel while blocked: ./scripts/guide-founder-growth-standup.sh"
echo ""
echo "Growth objective:"
./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
