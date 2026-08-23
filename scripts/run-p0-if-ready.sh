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
if [[ -z "${DATABASE_URL:-}" ]]; then
  if resolved=$(./scripts/resolve-database-url.sh 2>/dev/null); then
    DATABASE_URL="$resolved"
    export DATABASE_URL
    if [[ -n "${DATABASE_PASSWORD:-${SUPABASE_DB_PASSWORD:-}}" && -z "${SUPABASE_DATABASE_URL:-}" ]]; then
      echo "OK   DATABASE_URL built from DATABASE_PASSWORD"
    else
      echo "OK   DATABASE_URL resolved from Railway"
    fi
  fi
elif [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" && -z "${DATABASE_URL:-}" ]]; then
  :
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  sanitized=$(./scripts/sanitize-database-url.sh "$DATABASE_URL")
  if [[ "$sanitized" != "$DATABASE_URL" ]]; then
    echo "WARN  DATABASE_URL had [brackets] around password — auto-stripping"
    DATABASE_URL="$sanitized"
    export DATABASE_URL
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
