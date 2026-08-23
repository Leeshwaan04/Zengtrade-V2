#!/usr/bin/env bash
# Resolve a working DATABASE_URL from env, password, or Railway (prints URI on stdout).
# Does not print on failure. Caller must not log stdout if piping to logs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

url="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
if [[ -n "$url" ]]; then
  ./scripts/sanitize-database-url.sh "$url"
  exit 0
fi

pw="${DATABASE_PASSWORD:-${SUPABASE_DB_PASSWORD:-}}"
if [[ -n "$pw" ]]; then
  line=$(SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-ponvarxeytfcntckczbn}" \
    DATABASE_PASSWORD="$pw" ./scripts/discover-supabase-pooler.sh 2>/dev/null | sed -n "s/^export DATABASE_URL='\(.*\)'$/\1/p" || true)
  if [[ -n "$line" ]] && DATABASE_URL="$line" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    echo "$line"
    exit 0
  fi
fi

if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/scripts/railway-api.sh" 2>/dev/null || true
  if resolved=$(railway_resolve_database_url 2>/dev/null); then
    ./scripts/sanitize-database-url.sh "$resolved"
    exit 0
  fi
fi

exit 1
