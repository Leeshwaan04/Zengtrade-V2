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

    if command -v gh >/dev/null 2>&1 && ! gh api "repos/Leeshwaan04/Zengtrade-V2/contents/.github/workflows/apply-p0.yml?ref=main" >/dev/null 2>&1; then
      echo "NEXT: Merge PR #7 to main — enables GitHub Apply P0 workflow"
      echo "     https://github.com/Leeshwaan04/Zengtrade-V2/pull/7"
      echo ""
    fi

    if [[ $rail_db -eq 1 ]]; then
      echo "NEXT: DATABASE_URL found on Railway — run ./scripts/apply-p0-autopilot.sh"
      exit 1
    fi

    echo "NEXT: Add DATABASE_URL (Supabase session pooler :5432)"
    echo "     Cloud Agent secrets → ./scripts/apply-p0-autopilot.sh"
    echo "     OR Railway paper-worker variables (agent auto-resolves)"
    echo "     OR GitHub repo Secrets → Apply P0 workflow (after PR #7 merge)"
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
  exit 1
fi

echo "NEXT: P0 green — run ./scripts/wait-for-p0.sh then E2E https://zengtrade.in/ops/e2e"
exit 0
