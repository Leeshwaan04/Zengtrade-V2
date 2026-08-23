#!/usr/bin/env bash
# Test Postgres credentials before Railway deploy (no secrets printed).
# Resolves DATABASE_URL from env, DATABASE_PASSWORD, or Railway — then runs psql probe.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== zengtrade database credentials =="
echo ""

if resolved=$(./scripts/resolve-database-url.sh 2>/dev/null); then
  if DATABASE_URL="$resolved" ./scripts/test-database-url.sh; then
    echo ""
    echo "Ready: ./scripts/run-p0-if-ready.sh"
    exit 0
  fi
fi

# Railway has DATABASE_URL but password wrong (common P0 blocker)
if [[ -n "${RAILWAY_API_TOKEN:-${RAILWAY_TOKEN:-}}" ]]; then
  # shellcheck source=/dev/null
  source "$ROOT/scripts/railway-api.sh" 2>/dev/null || true
  if rail_uri=$(railway_resolve_database_url 2>/dev/null); then
    rail_uri=$(./scripts/sanitize-database-url.sh "$rail_uri" 2>/dev/null || echo "$rail_uri")
    if ! DATABASE_URL="$rail_uri" ./scripts/test-database-url.sh >/dev/null 2>&1; then
      echo "BLOCKED: Railway DATABASE_URL password invalid (deploy likely FAILED)."
      echo "  → Fastest: Cloud Agent secret DATABASE_PASSWORD only → ./scripts/run-p0-if-ready.sh"
      echo "  → GitHub Secrets + Apply P0 OR health-watch (every 6h auto)"
      echo "  → Manual: ./scripts/guide-worker-recovery.sh · https://zengtrade.in/ops/worker"
      echo ""
      ./scripts/check-railway-deploy.sh 2>/dev/null | head -5 || true
      echo ""
      ./scripts/founder-parallel-work.sh 2>/dev/null || true
      exit 1
    fi
  fi
fi

if [[ -n "${DATABASE_PASSWORD:-${SUPABASE_DB_PASSWORD:-}}" ]]; then
  echo "BLOCKED: DATABASE_PASSWORD is set but Postgres auth still fails."
  echo "  → Reset password in Supabase Connect and update the secret"
  echo "  → Then: ./scripts/run-p0-if-ready.sh"
  echo ""
  ./scripts/founder-parallel-work.sh 2>/dev/null || true
  exit 1
fi

# Explicit env URL (resolve skips invalid Railway URIs)
url="${DATABASE_URL:-${SUPABASE_DATABASE_URL:-}}"
if [[ -n "$url" ]]; then
  if DATABASE_URL="$url" ./scripts/test-database-url.sh; then
    echo ""
    echo "Ready: ./scripts/run-p0-if-ready.sh"
    exit 0
  fi
  echo ""
  echo "BLOCKED: DATABASE_URL is set but Postgres auth failed."
  echo "  → Fastest: Cloud Agent secret DATABASE_PASSWORD only (after Supabase reset)"
  echo "  → Or reset password in Supabase Connect → copy Session URI (5432, no [brackets])"
  echo "  → Update Railway paper-worker or Cloud Agent DATABASE_PASSWORD secret"
  echo "  → Or GitHub Secrets: DATABASE_PASSWORD + RAILWAY_API_TOKEN → Apply P0 workflow"
  echo "  → Deploy on Railway"
  echo "  → Guide: https://zengtrade.in/ops/worker · docs/WORKER_RECOVERY.md"
  echo ""
  ./scripts/founder-parallel-work.sh 2>/dev/null || true
  exit 1
fi

echo "No working DATABASE_URL found."
echo ""
./scripts/founder-database-url-help.sh
echo ""
./scripts/founder-parallel-work.sh 2>/dev/null || true
exit 1
