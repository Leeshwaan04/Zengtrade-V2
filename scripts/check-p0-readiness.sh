#!/usr/bin/env bash
# Pre-flight for ./scripts/apply-p0-autopilot.sh: shows what's ready without printing secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

db_set=0 rail_set=0 rail_db=0 rail_resolved=""
pw_set=0
[[ -n "${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}" ]] && db_set=1
[[ -n "${DATABASE_PASSWORD:-${SUPABASE_DB_PASSWORD:-}}" ]] && pw_set=1
[[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]] && rail_set=1
if [[ $db_set -eq 0 && $rail_set -eq 1 ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/scripts/railway-api.sh" 2>/dev/null || true
  if rail_resolved=$(railway_resolve_database_url 2>/dev/null); then
    rail_db=1
    rail_resolved=$(./scripts/sanitize-database-url.sh "$rail_resolved" 2>/dev/null || echo "$rail_resolved")
  fi
fi

mig=0 work=0
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1

growth_summary_if_blocked() {
  if [[ $work -eq 0 ]]; then
    echo ""
    echo "Growth goal:"
    GROWTH_MIG=$mig GROWTH_WORK=$work GROWTH_DB_AUTH=${db_auth_ok:-0} \
      ./scripts/print-growth-goal-summary-fast.sh 2>/dev/null | sed 's/^/  /' || true
  fi
}

echo "== P0 readiness =="
echo ""
printf "DATABASE_URL in environment     %s\n" "$([[ $db_set -eq 1 ]] && echo '✅ set' || echo '❌ missing')"
printf "DATABASE_PASSWORD in environment %s\n" "$([[ $pw_set -eq 1 ]] && echo '✅ set (agent can auto-fix Railway)' || echo '❌ missing — optional after Supabase reset')"
if [[ $db_set -eq 0 && $rail_db -eq 1 ]]; then
  echo "DATABASE_URL on Railway project  ✅ found (apply-p0 will auto-resolve)"
  if [[ -n "${rail_resolved:-}" ]]; then
    if DATABASE_URL="$rail_resolved" ./scripts/test-database-url.sh >/dev/null 2>&1; then
      printf "Railway DATABASE_URL connection   ✅\n"
    else
      printf "Railway DATABASE_URL connection   ❌ wrong password — Supabase Connect → Reset password → copy URI → Railway Deploy\n"
    fi
  fi
fi
printf "RAILWAY_API_TOKEN in environment %s\n" "$([[ $rail_set -eq 1 ]] && echo '✅ set' || echo '❌ missing')"
if [[ $db_set -eq 1 ]]; then
  if DATABASE_URL="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    printf "DATABASE_URL connection test    ✅\n"
  else
    printf "DATABASE_URL connection test    ❌ (bad URI or network)\n"
  fi
fi
if command -v psql >/dev/null 2>&1; then
  printf "psql client                      ✅ %s\n" "$(psql --version | head -1)"
else
  printf "psql client                      ❌ missing (needed for migration)\n"
fi
echo ""

printf "Migration 0011 (production)     %s\n" "$([[ $mig -eq 1 ]] && echo '✅' || echo '❌')"
printf "Paper worker heartbeat          %s\n" "$([[ $work -eq 1 ]] && echo '✅' || echo '❌')"
if [[ $mig -eq 1 && $work -eq 0 ]]; then
  echo ""
  echo "Migration 0011 done — sole P0 blocker is paper worker (needs DATABASE_URL on Railway)."
fi
echo ""

db_auth_ok=1
if [[ $rail_set -eq 1 ]]; then
  ./scripts/check-railway-deploy.sh 2>/dev/null || true
  echo ""
  if ./scripts/probe-database-auth.sh >/dev/null 2>&1; then
    printf "DATABASE_URL auth (probe)        ✅\n"
  else
    db_auth_ok=0
    printf "DATABASE_URL auth (probe)        ❌ wrong password — /ops/worker\n"
  fi
  echo ""
elif [[ -n "${rail_resolved:-}" ]]; then
  if ! DATABASE_URL="$rail_resolved" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    db_auth_ok=0
  fi
fi

if [[ $mig -eq 1 && $work -eq 1 ]]; then
  echo "P0 already green — run:"
  echo "  ./scripts/post-p0-success.sh"
  echo "  ./scripts/guide-qa-rls-isolation.sh   # after trades visible"
  echo "  ./scripts/audit-growth-goal.sh"
  exit 0
fi

if [[ $db_set -eq 1 && $rail_set -eq 1 ]]; then
  echo "Ready to run: ./scripts/run-p0-if-ready.sh"
  exit 0
fi

if [[ $db_set -eq 0 && $rail_db -eq 1 && $rail_set -eq 1 ]]; then
  if [[ -n "${rail_resolved:-}" ]] && DATABASE_URL="$rail_resolved" ./scripts/test-database-url.sh >/dev/null 2>&1; then
    echo "Ready to run: ./scripts/run-p0-if-ready.sh (DATABASE_URL from Railway)"
    exit 0
  fi
  if [[ -n "${rail_resolved:-}" ]]; then
    echo "BLOCKED: Railway DATABASE_URL password invalid — reset in Supabase, update Railway, Deploy"
    echo "  Fastest: Cloud Agent secret DATABASE_PASSWORD only → ./scripts/run-p0-if-ready.sh"
    echo "  GitHub: Secrets + Apply P0 workflow OR health-watch auto-runs every 6h"
    echo "  Test after fix: ./scripts/validate-database-credentials.sh"
    echo "  Recovery: ./scripts/guide-worker-recovery.sh · docs/WORKER_RECOVERY.md"
    echo "  Parallel work: ./scripts/guide-founder-parallel.sh"
    growth_summary_if_blocked
    exit 1
  fi
fi

echo "Unblock paths:"
if [[ $db_set -eq 0 ]]; then
  echo "  • Fastest: Cloud Agent secret DATABASE_PASSWORD only (after Supabase reset)"
  echo "  • Cloud Agent: full DATABASE_URL + RAILWAY_API_TOKEN"
  echo "  • GitHub Secrets: DATABASE_PASSWORD or DATABASE_URL + RAILWAY_API_TOKEN"
  echo "    → Apply P0 workflow (manual APPLY) OR health-watch (every 6h auto)"
  echo "  • Pooler host: aws-0-ap-northeast-1.pooler.supabase.com (session :5432)"
  echo "  • Railway: fix DATABASE_URL on paper-worker"
  echo "  • Supabase URI: https://supabase.com/dashboard/project/ponvarxeytfcntckczbn/database/settings"
  echo "  • Manual: https://zengtrade.in/ops/worker · ./scripts/guide-worker-recovery.sh"
fi
if [[ $db_set -eq 1 && $rail_set -eq 0 ]]; then
  echo "  • Add RAILWAY_API_TOKEN — migration can run via psql; worker needs Railway"
fi
if [[ -f .github/workflows/apply-p0.yml ]]; then
  echo "  • apply-p0.yml on main ✅"
else
  echo "  • apply-p0.yml missing on main — push workflow to main"
fi
growth_summary_if_blocked
exit 1
