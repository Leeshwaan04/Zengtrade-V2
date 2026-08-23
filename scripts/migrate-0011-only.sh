#!/usr/bin/env bash
# Print ONLY migration 0011 for quick Supabase SQL Editor paste.
set -euo pipefail
cat "$(cd "$(dirname "$0")/.." && pwd)/saas/db/migrations/0011_funnel_events_v2.sql"
echo ""
echo "-- Paste above into Supabase → SQL Editor → Run"
echo "-- Verify: ./scripts/check-migrations.sh"
