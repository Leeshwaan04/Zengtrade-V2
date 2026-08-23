#!/usr/bin/env bash
# Pre-flight for ./scripts/apply-p0-autopilot.sh — shows what's ready without printing secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

db_set=0 rail_set=0
[[ -n "${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}" ]] && db_set=1
[[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]] && rail_set=1

echo "== P0 readiness =="
echo ""
printf "DATABASE_URL in environment     %s\n" "$([[ $db_set -eq 1 ]] && echo '✅ set' || echo '❌ missing')"
printf "RAILWAY_API_TOKEN in environment %s\n" "$([[ $rail_set -eq 1 ]] && echo '✅ set' || echo '❌ missing')"
if command -v psql >/dev/null 2>&1; then
  printf "psql client                      ✅ %s\n" "$(psql --version | head -1)"
else
  printf "psql client                      ❌ missing (needed for migration)\n"
fi
echo ""

mig=0 work=0
./scripts/check-migrations.sh >/dev/null 2>&1 && mig=1
./scripts/check-worker.sh >/dev/null 2>&1 && work=1
printf "Migration 0011 (production)     %s\n" "$([[ $mig -eq 1 ]] && echo '✅' || echo '❌')"
printf "Paper worker heartbeat          %s\n" "$([[ $work -eq 1 ]] && echo '✅' || echo '❌')"
echo ""

if [[ $rail_set -eq 1 ]]; then
  ./scripts/check-railway-deploy.sh 2>/dev/null || true
  echo ""
fi

if [[ $mig -eq 1 && $work -eq 1 ]]; then
  echo "P0 already green — run ./scripts/post-p0-success.sh"
  exit 0
fi

if [[ $db_set -eq 1 && $rail_set -eq 1 ]]; then
  echo "Ready to run: ./scripts/apply-p0-autopilot.sh"
  exit 0
fi

echo "Unblock paths:"
if [[ $db_set -eq 0 ]]; then
  echo "  • Cloud Agent: add DATABASE_URL (Supabase session pooler :5432)"
  echo "  • GitHub: add DATABASE_URL + RAILWAY_API_TOKEN to repo Secrets → Apply P0 workflow"
  echo "  • Manual: https://zengtrade.in/ops/p0"
fi
if [[ $db_set -eq 1 && $rail_set -eq 0 ]]; then
  echo "  • Add RAILWAY_API_TOKEN — migration can run via psql; worker needs Railway"
fi
if [[ -f .github/workflows/apply-p0.yml ]]; then
  echo "  • apply-p0.yml present on this branch"
else
  echo "  • Merge PR #7 to main for apply-p0.yml GitHub workflow"
fi
if gh api "repos/Leeshwaan04/Zengtrade-V2/contents/.github/workflows/apply-p0.yml?ref=main" >/dev/null 2>&1; then
  echo "  • apply-p0.yml on main ✅"
else
  echo "  • apply-p0.yml on main ❌ — merge PR #7 first"
fi
exit 1
