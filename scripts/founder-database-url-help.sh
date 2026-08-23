#!/usr/bin/env bash
# Print founder instructions for DATABASE_URL (no secrets). Run when P0 is blocked.
set -euo pipefail

echo "== zengtrade DATABASE_URL setup =="
echo ""
echo "This project uses Supabase pooler host:"
echo "  aws-0-ap-northeast-1.pooler.supabase.com"
echo ""
echo "1. Open: https://supabase.com/dashboard/project/ponvarxeytfcntckczbn/database/settings"
echo "   (or click Connect on the project home — NOT Connection pooling pool-size settings)"
echo "2. Connection string → URI → Session mode → port 5432"
echo "3. Copy the FULL URI (starts with postgresql://postgres.ponvarxeytfcntckczbn:...)"
echo "4. Or add Cloud Agent secret DATABASE_PASSWORD (database password only) — agent builds URI"
echo "5. Or GitHub repo Secrets: DATABASE_PASSWORD + RAILWAY_API_TOKEN → Apply P0 workflow"
echo ""
echo "Verify (after secret is set):"
echo "  ./scripts/validate-database-credentials.sh"
echo "  ./scripts/run-p0-if-ready.sh"
echo ""
echo "Manual migration (no DATABASE_URL): https://zengtrade.in/ops/migrate"
echo "  → Supabase SQL Editor → paste SQL → Run → Verify"
