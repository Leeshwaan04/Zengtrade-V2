#!/usr/bin/env bash
# Print the single highest-priority founder action (for standups / issue #4).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mig=0 work=0
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1

# Single-secret path: Railway token without DB blocks full autopilot
if [[ $mig -eq 0 || $work -eq 0 ]]; then
  if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" && -z "${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}" ]]; then
    rail_db=0
    # shellcheck source=/dev/null
    source "$ROOT/scripts/railway-api.sh" 2>/dev/null || true
    railway_resolve_database_url >/dev/null 2>&1 && rail_db=1

    if [[ $rail_db -eq 1 ]]; then
      resolved=$(railway_resolve_database_url 2>/dev/null || true)
      if [[ -n "${resolved:-}" ]]; then
        resolved=$(./scripts/sanitize-database-url.sh "$resolved" 2>/dev/null || echo "$resolved")
        if DATABASE_URL="$resolved" ./scripts/test-database-url.sh >/dev/null 2>&1; then
          echo "NEXT: DATABASE_URL found on Railway — run ./scripts/run-p0-if-ready.sh"
        else
          echo "NEXT: Railway DATABASE_URL password invalid — reset in Supabase Connect"
          echo "     → copy Session URI (port 5432, no [brackets]) → Railway paper-worker → Deploy"
          echo "     Or add Cloud Agent secret DATABASE_PASSWORD only"
          echo "     Or GitHub Secrets → health-watch auto-runs every 6h"
          echo "     Guide: https://zengtrade.in/ops/worker · ./scripts/guide-worker-recovery.sh"
          echo ""
          ./scripts/founder-parallel-work.sh 2>/dev/null || true
        fi
      else
        echo "NEXT: DATABASE_URL found on Railway — run ./scripts/run-p0-if-ready.sh"
      fi
      exit 1
    fi

    echo "NEXT: Add DATABASE_URL (Supabase session pooler :5432)"
    if [[ $mig -eq 1 ]]; then
      echo "     Migration 0011 ✅ — worker only: https://railway.app/project/f5902ffd-5b3f-49ed-b87d-dad21568185b"
    fi
    echo "     Cloud Agent secrets → ./scripts/run-p0-if-ready.sh"
    echo "     OR Railway paper-worker variables (agent auto-resolves)"
    echo "     OR GitHub repo Secrets → Apply P0 workflow"
    echo "     Manual: https://zengtrade.in/ops/p0"
    echo "     Supabase URI: https://supabase.com/dashboard/project/ponvarxeytfcntckczbn/database/settings"
    exit 1
  fi
fi

if [[ $mig -eq 0 ]]; then
  echo "NEXT: Apply migration 0011 → https://zengtrade.in/ops/migrate"
  exit 1
fi
if [[ $work -eq 0 ]]; then
  echo "NEXT: Deploy paper worker → https://zengtrade.in/ops/worker"
  echo "     CLI: ./scripts/guide-worker-recovery.sh"
  echo ""
  ./scripts/founder-parallel-work.sh 2>/dev/null || true
  if ./scripts/check-founder-parallel-ready.sh >/dev/null 2>&1; then
    echo ""
    echo "Founder parallel probes green — sole blocker is DATABASE_PASSWORD"
    echo "Founder playbook: ./scripts/guide-founder-parallel.sh"
  elif ./scripts/check-parallel-growth.sh >/dev/null 2>&1; then
    echo ""
    echo "Parallel growth gates green (5/5 excl. worker) — sole blocker is DATABASE_PASSWORD"
    echo "Founder playbook: ./scripts/guide-founder-parallel.sh"
  fi
  exit 1
fi

echo "NEXT: P0 green — run ./scripts/wait-for-p0.sh then E2E https://zengtrade.in/ops/e2e"
exit 0
