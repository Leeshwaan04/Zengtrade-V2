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
