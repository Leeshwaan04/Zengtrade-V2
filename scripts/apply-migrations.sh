#!/usr/bin/env bash
# Apply pending Supabase migrations in order (paste output into SQL Editor or use psql).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/saas/db/migrations"
echo "-- zengtrade migrations bundle — run against production Postgres"
echo "-- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
for f in "$MIG"/*.sql; do
  echo "-- ========== $(basename "$f") =========="
  cat "$f"
  echo ""
done
