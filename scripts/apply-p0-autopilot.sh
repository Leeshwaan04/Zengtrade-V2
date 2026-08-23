#!/usr/bin/env bash
# Apply migration 0011 + deploy paper worker when secrets are available in the environment.
# Required env:
#   DATABASE_URL  — Supabase Postgres URI (session pooler :5432)
#   RAILWAY_TOKEN — Railway API token (for worker deploy)
# Optional:
#   RAILWAY_PROJECT_ID — default f5902ffd-5b3f-49ed-b87d-dad21568185b (founder-approved)
#   RAILWAY_SERVICE      — existing Railway service name/id to link (if project has multiple)
#   WORKER_INTERVAL      — default 300
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${RAILWAY_PROJECT_ID:-f5902ffd-5b3f-49ed-b87d-dad21568185b}"
MIG_SQL="$ROOT/saas/db/migrations/0011_funnel_events_v2.sql"

die() { echo "ERROR: $*" >&2; exit 1; }

echo "== zengtrade P0 autopilot =="
echo ""

# --- Migration 0011 ---
if ./scripts/check-migrations.sh >/dev/null 2>&1; then
  echo "OK   migration 0011 already applied"
else
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL not set — cannot apply migration 0011"
  command -v psql >/dev/null || die "psql not installed"
  echo ">> Applying migration 0011 via psql…"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIG_SQL"
  ./scripts/check-migrations.sh
fi

echo ""

# --- Paper worker (Railway) ---
if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "OK   paper worker heartbeat fresh"
else
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL not set — worker needs DB"
  [[ -n "${RAILWAY_TOKEN:-}" ]] || die "RAILWAY_TOKEN not set — cannot deploy to Railway"
  command -v railway >/dev/null || die "railway CLI not installed"

  echo ">> Deploying worker to Railway project $PROJECT_ID…"
  export RAILWAY_TOKEN
  cd "$ROOT/saas/worker"

  railway link -p "$PROJECT_ID" -y 2>/dev/null || railway link -p "$PROJECT_ID"

  if [[ -n "${RAILWAY_SERVICE:-}" ]]; then
    railway service link "$RAILWAY_SERVICE" 2>/dev/null || true
  fi

  railway variable set "DATABASE_URL=${DATABASE_URL}" --skip-deploys
  railway variable set "WORKER_INTERVAL=${WORKER_INTERVAL:-300}" --skip-deploys

  railway up -d -y

  cd "$ROOT"
  echo ">> Waiting for worker heartbeat (up to 6 min)…"
  for i in $(seq 1 24); do
    if ./scripts/check-worker.sh >/dev/null 2>&1; then
      echo "OK   worker heartbeat fresh"
      break
    fi
    sleep 15
  done
  ./scripts/check-worker.sh || die "Worker still stale after deploy — check Railway logs"
fi

echo ""
echo "== P0 status =="
./scripts/status-report.sh
echo ""
echo "Next: ./scripts/verify-activation-path.sh && E2E https://zengtrade.in/ops/e2e"
