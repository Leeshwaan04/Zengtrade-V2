#!/usr/bin/env bash
# Quiet Postgres auth probe for standup scripts (exit 0/1, no stdout).
# Use validate-database-credentials.sh for founder-facing diagnostics with hints.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if resolved=$(./scripts/resolve-database-url.sh 2>/dev/null); then
  DATABASE_URL="$resolved" ./scripts/test-database-url.sh >/dev/null 2>&1 && exit 0
fi

if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/scripts/railway-api.sh" 2>/dev/null || true
  if rail_uri=$(railway_resolve_database_url 2>/dev/null); then
    rail_uri=$(./scripts/sanitize-database-url.sh "$rail_uri" 2>/dev/null || echo "$rail_uri")
    DATABASE_URL="$rail_uri" ./scripts/test-database-url.sh >/dev/null 2>&1 && exit 0
  fi
fi

url="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
if [[ -n "$url" ]]; then
  DATABASE_URL="$url" ./scripts/test-database-url.sh >/dev/null 2>&1 && exit 0
fi

exit 1
