#!/usr/bin/env bash
# Print founder instructions for DATABASE_URL (no secrets). Run when P0 is blocked.
set -euo pipefail

echo "== zengtrade DATABASE_URL setup =="
echo ""
echo "This project uses Supabase pooler host:"
echo "  aws-0-ap-northeast-1.pooler.supabase.com"
echo ""
echo "1. Open: https://supabase.com/dashboard/project/ponvarxeytfcntckczbn/database/settings"
echo "2. Connection string → URI → Session mode → port 5432"
echo "3. Copy the FULL URI (starts with postgresql://postgres.ponvarxeytfcntckczbn:...)"
echo "4. Add to Cloud Agent secret DATABASE_URL (not sb_secret API key)"
echo ""
echo "Verify (after secret is set):"
echo "  ./scripts/test-database-url.sh"
echo "  ./scripts/run-p0-if-ready.sh"
echo ""
echo "Manual migration (no DATABASE_URL): https://zengtrade.in/ops/migrate"
echo "  → Supabase SQL Editor → paste SQL → Run → Verify"
