#!/usr/bin/env bash
# Post-P0 activation checks — run after migration 0011 + worker are live.
# Partial (worker blocked): ./scripts/verify-activation-path.sh --partial
# Exit 0 only when production loop is ready for signup → deploy → trades E2E.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--partial" ]]; then
  echo "== Partial activation path (signup → deploy, no trades) =="
  ./scripts/check-migrations.sh
  echo ""
  export SITE="${SITE:-https://zengtrade.in}"
  SITE="$SITE" ./scripts/check-activation-ready.sh
  echo ""

  if ./scripts/check-worker.sh >/dev/null 2>&1; then
    echo "Worker is live — run full path: ./scripts/verify-activation-path.sh"
    echo "Manual E2E: $SITE/ops/e2e"
    exit 0
  fi

  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/event' \
    -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' \
    -H 'Content-Type: application/json' \
    -H 'Prefer: return=minimal' \
    -d '{"name":"deploy_success","path":"/activation-verify-partial"}')
  if [[ "$code" != "201" ]]; then
    echo "FAIL deploy_success event blocked (HTTP $code)"
    exit 1
  fi
  echo "OK   deploy_success event accepted"
  echo ""
  echo "Partial activation green — manual E2E steps 1–2: https://zengtrade.in/ops/e2e"
  echo "View evidence: post-deploy hint or worker-offline banner → $SITE/app#forward"
  echo "Trades (steps 3–4) blocked until worker: https://zengtrade.in/ops/worker"
  if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
    echo ""
    echo "Growth objective:"
    GROWTH_PARTIAL=1 GROWTH_MIG=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
  exit 0
fi

echo "== P0 gates =="
SITE=https://zengtrade.in ./scripts/check-production.sh
./scripts/verify-billing.sh
./scripts/check-migrations.sh
./scripts/check-worker.sh

echo ""
echo "== funnel v2 events =="
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/event' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=minimal' \
  -d '{"name":"deploy_success","path":"/activation-verify"}')
if [[ "$code" != "201" ]]; then
  echo "FAIL deploy_success event blocked (HTTP $code)"
  exit 1
fi
echo "OK   deploy_success event accepted"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/event' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1' \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=minimal' \
  -d '{"name":"checkout_click","path":"/activation-verify"}')
if [[ "$code" != "201" ]]; then
  echo "FAIL checkout_click event blocked (HTTP $code)"
  exit 1
fi
echo "OK   checkout_click event accepted (CBO MRR funnel)"

echo ""
echo "== worker heartbeat detail =="
hb=$(curl -sfL 'https://ponvarxeytfcntckczbn.supabase.co/rest/v1/engine_state?key=eq._worker_heartbeat&select=updated_at,value' \
  -H 'apikey: sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1')
echo "$hb" | python3 -c "
import sys, json
from datetime import datetime, timezone
rows = json.load(sys.stdin)
if not rows:
    raise SystemExit('FAIL no heartbeat row')
row = rows[0]
age = (datetime.now(timezone.utc) - datetime.fromisoformat(row['updated_at'].replace('Z','+00:00'))).total_seconds() / 60
deps = (row.get('value') or {}).get('deployments', 0)
print(f'OK   heartbeat {age:.0f}m ago · {deps} active paper deployments')
if age > 12:
    raise SystemExit('FAIL heartbeat stale')
"

echo ""
echo "All activation-path gates green — run manual E2E:"
echo "  https://zengtrade.in/login?mode=signup → /dashboard deploy → /app#forward"
