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

# Resolve working DATABASE_URL (env, DATABASE_PASSWORD secret, or validated Railway)
DATABASE_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
if [[ -n "${DATABASE_URL:-}" ]]; then
  sanitized=$(./scripts/sanitize-database-url.sh "$DATABASE_URL")
  if [[ "$sanitized" != "$DATABASE_URL" ]]; then
    echo "WARN  DATABASE_URL had [brackets] around password — auto-stripping (use Supabase copy button)"
    DATABASE_URL="$sanitized"
  fi
  if ! DATABASE_URL="$DATABASE_URL" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    echo "WARN  DATABASE_URL in env failed auth — trying DATABASE_PASSWORD / Railway"
    DATABASE_URL=""
  fi
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  if resolved=$(./scripts/resolve-database-url.sh 2>/dev/null); then
    DATABASE_URL="$resolved"
    export DATABASE_URL
    echo "OK   DATABASE_URL resolved (password secret or Railway)"
  fi
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  sanitized=$(./scripts/sanitize-database-url.sh "$DATABASE_URL")
  if [[ "$sanitized" != "$DATABASE_URL" ]]; then
    echo "WARN  DATABASE_URL had [brackets] around password — auto-stripping (use Supabase copy button)"
    DATABASE_URL="$sanitized"
  fi
fi

echo "== zengtrade P0 autopilot =="
echo ""

# --- Migration 0011 ---
if ./scripts/check-migrations.sh >/dev/null 2>&1; then
  echo "OK   migration 0011 already applied"
else
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL not set — cannot apply migration 0011"
  command -v psql >/dev/null || die "psql not installed"
  if ! DATABASE_URL="$DATABASE_URL" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    if fixed=$(./scripts/remediate-database-url.sh "$DATABASE_URL" 2>/dev/null); then
      DATABASE_URL="$fixed"
      export DATABASE_URL
      echo "OK   DATABASE_URL remediated (Supavisor host corrected)"
    fi
  fi
  DATABASE_URL="$DATABASE_URL" ./scripts/test-database-url.sh
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
  if ! DATABASE_URL="$DATABASE_URL" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    die "DATABASE_URL password invalid — reset in Supabase Connect, update Railway, Deploy (see /ops/worker)"
  fi
  [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]] || die "RAILWAY_API_TOKEN not set — cannot deploy to Railway"

  echo ">> Configuring paper-worker on Railway ($PROJECT_ID)…"
  # shellcheck source=/dev/null
  source "$ROOT/scripts/railway-api.sh"
  export RAILWAY_PROJECT_ID="$PROJECT_ID" RAILWAY_ENV_ID="$ENV_ID" RAILWAY_SERVICE_ID="$SERVICE_ID"

  railway_set_vars "$PROJECT_ID" "$ENV_ID" "$SERVICE_ID" \
    "DATABASE_URL=${DATABASE_URL}" \
    "WORKER_INTERVAL=${WORKER_INTERVAL:-300}"

  railway_configure_worker_service >/dev/null
  echo ">> Redeploying paper-worker (single deploy after vars set)…"
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
echo "Next: ./scripts/post-p0-success.sh"
