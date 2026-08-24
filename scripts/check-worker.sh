#!/usr/bin/env bash
# Check paper worker heartbeat freshness (Supabase engine_state).
set -euo pipefail
SUPABASE_URL="${SUPABASE_URL:-https://ponvarxeytfcntckczbn.supabase.co}"
ANON_KEY="${ANON_KEY:-sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1}"
MAX_AGE_MIN="${MAX_AGE_MIN:-12}"

raw=$(curl -sfL "$SUPABASE_URL/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at,value" \
  -H "apikey: $ANON_KEY" 2>/dev/null || echo "[]")

ts=$(echo "$raw" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['updated_at'] if d else '')" 2>/dev/null || true)
if [[ -z "$ts" ]]; then
  echo "FAIL worker — no _worker_heartbeat row (apply migration 0009 + deploy worker)"
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth objective:"
    ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
  exit 1
fi

age_min=$(python3 -c "
from datetime import datetime, timezone
ts='''$ts'''.replace('Z','+00:00')
t=datetime.fromisoformat(ts)
print(int((datetime.now(timezone.utc)-t).total_seconds()/60))
")

deps=$(echo "$raw" | python3 -c "import sys,json; d=json.load(sys.stdin); print((d[0].get('value') or {}).get('deployments', '?'))" 2>/dev/null || echo "?")

if [[ "$age_min" -le "$MAX_AGE_MIN" ]]; then
  echo "OK   worker — heartbeat ${age_min}m ago · ${deps} active deployments"
  exit 0
fi

echo "FAIL worker — heartbeat stale (${age_min}m ago, max ${MAX_AGE_MIN}m) · last seen $ts"
echo "      Deploy saas/worker on Railway/Fly — docs/FOUNDER_DEPLOY.md §4"
echo "      Recovery: ./scripts/guide-worker-recovery.sh · https://zengtrade.in/ops/worker"
if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
  echo ""
  echo "Growth objective:"
  ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
fi
exit 1
