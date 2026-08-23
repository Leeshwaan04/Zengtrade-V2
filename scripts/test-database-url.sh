#!/usr/bin/env bash
# Verify DATABASE_URL connects to Supabase Postgres (does not print the URI).
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
[[ -n "$DATABASE_URL" ]] || { echo "ERROR: DATABASE_URL not set" >&2; exit 1; }
command -v psql >/dev/null || { echo "ERROR: psql not installed" >&2; exit 1; }

if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c 'SELECT 1' >/dev/null 2>&1; then
  echo "ERROR: DATABASE_URL connection failed — use Supabase session pooler on port 5432" >&2
  exit 1
fi

echo "OK   DATABASE_URL connects"
