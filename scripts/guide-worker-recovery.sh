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
  echo "Worker is live — run full post-P0:"
  echo "  ./scripts/post-p0-success.sh"
  echo "  Manual E2E trades: $SITE/ops/e2e steps 3–4"
  echo "  RLS isolation:     ./scripts/guide-qa-rls-isolation.sh"
  echo "  Growth audit:      ./scripts/audit-growth-goal.sh"
  exit 0
fi

echo "== Fix paths (Google Cloud Platform) =="
echo ""
echo "A) Enable GCP Billing (Required for Cloud Run & Scheduler)"
echo "   1. Open: https://console.cloud.google.com/billing/linkedaccount?project=zengtrade"
echo "   2. Link an active/open billing account"
echo ""
echo "B) Deploy / Update Worker on GCP Cloud Run"
echo "   Run: ./scripts/deploy-worker-gcp.sh"
echo "   Or resume Cloud Scheduler job once billing is active:"
echo "   gcloud scheduler jobs resume paper-worker-cycle --location=us-central1 --project=zengtrade"
echo ""
echo "C) Rotate Supabase Database Password in GCP Secret Manager"
echo "   read -s -p 'Paste new DATABASE_URL: ' DBURL && echo"
echo "   printf '%s' \"\$DBURL\" | gcloud secrets versions add zengtrade-worker-db-url --data-file=- --project=zengtrade"
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
