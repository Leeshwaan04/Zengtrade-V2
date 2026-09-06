#!/usr/bin/env bash
# Probe which Supabase migrations are applied (via public REST + RLS behavior).
set -euo pipefail
SUPABASE_URL="${SUPABASE_URL:-https://ponvarxeytfcntckczbn.supabase.co}"
ANON_KEY="${ANON_KEY:-sb_publishable_w-pQMK0bj-91EPHXtA0sMQ__CTu_rf1}"
fail=0

probe_event() {
  local name="$1" label="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SUPABASE_URL/rest/v1/event" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"name\":\"$name\",\"path\":\"/migration-probe\"}" 2>/dev/null || echo "000")
  if [[ "$code" == "201" ]]; then
    echo "OK   $label — event '$name' allowed"
  else
    echo "FAIL $label — event '$name' blocked (HTTP $code); run migration SQL"
    fail=1
  fi
}

# 0008: base funnel events
probe_event "signup_view" "0008_admin_portal"

# 0011: extended funnel events (signup + deploy + checkout attribution)
probe_event "signup_complete" "0011_funnel_events_v2"
probe_event "deploy_click" "0008_deploy_click"
probe_event "deploy_success" "0011_deploy_success"
probe_event "checkout_click" "0011_checkout_click"

# 0009: engine_state readable
if curl -sfL "$SUPABASE_URL/rest/v1/engine_state?key=eq._worker_heartbeat&select=key" \
  -H "apikey: $ANON_KEY" | grep -q '_worker_heartbeat'; then
  echo "OK   0009_engine_state — engine_state readable"
else
  echo "FAIL 0009_engine_state — no heartbeat row"
  fail=1
fi

# 0010: admin RPC exists (returns null without auth, not 404)
rpc_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SUPABASE_URL/rest/v1/rpc/admin_overview" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [[ "$rpc_code" == "200" || "$rpc_code" == "401" ]]; then
  echo "OK   0010_admin_rpc_funnel — admin_overview RPC exists"
else
  echo "FAIL 0010_admin_rpc_funnel — admin_overview HTTP $rpc_code (404 = not applied)"
  fail=1
fi

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "Apply pending migrations (likely 0011 only):"
  echo "  ./scripts/migrate-0011-only.sh"
  exit 1
fi
echo "All migration probes passed."
if [[ -z "${ZT_QUIET_GROWTH:-}" ]]; then
  echo ""
  echo "Growth objective:"
  GROWTH_MIG=1 ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
fi
