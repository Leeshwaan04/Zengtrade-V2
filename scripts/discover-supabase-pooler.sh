#!/usr/bin/env bash
# Discover the Supabase shared pooler hostname for a project (Supavisor cluster varies).
# Does not print DATABASE_PASSWORD. Use with test-database-url.sh after.
#
# Usage:
#   SUPABASE_PROJECT_REF=ponvarxeytfcntckczbn DATABASE_PASSWORD='...' ./scripts/discover-supabase-pooler.sh
#   # prints: export DATABASE_URL='postgresql://postgres.REF:***@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
#
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-ponvarxeytfcntckczbn}"
PW="${DATABASE_PASSWORD:-${SUPABASE_DB_PASSWORD:-}}"
[[ -n "$PW" ]] || { echo "ERROR: set DATABASE_PASSWORD (Supabase database password, not API keys)" >&2; exit 1; }
command -v psql >/dev/null || { echo "ERROR: psql required" >&2; exit 1; }

regions="us-east-1 us-east-2 us-west-1 us-west-2 eu-west-1 eu-west-2 eu-central-1 eu-central-2 eu-north-1 ap-southeast-1 ap-southeast-2 ap-northeast-1 ap-northeast-2 ap-south-1 ca-central-1 sa-east-1"

found_host=""
for n in 0 1 2 3 4 5; do
  for r in $regions; do
    host="aws-${n}-${r}.pooler.supabase.com"
    uri="postgresql://postgres.${REF}:${PW}@${host}:5432/postgres"
    if psql "$uri" -v ON_ERROR_STOP=1 -qAt -c 'SELECT 1' >/dev/null 2>&1; then
      found_host="$host"
      break 2
    fi
    err=$(psql "$uri" -qAt -c 'SELECT 1' 2>&1 || true)
    if echo "$err" | grep -qi 'password authentication failed'; then
      found_host="$host"
      echo "WARN: pooler host found but password rejected — reset in Supabase → Database" >&2
      break 2
    fi
  done
done

[[ -n "$found_host" ]] || { echo "ERROR: could not find pooler host for project $REF" >&2; exit 1; }

enc_pw=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$PW")
echo "OK   pooler host: $found_host"
echo "export DATABASE_URL='postgresql://postgres.${REF}:${enc_pw}@${found_host}:5432/postgres'"
