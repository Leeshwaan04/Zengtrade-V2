#!/usr/bin/env bash
# Redundant, code-visible trigger for downgrade_expired() (saas/db/migrations/0003, tightened by
# 0015). The only previous trigger was an optional pg_cron schedule enabled manually in the
# Supabase dashboard, with zero code-level guarantee it was ever turned on or stays on. This calls
# the same RPC directly on health-watch's existing 6-hourly schedule regardless, so a lapsed paid
# subscription can't silently stay paid forever just because pg_cron was never enabled (or later
# got disabled) - belt-and-suspenders, not a replacement for enabling pg_cron if you can.
set -euo pipefail
SUPABASE_URL="${SUPABASE_URL:-https://ponvarxeytfcntckczbn.supabase.co}"

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SKIP: SUPABASE_SERVICE_ROLE_KEY not in repo Secrets - add it (Settings > Secrets and" \
       "variables > Actions) to activate this redundant safety net. See saas/db/migrations/0015."
  exit 0
fi

resp=$(curl -s -w '\n%{http_code}' -X POST "$SUPABASE_URL/rest/v1/rpc/downgrade_expired" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json")
code=$(echo "$resp" | tail -1)
body=$(echo "$resp" | sed '$d')

if [[ "$code" == "200" ]]; then
  echo "OK   downgrade_expired() ran, response: $body"
else
  echo "FAIL downgrade_expired() HTTP $code: $body"
  exit 1
fi
