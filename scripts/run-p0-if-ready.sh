#!/usr/bin/env bash
# Agent entry point — run each autopilot turn on main when pursuing P0.
# Applies migration 0011 + deploys worker when DATABASE_URL is available (env or Railway).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mig=0 work=0
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1

if [[ $mig -eq 1 && $work -eq 1 ]]; then
  echo "P0 already green — running post-P0 runbook"
  exec ./scripts/post-p0-success.sh
fi

DATABASE_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
if [[ -z "${DATABASE_URL:-}" && -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/scripts/railway-api.sh" 2>/dev/null || true
  if resolved=$(railway_resolve_database_url 2>/dev/null); then
    DATABASE_URL="$resolved"
    export DATABASE_URL
    echo "OK   DATABASE_URL resolved from Railway"
  fi
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL
  ./scripts/apply-p0-autopilot.sh
  exec ./scripts/post-p0-success.sh
fi

echo ""
./scripts/check-p0-readiness.sh
exit 1
