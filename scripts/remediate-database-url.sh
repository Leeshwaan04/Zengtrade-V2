#!/usr/bin/env bash
# If DATABASE_URL has the wrong Supavisor host but password is valid, return a working URI on stdout.
# Exits 0 only when psql connects. Does not print the password.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

url="${1:-${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}}"
[[ -n "$url" ]] || exit 1

if DATABASE_URL="$url" ./scripts/test-database-url.sh >/dev/null 2>&1; then
  echo "$url"
  exit 0
fi

pw=$(python3 -c "from urllib.parse import urlparse; import os,sys
u=urlparse(os.environ['U'])
sys.exit(0 if u.password else 1)
print(u.password)" U="$url") || exit 1

if [[ "$pw" == sb_* ]]; then
  exit 1
fi

REF="${SUPABASE_PROJECT_REF:-ponvarxeytfcntckczbn}"
regions="us-east-1 us-east-2 us-west-1 us-west-2 eu-west-1 eu-west-2 eu-central-1 eu-central-2 eu-north-1 ap-southeast-1 ap-southeast-2 ap-northeast-1 ap-northeast-2 ap-south-1 ca-central-1 sa-east-1"

for n in 0 1 2 3 4 5; do
  for r in $regions; do
    host="aws-${n}-${r}.pooler.supabase.com"
    try="postgresql://postgres.${REF}:${pw}@${host}:5432/postgres"
    if psql "$try" -v ON_ERROR_STOP=1 -qAt -c 'SELECT 1' >/dev/null 2>&1; then
      enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$pw")
      echo "postgresql://postgres.${REF}:${enc}@${host}:5432/postgres"
      exit 0
    fi
  done
done
exit 1
