#!/usr/bin/env bash
# Verify DATABASE_URL connects to Supabase Postgres (does not print the URI).
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
[[ -n "$DATABASE_URL" ]] || { echo "ERROR: DATABASE_URL not set" >&2; exit 1; }
command -v psql >/dev/null || { echo "ERROR: psql not installed" >&2; exit 1; }

if python3 -c 'import os,sys; from urllib.parse import urlparse
u=os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DATABASE_URL") or ""
p=urlparse(u)
pw=p.password or ""
if pw.startswith("sb_"):
    print("ERROR: DATABASE_URL password looks like a Supabase API key (sb_secret/sb_publishable), not the Postgres database password", file=sys.stderr)
    print("Get the URI from Supabase → Project Settings → Database → Connection string (Session pooler, port 5432)", file=sys.stderr)
    print("Reset the database password there if needed — API keys cannot substitute for it.", file=sys.stderr)
    sys.exit(2)
sys.exit(0)'; then
  :
else
  rc=$?
  if [[ $rc -eq 2 ]]; then exit 2; fi
fi

if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c 'SELECT 1' >/dev/null 2>&1; then
  host=$(python3 -c "from urllib.parse import urlparse; import os; print(urlparse(os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_DATABASE_URL') or '').hostname or '')")
  if [[ "$host" == *us-east-1* ]]; then
    echo "HINT: this project may use aws-0-ap-northeast-1.pooler.supabase.com — copy URI from Supabase Dashboard" >&2
  fi
  echo "ERROR: DATABASE_URL connection failed — use Supabase session pooler on port 5432" >&2
  echo "       Supabase → Database → Connection string (not the sb_secret / sb_publishable API keys)" >&2
  exit 1
fi

echo "OK   DATABASE_URL connects"
