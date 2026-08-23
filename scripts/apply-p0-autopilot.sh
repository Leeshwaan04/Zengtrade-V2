#!/usr/bin/env bash
# Apply migration 0011 + deploy paper worker when secrets are available in the environment.
#
# Required:
#   DATABASE_URL       — Supabase Postgres URI (session pooler :5432)
#   RAILWAY_API_TOKEN  — Account token from railway.com/account/tokens
#
# Optional:
#   RAILWAY_PROJECT_ID — default f5902ffd-5b3f-49ed-b87d-dad21568185b
#   RAILWAY_ENV_ID     — default production env in that project
#   RAILWAY_SERVICE_ID — default paper-worker service (0decae25-…)
#   WORKER_INTERVAL    — default 300
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${RAILWAY_PROJECT_ID:-f5902ffd-5b3f-49ed-b87d-dad21568185b}"
ENV_ID="${RAILWAY_ENV_ID:-354b0010-b9a7-48ef-a809-c239f9469fa9}"
SERVICE_ID="${RAILWAY_SERVICE_ID:-0decae25-fab5-44f1-aefa-af6fcd5f070a}"
MIG_SQL="$ROOT/saas/db/migrations/0011_funnel_events_v2.sql"

die() { echo "ERROR: $*" >&2; exit 1; }

# Accept common secret aliases from Cloud Agent / CI
DATABASE_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"

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

# --- Paper worker (Railway GraphQL API) ---
if ./scripts/check-worker.sh >/dev/null 2>&1; then
  echo "OK   paper worker heartbeat fresh"
else
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL not set — worker needs DB"
  [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]] || die "RAILWAY_API_TOKEN not set — cannot deploy to Railway"

  echo ">> Configuring paper-worker on Railway ($PROJECT_ID)…"
  # shellcheck source=/dev/null
  source "$ROOT/scripts/railway-api.sh"
  export RAILWAY_PROJECT_ID="$PROJECT_ID" RAILWAY_ENV_ID="$ENV_ID" RAILWAY_SERVICE_ID="$SERVICE_ID"

  railway_set_vars "$PROJECT_ID" "$ENV_ID" "$SERVICE_ID" \
    "DATABASE_URL=${DATABASE_URL}" \
    "WORKER_INTERVAL=${WORKER_INTERVAL:-300}"

  railway_ensure_worker_service >/dev/null
  railway_redeploy "$ENV_ID" "$SERVICE_ID"

  echo ">> Waiting for worker heartbeat (up to 6 min)…"
  for _ in $(seq 1 24); do
    if ./scripts/check-worker.sh >/dev/null 2>&1; then
      echo "OK   worker heartbeat fresh"
      break
    fi
    sleep 15
  done
  ./scripts/check-worker.sh || die "Worker still stale — check Railway paper-worker logs"
fi

echo ""
echo "== P0 status =="
./scripts/status-report.sh
echo ""
echo "Next: ./scripts/verify-activation-path.sh && E2E https://zengtrade.in/ops/e2e"
